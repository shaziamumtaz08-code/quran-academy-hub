import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Calendar, User, Search, X, Filter, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface MissingRecord {
  date: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  subjectName: string | null;
  scheduledTime: string;
}

// Bypass cutoff: only count missing from April 2026 onwards
const BYPASS_CUTOFF = '2026-04-01';

interface MissingAttendanceSectionProps {
  monthFilter: string;
  dateMode: 'month' | 'dateRange';
  dateFrom: string;
  dateTo: string;
  isVisible: boolean;
  onClose: () => void;
  teacherId?: string;
}

export function MissingAttendanceSection({
  monthFilter,
  dateMode,
  dateFrom,
  dateTo,
  isVisible,
  onClose,
  teacherId,
}: MissingAttendanceSectionProps) {
  const [studentFilter, setStudentFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'date' | 'student' | 'teacher' | 'subject' | 'time'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Compute date range — enforce bypass cutoff (no missing before April 2026)
  const { startDate, endDate } = useMemo(() => {
    let sd: string, ed: string;
    if (dateMode === 'dateRange' && dateFrom && dateTo) {
      sd = dateFrom;
      ed = dateTo;
    } else {
      const monthStart = startOfMonth(parseISO(`${monthFilter}-01`));
      sd = format(monthStart, 'yyyy-MM-dd');
      ed = format(endOfMonth(monthStart), 'yyyy-MM-dd');
    }
    // Enforce bypass: never show missing before April 2026
    if (sd < BYPASS_CUTOFF) sd = BYPASS_CUTOFF;
    return { startDate: sd, endDate: ed };
  }, [dateMode, dateFrom, dateTo, monthFilter]);

  // Fetch all active schedules with student/teacher info
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['all-schedules-for-missing', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          day_of_week,
          teacher_local_time,
          is_active,
            student_teacher_assignments!inner (
              student_id,
              teacher_id,
              status,
              requires_attendance,
              subject:subjects(name),
              student:profiles!student_teacher_assignments_student_id_fkey(id, full_name),
              teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name)
            )
          `)
          .eq('is_active', true)
          .eq('student_teacher_assignments.status', 'active')
          .eq('student_teacher_assignments.requires_attendance', true);

      if (error) throw error;
      return data;
    },
    enabled: isVisible,
  });

  // Fetch all attendance records in range
  const { data: attendanceRecords, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance-for-missing', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, class_date')
        .gte('class_date', startDate)
        .lte('class_date', endDate);

      if (error) throw error;
      return data;
    },
    enabled: isVisible,
  });

  // Compute missing records
  const missingRecords = useMemo(() => {
    if (!schedules || !attendanceRecords) return [];

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Build a set of "studentId:date" for quick lookup
    const attendanceSet = new Set(
      (attendanceRecords || []).map(r => `${r.student_id}:${r.class_date}`)
    );

    const missing: MissingRecord[] = [];

    // For each schedule, compute which days in the date range should have attendance
    const rangeDays = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate > format(today, 'yyyy-MM-dd') ? format(today, 'yyyy-MM-dd') : endDate),
    });

    for (const schedule of schedules || []) {
      const assignment = schedule.student_teacher_assignments as any;
      if (!assignment?.student || !assignment?.teacher) continue;

      const scheduledDayName = schedule.day_of_week.toLowerCase();
      const scheduledDayIndex = DAY_NAMES.indexOf(scheduledDayName);
      if (scheduledDayIndex === -1) continue;

      for (const day of rangeDays) {
        // Skip today and future dates
        if (isAfter(day, new Date())) continue;
        // Skip if today (attendance might not be marked yet if class hasn't happened)
        const dayStr = format(day, 'yyyy-MM-dd');
        if (dayStr === format(new Date(), 'yyyy-MM-dd')) continue;

        if (getDay(day) === scheduledDayIndex) {
          const key = `${assignment.student_id}:${dayStr}`;
          if (!attendanceSet.has(key)) {
            missing.push({
              date: dayStr,
              studentId: assignment.student_id,
              studentName: assignment.student.full_name,
              teacherId: assignment.teacher_id,
              teacherName: assignment.teacher.full_name,
              subjectName: assignment.subject?.name || null,
              scheduledTime: schedule.teacher_local_time?.substring(0, 5) || '-',
            });
          }
        }
      }
    }

    // Sort by date descending
    return missing.sort((a, b) => b.date.localeCompare(a.date));
  }, [schedules, attendanceRecords, startDate, endDate]);

  // Extract unique filter options
  const filterOptions = useMemo(() => {
    const students = new Map<string, string>();
    const teachers = new Map<string, string>();
    const subjects = new Set<string>();

    for (const r of missingRecords) {
      students.set(r.studentId, r.studentName);
      teachers.set(r.teacherId, r.teacherName);
      if (r.subjectName) subjects.add(r.subjectName);
    }

    return {
      students: Array.from(students.entries()).sort((a, b) => a[1].localeCompare(b[1])),
      teachers: Array.from(teachers.entries()).sort((a, b) => a[1].localeCompare(b[1])),
      subjects: Array.from(subjects).sort(),
    };
  }, [missingRecords]);

  // Apply filters
  const filteredAndSortedMissing = useMemo(() => {
    let records = missingRecords;

    if (studentFilter !== 'all') {
      records = records.filter(r => r.studentId === studentFilter);
    }
    if (teacherFilter !== 'all') {
      records = records.filter(r => r.teacherId === teacherFilter);
    }
    if (subjectFilter !== 'all') {
      records = records.filter(r => r.subjectName === subjectFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      records = records.filter(r =>
        r.studentName.toLowerCase().includes(q) ||
        r.teacherName.toLowerCase().includes(q) ||
        (r.subjectName || '').toLowerCase().includes(q)
      );
    }

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    records = [...records].sort((a, b) => {
      switch (sortField) {
        case 'date': return dir * a.date.localeCompare(b.date);
        case 'student': return dir * a.studentName.localeCompare(b.studentName);
        case 'teacher': return dir * a.teacherName.localeCompare(b.teacherName);
        case 'subject': return dir * (a.subjectName || '').localeCompare(b.subjectName || '');
        case 'time': return dir * a.scheduledTime.localeCompare(b.scheduledTime);
        default: return 0;
      }
    });

    return records;
  }, [missingRecords, studentFilter, teacherFilter, subjectFilter, searchQuery, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const isLoading = schedulesLoading || attendanceLoading;

  if (!isVisible) return null;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="font-serif text-lg font-semibold text-foreground">
            Missing Attendance Records
          </h3>
          <Badge variant="destructive" className="ml-2">
            {filteredAndSortedMissing.length}
          </Badge>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
          </div>

          <Select value={studentFilter} onValueChange={setStudentFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="All Students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {filterOptions.students.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="All Teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teachers</SelectItem>
              {filterOptions.teachers.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {filterOptions.subjects.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search student or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filteredAndSortedMissing.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No missing attendance records found</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {([['date', 'Date'], ['student', 'Student'], ['teacher', 'Teacher'], ['subject', 'Subject'], ['time', 'Scheduled Time']] as const).map(([field, label]) => (
                    <TableHead key={field} className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort(field)}>
                      <span className="flex items-center gap-1">
                        {label}
                        <ArrowUpDown className={cn("h-3 w-3", sortField === field ? "text-foreground" : "text-muted-foreground/40")} />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedMissing.map((record, idx) => (
                  <TableRow key={`${record.studentId}-${record.date}-${idx}`} className="bg-destructive/5 hover:bg-destructive/10">
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-destructive/70" />
                        {format(parseISO(record.date), 'dd MMM yyyy')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{record.studentName}</span>
                      </span>
                    </TableCell>
                    <TableCell>{record.teacherName}</TableCell>
                    <TableCell>
                      {record.subjectName ? (
                        <Badge variant="secondary" className="text-xs">{record.subjectName}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{record.scheduledTime}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function useMissingAttendanceCount(
  monthFilter: string,
  dateMode: 'month' | 'dateRange',
  dateFrom: string,
  dateTo: string,
  enabled: boolean
) {
  const { startDate, endDate } = useMemo(() => {
    if (dateMode === 'dateRange' && dateFrom && dateTo) {
      return { startDate: dateFrom, endDate: dateTo };
    }
    const monthStart = startOfMonth(parseISO(`${monthFilter}-01`));
    return {
      startDate: format(monthStart, 'yyyy-MM-dd'),
      endDate: format(endOfMonth(monthStart), 'yyyy-MM-dd'),
    };
  }, [dateMode, dateFrom, dateTo, monthFilter]);

  const { data: schedules } = useQuery({
    queryKey: ['schedules-count-missing', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          day_of_week,
            student_teacher_assignments!inner (
              student_id,
              status,
              requires_attendance
            )
          `)
          .eq('is_active', true)
          .eq('student_teacher_assignments.status', 'active')
          .eq('student_teacher_assignments.requires_attendance', true);

      if (error) throw error;
      return data;
    },
    enabled,
  });

  const { data: attendanceRecords } = useQuery({
    queryKey: ['attendance-count-missing', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, class_date')
        .gte('class_date', startDate)
        .lte('class_date', endDate);

      if (error) throw error;
      return data;
    },
    enabled,
  });

  return useMemo(() => {
    if (!schedules || !attendanceRecords) return 0;

    const today = new Date();
    const attendanceSet = new Set(
      (attendanceRecords || []).map(r => `${r.student_id}:${r.class_date}`)
    );

    let count = 0;
    const effectiveEnd = endDate > format(today, 'yyyy-MM-dd') ? format(today, 'yyyy-MM-dd') : endDate;
    const rangeDays = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(effectiveEnd),
    });

    for (const schedule of schedules || []) {
      const assignment = schedule.student_teacher_assignments as any;
      if (!assignment) continue;

      const scheduledDayIndex = DAY_NAMES.indexOf(schedule.day_of_week.toLowerCase());
      if (scheduledDayIndex === -1) continue;

      for (const day of rangeDays) {
        if (isAfter(day, new Date())) continue;
        const dayStr = format(day, 'yyyy-MM-dd');
        if (dayStr === format(new Date(), 'yyyy-MM-dd')) continue;

        if (getDay(day) === scheduledDayIndex) {
          const key = `${assignment.student_id}:${dayStr}`;
          if (!attendanceSet.has(key)) {
            count++;
          }
        }
      }
    }

    return count;
  }, [schedules, attendanceRecords, startDate, endDate]);
}
