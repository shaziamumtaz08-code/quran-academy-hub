import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CheckCircle, XCircle, AlertCircle, User, Plus, Clock, CalendarClock, UserX, Palmtree } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

type AttendanceStatus = 'present' | 'student_absent' | 'teacher_absent' | 'teacher_leave' | 'rescheduled' | 'holiday';
type ReasonCategory = 'sick' | 'personal' | 'emergency' | 'internet_issue' | 'other';
type VarianceReason = 'slow_pace' | 'lack_of_revision' | 'technical_issues' | 'student_late' | 'short_verses';

const VARIANCE_REASONS: { value: VarianceReason; label: string }[] = [
  { value: 'slow_pace', label: 'Slow Pace' },
  { value: 'lack_of_revision', label: 'Lack of Revision' },
  { value: 'technical_issues', label: 'Technical Issues' },
  { value: 'student_late', label: 'Student Late' },
  { value: 'short_verses', label: 'Short Verses' },
];

interface AttendanceRecord {
  id: string;
  class_date: string;
  class_time: string;
  duration_minutes: number;
  status: AttendanceStatus;
  reason: string | null;
  lesson_covered: string | null;
  homework: string | null;
  student_id: string;
  teacher_id: string;
  absence_type: string | null;
  reason_category: ReasonCategory | null;
  reason_text: string | null;
  reschedule_date: string | null;
  reschedule_time: string | null;
  lines_completed: number | null;
  surah_name: string | null;
  ayah_from: number | null;
  ayah_to: number | null;
  variance_reason: string | null;
  student?: { full_name: string };
  teacher?: { full_name: string };
}

interface Profile {
  id: string;
  full_name: string;
  mushaf_type: string;
  daily_target_lines: number;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'student_absent', label: 'Student Absent' },
  { value: 'teacher_absent', label: 'Teacher Absent' },
  { value: 'teacher_leave', label: 'Teacher Leave' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'holiday', label: 'Holiday' },
];

const REASON_CATEGORIES: { value: ReasonCategory; label: string }[] = [
  { value: 'sick', label: 'Sick' },
  { value: 'personal', label: 'Personal' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'internet_issue', label: 'Internet Issue' },
  { value: 'other', label: 'Other' },
];

export default function Attendance() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filter, setFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  
  // Form state for marking attendance
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('present');
  const [classTime, setClassTime] = useState('09:00');
  const [classDate, setClassDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [duration, setDuration] = useState('30');
  const [reason, setReason] = useState('');
  const [lessonCovered, setLessonCovered] = useState('');
  const [homework, setHomework] = useState('');
  
  // New form state for enhanced attendance
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory | ''>('');
  const [reasonText, setReasonText] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  
  // Quran tracking fields
  const [surahName, setSurahName] = useState('');
  const [ayahFrom, setAyahFrom] = useState('');
  const [ayahTo, setAyahTo] = useState('');
  const [linesCompleted, setLinesCompleted] = useState('');
  const [varianceReason, setVarianceReason] = useState<VarianceReason | ''>('');

  const userRole = profile?.role;
  const isAdmin = userRole === 'super_admin' || userRole === 'admin' || 
    userRole === 'admin_admissions' || userRole === 'admin_fees' || userRole === 'admin_academic';
  const isTeacher = userRole === 'teacher' || userRole === 'examiner';
  const isStudent = userRole === 'student';

  // Statuses that require reason
  const requiresReason = (status: AttendanceStatus) => 
    ['student_absent', 'teacher_absent', 'teacher_leave'].includes(status);
  
  // Status requires reschedule info
  const requiresReschedule = (status: AttendanceStatus) => status === 'rescheduled';

  // Fetch assigned students (for teacher) with daily_target_lines
  const { data: assignedStudents } = useQuery({
    queryKey: ['assigned-students', user?.id],
    queryFn: async () => {
      if (!user?.id || !isTeacher) return [];
      
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, mushaf_type, daily_target_lines)')
        .eq('teacher_id', user.id);

      if (error) throw error;
      return (data || []).map(d => d.student).filter(Boolean) as Profile[];
    },
    enabled: !!user?.id && isTeacher,
  });

  // Get selected student's daily target
  const selectedStudentProfile = useMemo(() => {
    if (!selectedStudent || !assignedStudents) return null;
    return assignedStudents.find(s => s.id === selectedStudent) || null;
  }, [selectedStudent, assignedStudents]);

  const dailyTarget = selectedStudentProfile?.daily_target_lines || 10;
  const linesNum = parseInt(linesCompleted) || 0;
  const needsVarianceReason = linesNum > 0 && linesNum < dailyTarget;

  // Validation
  const isFormValid = useMemo(() => {
    // For teacher leave/absent statuses, don't require student selection
    const isTeacherStatus = ['teacher_absent', 'teacher_leave', 'holiday'].includes(selectedStatus);
    
    if (!isTeacherStatus && !selectedStudent) return false;
    if (!classTime) return false;
    
    if (requiresReason(selectedStatus)) {
      if (!reasonCategory) return false;
      if (reasonCategory === 'other' && !reasonText.trim()) return false;
    }
    
    if (requiresReschedule(selectedStatus)) {
      if (!rescheduleDate || !rescheduleTime) return false;
    }
    
    // Variance reason required when lines below target
    if (needsVarianceReason && !varianceReason) return false;
    
    return true;
  }, [selectedStudent, selectedStatus, classTime, reasonCategory, reasonText, rescheduleDate, rescheduleTime, needsVarianceReason, varianceReason]);

  // Fetch attendance records
  const { data: attendanceRecords, isLoading } = useQuery({
    queryKey: ['attendance', user?.id, monthFilter],
    queryFn: async () => {
      if (!user?.id) return [];

      const startDate = startOfMonth(parseISO(`${monthFilter}-01`));
      const endDate = endOfMonth(startDate);

      let query = supabase
        .from('attendance')
        .select(`
          id,
          class_date,
          class_time,
          duration_minutes,
          status,
          reason,
          lesson_covered,
          homework,
          student_id,
          teacher_id,
          absence_type,
          reason_category,
          reason_text,
          reschedule_date,
          reschedule_time,
          student:profiles!attendance_student_id_fkey(full_name),
          teacher:profiles!attendance_teacher_id_fkey(full_name)
        `)
        .gte('class_date', format(startDate, 'yyyy-MM-dd'))
        .lte('class_date', format(endDate, 'yyyy-MM-dd'))
        .order('class_date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AttendanceRecord[];
    },
    enabled: !!user?.id,
  });

  // Mark attendance mutation
  const markAttendance = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Missing user');
      
      const isTeacherStatus = ['teacher_absent', 'teacher_leave', 'holiday'].includes(selectedStatus);
      
      // For teacher statuses, we still need a student_id - use first assigned student or throw error
      let studentId = selectedStudent;
      if (isTeacherStatus && !studentId && assignedStudents && assignedStudents.length > 0) {
        studentId = assignedStudents[0].id;
      }
      
      if (!studentId && !isTeacherStatus) {
        throw new Error('Please select a student');
      }

      // Build the auto-generated note for rescheduled
      let finalReason = reason;
      if (selectedStatus === 'rescheduled' && rescheduleDate && rescheduleTime) {
        finalReason = `Class rescheduled from ${classDate} ${classTime} to ${rescheduleDate} ${rescheduleTime}`;
      }

      // Build lesson_covered from structured fields for backward compatibility
      let lessonCoveredText = '';
      if (surahName && ayahFrom && ayahTo) {
        lessonCoveredText = `${surahName}, Ayah ${ayahFrom}-${ayahTo}`;
      } else if (surahName && ayahFrom) {
        lessonCoveredText = `${surahName}, Ayah ${ayahFrom}`;
      } else if (surahName) {
        lessonCoveredText = surahName;
      }

      const { error } = await supabase.from('attendance').insert({
        student_id: studentId || user.id,
        teacher_id: user.id,
        class_date: classDate,
        class_time: classTime,
        duration_minutes: parseInt(duration),
        status: selectedStatus,
        reason: finalReason || null,
        lesson_covered: lessonCoveredText || null,
        homework: homework || null,
        reason_category: reasonCategory || null,
        reason_text: reasonCategory === 'other' ? reasonText : null,
        reschedule_date: rescheduleDate || null,
        reschedule_time: rescheduleTime || null,
        surah_name: surahName || null,
        ayah_from: ayahFrom ? parseInt(ayahFrom) : null,
        ayah_to: ayahTo ? parseInt(ayahTo) : null,
        lines_completed: linesCompleted ? parseInt(linesCompleted) : null,
        variance_reason: needsVarianceReason ? varianceReason : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Attendance Marked', description: 'Attendance has been recorded successfully.' });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      resetForm();
      setMarkDialogOpen(false);
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to mark attendance',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setSelectedStudent('');
    setSelectedStatus('present');
    setClassTime('09:00');
    setClassDate(format(new Date(), 'yyyy-MM-dd'));
    setDuration('30');
    setReason('');
    setLessonCovered('');
    setHomework('');
    setReasonCategory('');
    setReasonText('');
    setRescheduleDate('');
    setRescheduleTime('');
    setSurahName('');
    setAyahFrom('');
    setAyahTo('');
    setLinesCompleted('');
    setVarianceReason('');
  };

  const filteredRecords = useMemo(() => {
    if (!attendanceRecords) return [];
    if (filter === 'all') return attendanceRecords;
    return attendanceRecords.filter(r => r.status === filter);
  }, [attendanceRecords, filter]);

  const stats = useMemo(() => {
    const records = attendanceRecords || [];
    return {
      total: records.length,
      present: records.filter(r => r.status === 'present').length,
      studentAbsent: records.filter(r => r.status === 'student_absent').length,
      teacherOff: records.filter(r => ['teacher_absent', 'teacher_leave'].includes(r.status)).length,
      rescheduled: records.filter(r => r.status === 'rescheduled').length,
      holiday: records.filter(r => r.status === 'holiday').length,
    };
  }, [attendanceRecords]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-emerald-light" />;
      case 'student_absent':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'teacher_absent':
      case 'teacher_leave':
        return <UserX className="h-4 w-4 text-accent" />;
      case 'rescheduled':
        return <CalendarClock className="h-4 w-4 text-primary" />;
      case 'holiday':
        return <Palmtree className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return option?.label || status;
  };

  const months = [
    { value: `${new Date().getFullYear()}-01`, label: 'January' },
    { value: `${new Date().getFullYear()}-02`, label: 'February' },
    { value: `${new Date().getFullYear()}-03`, label: 'March' },
    { value: `${new Date().getFullYear()}-04`, label: 'April' },
    { value: `${new Date().getFullYear()}-05`, label: 'May' },
    { value: `${new Date().getFullYear()}-06`, label: 'June' },
    { value: `${new Date().getFullYear()}-07`, label: 'July' },
    { value: `${new Date().getFullYear()}-08`, label: 'August' },
    { value: `${new Date().getFullYear()}-09`, label: 'September' },
    { value: `${new Date().getFullYear()}-10`, label: 'October' },
    { value: `${new Date().getFullYear()}-11`, label: 'November' },
    { value: `${new Date().getFullYear()}-12`, label: 'December' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Attendance Records</h1>
            <p className="text-muted-foreground mt-1">
              {isTeacher ? 'Mark and manage class attendance' : 
               isStudent ? 'View your attendance history' : 
               'View attendance across the academy'}
            </p>
          </div>
          {isTeacher && (
            <Button onClick={() => setMarkDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Mark Attendance
            </Button>
          )}
        </div>

        {/* Stats - Enhanced for Admin */}
        <div className={cn("grid gap-4", isAdmin ? "grid-cols-2 md:grid-cols-6" : "grid-cols-2 md:grid-cols-4")}>
          <Card className="text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Classes</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-light/10 border-emerald-light/20 text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-emerald-light">{stats.present}</p>
              <p className="text-sm text-emerald-light/80">Present</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/10 border-destructive/20 text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-destructive">{stats.studentAbsent}</p>
              <p className="text-sm text-destructive/80">Student Absent</p>
            </CardContent>
          </Card>
          {isAdmin && (
            <>
              <Card className="bg-accent/10 border-accent/20 text-center">
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-accent">{stats.teacherOff}</p>
                  <p className="text-sm text-accent/80">Teacher Off</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/10 border-primary/20 text-center">
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-primary">{stats.rescheduled}</p>
                  <p className="text-sm text-primary/80">Rescheduled</p>
                </CardContent>
              </Card>
              <Card className="bg-muted text-center">
                <CardContent className="pt-6">
                  <p className="text-2xl font-serif font-bold text-muted-foreground">{stats.holiday}</p>
                  <p className="text-sm text-muted-foreground">Holidays</p>
                </CardContent>
              </Card>
            </>
          )}
          {!isAdmin && (
            <Card className="bg-accent/10 border-accent/20 text-center">
              <CardContent className="pt-6">
                <p className="text-2xl font-serif font-bold text-accent">{stats.rescheduled}</p>
                <p className="text-sm text-accent/80">Rescheduled</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No attendance records found</p>
                <p className="text-sm mt-1">
                  {isTeacher ? 'Start marking attendance for your students' : 
                   'Attendance records will appear here once marked'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {!isStudent && <TableHead>Student</TableHead>}
                    {isAdmin && <TableHead>Teacher</TableHead>}
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lesson Covered</TableHead>
                    {(isTeacher || isAdmin) && <TableHead>Reason</TableHead>}
                    {isAdmin && <TableHead>Reschedule Info</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(parseISO(record.class_date), 'MMM dd, yyyy')}
                        </span>
                      </TableCell>
                      {!isStudent && (
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{record.student?.full_name || 'Unknown'}</span>
                          </span>
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell>{record.teacher?.full_name || 'Unknown'}</TableCell>
                      )}
                      <TableCell>{record.class_time?.substring(0, 5) || '-'}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                          record.status === 'present' && "bg-emerald-light/10 text-emerald-light",
                          record.status === 'student_absent' && "bg-destructive/10 text-destructive",
                          ['teacher_absent', 'teacher_leave'].includes(record.status) && "bg-accent/10 text-accent",
                          record.status === 'rescheduled' && "bg-primary/10 text-primary",
                          record.status === 'holiday' && "bg-muted text-muted-foreground"
                        )}>
                          {getStatusIcon(record.status)}
                          {getStatusLabel(record.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {record.lesson_covered || '-'}
                      </TableCell>
                      {(isTeacher || isAdmin) && (
                        <TableCell className="text-muted-foreground max-w-[150px]">
                          {record.reason_category ? (
                            <span className="capitalize">
                              {record.reason_category === 'other' 
                                ? record.reason_text 
                                : record.reason_category.replace('_', ' ')}
                            </span>
                          ) : record.reason || '-'}
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell className="text-muted-foreground">
                          {record.reschedule_date ? (
                            <span className="text-xs">
                              {format(parseISO(record.reschedule_date), 'MMM dd')} {record.reschedule_time?.substring(0, 5)}
                            </span>
                          ) : '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Mark Attendance Dialog */}
        <Dialog open={markDialogOpen} onOpenChange={setMarkDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif">Mark Attendance</DialogTitle>
              <DialogDescription>
                Record attendance for a class
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Status Selection */}
              <div className="space-y-2">
                <Label>Status <span className="text-destructive">*</span></Label>
                <Select value={selectedStatus} onValueChange={(v) => {
                  setSelectedStatus(v as AttendanceStatus);
                  // Reset conditional fields when status changes
                  setReasonCategory('');
                  setReasonText('');
                  setRescheduleDate('');
                  setRescheduleTime('');
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student Selection - Only show for non-teacher statuses */}
              {!['teacher_absent', 'teacher_leave', 'holiday'].includes(selectedStatus) && (
                <div className="space-y-2">
                  <Label>Student <span className="text-destructive">*</span></Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {(assignedStudents || []).map((student) => (
                        <SelectItem key={student.id} value={student.id}>{student.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignedStudents?.length === 0 && (
                    <p className="text-sm text-muted-foreground">No students assigned to you yet.</p>
                  )}
                </div>
              )}

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Class Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Class Time <span className="text-destructive">*</span></Label>
                  <Input type="time" value={classTime} onChange={(e) => setClassTime(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>

              {/* Reason Category - Required for absence statuses */}
              {requiresReason(selectedStatus) && (
                <>
                  <div className="space-y-2">
                    <Label>Reason <span className="text-destructive">*</span></Label>
                    <Select value={reasonCategory} onValueChange={(v) => setReasonCategory(v as ReasonCategory)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {REASON_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Text reason for "Other" */}
                  {reasonCategory === 'other' && (
                    <div className="space-y-2">
                      <Label>Specify Reason <span className="text-destructive">*</span></Label>
                      <Textarea
                        placeholder="Please specify the reason..."
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        rows={2}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Reschedule Fields */}
              {requiresReschedule(selectedStatus) && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-foreground">Reschedule Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>New Date <span className="text-destructive">*</span></Label>
                      <Input 
                        type="date" 
                        value={rescheduleDate} 
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>New Time <span className="text-destructive">*</span></Label>
                      <Input 
                        type="time" 
                        value={rescheduleTime} 
                        onChange={(e) => setRescheduleTime(e.target.value)} 
                      />
                    </div>
                  </div>
                  {rescheduleDate && rescheduleTime && (
                    <p className="text-xs text-muted-foreground italic">
                      Auto-note: Class rescheduled from {classDate} {classTime} to {rescheduleDate} {rescheduleTime}
                    </p>
                  )}
                </div>
              )}

              {/* Quran Progress Section - Only for present/rescheduled */}
              {['present', 'rescheduled'].includes(selectedStatus) && (
                <>
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium text-foreground">Quran Progress</p>
                    
                    <div className="space-y-2">
                      <Label>Surah Name</Label>
                      <Input
                        placeholder="e.g., Al-Baqarah"
                        value={surahName}
                        onChange={(e) => setSurahName(e.target.value)}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Ayah From</Label>
                        <Input
                          type="number"
                          placeholder="1"
                          min="1"
                          value={ayahFrom}
                          onChange={(e) => setAyahFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ayah To</Label>
                        <Input
                          type="number"
                          placeholder="5"
                          min="1"
                          value={ayahTo}
                          onChange={(e) => setAyahTo(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Lines Completed</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        min="0"
                        value={linesCompleted}
                        onChange={(e) => setLinesCompleted(e.target.value)}
                      />
                      {selectedStudentProfile && (
                        <p className="text-xs text-muted-foreground">
                          Daily target: {dailyTarget} lines ({selectedStudentProfile.mushaf_type || '15-line'} mushaf)
                        </p>
                      )}
                    </div>
                    
                    {/* Variance Reason - Required when lines < target */}
                    {needsVarianceReason && (
                      <div className="space-y-2">
                        <Label>Variance Reason <span className="text-destructive">*</span></Label>
                        <Select value={varianceReason} onValueChange={(v) => setVarianceReason(v as VarianceReason)}>
                          <SelectTrigger className="border-destructive/50">
                            <SelectValue placeholder="Why below target?" />
                          </SelectTrigger>
                          <SelectContent>
                            {VARIANCE_REASONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-destructive">
                          Lines completed ({linesNum}) is below the daily target ({dailyTarget})
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Homework</Label>
                    <Textarea
                      placeholder="Enter homework or notes..."
                      value={homework}
                      onChange={(e) => setHomework(e.target.value)}
                      rows={2}
                    />
                  </div>
                </>
              )}

              {/* Optional free-text reason for non-required statuses */}
              {!requiresReason(selectedStatus) && !requiresReschedule(selectedStatus) && selectedStatus !== 'present' && (
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Optional notes..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { resetForm(); setMarkDialogOpen(false); }}>
                Cancel
              </Button>
              <Button 
                onClick={() => markAttendance.mutate()} 
                disabled={!isFormValid || markAttendance.isPending}
              >
                {markAttendance.isPending ? 'Saving...' : 'Save Attendance'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
