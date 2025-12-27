import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  Loader2,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface StudentWithDetails {
  id: string;
  full_name: string;
  gender: string | null;
  age: number | null;
  subject_name?: string;
  last_lesson?: {
    sabaq: string | null;
    lesson_covered: string | null;
    homework: string | null;
    class_date: string;
  };
}

type LessonStatus = 'present' | 'absent' | 'late';

export default function TeacherNazraDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null);
  const [isMarkDialogOpen, setIsMarkDialogOpen] = useState(false);
  
  // Form state
  const [status, setStatus] = useState<LessonStatus>('present');
  const [sabaq, setSabaq] = useState('');
  const [revisionDone, setRevisionDone] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [homework, setHomework] = useState('');
  const [classDate, setClassDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [classTime, setClassTime] = useState(format(new Date(), 'HH:mm'));

  // Fetch assigned students with their details and last lesson – filtered by teacher_id
  const { data: students, isLoading } = useQuery({
    queryKey: ['teacher-students', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Only get students assigned specifically to this teacher via student_teacher_assignments
      const { data: assignments, error: assignError } = await supabase
        .from('student_teacher_assignments')
        .select('student_id')
        .eq('teacher_id', user.id);

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) return [];

      const studentIds = assignments.map(a => a.student_id);

      // Fetch profiles for those students
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, gender, age')
        .in('id', studentIds);

      if (profilesError) throw profilesError;

      // Get last lesson for each student
      const studentsWithDetails: StudentWithDetails[] = await Promise.all(
        (profilesData || []).map(async (student) => {
          const { data: lastLesson } = await supabase
            .from('attendance')
            .select('sabaq, lesson_covered, homework, class_date')
            .eq('student_id', student.id)
            .eq('teacher_id', user.id)
            .order('class_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: student.id,
            full_name: student.full_name,
            gender: student.gender,
            age: student.age,
            last_lesson: lastLesson || undefined,
          };
        })
      );

      return studentsWithDetails;
    },
    enabled: !!user?.id,
  });

  // Stats
  const stats = useMemo(() => {
    return {
      totalStudents: students?.length || 0,
      lessonsToday: 0, // Would need separate query
    };
  }, [students]);

  // Mark lesson mutation
  const markLessonMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedStudent) throw new Error('Missing data');

      const { error } = await supabase.from('attendance').insert({
        student_id: selectedStudent.id,
        teacher_id: user.id,
        class_date: classDate,
        class_time: classTime,
        duration_minutes: 30,
        status: status,
        sabaq: sabaq || null,
        revision_done: revisionDone,
        revision_notes: revisionNotes || null,
        homework: homework || null,
        lesson_covered: sabaq || null, // For backward compatibility
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Lesson Marked', description: 'Attendance recorded successfully.' });
      queryClient.invalidateQueries({ queryKey: ['teacher-students'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      resetForm();
      setIsMarkDialogOpen(false);
      setSelectedStudent(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark lesson',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setStatus('present');
    setSabaq('');
    setRevisionDone(false);
    setRevisionNotes('');
    setHomework('');
    setClassDate(format(new Date(), 'yyyy-MM-dd'));
    setClassTime(format(new Date(), 'HH:mm'));
  };

  const handleStudentClick = (student: StudentWithDetails) => {
    setSelectedStudent(student);
    setIsMarkDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
            Assalamu Alaikum, {profile?.full_name?.split(' ')[0] || 'Teacher'}
          </h1>
          <p className="text-muted-foreground mt-1">Your Nazra class dashboard</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-light/10 rounded-full">
                  <BookOpen className="h-6 w-6 text-emerald-light" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.lessonsToday}</p>
                  <p className="text-sm text-muted-foreground">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Class List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Students</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : students && students.length > 0 ? (
              <div className="space-y-3">
                {students.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleStudentClick(student)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 transition-all",
                      "hover:border-primary hover:shadow-md",
                      "flex items-center justify-between text-left",
                      "bg-card"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-full">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{student.full_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {student.age && <span>Age: {student.age}</span>}
                          {student.gender && <span className="capitalize">• {student.gender}</span>}
                        </div>
                        {student.last_lesson && (
                          <p className="text-xs text-primary mt-1">
                            Last: {student.last_lesson.sabaq || student.last_lesson.lesson_covered || 'No lesson recorded'}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="default" className="flex">
                      <BookOpen className="h-3 w-3 mr-1" />
                      Log Lesson
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No students assigned yet</p>
                <p className="text-sm">Contact admin to assign students</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mark Lesson Dialog */}
        <Dialog open={isMarkDialogOpen} onOpenChange={setIsMarkDialogOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {selectedStudent?.full_name}
              </DialogTitle>
            </DialogHeader>

            {/* Last Lesson Info */}
            {selectedStudent?.last_lesson && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <p className="text-sm font-medium mb-1">Last Lesson ({selectedStudent.last_lesson.class_date})</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedStudent.last_lesson.sabaq || selectedStudent.last_lesson.lesson_covered || 'No details'}
                  </p>
                  {selectedStudent.last_lesson.homework && (
                    <p className="text-xs text-accent mt-1">
                      Homework: {selectedStudent.last_lesson.homework}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-4 pt-2">
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={classDate}
                    onChange={(e) => setClassDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={classTime}
                    onChange={(e) => setClassTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Status - Large Buttons for Mobile */}
              <div className="space-y-2">
                <Label>Status *</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={status === 'present' ? 'default' : 'outline'}
                    className={cn(
                      "h-14 flex-col gap-1",
                      status === 'present' && "bg-emerald-light hover:bg-emerald-light/90"
                    )}
                    onClick={() => setStatus('present')}
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-xs">Present</span>
                  </Button>
                  <Button
                    type="button"
                    variant={status === 'absent' ? 'default' : 'outline'}
                    className={cn(
                      "h-14 flex-col gap-1",
                      status === 'absent' && "bg-destructive hover:bg-destructive/90"
                    )}
                    onClick={() => setStatus('absent')}
                  >
                    <XCircle className="h-5 w-5" />
                    <span className="text-xs">Absent</span>
                  </Button>
                  <Button
                    type="button"
                    variant={status === 'late' ? 'default' : 'outline'}
                    className={cn(
                      "h-14 flex-col gap-1",
                      status === 'late' && "bg-accent hover:bg-accent/90"
                    )}
                    onClick={() => setStatus('late')}
                  >
                    <Clock className="h-5 w-5" />
                    <span className="text-xs">Late</span>
                  </Button>
                </div>
              </div>

              {/* Sabaq (New Lesson) */}
              <div className="space-y-2">
                <Label>Sabaq (New Lesson)</Label>
                <Textarea
                  value={sabaq}
                  onChange={(e) => setSabaq(e.target.value)}
                  placeholder="e.g., Surah Al-Fatiha, Ayah 1-7"
                  rows={2}
                />
              </div>

              {/* Revision Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <Label className="font-medium">Revision Done?</Label>
                  <p className="text-sm text-muted-foreground">Sabqi/Manzil completed</p>
                </div>
                <Switch
                  checked={revisionDone}
                  onCheckedChange={setRevisionDone}
                />
              </div>

              {/* Revision Notes (shown when revision is done) */}
              {revisionDone && (
                <div className="space-y-2">
                  <Label>Revision Notes</Label>
                  <Textarea
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    placeholder="What was revised?"
                    rows={2}
                  />
                </div>
              )}

              {/* Homework */}
              <div className="space-y-2">
                <Label>Homework / Notes for Parent</Label>
                <Textarea
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  placeholder="Any homework or notes..."
                  rows={2}
                />
              </div>

              {/* Submit Button - Large for Mobile */}
              <Button 
                className="w-full h-14 text-lg btn-primary-glow" 
                disabled={markLessonMutation.isPending}
                onClick={() => markLessonMutation.mutate()}
              >
                {markLessonMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Save Lesson
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
