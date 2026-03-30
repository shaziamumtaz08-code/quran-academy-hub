import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Calendar, CalendarDays, Clock, User, ChevronDown, ChevronRight, Loader2, AlertCircle, Globe, Pencil, Trash2, Upload, ArrowUpDown, ArrowUp, ArrowDown, Search, X, List } from 'lucide-react';
import { MonthlyCalendarView } from '@/components/schedules/MonthlyCalendarView';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { format } from 'date-fns';
import { BulkScheduleImportDialog } from '@/components/schedules/BulkScheduleImportDialog';
import { TIMEZONES_SORTED as TIMEZONES, getTimezoneAbbr, convertTimeBetweenTimezones, convertTimeBetweenTimezonesWithDay, formatTime12h as formatTime12hShared } from '@/lib/timezones';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAYS_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const getTzAbbr = (tzValue: string | null) => {
  return getTimezoneAbbr(tzValue);
};

// Country code abbreviations for timezone display
const COUNTRY_CODES: Record<string, string> = {
  Pakistan: 'PK',
  Canada: 'CA',
  USA: 'US',
  'United States': 'US',
  'United States of America': 'US',
  UK: 'UK',
  'United Kingdom': 'UK',
  UAE: 'AE',
  'United Arab Emirates': 'AE',
  'Saudi Arabia': 'SA',
  India: 'IN',
  Australia: 'AU',
  Bangladesh: 'BD',
  'Sri Lanka': 'LK',
  Egypt: 'EG',
  Qatar: 'QA',
  Kuwait: 'KW',
  Bahrain: 'BH',
  Oman: 'OM',
  Jordan: 'JO',
  Malaysia: 'MY',
  Singapore: 'SG',
  Indonesia: 'ID',
  Turkey: 'TR',
  'South Africa': 'ZA',
  Nigeria: 'NG',
  Kenya: 'KE',
  Germany: 'DE',
  France: 'FR',
  'New Zealand': 'NZ',
};

const getCountryCode = (country: string | null | undefined) => {
  const c = country || 'Pakistan';
  // Exact match first, then try case-insensitive
  if (COUNTRY_CODES[c]) return COUNTRY_CODES[c];
  const lower = c.toLowerCase();
  for (const [key, val] of Object.entries(COUNTRY_CODES)) {
    if (key.toLowerCase() === lower) return val;
  }
  // Fallback: ISO-style 2-char from first word
  return c.slice(0, 2).toUpperCase();
};

type AssignmentStatus = 'active' | 'paused' | 'completed';

interface Assignment {
  id: string;
  teacher_id: string;
  student_id: string;
  status: AssignmentStatus;
  teacher_name: string;
  student_name: string;
  subject_name: string | null;
  student_timezone: string | null;
  teacher_timezone: string | null;
  student_country: string | null;
  student_city: string | null;
  teacher_country: string | null;
  teacher_city: string | null;
}

interface Schedule {
  id: string;
  assignment_id: string;
  day_of_week: string;
  student_local_time: string;
  teacher_local_time: string;
  duration_minutes: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Helper to calculate teacher time from student time based on timezone offsets
function calculateTeacherTime(studentTime: string, studentTz: string, teacherTz: string): string {
  return convertTimeBetweenTimezones(studentTime, studentTz, teacherTz);
}

// Helper to calculate student time from teacher time based on timezone offsets
function calculateStudentTime(teacherTime: string, studentTz: string, teacherTz: string): string {
  return convertTimeBetweenTimezones(teacherTime, teacherTz, studentTz);
}

function formatTime12h(time: string): string {
  return formatTime12hShared(time);
}

// Convert time string to minutes from midnight for comparison
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Check if two time ranges overlap
function timesOverlap(
  start1: string, duration1: number,
  start2: string, duration2: number
): boolean {
  const t1Start = timeToMinutes(start1);
  const t1End = t1Start + duration1;
  const t2Start = timeToMinutes(start2);
  const t2End = t2Start + duration2;
  return t1Start < t2End && t2Start < t1End;
}

interface ConflictResult {
  hasConflict: boolean;
  conflictType: 'student' | null;
  conflictDetails: string;
}

// Detect schedule conflicts
// NOTE: Teachers CAN have multiple students at the same time - only students are restricted to one teacher
function detectScheduleConflict(
  newSchedule: {
    day: string;
    studentTime: string;
    duration: number;
    assignmentId: string;
  },
  assignments: Assignment[],
  schedules: Schedule[],
  editingScheduleId?: string
): ConflictResult {
  const assignment = assignments.find(a => a.id === newSchedule.assignmentId);
  if (!assignment) return { hasConflict: false, conflictType: null, conflictDetails: '' };

  const studentId = assignment.student_id;

  // Get all schedules for the same day, excluding the one being edited
  const sameDaySchedules = schedules.filter(
    s => s.day_of_week === newSchedule.day && s.id !== editingScheduleId
  );

  for (const existingSchedule of sameDaySchedules) {
    const existingAssignment = assignments.find(a => a.id === existingSchedule.assignment_id);
    if (!existingAssignment) continue;

    // Check for time overlap
    const hasOverlap = timesOverlap(
      newSchedule.studentTime,
      newSchedule.duration,
      existingSchedule.student_local_time,
      existingSchedule.duration_minutes
    );

    if (!hasOverlap) continue;

    // Only check if same student (students can only have one teacher at a time)
    // Teachers CAN have multiple students at the same time - no conflict check needed
    if (existingAssignment.student_id === studentId) {
      return {
        hasConflict: true,
        conflictType: 'student',
        conflictDetails: `${assignment.student_name} already has a class with ${existingAssignment.teacher_name} at ${formatTime12h(existingSchedule.student_local_time)} on ${DAYS_LABELS[newSchedule.day]}`,
      };
    }
  }

  return { hasConflict: false, conflictType: null, conflictDetails: '' };
}

export default function Schedules() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(new Set());
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleteSchedule, setDeleteSchedule] = useState<Schedule | null>(null);
  const [calendarTimeView, setCalendarTimeView] = useState<Record<string, 'student' | 'teacher'>>({});
  
  // Filtering state
  const [filterTeacher, setFilterTeacher] = useState<string>('');
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>(''); // 'scheduled' | 'not_scheduled' | ''
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAllDivisions, setShowAllDivisions] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
  // Sorting state
  type ScheduleSortField = 'student' | 'teacher' | 'subject' | 'status' | 'classes';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<ScheduleSortField>('student');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const handleSort = (field: ScheduleSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const getSortIcon = (field: ScheduleSortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };
  
  const [newSchedule, setNewSchedule] = useState({
    assignmentId: '',
    day: '',
    studentTime: '',
    teacherTime: '',
    studentTimezone: '',
    teacherTimezone: '',
    duration: '30',
    customDuration: '',
  });
  // Track which field was last edited for bidirectional sync
  const [lastEditedField, setLastEditedField] = useState<'student' | 'teacher'>('student');
  // Bulk schedule state
  const [bulkSchedule, setBulkSchedule] = useState({
    assignmentId: '',
    selectedDays: [] as string[],
    studentTime: '',
    teacherTime: '',
    studentTimezone: '',
    teacherTimezone: '',
    duration: '30',
    customDuration: '',
  });
  const [bulkLastEditedField, setBulkLastEditedField] = useState<'student' | 'teacher'>('student');

  // Helper to get effective duration value
  const getEffectiveDuration = (duration: string, customDuration: string): number => {
    if (duration === 'custom') {
      const val = parseInt(customDuration);
      return isNaN(val) ? 30 : Math.min(180, Math.max(5, val));
    }
    return parseInt(duration);
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeDivision } = useDivision();

  const todayDayName = format(new Date(), 'EEEE').toLowerCase();

  // Fetch assignments with timezone info (only active assignments for scheduling)
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['assignments-with-tz', activeDivision?.id, showAllDivisions],
    queryFn: async () => {
      let query = supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          teacher_id,
          student_id,
          status,
          division_id,
          student_timezone,
          teacher_timezone,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name, country, city),
          student:profiles!student_teacher_assignments_student_id_fkey(full_name, country, city),
          subject:subjects(name)
        `)
        .eq('status', 'active');

      if (!showAllDivisions && activeDivision?.id) {
        query = query.eq('division_id', activeDivision.id);
      }

      const { data, error } = await query;
      return (data || []).map((row: any) => ({
        id: row.id,
        teacher_id: row.teacher_id,
        student_id: row.student_id,
        status: row.status || 'active',
        teacher_name: row.teacher?.full_name || 'Unknown',
        student_name: row.student?.full_name || 'Unknown',
        subject_name: row.subject?.name || null,
        student_timezone: row.student_timezone,
        teacher_timezone: row.teacher_timezone,
        student_country: row.student?.country || null,
        student_city: row.student?.city || null,
        teacher_country: row.teacher?.country || null,
        teacher_city: row.teacher?.city || null,
      })) as Assignment[];
    },
  });

  // Fetch schedules (1:1 only — exclude group/course schedules)
  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['class-schedules', activeDivision?.id, showAllDivisions],
    queryFn: async () => {
      let query = supabase
        .from('schedules')
        .select('*')
        .eq('is_active', true)
        .not('assignment_id', 'is', null);

      if (!showAllDivisions && activeDivision?.id) {
        query = query.or(`division_id.eq.${activeDivision.id},division_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Schedule[];
    },
  });

  // Fetch location→timezone mappings
  const { data: timezoneMappings = [] } = useQuery({
    queryKey: ['timezone-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timezone_mappings')
        .select('country, city, timezone');
      if (error) throw error;
      return (data || []) as { country: string; city: string; timezone: string }[];
    },
  });

  const tzByLocation = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of timezoneMappings) m.set(`${r.country}|${r.city}`, r.timezone);
    return m;
  }, [timezoneMappings]);

  // Common country → IANA timezone fallbacks (used when no city match in DB)
  const COUNTRY_TZ_FALLBACKS: Record<string, string> = {
    'United Arab Emirates': 'Asia/Dubai',
    'UAE': 'Asia/Dubai',
    'Pakistan': 'Asia/Karachi',
    'India': 'Asia/Kolkata',
    'Saudi Arabia': 'Asia/Riyadh',
    'USA': 'America/New_York',
    'United States': 'America/New_York',
    'United States of America': 'America/New_York',
    'Canada': 'America/Toronto',
    'UK': 'Europe/London',
    'United Kingdom': 'Europe/London',
    'Australia': 'Australia/Sydney',
    'Bangladesh': 'Asia/Dhaka',
    'Sri Lanka': 'Asia/Colombo',
    'Qatar': 'Asia/Qatar',
    'Kuwait': 'Asia/Kuwait',
    'Bahrain': 'Asia/Bahrain',
    'Egypt': 'Africa/Cairo',
    'Malaysia': 'Asia/Kuala_Lumpur',
    'Singapore': 'Asia/Singapore',
    'Turkey': 'Europe/Istanbul',
    'South Africa': 'Africa/Johannesburg',
    'New Zealand': 'Pacific/Auckland',
    'Germany': 'Europe/Berlin',
    'France': 'Europe/Paris',
  };

  const resolveTimezone = (
    country: string | null | undefined,
    city: string | null | undefined,
    fallback: string | null | undefined
  ) => {
    // 1. Try exact country+city match from DB
    if (country && city) {
      const tz = tzByLocation.get(`${country}|${city}`);
      if (tz) return tz;
    }
    // 2. Try the stored IANA fallback from assignment (if it looks like IANA)
    if (fallback && fallback.includes('/')) return fallback;
    // 3. Country-level IANA fallback
    if (country) {
      const countryTz = COUNTRY_TZ_FALLBACKS[country];
      if (countryTz) return countryTz;
      // Case-insensitive lookup
      const lower = country.toLowerCase();
      for (const [k, v] of Object.entries(COUNTRY_TZ_FALLBACKS)) {
        if (k.toLowerCase() === lower) return v;
      }
    }
    return fallback || 'Asia/Karachi';
  };

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: {
      assignment_id: string;
      day_of_week: string;
      student_local_time: string;
      teacher_local_time: string;
      duration_minutes: number;
    }) => {
      const { error } = await supabase.from('schedules').insert(scheduleData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
      toast({ title: 'Success', description: 'Schedule created successfully' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      const msg = error.message || 'Failed to create schedule';
      const friendlyMsg = msg.includes('schedules_assignment_day_unique') 
        ? 'This student already has a schedule for this day. Please edit the existing one or choose a different day.'
        : msg.includes('Schedule conflict')
        ? msg
        : msg;
      toast({ title: 'Error', description: friendlyMsg, variant: 'destructive' });
    },
  });

  // Bulk create schedule mutation
  const bulkCreateScheduleMutation = useMutation({
    mutationFn: async (schedulesData: Array<{
      assignment_id: string;
      day_of_week: string;
      student_local_time: string;
      teacher_local_time: string;
      duration_minutes: number;
    }>) => {
      const { error } = await supabase.from('schedules').insert(schedulesData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
      toast({ title: 'Success', description: 'Schedules created successfully' });
      handleCloseBulkDialog();
    },
    onError: (error: any) => {
      const msg = error.message || 'Failed to create schedules';
      const friendlyMsg = msg.includes('schedules_assignment_day_unique') 
        ? 'A schedule already exists for one of the selected days. Please edit the existing schedule instead.'
        : msg;
      toast({ title: 'Error', description: friendlyMsg, variant: 'destructive' });
    },
  });

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, ...scheduleData }: {
      id: string;
      day_of_week: string;
      student_local_time: string;
      teacher_local_time: string;
      duration_minutes: number;
    }) => {
      const { error } = await supabase.from('schedules').update(scheduleData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
      toast({ title: 'Success', description: 'Schedule updated successfully' });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase.from('schedules').delete().eq('id', scheduleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
      toast({ title: 'Deleted', description: 'Schedule deleted successfully' });
      setDeleteSchedule(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getSchedulesForAssignment = (assignmentId: string) => {
    const list = schedules.filter(s => s.assignment_id === assignmentId);

    // Deduplicate in case multiple schedules exist for the same day
    // (we keep the most recently updated/created one).
    const byDay = new Map<string, Schedule>();
    for (const s of list) {
      const dayKey = (s.day_of_week || '').toLowerCase();
      const existing = byDay.get(dayKey);

      if (!existing) {
        byDay.set(dayKey, { ...s, day_of_week: dayKey });
        continue;
      }

      const existingTs = existing.updated_at ?? existing.created_at ?? '';
      const candidateTs = s.updated_at ?? s.created_at ?? '';

      if (candidateTs >= existingTs) {
        byDay.set(dayKey, { ...s, day_of_week: dayKey });
      }
    }

    return DAYS_OF_WEEK.map(day => byDay.get(day)).filter(Boolean) as Schedule[];
  };

  const toggleExpanded = (assignmentId: string) => {
    setExpandedAssignments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assignmentId)) {
        newSet.delete(assignmentId);
      } else {
        newSet.add(assignmentId);
      }
      return newSet;
    });
  };

  // Get unique teachers and subjects for filter dropdowns
  const availableTeachers = useMemo(() => {
    const teachers = new Map<string, string>();
    assignments.forEach(a => {
      teachers.set(a.teacher_id, a.teacher_name);
    });
    return Array.from(teachers.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments]);

  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    assignments.forEach(a => {
      if (a.subject_name) subjects.add(a.subject_name);
    });
    return Array.from(subjects).sort();
  }, [assignments]);

  // Filter and sort assignments
  const filteredAssignments = useMemo(() => {
    return assignments
      .filter(assignment => {
        const assignmentSchedules = schedules.filter(s => s.assignment_id === assignment.id);
        const isScheduled = assignmentSchedules.length > 0;
        
        // Search term filter (student or teacher name)
        const matchesSearch = !searchTerm || 
          assignment.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          assignment.teacher_name.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Teacher filter
        const matchesTeacher = !filterTeacher || assignment.teacher_id === filterTeacher;
        
        // Subject filter
        const matchesSubject = !filterSubject || assignment.subject_name === filterSubject;
        
        // Status filter
        const matchesStatus = !filterStatus || 
          (filterStatus === 'scheduled' && isScheduled) ||
          (filterStatus === 'not_scheduled' && !isScheduled);
        
        return matchesSearch && matchesTeacher && matchesSubject && matchesStatus;
      })
      .sort((a, b) => {
        const aSchedules = schedules.filter(s => s.assignment_id === a.id);
        const bSchedules = schedules.filter(s => s.assignment_id === b.id);
        
        let comparison = 0;
        switch (sortField) {
          case 'student':
            comparison = a.student_name.localeCompare(b.student_name);
            break;
          case 'teacher':
            comparison = a.teacher_name.localeCompare(b.teacher_name);
            break;
          case 'subject':
            comparison = (a.subject_name || '').localeCompare(b.subject_name || '');
            break;
          case 'status':
            comparison = (aSchedules.length > 0 ? 1 : 0) - (bSchedules.length > 0 ? 1 : 0);
            break;
          case 'classes':
            comparison = aSchedules.length - bSchedules.length;
            break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [assignments, schedules, searchTerm, filterTeacher, filterSubject, filterStatus, sortField, sortDirection]);

  const hasActiveFilters = !!filterTeacher || !!filterSubject || !!filterStatus || !!searchTerm || showAllDivisions;

  const resetFilters = () => {
    setFilterTeacher('');
    setFilterSubject('');
    setFilterStatus('');
    setSearchTerm('');
    setShowAllDivisions(false);
  };

  // Get selected assignment info for displaying location labels
  const selectedAssignment = useMemo(() => {
    return assignments.find(a => a.id === newSchedule.assignmentId);
  }, [assignments, newSchedule.assignmentId]);

  const bulkSelectedAssignment = useMemo(() => {
    return assignments.find(a => a.id === bulkSchedule.assignmentId);
  }, [assignments, bulkSchedule.assignmentId]);

  // Handlers for student time change - update teacher time
  const handleStudentTimeChange = (time: string) => {
    const teacherTime = time ? calculateTeacherTime(time, newSchedule.studentTimezone, newSchedule.teacherTimezone) : '';
    setNewSchedule(prev => ({ ...prev, studentTime: time, teacherTime }));
    setLastEditedField('student');
  };

  // Handlers for teacher time change - update student time
  const handleTeacherTimeChange = (time: string) => {
    const studentTime = time ? calculateStudentTime(time, newSchedule.studentTimezone, newSchedule.teacherTimezone) : '';
    setNewSchedule(prev => ({ ...prev, teacherTime: time, studentTime }));
    setLastEditedField('teacher');
  };

  // Handlers for timezone change - recalculate opposite time
  const handleStudentTimezoneChange = (tz: string) => {
    setNewSchedule(prev => {
      if (lastEditedField === 'student' && prev.studentTime) {
        const teacherTime = calculateTeacherTime(prev.studentTime, tz, prev.teacherTimezone);
        return { ...prev, studentTimezone: tz, teacherTime };
      } else if (lastEditedField === 'teacher' && prev.teacherTime) {
        const studentTime = calculateStudentTime(prev.teacherTime, tz, prev.teacherTimezone);
        return { ...prev, studentTimezone: tz, studentTime };
      }
      return { ...prev, studentTimezone: tz };
    });
  };

  const handleTeacherTimezoneChange = (tz: string) => {
    setNewSchedule(prev => {
      if (lastEditedField === 'student' && prev.studentTime) {
        const teacherTime = calculateTeacherTime(prev.studentTime, prev.studentTimezone, tz);
        return { ...prev, teacherTimezone: tz, teacherTime };
      } else if (lastEditedField === 'teacher' && prev.teacherTime) {
        const studentTime = calculateStudentTime(prev.teacherTime, prev.studentTimezone, tz);
        return { ...prev, teacherTimezone: tz, studentTime };
      }
      return { ...prev, teacherTimezone: tz };
    });
  };

  // Bulk handlers
  const handleBulkStudentTimeChange = (time: string) => {
    const teacherTime = time ? calculateTeacherTime(time, bulkSchedule.studentTimezone, bulkSchedule.teacherTimezone) : '';
    setBulkSchedule(prev => ({ ...prev, studentTime: time, teacherTime }));
    setBulkLastEditedField('student');
  };

  const handleBulkTeacherTimeChange = (time: string) => {
    const studentTime = time ? calculateStudentTime(time, bulkSchedule.studentTimezone, bulkSchedule.teacherTimezone) : '';
    setBulkSchedule(prev => ({ ...prev, teacherTime: time, studentTime }));
    setBulkLastEditedField('teacher');
  };

  const handleBulkStudentTimezoneChange = (tz: string) => {
    setBulkSchedule(prev => {
      if (bulkLastEditedField === 'student' && prev.studentTime) {
        const teacherTime = calculateTeacherTime(prev.studentTime, tz, prev.teacherTimezone);
        return { ...prev, studentTimezone: tz, teacherTime };
      } else if (bulkLastEditedField === 'teacher' && prev.teacherTime) {
        const studentTime = calculateStudentTime(prev.teacherTime, tz, prev.teacherTimezone);
        return { ...prev, studentTimezone: tz, studentTime };
      }
      return { ...prev, studentTimezone: tz };
    });
  };

  const handleBulkTeacherTimezoneChange = (tz: string) => {
    setBulkSchedule(prev => {
      if (bulkLastEditedField === 'student' && prev.studentTime) {
        const teacherTime = calculateTeacherTime(prev.studentTime, prev.studentTimezone, tz);
        return { ...prev, teacherTimezone: tz, teacherTime };
      } else if (bulkLastEditedField === 'teacher' && prev.teacherTime) {
        const studentTime = calculateStudentTime(prev.teacherTime, prev.studentTimezone, tz);
        return { ...prev, teacherTimezone: tz, studentTime };
      }
      return { ...prev, teacherTimezone: tz };
    });
  };

  const handleAssignmentSelect = (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    setNewSchedule(prev => ({
      ...prev,
      assignmentId,
      studentTimezone: resolveTimezone(
        assignment?.student_country,
        assignment?.student_city,
        assignment?.student_timezone
      ),
      teacherTimezone: resolveTimezone(
        assignment?.teacher_country,
        assignment?.teacher_city,
        assignment?.teacher_timezone
      ),
    }));
  };

  const handleBulkAssignmentSelect = (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    setBulkSchedule(prev => ({
      ...prev,
      assignmentId,
      studentTimezone: resolveTimezone(
        assignment?.student_country,
        assignment?.student_city,
        assignment?.student_timezone
      ),
      teacherTimezone: resolveTimezone(
        assignment?.teacher_country,
        assignment?.teacher_city,
        assignment?.teacher_timezone
      ),
    }));
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSchedule(null);
    setNewSchedule({
      assignmentId: '',
      day: '',
      studentTime: '',
      teacherTime: '',
      studentTimezone: '',
      teacherTimezone: '',
      duration: '30',
      customDuration: '',
    });
    setLastEditedField('student');
  };

  const handleCloseBulkDialog = () => {
    setIsBulkDialogOpen(false);
    setBulkSchedule({
      assignmentId: '',
      selectedDays: [],
      studentTime: '',
      teacherTime: '',
      studentTimezone: '',
      teacherTimezone: '',
      duration: '30',
      customDuration: '',
    });
    setBulkLastEditedField('student');
  };

  const handleEditSchedule = (schedule: Schedule, assignment: Assignment) => {
    setEditingSchedule(schedule);
    const studentTz = resolveTimezone(
      assignment.student_country,
      assignment.student_city,
      assignment.student_timezone
    );
    const teacherTz = resolveTimezone(
      assignment.teacher_country,
      assignment.teacher_city,
      assignment.teacher_timezone
    );
    const durationVal = schedule.duration_minutes;
    const isPreset = [30, 45, 60].includes(durationVal);
    setNewSchedule({
      assignmentId: schedule.assignment_id,
      day: schedule.day_of_week,
      studentTime: schedule.student_local_time,
      teacherTime: schedule.teacher_local_time,
      studentTimezone: studentTz,
      teacherTimezone: teacherTz,
      duration: isPreset ? durationVal.toString() : 'custom',
      customDuration: isPreset ? '' : durationVal.toString(),
    });
    setLastEditedField('student');
    setIsDialogOpen(true);
  };

  const handleSubmitSchedule = () => {
    if (!newSchedule.assignmentId || !newSchedule.day || !newSchedule.studentTime) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    // Validate custom duration if selected
    if (newSchedule.duration === 'custom') {
      const customVal = parseInt(newSchedule.customDuration);
      if (isNaN(customVal) || customVal < 5 || customVal > 180) {
        toast({ title: 'Error', description: 'Custom duration must be between 5 and 180 minutes', variant: 'destructive' });
        return;
      }
    }

    // Validate timezones are set
    if (!newSchedule.studentTimezone || !newSchedule.teacherTimezone) {
      toast({
        title: 'Missing Timezone',
        description: 'Please set student/teacher location (or timezone) before creating a schedule.',
        variant: 'destructive',
      });
      return;
    }

    const effectiveDuration = getEffectiveDuration(newSchedule.duration, newSchedule.customDuration);

    // Check for conflicts
    const conflict = detectScheduleConflict(
      {
        day: newSchedule.day,
        studentTime: newSchedule.studentTime,
        duration: effectiveDuration,
        assignmentId: newSchedule.assignmentId,
      },
      assignments,
      schedules,
      editingSchedule?.id
    );

    if (conflict.hasConflict) {
      toast({
        title: `⚠️ ${conflict.conflictType === 'student' ? 'Student' : 'Teacher'} Conflict`,
        description: conflict.conflictDetails,
        variant: 'destructive',
      });
      return;
    }

    const scheduleData = {
      day_of_week: newSchedule.day,
      student_local_time: newSchedule.studentTime,
      teacher_local_time: newSchedule.teacherTime || calculateTeacherTime(newSchedule.studentTime, newSchedule.studentTimezone, newSchedule.teacherTimezone),
      duration_minutes: effectiveDuration,
    };

    if (editingSchedule) {
      updateScheduleMutation.mutate({ id: editingSchedule.id, ...scheduleData });
    } else {
      createScheduleMutation.mutate({ assignment_id: newSchedule.assignmentId, ...scheduleData });
    }
  };

  const handleSubmitBulkSchedule = () => {
    if (!bulkSchedule.assignmentId || bulkSchedule.selectedDays.length === 0 || !bulkSchedule.studentTime) {
      toast({ title: 'Error', description: 'Please select assignment, at least one day, and time', variant: 'destructive' });
      return;
    }

    // Validate custom duration if selected
    if (bulkSchedule.duration === 'custom') {
      const customVal = parseInt(bulkSchedule.customDuration);
      if (isNaN(customVal) || customVal < 5 || customVal > 180) {
        toast({ title: 'Error', description: 'Custom duration must be between 5 and 180 minutes', variant: 'destructive' });
        return;
      }
    }

    // Validate timezones are set
    if (!bulkSchedule.studentTimezone || !bulkSchedule.teacherTimezone) {
      toast({
        title: 'Missing Timezone',
        description: 'Please set student/teacher location (or timezone) before creating schedules.',
        variant: 'destructive',
      });
      return;
    }

    const effectiveDuration = getEffectiveDuration(bulkSchedule.duration, bulkSchedule.customDuration);

    // Check for conflicts on each selected day
    const conflicts: string[] = [];
    for (const day of bulkSchedule.selectedDays) {
      const conflict = detectScheduleConflict(
        {
          day,
          studentTime: bulkSchedule.studentTime,
          duration: effectiveDuration,
          assignmentId: bulkSchedule.assignmentId,
        },
        assignments,
        schedules
      );
      if (conflict.hasConflict) {
        conflicts.push(`${DAYS_LABELS[day]}: ${conflict.conflictDetails}`);
      }
    }

    if (conflicts.length > 0) {
      toast({
        title: '⚠️ Schedule Conflicts Detected',
        description: conflicts.join('\n'),
        variant: 'destructive',
      });
      return;
    }

    const schedulesData = bulkSchedule.selectedDays.map(day => ({
      assignment_id: bulkSchedule.assignmentId,
      day_of_week: day,
      student_local_time: bulkSchedule.studentTime,
      teacher_local_time: bulkSchedule.teacherTime || calculateTeacherTime(bulkSchedule.studentTime, bulkSchedule.studentTimezone, bulkSchedule.teacherTimezone),
      duration_minutes: effectiveDuration,
    }));

    bulkCreateScheduleMutation.mutate(schedulesData);
  };

  const toggleBulkDay = (day: string) => {
    setBulkSchedule(prev => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter(d => d !== day)
        : [...prev.selectedDays, day],
    }));
  };

  const isLoading = loadingAssignments || loadingSchedules;
  const hasAssignments = assignments.length > 0;
  const isPending = createScheduleMutation.isPending || updateScheduleMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Class Schedules</h1>
            <p className="text-muted-foreground mt-1">Manage class schedules with timezone support</p>
          </div>
          <div className="flex gap-2">
            {/* CSV Import Button */}
            <Button variant="outline" onClick={() => setIsCsvImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              CSV Import
            </Button>
            {/* Bulk Add Button */}
            <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!hasAssignments}>
                  <Calendar className="h-4 w-4 mr-1" />
                  Bulk Add
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="font-serif">Bulk Add Schedules</DialogTitle>
                </DialogHeader>
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <Label className="text-xs">Assignment *</Label>
                      <Select value={bulkSchedule.assignmentId} onValueChange={handleBulkAssignmentSelect}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignments.map((assignment) => (
                            <SelectItem key={assignment.id} value={assignment.id}>
                              {assignment.student_name} → {assignment.teacher_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <Label className="text-xs">Select Days *</Label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <label key={day} className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={bulkSchedule.selectedDays.includes(day)}
                              onCheckedChange={() => toggleBulkDay(day)}
                            />
                            <span className="text-sm">{DAYS_LABELS[day].slice(0, 3)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* Location info banner with frozen timezones */}
                    {bulkSelectedAssignment && (
                      <div className="sm:col-span-2 lg:col-span-3 p-3 bg-muted/50 rounded-md border border-border">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              <span>Student:</span>
                            </div>
                            <div className="font-medium">{bulkSelectedAssignment.student_city || 'Unknown'}, {bulkSelectedAssignment.student_country || 'Unknown'}</div>
                            <Badge variant="secondary" className="text-xs">{getCountryCode(bulkSelectedAssignment.student_country)} - {getTzAbbr(bulkSchedule.studentTimezone)}</Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              <span>Teacher:</span>
                            </div>
                            <div className="font-medium">{bulkSelectedAssignment.teacher_city || 'Unknown'}, {bulkSelectedAssignment.teacher_country || 'Unknown'}</div>
                            <Badge variant="secondary" className="text-xs">{getCountryCode(bulkSelectedAssignment.teacher_country)} - {getTzAbbr(bulkSchedule.teacherTimezone)}</Badge>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Student Time *</Label>
                      <Input
                        type="time"
                        value={bulkSchedule.studentTime}
                        onChange={(e) => handleBulkStudentTimeChange(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Teacher Time (auto)</Label>
                      <div className="h-9 px-3 flex items-center bg-muted rounded-md border border-input text-sm">
                        {bulkSchedule.teacherTime ? formatTime12h(bulkSchedule.teacherTime) : '--:-- --'}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Duration</Label>
                      <div className="flex gap-2">
                        <Select value={bulkSchedule.duration} onValueChange={(v) => setBulkSchedule(prev => ({ ...prev, duration: v, customDuration: v === 'custom' ? prev.customDuration : '' }))}>
                          <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="45">45 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        {bulkSchedule.duration === 'custom' && (
                          <Input
                            type="number"
                            min={5}
                            max={180}
                            placeholder="e.g. 40"
                            value={bulkSchedule.customDuration}
                            onChange={(e) => setBulkSchedule(prev => ({ ...prev, customDuration: e.target.value }))}
                            className="h-9 w-20"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-blue-200 dark:border-blue-800 mt-3">
                    <Button variant="outline" size="sm" onClick={handleCloseBulkDialog}>Cancel</Button>
                    <Button size="sm" onClick={handleSubmitBulkSchedule} disabled={bulkCreateScheduleMutation.isPending}>
                      {bulkCreateScheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create {bulkSchedule.selectedDays.length} Schedule{bulkSchedule.selectedDays.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Single Add Button */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => open ? setIsDialogOpen(true) : handleCloseDialog()}>
              <DialogTrigger asChild>
                <Button variant="hero" disabled={!hasAssignments}>
                  <Plus className="h-4 w-4" />
                  Add Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="font-serif">{editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}</DialogTitle>
                </DialogHeader>
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Assignment *</Label>
                      <Select value={newSchedule.assignmentId} onValueChange={handleAssignmentSelect} disabled={!!editingSchedule}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {assignments.map((assignment) => (
                            <SelectItem key={assignment.id} value={assignment.id}>
                              {assignment.student_name} → {assignment.teacher_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Day *</Label>
                      <Select value={newSchedule.day} onValueChange={(v) => setNewSchedule(prev => ({ ...prev, day: v }))}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((day) => (
                            <SelectItem key={day} value={day}>{DAYS_LABELS[day]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Duration</Label>
                      <div className="flex gap-2">
                        <Select value={newSchedule.duration} onValueChange={(v) => setNewSchedule(prev => ({ ...prev, duration: v, customDuration: v === 'custom' ? prev.customDuration : '' }))}>
                          <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="45">45 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        {newSchedule.duration === 'custom' && (
                          <Input
                            type="number"
                            min={5}
                            max={180}
                            placeholder="e.g. 40"
                            value={newSchedule.customDuration}
                            onChange={(e) => setNewSchedule(prev => ({ ...prev, customDuration: e.target.value }))}
                            className="h-9 w-20"
                          />
                        )}
                      </div>
                    </div>
                    {/* Location info banner with frozen timezones */}
                    {selectedAssignment && (
                      <div className="sm:col-span-2 lg:col-span-3 p-3 bg-muted/50 rounded-md border border-border">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              <span>Student:</span>
                            </div>
                            <div className="font-medium">{selectedAssignment.student_city || 'Unknown'}, {selectedAssignment.student_country || 'Unknown'}</div>
                            <Badge variant="secondary" className="text-xs">{getCountryCode(selectedAssignment.student_country)} - {getTzAbbr(newSchedule.studentTimezone)}</Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              <span>Teacher:</span>
                            </div>
                            <div className="font-medium">{selectedAssignment.teacher_city || 'Unknown'}, {selectedAssignment.teacher_country || 'Unknown'}</div>
                            <Badge variant="secondary" className="text-xs">{getCountryCode(selectedAssignment.teacher_country)} - {getTzAbbr(newSchedule.teacherTimezone)}</Badge>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Student Time *</Label>
                      <Input type="time" value={newSchedule.studentTime} onChange={(e) => handleStudentTimeChange(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Teacher Time (auto)</Label>
                      <div className="h-9 px-3 flex items-center bg-muted rounded-md border border-input text-sm">
                        {newSchedule.teacherTime ? formatTime12h(newSchedule.teacherTime) : '--:-- --'}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-blue-200 dark:border-blue-800 mt-3">
                    <Button variant="outline" size="sm" onClick={handleCloseDialog}>Cancel</Button>
                    <Button size="sm" onClick={handleSubmitSchedule} disabled={isPending}>
                      {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingSchedule ? 'Update Schedule' : 'Add Schedule'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* No Assignments Warning */}
        {!hasAssignments && !isLoading && (
          <Card className="bg-accent/10 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-8 w-8 text-accent" />
                <div>
                  <p className="font-medium text-foreground">No Student–Teacher Assignments</p>
                  <p className="text-sm text-muted-foreground">Create assignments in the Assignments module before scheduling classes.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters Section */}
        {hasAssignments && (
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search student or teacher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Teacher Filter */}
            <Select value={filterTeacher || "all"} onValueChange={(v) => setFilterTeacher(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Teachers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teachers</SelectItem>
                {availableTeachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Subject Filter */}
            {availableSubjects.length > 0 && (
              <Select value={filterSubject || "all"} onValueChange={(v) => setFilterSubject(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {availableSubjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Status Filter */}
            <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="not_scheduled">Not Scheduled</SelectItem>
              </SelectContent>
            </Select>

            {/* All Divisions Toggle */}
            <Button
              variant={showAllDivisions ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAllDivisions(!showAllDivisions)}
              className="h-10"
            >
              <Globe className="h-4 w-4 mr-1" />
              {showAllDivisions ? 'All Divisions' : 'Current Division'}
            </Button>

            {/* View Mode Toggle */}
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-10 rounded-none"
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="h-10 rounded-none"
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                Month
              </Button>
            </div>
            
            {/* Reset Filters */}
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="h-10">
                <X className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
          </div>
        )}

        {/* Monthly Calendar View */}
        {viewMode === 'calendar' && (
          <div className="bg-card rounded-xl border border-border p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <MonthlyCalendarView
                assignments={filteredAssignments}
                schedules={schedules}
              />
            )}
          </div>
        )}

        {/* Master Schedule Table */}
        {viewMode === 'list' && <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No schedules available</p>
              <p className="text-sm mt-1">Assignments must exist before creating schedules</p>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No matching results</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
              <Button variant="link" onClick={resetFilters} className="mt-2">Reset Filters</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('student')}
                  >
                    <div className="flex items-center">
                      Student
                      {getSortIcon('student')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('teacher')}
                  >
                    <div className="flex items-center">
                      Teacher
                      {getSortIcon('teacher')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </TableHead>
                  <TableHead>Time (Student / Teacher)</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment) => {
                  const isExpanded = expandedAssignments.has(assignment.id);
                  const assignmentSchedules = getSchedulesForAssignment(assignment.id);
                  const todaysClass = assignmentSchedules.find(s => s.day_of_week === todayDayName);

                  const studentCode = getCountryCode(assignment.student_country);
                  const teacherCode = getCountryCode(assignment.teacher_country);

                  const timeViewMode = calendarTimeView[assignment.id] || 'student';

                  return (
                    <React.Fragment key={assignment.id}>
                      <TableRow className="hover:bg-secondary/30">
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toggleExpanded(assignment.id)}>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{assignment.student_name}</span>
                          </span>
                        </TableCell>
                        <TableCell>{assignment.teacher_name}</TableCell>
                        <TableCell>
                          {assignmentSchedules.length > 0 ? (
                            <Badge variant="default" className="bg-emerald-light/20 text-emerald-light border-emerald-light/30">
                              {assignmentSchedules.length} class{assignmentSchedules.length > 1 ? 'es' : ''}/week
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not Scheduled</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {todaysClass ? (
                            <span className="text-sm font-medium">
                              <span className="text-primary">{formatTime12h(todaysClass.student_local_time)}</span>
                              <span className="text-muted-foreground text-xs ml-1">({studentCode})</span>
                              <span className="text-muted-foreground mx-1">/</span>
                              <span className="text-foreground">{formatTime12h(todaysClass.teacher_local_time)}</span>
                              <span className="text-muted-foreground text-xs ml-1">({teacherCode})</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">No class today</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {todaysClass && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditSchedule(todaysClass, assignment)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteSchedule(todaysClass)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded Weekly Calendar */}
                      {isExpanded && (
                        <TableRow className="bg-secondary/20">
                          <TableCell colSpan={6} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm text-muted-foreground">Weekly Schedule</h4>
                                <div className="flex gap-1">
                                  <Button
                                    variant={timeViewMode === 'student' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => setCalendarTimeView(prev => ({ ...prev, [assignment.id]: 'student' }))}
                                  >
                                    Show Student ({studentCode})
                                  </Button>
                                  <Button
                                    variant={timeViewMode === 'teacher' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => setCalendarTimeView(prev => ({ ...prev, [assignment.id]: 'teacher' }))}
                                  >
                                    Show Teacher ({teacherCode})
                                  </Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-7 gap-2">
                                {DAYS_OF_WEEK.map((day) => {
                                  // When in teacher view, a schedule's day may shift due to timezone offset
                                  // e.g., Sunday 5PM student → Monday 4AM teacher
                                  let daySchedule = assignmentSchedules.find(s => s.day_of_week === day);
                                  let displayTime: string | null = null;
                                  let displayTzAbbr = timeViewMode === 'teacher' ? teacherCode : studentCode;

                                  if (timeViewMode === 'teacher') {
                                    // Find any schedule whose teacher-day maps to this grid day
                                    daySchedule = undefined; // reset
                                    for (const s of assignmentSchedules) {
                                      const studentTz = resolveTimezone(assignment.student_country, assignment.student_city, assignment.student_timezone);
                                      const teacherTz = resolveTimezone(assignment.teacher_country, assignment.teacher_city, assignment.teacher_timezone);
                                      const { dayOffset } = convertTimeBetweenTimezonesWithDay(
                                        s.student_local_time, studentTz, teacherTz
                                      );
                                      const studentDayIdx = DAYS_OF_WEEK.indexOf(s.day_of_week);
                                      const teacherDayIdx = (studentDayIdx + dayOffset + 7) % 7;
                                      if (DAYS_OF_WEEK[teacherDayIdx] === day) {
                                        daySchedule = s;
                                        displayTime = s.teacher_local_time;
                                        break;
                                      }
                                    }
                                  } else {
                                    displayTime = daySchedule ? daySchedule.student_local_time : null;
                                  }

                                  const isToday = day === todayDayName;

                                  return (
                                    <Card
                                      key={day}
                                      className={`p-3 text-center ${isToday ? 'ring-2 ring-primary' : ''} ${daySchedule ? 'bg-primary/10 border-primary/30' : 'bg-muted/30'}`}
                                    >
                                      <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {DAYS_LABELS[day].slice(0, 3)}
                                      </p>
                                      {daySchedule && displayTime ? (
                                        <div className="space-y-1">
                                          <p className="text-sm font-bold text-foreground">{formatTime12h(displayTime)}</p>
                                          <p className="text-xs text-muted-foreground">{daySchedule.duration_minutes}min ({displayTzAbbr})</p>
                                          <div className="flex justify-center gap-1 mt-1">
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEditSchedule(daySchedule!, assignment)}>
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteSchedule(daySchedule!)}>
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">—</p>
                                      )}
                                    </Card>
                                  );
                                })}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteSchedule} onOpenChange={() => setDeleteSchedule(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Schedule?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the schedule for {deleteSchedule && DAYS_LABELS[deleteSchedule.day_of_week]}.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteSchedule && deleteScheduleMutation.mutate(deleteSchedule.id)}
              >
                {deleteScheduleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* CSV Import Dialog */}
        <BulkScheduleImportDialog 
          open={isCsvImportOpen} 
          onOpenChange={setIsCsvImportOpen} 
        />
      </div>
    </DashboardLayout>
  );
}
