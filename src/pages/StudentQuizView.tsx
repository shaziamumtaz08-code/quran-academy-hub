import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCheck, Play, Clock, CheckCircle, XCircle, ChevronRight, ChevronLeft, Trophy, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function StudentQuizView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [attemptId, setAttemptId] = useState('');
  const [phase, setPhase] = useState<'list' | 'quiz' | 'submitting' | 'results'>('list');
  const [results, setResults] = useState<any>(null);
  const [startTime, setStartTime] = useState(0);

  // Available quizzes for this student (authenticated mode)
  const { data: availableSessions = [], isLoading } = useQuery({
    queryKey: ['student-quiz-sessions', user?.id],
    queryFn: async () => {
      const { data } = await (supabase.from('quiz_sessions') as any)
        .select('*, quiz_bank:quiz_banks(id, name, description, language, questions_per_attempt, time_limit_minutes, max_attempts, passing_percentage, question_bank, mode, course_id)')
        .eq('status', 'live');
      return (data || []).filter((s: any) => s.quiz_bank?.mode === 'authenticated');
    },
    enabled: !!user,
  });

  // Past attempts
  const { data: pastAttempts = [] } = useQuery({
    queryKey: ['student-quiz-attempts', user?.id],
    queryFn: async () => {
      const { data } = await (supabase.from('quiz_attempts') as any)
        .select('*, session:quiz_sessions(title)')
        .eq('student_id', user?.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const startQuiz = async (session: any) => {
    const bank = session.quiz_bank;
    // Check attempts
    const existingAttempts = pastAttempts.filter((a: any) => a.session_id === session.id).length;
    if (bank.max_attempts && existingAttempts >= bank.max_attempts) {
      toast({ title: 'Maximum attempts reached', variant: 'destructive' });
      return;
    }

    // Select random questions
    const allQ = bank.question_bank || [];
    const numQ = Math.min(bank.questions_per_attempt || 10, allQ.length);
    const shuffled = [...allQ].sort(() => Math.random() - 0.5).slice(0, numQ);

    // Create attempt
    const { data: attempt, error } = await (supabase.from('quiz_attempts') as any).insert({
      session_id: session.id,
      quiz_bank_id: bank.id,
      student_id: user?.id,
      questions: shuffled,
      max_score: numQ,
      status: 'in_progress',
    }).select('id').single();

    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    // Prepare client questions (strip answers)
    const clientQ = shuffled.map((q: any, i: number) => ({ index: i, text: q.text, type: q.type, options: q.options || [] }));
    setQuestions(clientQ);
    setActiveQuiz(session);
    setAttemptId(attempt.id);
    setAnswers({});
    setCurrentQ(0);
    setStartTime(Date.now());
    setPhase('quiz');
  };

  const handleSubmit = async () => {
    setPhase('submitting');
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    try {
      // Use server-side AI grading
      const { data, error } = await supabase.functions.invoke('grade-quiz-attempt', {
        body: { attempt_id: attemptId, answers, time_taken_seconds: timeTaken },
      });

      if (error) throw error;

      setResults(data);
      queryClient.invalidateQueries({ queryKey: ['student-quiz-attempts'] });
      setPhase('results');
    } catch (e: any) {
      toast({ title: 'Grading error', description: e.message, variant: 'destructive' });
      setPhase('quiz');
    }
  };

  if (phase === 'submitting') return (
    <DashboardLayout><div className="flex items-center justify-center h-96">
      <div className="text-center space-y-4"><Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" /><p>Grading...</p></div>
    </div></DashboardLayout>
  );

  if (phase === 'results' && results) {
    const passed = results.percentage >= (activeQuiz?.quiz_bank?.passing_percentage || 50);
    return (
      <DashboardLayout><div className="max-w-2xl mx-auto p-4 space-y-4">
        <Button variant="ghost" onClick={() => { setPhase('list'); setResults(null); }}>← Back to Quizzes</Button>
        <Card><CardContent className="p-8 text-center space-y-4">
          <div className={`text-5xl font-black ${passed ? 'text-green-600' : 'text-destructive'}`}>{results.percentage}%</div>
          <Badge variant={passed ? 'default' : 'destructive'}>{passed ? '✅ PASSED' : '❌ NOT PASSED'}</Badge>
          <p className="text-muted-foreground">{results.score}/{results.max_score}</p>
        </CardContent></Card>
        {results.results.map((r: any, i: number) => (
          <Card key={i} className={`border-l-4 ${r.correct ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                {r.correct ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" /> : <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
                <p className="font-medium">{r.text}</p>
              </div>
              {!r.correct && <div className="ml-7 text-sm text-muted-foreground">
                Correct: <span className="text-green-600 font-medium">{r.type === 'fib' ? r.correctText : r.options?.[r.correctIndex]}</span>
              </div>}
              {r.explanation && <p className="ml-7 text-xs text-muted-foreground italic">{r.explanation}</p>}
            </CardContent>
          </Card>
        ))}
      </div></DashboardLayout>
    );
  }

  if (phase === 'quiz') {
    const q = questions[currentQ];
    const isRTL = activeQuiz?.quiz_bank?.language === 'ar' || activeQuiz?.quiz_bank?.language === 'ur';
    return (
      <DashboardLayout><div className="max-w-2xl mx-auto p-4 space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{activeQuiz?.title || activeQuiz?.quiz_bank?.name}</span>
          <span className="text-xs text-muted-foreground">{Object.keys(answers).length}/{questions.length}</span>
        </div>
        <Progress value={((currentQ + 1) / questions.length) * 100} className="h-1.5" />
        <Card><CardContent className="p-6">
          <p className="text-xs text-muted-foreground mb-2">Q{currentQ + 1} · <Badge variant="outline" className="text-xs">{q.type.toUpperCase()}</Badge></p>
          <h2 className={`text-lg font-bold mb-6 ${isRTL ? 'text-right' : ''}`}>{q.text}</h2>
          {q.type === 'fib' ? (
            <Input className={`text-center text-lg ${isRTL ? 'text-right' : ''}`} placeholder="Type answer..." value={answers[currentQ] || ''} onChange={e => setAnswers({ ...answers, [currentQ]: e.target.value })} />
          ) : (
            <div className="grid gap-2">
              {q.options.map((opt: string, oi: number) => (
                <button key={oi} onClick={() => setAnswers({ ...answers, [currentQ]: oi })}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${answers[currentQ] === oi ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-primary/30'} ${isRTL ? 'text-right' : ''}`}>
                  <span className="text-xs text-muted-foreground mr-2">{String.fromCharCode(65 + oi)}.</span>{opt}
                </button>
              ))}
            </div>
          )}
        </CardContent></Card>
        <div className="flex justify-between">
          <Button variant="outline" disabled={currentQ === 0} onClick={() => setCurrentQ(currentQ - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          {currentQ < questions.length - 1 ? (
            <Button onClick={() => setCurrentQ(currentQ + 1)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <Button onClick={handleSubmit}>Submit <CheckCircle className="h-4 w-4 ml-1" /></Button>
          )}
        </div>
      </div></DashboardLayout>
    );
  }

  // List view
  return (
    <DashboardLayout><div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">My Quizzes</h1>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <>
          {availableSessions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Available</h2>
              {availableSessions.map((s: any) => {
                const attempts = pastAttempts.filter((a: any) => a.session_id === s.id).length;
                const maxA = s.quiz_bank?.max_attempts || 999;
                return (
                  <Card key={s.id}><CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">{s.title || s.quiz_bank?.name}</h3>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                        <span>{s.quiz_bank?.questions_per_attempt}Q</span>
                        {s.quiz_bank?.time_limit_minutes && <span><Clock className="h-3 w-3 inline" /> {s.quiz_bank.time_limit_minutes}m</span>}
                        <span>{attempts}/{maxA} attempts</span>
                      </div>
                    </div>
                    <Button size="sm" disabled={attempts >= maxA} onClick={() => startQuiz(s)} className="gap-1">
                      <Play className="h-3.5 w-3.5" /> Start
                    </Button>
                  </CardContent></Card>
                );
              })}
            </div>
          )}

          {pastAttempts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Past Results</h2>
              {pastAttempts.map((a: any) => (
                <Card key={a.id}><CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">{a.session?.title || 'Quiz'}</h3>
                    <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                  <Badge variant={a.percentage >= 70 ? 'default' : a.percentage >= 50 ? 'secondary' : 'destructive'}>
                    {a.percentage}% ({a.score}/{a.max_score})
                  </Badge>
                </CardContent></Card>
              ))}
            </div>
          )}

          {availableSessions.length === 0 && pastAttempts.length === 0 && (
            <Card><CardContent className="p-8 text-center">
              <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No quizzes available yet.</p>
            </CardContent></Card>
          )}
        </>
      )}
    </div></DashboardLayout>
  );
}
