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
import { Calendar, CheckCircle, XCircle, AlertCircle, User, Plus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

interface AttendanceRecord {
  id: string;
  class_date: string;
  class_time: string;
  duration_minutes: number;
  status: 'present' | 'absent' | 'late';
  reason: string | null;
  lesson_covered: string | null;
  homework: string | null;
  student_id: string;
  teacher_id: string;
  student?: { full_name: string };
  teacher?: { full_name: string };
}

interface Profile {
  id: string;
  full_name: string;
}

export default function Attendance() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filter, setFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  
  // Form state for marking attendance
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'present' | 'absent' | 'late'>('present');
  const [classTime, setClassTime] = useState('09:00');
  const [duration, setDuration] = useState('30');
  const [reason, setReason] = useState('');
  const [lessonCovered, setLessonCovered] = useState('');
  const [homework, setHomework] = useState('');

  const userRole = profile?.role;
  const isAdmin = userRole === 'super_admin' || userRole === 'admin' || 
    userRole === 'admin_admissions' || userRole === 'admin_fees' || userRole === 'admin_academic';
  const isTeacher = userRole === 'teacher' || userRole === 'examiner';
  const isStudent = userRole === 'student';

  // Fetch assigned students (for teacher)
  const { data: assignedStudents } = useQuery({
    queryKey: ['assigned-students', user?.id],
    queryFn: async () => {
      if (!user?.id || !isTeacher) return [];
      
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name)')
        .eq('teacher_id', user.id);

      if (error) throw error;
      return (data || []).map(d => d.student).filter(Boolean) as Profile[];
    },
    enabled: !!user?.id && isTeacher,
  });

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
      if (!user?.id || !selectedStudent) throw new Error('Missing required data');

      const { error } = await supabase.from('attendance').insert({
        student_id: selectedStudent,
        teacher_id: user.id,
        class_date: format(new Date(), 'yyyy-MM-dd'),
        class_time: classTime,
        duration_minutes: parseInt(duration),
        status: selectedStatus,
        reason: reason || null,
        lesson_covered: lessonCovered || null,
        homework: homework || null,
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
    setDuration('30');
    setReason('');
    setLessonCovered('');
    setHomework('');
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
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
    };
  }, [attendanceRecords]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-emerald-light" />;
      case 'absent':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'late':
        return <AlertCircle className="h-4 w-4 text-accent" />;
    }
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <Card className="bg-accent/10 border-accent/20 text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-accent">{stats.late}</p>
              <p className="text-sm text-accent/80">Late</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/10 border-destructive/20 text-center">
            <CardContent className="pt-6">
              <p className="text-2xl font-serif font-bold text-destructive">{stats.absent}</p>
              <p className="text-sm text-destructive/80">Absent</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="late">Late</SelectItem>
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
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize",
                          record.status === 'present' && "bg-emerald-light/10 text-emerald-light",
                          record.status === 'absent' && "bg-destructive/10 text-destructive",
                          record.status === 'late' && "bg-accent/10 text-accent"
                        )}>
                          {getStatusIcon(record.status)}
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {record.lesson_covered || '-'}
                      </TableCell>
                      {(isTeacher || isAdmin) && (
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">
                          {record.reason || '-'}
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
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif">Mark Attendance</DialogTitle>
              <DialogDescription>
                Record attendance for today's class
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Student</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as 'present' | 'absent' | 'late')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Class Time</Label>
                  <Input type="time" value={classTime} onChange={(e) => setClassTime(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>

              {selectedStatus !== 'present' && (
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Textarea
                    placeholder="Enter reason for absence or being late..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>
              )}

              {selectedStatus !== 'absent' && (
                <>
                  <div className="space-y-2">
                    <Label>Lesson Covered</Label>
                    <Input
                      placeholder="e.g., Surah Al-Baqarah, Ayat 1-5"
                      value={lessonCovered}
                      onChange={(e) => setLessonCovered(e.target.value)}
                    />
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
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setMarkDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => markAttendance.mutate()} 
                disabled={!selectedStudent || markAttendance.isPending}
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
