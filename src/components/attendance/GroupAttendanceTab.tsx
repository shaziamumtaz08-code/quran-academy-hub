import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Users, Clock, Save, CheckCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isAfter } from 'date-fns';

type BulkStatus = 'present' | 'student_absent' | 'teacher_leave';

interface StudentMark {
  student_id: string;
  full_name: string;
  status: BulkStatus;
}

export function GroupAttendanceTab() {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [classDate, setClassDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [classTime, setClassTime] = useState('09:00');
  const [duration, setDuration] = useState('30');
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);

  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' ||
    activeRole === 'admin_admissions' || activeRole === 'admin_fees' || activeRole === 'admin_academic';
  const isTeacher = activeRole === 'teacher' || activeRole === 'examiner';

  const isDateFuture = useMemo(() => {
    if (!classDate) return false;
    const selected = parseISO(classDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return isAfter(selected, today);
  }, [classDate]);

  // Fetch active courses (admin sees all, teacher sees own)
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['group-courses', user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('courses')
        .select('id, name, teacher_id, status')
        .eq('status', 'active')
        .eq('is_group_class', true);

      if (isTeacher) {
        query = query.eq('teacher_id', user.id);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch enrolled students for selected course
  const { data: enrolledStudents, isLoading: enrolledLoading } = useQuery({
    queryKey: ['course-enrolled-students', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('student_id, student:profiles!course_enrollments_student_id_fkey(id, full_name)')
        .eq('course_id', selectedCourseId)
        .eq('status', 'active');
      if (error) throw error;
      return (data || [])
        .filter(d => d.student)
        .map(d => ({ student_id: d.student_id, full_name: (d.student as any).full_name }));
    },
    enabled: !!selectedCourseId,
  });

  // Check for existing attendance on selected date for this course
  const { data: existingAttendance } = useQuery({
    queryKey: ['group-attendance-existing', selectedCourseId, classDate],
    queryFn: async () => {
      if (!selectedCourseId || !classDate) return [];
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id')
        .eq('course_id', selectedCourseId)
        .eq('class_date', classDate);
      if (error) throw error;
      return (data || []).map(d => d.student_id);
    },
    enabled: !!selectedCourseId && !!classDate,
  });

  const alreadyMarkedIds = new Set(existingAttendance || []);

  // Initialize student marks when enrolled students load
  React.useEffect(() => {
    if (enrolledStudents && enrolledStudents.length > 0) {
      setStudentMarks(
        enrolledStudents.map(s => ({
          student_id: s.student_id,
          full_name: s.full_name,
          status: 'present' as BulkStatus,
        }))
      );
    } else {
      setStudentMarks([]);
    }
  }, [enrolledStudents]);

  const selectedCourse = courses?.find(c => c.id === selectedCourseId);

  const toggleStudentStatus = (studentId: string) => {
    setStudentMarks(prev =>
      prev.map(s =>
        s.student_id === studentId
          ? { ...s, status: s.status === 'present' ? 'student_absent' : s.status === 'student_absent' ? 'teacher_leave' : 'present' }
          : s
      )
    );
  };

  const markAllPresent = () => {
    setStudentMarks(prev => prev.map(s => ({ ...s, status: 'present' })));
  };

  // Filter out already-marked students
  const unmarkedStudents = studentMarks.filter(s => !alreadyMarkedIds.has(s.student_id));
  const hasAllMarked = unmarkedStudents.length === 0 && studentMarks.length > 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedCourseId || !selectedCourse) throw new Error('Missing data');

      const rows = unmarkedStudents.map(s => ({
        student_id: s.student_id,
        teacher_id: selectedCourse.teacher_id,
        class_date: classDate,
        class_time: classTime,
        duration_minutes: parseInt(duration),
        status: s.status,
        course_id: selectedCourseId,
      }));

      if (rows.length === 0) throw new Error('All students already have attendance for this date');

      const { error } = await supabase.from('attendance').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Saved', description: `Attendance saved for ${unmarkedStudents.length} student(s).` });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['group-attendance-existing'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save', variant: 'destructive' });
    },
  });

  const canSave = selectedCourseId && classDate && classTime && !isDateFuture && unmarkedStudents.length > 0;

  return (
    <div className="space-y-6">
      {/* Course & Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Users className="h-5 w-5" />
            Group Class Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Course <span className="text-destructive">*</span></Label>
              {coursesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {(courses || []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {courses?.length === 0 && (
                <p className="text-xs text-muted-foreground">No active group courses found.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Class Date <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={classDate}
                onChange={e => setClassDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div className="space-y-2">
              <Label>Class Time <span className="text-destructive">*</span></Label>
              <Input type="time" value={classTime} onChange={e => setClassTime(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
          </div>

          {isDateFuture && (
            <Alert className="bg-destructive/10 border-destructive/30">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive">Cannot mark attendance for future dates.</AlertDescription>
            </Alert>
          )}

          {hasAllMarked && (
            <Alert className="bg-amber-500/10 border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                All enrolled students already have attendance recorded for {format(parseISO(classDate), 'dd MMM yyyy')}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Student List */}
      {selectedCourseId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">
              Enrolled Students ({studentMarks.length})
              {alreadyMarkedIds.size > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({alreadyMarkedIds.size} already marked)
                </span>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={markAllPresent}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark All Present
            </Button>
          </CardHeader>
          <CardContent>
            {enrolledLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : studentMarks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No students enrolled in this course.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-40 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentMarks.map(s => {
                    const alreadyDone = alreadyMarkedIds.has(s.student_id);
                    return (
                      <TableRow key={s.student_id} className={alreadyDone ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell className="text-center">
                          {alreadyDone ? (
                            <span className="text-xs text-muted-foreground italic">Already marked</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "min-w-[100px] gap-1.5",
                                s.status === 'present' && "text-emerald-light hover:text-emerald-light",
                                s.status === 'student_absent' && "text-destructive hover:text-destructive",
                                s.status === 'teacher_leave' && "text-accent hover:text-accent",
                              )}
                              onClick={() => toggleStudentStatus(s.student_id)}
                            >
                              {s.status === 'present' && <><CheckCircle className="h-4 w-4" /> Present</>}
                              {s.status === 'student_absent' && <><XCircle className="h-4 w-4" /> Absent</>}
                              {s.status === 'teacher_leave' && <><Clock className="h-4 w-4" /> Leave</>}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>

          {/* Save Button */}
          {studentMarks.length > 0 && (
            <div className="px-6 pb-6">
              <Button
                className="w-full"
                disabled={!canSave || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : `Save Class Attendance (${unmarkedStudents.length} students)`}
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
