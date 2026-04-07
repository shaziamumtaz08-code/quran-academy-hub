import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, FileText, Trophy, ClipboardCheck, Trash2, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';

interface CourseExamsTabProps {
  courseId: string;
}

export function CourseExamsTab({ courseId }: CourseExamsTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('exams');
  const [createQuizOpen, setCreateQuizOpen] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [quizPassingPct, setQuizPassingPct] = useState('50');
  const [quizTimeLimit, setQuizTimeLimit] = useState('');

  // Existing exams for students in this course
  const { data: enrolledStudentIds = [] } = useQuery({
    queryKey: ['course-enrolled-ids', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_enrollments')
        .select('student_id')
        .eq('course_id', courseId)
        .eq('status', 'active');
      return (data || []).map(d => d.student_id);
    },
  });

  const { data: exams = [] } = useQuery({
    queryKey: ['course-exams', courseId, enrolledStudentIds],
    queryFn: async () => {
      if (enrolledStudentIds.length === 0) return [];
      const { data } = await supabase
        .from('exams')
        .select('*, student:profiles!exams_student_id_fkey(full_name), template:exam_templates!exams_template_id_fkey(name)')
        .in('student_id', enrolledStudentIds)
        .is('deleted_at', null)
        .order('exam_date', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: enrolledStudentIds.length > 0,
  });

  // Course quizzes
  const { data: quizzes = [] } = useQuery({
    queryKey: ['course-quizzes', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_quizzes')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Quiz attempts
  const { data: attempts = [] } = useQuery({
    queryKey: ['course-quiz-attempts', courseId],
    queryFn: async () => {
      if (quizzes.length === 0) return [];
      const { data } = await supabase
        .from('course_quiz_attempts')
        .select('*, student:profiles!course_quiz_attempts_student_id_fkey(full_name)')
        .in('quiz_id', quizzes.map(q => q.id))
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
    enabled: quizzes.length > 0,
  });

  const createQuiz = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('course_quizzes').insert({
        course_id: courseId,
        title: quizTitle,
        description: quizDescription || null,
        passing_percentage: parseFloat(quizPassingPct) || 50,
        time_limit_minutes: quizTimeLimit ? parseInt(quizTimeLimit) : null,
        status: 'draft',
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-quizzes', courseId] });
      setCreateQuizOpen(false);
      setQuizTitle('');
      setQuizDescription('');
      toast({ title: 'Quiz created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleQuizStatus = useMutation({
    mutationFn: async ({ quizId, newStatus }: { quizId: string; newStatus: string }) => {
      const { error } = await supabase.from('course_quizzes').update({ status: newStatus }).eq('id', quizId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-quizzes', courseId] });
      toast({ title: 'Quiz status updated' });
    },
  });

  const deleteQuiz = useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase.from('course_quizzes').delete().eq('id', quizId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-quizzes', courseId] });
      toast({ title: 'Quiz deleted' });
    },
  });

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="exams" className="gap-1 text-xs">
            <GraduationCap className="h-3.5 w-3.5" /> Formal Exams
          </TabsTrigger>
          <TabsTrigger value="quizzes" className="gap-1 text-xs">
            <ClipboardCheck className="h-3.5 w-3.5" /> Quizzes
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-1 text-xs">
            <Trophy className="h-3.5 w-3.5" /> Results
          </TabsTrigger>
        </TabsList>

        {/* Formal Exams */}
        <TabsContent value="exams" className="mt-4">
          <Card className="border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Formal Exams for Enrolled Students</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {exams.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No exam records found for enrolled students</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Student</TableHead>
                        <TableHead className="text-xs">Template</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Score</TableHead>
                        <TableHead className="text-xs">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exams.map(exam => (
                        <TableRow key={exam.id}>
                          <TableCell className="text-sm">{(exam as any).student?.full_name || '-'}</TableCell>
                          <TableCell className="text-sm">{(exam as any).template?.name || '-'}</TableCell>
                          <TableCell className="text-sm">{format(new Date(exam.exam_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="text-sm">{exam.total_marks}/{exam.max_total_marks}</TableCell>
                          <TableCell>
                            <Badge variant={exam.percentage >= 70 ? 'default' : exam.percentage >= 50 ? 'secondary' : 'destructive'} className="text-xs">
                              {exam.percentage}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quizzes */}
        <TabsContent value="quizzes" className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Course Quizzes</h3>
            <Button size="sm" onClick={() => setCreateQuizOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Quiz
            </Button>
          </div>

          {quizzes.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No quizzes created yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {quizzes.map(quiz => {
                const quizAttempts = attempts.filter(a => a.quiz_id === quiz.id);
                return (
                  <Card key={quiz.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium">{quiz.title}</h4>
                            <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                              {quiz.status}
                            </Badge>
                          </div>
                          {quiz.description && <p className="text-xs text-muted-foreground">{quiz.description}</p>}
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>Pass: {quiz.passing_percentage}%</span>
                            {quiz.time_limit_minutes && <span>Time: {quiz.time_limit_minutes}min</span>}
                            <span>{quizAttempts.length} attempts</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" variant="ghost" className="text-xs h-7"
                            onClick={() => toggleQuizStatus.mutate({ quizId: quiz.id, newStatus: quiz.status === 'published' ? 'draft' : 'published' })}
                          >
                            {quiz.status === 'published' ? 'Unpublish' : 'Publish'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteQuiz.mutate(quiz.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Results */}
        <TabsContent value="results" className="mt-4">
          <Card className="border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Quiz Results</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No quiz attempts yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Student</TableHead>
                        <TableHead className="text-xs">Quiz</TableHead>
                        <TableHead className="text-xs">Score</TableHead>
                        <TableHead className="text-xs">%</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attempts.map(attempt => {
                        const quiz = quizzes.find(q => q.id === attempt.quiz_id);
                        return (
                          <TableRow key={attempt.id}>
                            <TableCell className="text-sm">{attempt.student?.full_name || '-'}</TableCell>
                            <TableCell className="text-sm">{quiz?.title || '-'}</TableCell>
                            <TableCell className="text-sm">{attempt.score}/{attempt.max_score}</TableCell>
                            <TableCell>
                              <Badge variant={attempt.percentage >= (quiz?.passing_percentage || 50) ? 'default' : 'destructive'} className="text-xs">
                                {attempt.percentage}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={attempt.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                                {attempt.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(attempt.created_at), 'MMM d, yyyy')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Quiz Dialog */}
      <Dialog open={createQuizOpen} onOpenChange={setCreateQuizOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Quiz</DialogTitle>
            <DialogDescription>Add a lightweight quiz for your course students.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Quiz Title *</Label>
              <Input value={quizTitle} onChange={e => setQuizTitle(e.target.value)} placeholder="Week 3 Vocabulary Test" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={quizDescription} onChange={e => setQuizDescription(e.target.value)} placeholder="Brief description..." className="min-h-[60px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Passing %</Label>
                <Input type="number" value={quizPassingPct} onChange={e => setQuizPassingPct(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Time Limit (min)</Label>
                <Input type="number" value={quizTimeLimit} onChange={e => setQuizTimeLimit(e.target.value)} placeholder="No limit" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateQuizOpen(false)}>Cancel</Button>
            <Button onClick={() => createQuiz.mutate()} disabled={!quizTitle.trim() || createQuiz.isPending}>
              Create Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
