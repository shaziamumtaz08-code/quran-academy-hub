import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, ChevronRight, ChevronLeft, Trophy, Clock, Mail, User } from 'lucide-react';

interface QuizMeta {
  session_id: string;
  title: string;
  description?: string;
  language: string;
  questions_per_attempt: number;
  time_limit_minutes?: number;
  max_attempts?: number;
  passing_percentage: number;
  total_questions: number;
  mode: string;
}

interface Question {
  index: number;
  text: string;
  type: 'mcq' | 'tf' | 'fib' | 'error_detection' | 'dialogue_completion' | 'matching' | 'scenario' | 'translation';
  options: string[];
}

interface GradedResult {
  text: string;
  type: string;
  options?: string[];
  correctIndex?: number;
  correctText?: string;
  explanation?: string;
  userAnswer: any;
  correct: boolean;
}

const API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/quiz-public-access`;

export default function PublicQuiz() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<'loading' | 'entry' | 'quiz' | 'submitting' | 'results' | 'error'>('loading');
  const [meta, setMeta] = useState<QuizMeta | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [attemptId, setAttemptId] = useState('');
  const [results, setResults] = useState<{ score: number; max_score: number; percentage: number; results: GradedResult[] } | null>(null);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const isRTL = meta?.language === 'ar' || meta?.language === 'ur';

  // Load quiz metadata
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}?action=load&token=${token}`, {
      headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setPhase('error'); }
        else { setMeta(d); setPhase('entry'); }
      })
      .catch(() => { setError('Failed to load quiz'); setPhase('error'); });
  }, [token]);

  // Timer
  useEffect(() => {
    if (phase !== 'quiz' || !meta?.time_limit_minutes) return;
    setTimeLeft(meta.time_limit_minutes * 60);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const startQuiz = async () => {
    if (!email.trim()) return;
    setPhase('loading');
    try {
      const res = await fetch(`${API_BASE}?action=start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ token, guest_email: email, guest_name: name }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setPhase('error'); return; }
      setAttemptId(data.attempt_id);
      setQuestions(data.questions);
      startTimeRef.current = Date.now();
      setPhase('quiz');
    } catch { setError('Failed to start quiz'); setPhase('error'); }
  };

  const handleSubmit = useCallback(async () => {
    if (phase === 'submitting') return;
    setPhase('submitting');
    if (timerRef.current) clearInterval(timerRef.current);
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    try {
      const res = await fetch(`${API_BASE}?action=submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ attempt_id: attemptId, answers, time_taken_seconds: timeTaken }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setPhase('error'); return; }
      setResults(data);
      setPhase('results');
    } catch { setError('Failed to submit'); setPhase('error'); }
  }, [attemptId, answers, phase]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (phase === 'loading') return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Loading quiz...</p>
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full"><CardContent className="p-8 text-center space-y-4">
        <XCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-lg font-bold">Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Try Again</Button>
      </CardContent></Card>
    </div>
  );

  if (phase === 'entry') return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="max-w-md w-full"><CardContent className="p-8 space-y-6">
        <div className="text-center space-y-2">
          <Trophy className="h-10 w-10 text-primary mx-auto" />
          <h1 className="text-xl font-bold">{meta?.title}</h1>
          {meta?.description && <p className="text-sm text-muted-foreground">{meta.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge variant="outline">{meta?.questions_per_attempt} questions</Badge>
          {meta?.time_limit_minutes && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{meta.time_limit_minutes} min</Badge>}
          <Badge variant="outline">Pass: {meta?.passing_percentage}%</Badge>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" type="email" placeholder="Your email *" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <Button className="w-full gap-2" onClick={startQuiz} disabled={!email.trim()}>
            Start Quiz <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent></Card>
    </div>
  );

  if (phase === 'submitting') return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="text-lg font-bold">Submitting & grading...</p>
      </div>
    </div>
  );

  if (phase === 'results' && results) {
    const passed = results.percentage >= (meta?.passing_percentage || 50);
    return (
      <div className="min-h-screen bg-background p-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="max-w-2xl mx-auto space-y-6 py-8">
          <Card><CardContent className="p-8 text-center space-y-4">
            <div className={`text-6xl font-black ${passed ? 'text-green-600' : 'text-destructive'}`}>
              {results.percentage}%
            </div>
            <Badge variant={passed ? 'default' : 'destructive'} className="text-sm px-4 py-1">
              {passed ? '✅ PASSED' : '❌ NOT PASSED'}
            </Badge>
            <p className="text-muted-foreground">Score: {results.score}/{results.max_score}</p>
          </CardContent></Card>

          <h3 className="font-bold text-lg">Review</h3>
          {results.results.map((r, i) => (
            <Card key={i} className={`border-l-4 ${r.correct ? 'border-l-green-500' : 'border-l-red-500'}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-2">
                  {r.correct ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
                  <p className={`font-medium ${isRTL ? 'text-right' : ''}`}>{r.text}</p>
                </div>
                {!r.correct && (
                  <div className="ml-7 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Your answer: <span className="text-red-600 font-medium">
                        {r.type === 'fib' ? (r.userAnswer || 'blank') : (r.options?.[r.userAnswer] || 'skipped')}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Correct: <span className="text-green-600 font-medium">
                        {r.type === 'fib' ? r.correctText : r.options?.[r.correctIndex!]}
                      </span>
                    </p>
                  </div>
                )}
                {r.explanation && <p className="ml-7 text-xs text-muted-foreground italic">{r.explanation}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Quiz phase
  const q = questions[currentQ];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-card border-b px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium">{meta?.title}</span>
        <div className="flex items-center gap-3">
          {meta?.time_limit_minutes ? (
            <Badge variant={timeLeft < 60 ? 'destructive' : 'outline'} className="gap-1">
              <Clock className="h-3 w-3" /> {formatTime(timeLeft)}
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">{answeredCount}/{questions.length}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Progress value={((currentQ + 1) / questions.length) * 100} className="h-1.5" />

        <div className="text-xs text-muted-foreground text-center">
          <Badge variant="outline" className="text-xs">{q.type.toUpperCase().replace(/_/g, ' ')}</Badge>
          <span className="ml-2">Question {currentQ + 1} of {questions.length}</span>
        </div>

        <Card><CardContent className="p-6">
          <h2 className={`text-lg font-bold mb-6 leading-relaxed ${isRTL ? 'text-right font-urdu' : ''}`}>{q.text}</h2>

          {/* Free-text input types */}
          {['fib', 'error_detection', 'dialogue_completion', 'scenario', 'translation'].includes(q.type) && (!q.options || q.options.length === 0) ? (
            <div className="space-y-2">
              <Input
                className={`text-center text-lg ${isRTL ? 'text-right' : ''}`}
                placeholder={isRTL ? 'یہاں لکھیں...' : 'Type your answer...'}
                value={answers[currentQ] || ''}
                onChange={e => setAnswers({ ...answers, [currentQ]: e.target.value })}
                dir={isRTL ? 'rtl' : 'ltr'}
              />
              <p className="text-xs text-muted-foreground text-center">
                {isRTL ? 'عربی، اردو یا رومن میں لکھ سکتے ہیں' : 'You can type in Arabic, Urdu, or Roman/English'}
              </p>
            </div>
          ) : q.options && q.options.length > 0 ? (
            <div className="grid gap-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => setAnswers({ ...answers, [currentQ]: oi })}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    answers[currentQ] === oi
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:border-primary/30'
                  } ${isRTL ? 'text-right' : ''}`}
                >
                  <span className="text-xs text-muted-foreground mr-2">{String.fromCharCode(65 + oi)}.</span>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <Input
              className={`text-center text-lg ${isRTL ? 'text-right' : ''}`}
              placeholder={isRTL ? 'یہاں لکھیں...' : 'Type your answer...'}
              value={answers[currentQ] || ''}
              onChange={e => setAnswers({ ...answers, [currentQ]: e.target.value })}
              dir={isRTL ? 'rtl' : 'ltr'}
            />
          )}
        </CardContent></Card>

        <div className="flex justify-between">
          <Button variant="outline" disabled={currentQ === 0} onClick={() => setCurrentQ(currentQ - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          {currentQ < questions.length - 1 ? (
            <Button onClick={() => setCurrentQ(currentQ + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} variant="default" className="gap-1.5">
              Submit Quiz <CheckCircle className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Question dots */}
        <div className="flex flex-wrap gap-1 justify-center pt-2">
          {questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`w-7 h-7 rounded-full text-xs font-medium transition-all ${
                i === currentQ ? 'bg-primary text-primary-foreground' :
                answers[i] !== undefined ? 'bg-primary/20 text-primary' :
                'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
