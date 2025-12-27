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
import { Plus, Calendar, Clock, User, ChevronDown, ChevronRight, Loader2, AlertCircle, Globe, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

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

const TIMEZONES = [
  { value: 'America/Toronto', label: 'Canada (Toronto) EST/EDT', offset: -5, abbr: 'CA' },
  { value: 'America/New_York', label: 'USA (New York) EST/EDT', offset: -5, abbr: 'NY' },
  { value: 'America/Los_Angeles', label: 'USA (Los Angeles) PST/PDT', offset: -8, abbr: 'LA' },
  { value: 'Europe/London', label: 'UK (London) GMT/BST', offset: 0, abbr: 'UK' },
  { value: 'Asia/Karachi', label: 'Pakistan (Karachi) PKT', offset: 5, abbr: 'PK' },
  { value: 'Asia/Dubai', label: 'UAE (Dubai) GST', offset: 4, abbr: 'AE' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (Riyadh) AST', offset: 3, abbr: 'SA' },
  { value: 'Asia/Kolkata', label: 'India (Mumbai) IST', offset: 5.5, abbr: 'IN' },
  { value: 'Australia/Sydney', label: 'Australia (Sydney) AEST', offset: 10, abbr: 'AU' },
];

const getTzAbbr = (tzValue: string | null) => {
  return TIMEZONES.find(tz => tz.value === tzValue)?.abbr || '??';
};

interface Assignment {
  id: string;
  teacher_id: string;
  student_id: string;
  teacher_name: string;
  student_name: string;
  subject_name: string | null;
  student_timezone: string | null;
  teacher_timezone: string | null;
}

interface Schedule {
  id: string;
  assignment_id: string;
  day_of_week: string;
  student_local_time: string;
  teacher_local_time: string;
  duration_minutes: number;
  is_active: boolean;
}

// Helper to calculate teacher time from student time based on timezone offsets
function calculateTeacherTime(studentTime: string, studentTz: string, teacherTz: string): string {
  const studentOffset = TIMEZONES.find(tz => tz.value === studentTz)?.offset ?? 0;
  const teacherOffset = TIMEZONES.find(tz => tz.value === teacherTz)?.offset ?? 0;
  
  const [hours, minutes] = studentTime.split(':').map(Number);
  const studentMinutesFromMidnight = hours * 60 + minutes;
  
  const offsetDiffMinutes = (teacherOffset - studentOffset) * 60;
  let teacherMinutesFromMidnight = studentMinutesFromMidnight + offsetDiffMinutes;
  
  if (teacherMinutesFromMidnight < 0) teacherMinutesFromMidnight += 24 * 60;
  if (teacherMinutesFromMidnight >= 24 * 60) teacherMinutesFromMidnight -= 24 * 60;
  
  const teacherHours = Math.floor(teacherMinutesFromMidnight / 60);
  const teacherMins = teacherMinutesFromMidnight % 60;
  
  return `${teacherHours.toString().padStart(2, '0')}:${teacherMins.toString().padStart(2, '0')}`;
}

function formatTime12h(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
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
  conflictType: 'student' | 'teacher' | null;
  conflictDetails: string;
}

// Detect schedule conflicts
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
  const teacherId = assignment.teacher_id;

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

    // Check if same student
    if (existingAssignment.student_id === studentId) {
      return {
        hasConflict: true,
        conflictType: 'student',
        conflictDetails: `${assignment.student_name} already has a class with ${existingAssignment.teacher_name} at ${formatTime12h(existingSchedule.student_local_time)} on ${DAYS_LABELS[newSchedule.day]}`,
      };
    }

    // Check if same teacher
    if (existingAssignment.teacher_id === teacherId) {
      return {
        hasConflict: true,
        conflictType: 'teacher',
        conflictDetails: `${assignment.teacher_name} already has a class with ${existingAssignment.student_name} at ${formatTime12h(existingSchedule.student_local_time)} on ${DAYS_LABELS[newSchedule.day]}`,
      };
    }
  }

  return { hasConflict: false, conflictType: null, conflictDetails: '' };
}

export default function Schedules() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(new Set());
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleteSchedule, setDeleteSchedule] = useState<Schedule | null>(null);
  const [calendarTimeView, setCalendarTimeView] = useState<Record<string, 'student' | 'teacher'>>({});
  const [newSchedule, setNewSchedule] = useState({
    assignmentId: '',
    day: '',
    studentTime: '',
    studentTimezone: 'America/Toronto',
    teacherTimezone: 'Asia/Karachi',
    duration: '30',
  });
  // Bulk schedule state
  const [bulkSchedule, setBulkSchedule] = useState({
    assignmentId: '',
    selectedDays: [] as string[],
    studentTime: '',
    studentTimezone: 'America/Toronto',
    teacherTimezone: 'Asia/Karachi',
    duration: '30',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const todayDayName = format(new Date(), 'EEEE').toLowerCase();

  // Fetch assignments with timezone info
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['assignments-with-tz'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          teacher_id,
          student_id,
          student_timezone,
          teacher_timezone,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
          student:profiles!student_teacher_assignments_student_id_fkey(full_name),
          subject:subjects(name)
        `);

      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        teacher_id: row.teacher_id,
        student_id: row.student_id,
        teacher_name: row.teacher?.full_name || 'Unknown',
        student_name: row.student?.full_name || 'Unknown',
        subject_name: row.subject?.name || null,
        student_timezone: row.student_timezone,
        teacher_timezone: row.teacher_timezone,
      })) as Assignment[];
    },
  });

  // Fetch schedules
  const { data: schedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['class-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return (data || []) as Schedule[];
    },
  });

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
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
    return schedules.filter(s => s.assignment_id === assignmentId);
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

  const calculatedTeacherTime = useMemo(() => {
    if (!newSchedule.studentTime) return '';
    return calculateTeacherTime(newSchedule.studentTime, newSchedule.studentTimezone, newSchedule.teacherTimezone);
  }, [newSchedule.studentTime, newSchedule.studentTimezone, newSchedule.teacherTimezone]);

  const bulkCalculatedTeacherTime = useMemo(() => {
    if (!bulkSchedule.studentTime) return '';
    return calculateTeacherTime(bulkSchedule.studentTime, bulkSchedule.studentTimezone, bulkSchedule.teacherTimezone);
  }, [bulkSchedule.studentTime, bulkSchedule.studentTimezone, bulkSchedule.teacherTimezone]);

  const handleAssignmentSelect = (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    setNewSchedule(prev => ({
      ...prev,
      assignmentId,
      studentTimezone: assignment?.student_timezone || 'America/Toronto',
      teacherTimezone: assignment?.teacher_timezone || 'Asia/Karachi',
    }));
  };

  const handleBulkAssignmentSelect = (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    setBulkSchedule(prev => ({
      ...prev,
      assignmentId,
      studentTimezone: assignment?.student_timezone || 'America/Toronto',
      teacherTimezone: assignment?.teacher_timezone || 'Asia/Karachi',
    }));
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSchedule(null);
    setNewSchedule({
      assignmentId: '',
      day: '',
      studentTime: '',
      studentTimezone: 'America/Toronto',
      teacherTimezone: 'Asia/Karachi',
      duration: '30',
    });
  };

  const handleCloseBulkDialog = () => {
    setIsBulkDialogOpen(false);
    setBulkSchedule({
      assignmentId: '',
      selectedDays: [],
      studentTime: '',
      studentTimezone: 'America/Toronto',
      teacherTimezone: 'Asia/Karachi',
      duration: '30',
    });
  };

  const handleEditSchedule = (schedule: Schedule, assignment: Assignment) => {
    setEditingSchedule(schedule);
    setNewSchedule({
      assignmentId: schedule.assignment_id,
      day: schedule.day_of_week,
      studentTime: schedule.student_local_time,
      studentTimezone: assignment.student_timezone || 'America/Toronto',
      teacherTimezone: assignment.teacher_timezone || 'Asia/Karachi',
      duration: schedule.duration_minutes.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSubmitSchedule = () => {
    if (!newSchedule.assignmentId || !newSchedule.day || !newSchedule.studentTime) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    // Validate timezones are set
    const assignment = assignments.find(a => a.id === newSchedule.assignmentId);
    if (!assignment?.student_timezone || !assignment?.teacher_timezone) {
      toast({
        title: 'Missing Timezone',
        description: 'Please configure student and teacher timezones in the assignment before creating a schedule.',
        variant: 'destructive',
      });
      return;
    }
    }

    // Check for conflicts
    const conflict = detectScheduleConflict(
      {
        day: newSchedule.day,
        studentTime: newSchedule.studentTime,
        duration: parseInt(newSchedule.duration),
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
      teacher_local_time: calculatedTeacherTime,
      duration_minutes: parseInt(newSchedule.duration),
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

    // Validate timezones are set
    const assignment = assignments.find(a => a.id === bulkSchedule.assignmentId);
    if (!assignment?.student_timezone || !assignment?.teacher_timezone) {
      toast({
        title: 'Missing Timezone',
        description: 'Please configure student and teacher timezones in the assignment before creating schedules.',
        variant: 'destructive',
      });
      return;
    }

    // Check for conflicts on each selected day
    const conflicts: string[] = [];
    for (const day of bulkSchedule.selectedDays) {
      const conflict = detectScheduleConflict(
        {
          day,
          studentTime: bulkSchedule.studentTime,
          duration: parseInt(bulkSchedule.duration),
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
      teacher_local_time: bulkCalculatedTeacherTime,
      duration_minutes: parseInt(bulkSchedule.duration),
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
                    <div className="space-y-1.5">
                      <Label className="text-xs">Student TZ</Label>
                      <Select value={bulkSchedule.studentTimezone} onValueChange={(v) => setBulkSchedule(prev => ({ ...prev, studentTimezone: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>{tz.abbr} - {tz.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Student Time *</Label>
                      <Input
                        type="time"
                        value={bulkSchedule.studentTime}
                        onChange={(e) => setBulkSchedule(prev => ({ ...prev, studentTime: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Duration</Label>
                      <Select value={bulkSchedule.duration} onValueChange={(v) => setBulkSchedule(prev => ({ ...prev, duration: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 min</SelectItem>
                          <SelectItem value="45">45 min</SelectItem>
                          <SelectItem value="60">60 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {bulkCalculatedTeacherTime && (
                      <div className="sm:col-span-2 lg:col-span-3 p-2 bg-primary/10 rounded-md border border-primary/20 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Teacher's Local Time</p>
                          <p className="text-sm font-bold text-primary">{formatTime12h(bulkCalculatedTeacherTime)}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{getTzAbbr(bulkSchedule.teacherTimezone)}</Badge>
                      </div>
                    )}
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
                      <Select value={newSchedule.duration} onValueChange={(v) => setNewSchedule(prev => ({ ...prev, duration: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 min</SelectItem>
                          <SelectItem value="45">45 min</SelectItem>
                          <SelectItem value="60">60 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Student TZ</Label>
                      <Select value={newSchedule.studentTimezone} onValueChange={(v) => setNewSchedule(prev => ({ ...prev, studentTimezone: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>{tz.abbr} - {tz.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Student Time *</Label>
                      <Input type="time" value={newSchedule.studentTime} onChange={(e) => setNewSchedule(prev => ({ ...prev, studentTime: e.target.value }))} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Teacher TZ</Label>
                      <Select value={newSchedule.teacherTimezone} onValueChange={(v) => setNewSchedule(prev => ({ ...prev, teacherTimezone: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>{tz.abbr} - {tz.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {calculatedTeacherTime && (
                      <div className="sm:col-span-2 lg:col-span-3 p-2 bg-primary/10 rounded-md border border-primary/20 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Teacher's Local Time (Auto)</p>
                          <p className="text-sm font-bold text-primary">{formatTime12h(calculatedTeacherTime)}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{getTzAbbr(newSchedule.teacherTimezone)}</Badge>
                      </div>
                    )}
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

        {/* Master Schedule Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time (Student / Teacher)</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => {
                  const isExpanded = expandedAssignments.has(assignment.id);
                  const assignmentSchedules = getSchedulesForAssignment(assignment.id);
                  const todaysClass = assignmentSchedules.find(s => s.day_of_week === todayDayName);
                  const studentTzAbbr = getTzAbbr(assignment.student_timezone);
                  const teacherTzAbbr = getTzAbbr(assignment.teacher_timezone);
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
                              <span className="text-muted-foreground text-xs ml-1">({studentTzAbbr})</span>
                              <span className="text-muted-foreground mx-1">/</span>
                              <span className="text-foreground">{formatTime12h(todaysClass.teacher_local_time)}</span>
                              <span className="text-muted-foreground text-xs ml-1">({teacherTzAbbr})</span>
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
                                    Show {studentTzAbbr} Time
                                  </Button>
                                  <Button
                                    variant={timeViewMode === 'teacher' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => setCalendarTimeView(prev => ({ ...prev, [assignment.id]: 'teacher' }))}
                                  >
                                    Show {teacherTzAbbr} Time
                                  </Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-7 gap-2">
                                {DAYS_OF_WEEK.map((day) => {
                                  const daySchedule = assignmentSchedules.find(s => s.day_of_week === day);
                                  const isToday = day === todayDayName;
                                  const displayTime = daySchedule
                                    ? (timeViewMode === 'teacher' ? daySchedule.teacher_local_time : daySchedule.student_local_time)
                                    : null;
                                  const displayTzAbbr = timeViewMode === 'teacher' ? teacherTzAbbr : studentTzAbbr;

                                  return (
                                    <Card
                                      key={day}
                                      className={`p-3 text-center ${isToday ? 'ring-2 ring-primary' : ''} ${daySchedule ? 'bg-primary/10 border-primary/30' : 'bg-muted/30'}`}
                                    >
                                      <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {DAYS_LABELS[day].slice(0, 3)}
                                      </p>
                                      {daySchedule ? (
                                        <div className="space-y-1">
                                          <p className="text-sm font-bold text-foreground">{formatTime12h(displayTime!)}</p>
                                          <p className="text-xs text-muted-foreground">{daySchedule.duration_minutes}min ({displayTzAbbr})</p>
                                          <div className="flex justify-center gap-1 mt-1">
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEditSchedule(daySchedule, assignment)}>
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteSchedule(daySchedule)}>
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
        </div>

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
      </div>
    </DashboardLayout>
  );
}
