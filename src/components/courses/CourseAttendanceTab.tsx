import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, CheckCircle2, XCircle, Clock, Users, Plus, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface CourseAttendanceTabProps {
  courseId: string;
}

export function CourseAttendanceTab({ courseId }: CourseAttendanceTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  const [markDate, setMarkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [markTime, setMarkTime] = useState('09:00');
  const [markingClassId, setMarkingClassId] = useState<string>('');
  const [studentStatuses, setStudentStatuses] = useState<Record<string, { status: string; notes: string }>>({});

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['course-classes-attendance', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_classes')
        .select('id, name, schedule_days, schedule_time')
        .eq('course_id', courseId)
        .eq('status', 'active');
      return data || [];
    },
  });

  // Fetch enrolled students per class
  const { data: classStudents = [] } = useQuery({
    queryKey: ['course-class-students-attendance', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_class_students')
        .select('class_id, student_id, student:profiles!course_class_students_student_id_fkey(id, full_name, email)')
        .in('class_id', classes.map(c => c.id));
      return (data || []) as any[];
    },
    enabled: classes.length > 0,
  });

  // Fetch attendance records for this course
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['course-attendance-records', courseId, selectedClassId],
    queryFn: async () => {
      let query = supabase
        .from('attendance')
        .select('*, student:profiles!attendance_student_id_fkey(full_name)')
        .eq('course_id', courseId)
        .order('class_date', { ascending: false })
        .limit(200);
      
      if (selectedClassId !== 'all') {
        // Filter by students in that class
        const studentsInClass = classStudents
          .filter(cs => cs.class_id === selectedClassId)
          .map(cs => cs.student_id);
        if (studentsInClass.length > 0) {
          query = query.in('student_id', studentsInClass);
        }
      }
      
      const { data } = await query;
      return data || [];
    },
    enabled: classes.length > 0,
  });

  // Group attendance by date
  const attendanceByDate = React.useMemo(() => {
    const grouped: Record<string, typeof attendanceRecords> = {};
    attendanceRecords.forEach(record => {
      const date = record.class_date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(record);
    });
    return grouped;
  }, [attendanceRecords]);

  const dates = Object.keys(attendanceByDate).sort((a, b) => b.localeCompare(a));

  // Stats
  const totalRecords = attendanceRecords.length;
  const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
  const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
  const lateCount = attendanceRecords.filter(r => r.status === 'late').length;

  const openMarkDialog = (classId: string) => {
    setMarkingClassId(classId);
    const cls = classes.find(c => c.id === classId);
    setMarkTime(cls?.schedule_time || '09:00');
    
    const students = classStudents.filter(cs => cs.class_id === classId);
    const statuses: Record<string, { status: string; notes: string }> = {};
    students.forEach(s => {
      statuses[s.student_id] = { status: 'present', notes: '' };
    });
    setStudentStatuses(statuses);
    setMarkDialogOpen(true);
  };

  const markAttendance = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(studentStatuses).map(([studentId, { status, notes }]) => ({
        student_id: studentId,
        teacher_id: user?.id || '',
        course_id: courseId,
        class_date: markDate,
        class_time: markTime,
        status,
        lesson_notes: notes || null,
        duration_minutes: 30,
      }));
      
      const { error } = await supabase.from('attendance').insert(entries);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-attendance-records', courseId] });
      setMarkDialogOpen(false);
      toast({ title: 'Attendance marked successfully' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const studentsForMarkingClass = classStudents.filter(cs => cs.class_id === markingClassId);

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalRecords}</p>
            <p className="text-xs text-muted-foreground">Total Records</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{presentCount}</p>
            <p className="text-xs text-muted-foreground">Present</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{absentCount}</p>
            <p className="text-xs text-muted-foreground">Absent</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{lateCount}</p>
            <p className="text-xs text-muted-foreground">Late</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(cls => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {classes.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {classes.map(cls => (
              <Button key={cls.id} size="sm" variant="outline" onClick={() => openMarkDialog(cls.id)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Mark {cls.name}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Attendance History */}
      {dates.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No attendance records yet</p>
            <p className="text-xs text-muted-foreground mt-1">Mark attendance for a class to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {dates.map(date => (
            <Card key={date} className="border-border">
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {format(new Date(date + 'T00:00:00'), 'EEEE, MMM d, yyyy')}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {attendanceByDate[date].length} students
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Student</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceByDate[date].map(record => (
                        <TableRow key={record.id}>
                          <TableCell className="text-sm font-medium">{(record as any).student?.full_name || 'Unknown'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{record.class_time}</TableCell>
                          <TableCell>
                            <Badge variant={record.status === 'present' ? 'default' : record.status === 'absent' ? 'destructive' : 'secondary'} className="text-xs">
                              {record.status === 'present' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {record.status === 'absent' && <XCircle className="h-3 w-3 mr-1" />}
                              {record.status === 'late' && <Clock className="h-3 w-3 mr-1" />}
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                            {record.lesson_notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mark Attendance Dialog */}
      <Dialog open={markDialogOpen} onOpenChange={setMarkDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mark Attendance — {classes.find(c => c.id === markingClassId)?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={markDate} onChange={e => setMarkDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Time</Label>
              <Input type="time" value={markTime} onChange={e => setMarkTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 mt-2">
            {studentsForMarkingClass.map(cs => {
              const student = cs.student as any;
              const current = studentStatuses[cs.student_id] || { status: 'present', notes: '' };
              return (
                <Card key={cs.student_id} className="border-border">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{student?.full_name || 'Unknown'}</p>
                      <Select value={current.status} onValueChange={v => setStudentStatuses(prev => ({ ...prev, [cs.student_id]: { ...prev[cs.student_id], status: v } }))}>
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">✅ Present</SelectItem>
                          <SelectItem value="absent">❌ Absent</SelectItem>
                          <SelectItem value="late">⏰ Late</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea 
                      placeholder="Notes (optional)"
                      value={current.notes}
                      onChange={e => setStudentStatuses(prev => ({ ...prev, [cs.student_id]: { ...prev[cs.student_id], notes: e.target.value } }))}
                      className="min-h-[40px] text-xs"
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => markAttendance.mutate()} disabled={markAttendance.isPending}>
              {markAttendance.isPending ? 'Saving...' : 'Save Attendance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
