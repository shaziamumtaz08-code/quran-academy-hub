import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  Minus,
  Trophy,
  Clock,
  Calendar,
  User,
  Mail,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attempts: any[];
  attemptId: string | null;
  setAttemptId: (id: string | null) => void;
  sessionNumberMap: Map<string, number>;
  attemptNumberMap: Map<string, number>;
}

const stripDiacritics = (s: string) =>
  s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, '');
const norm = (v: any) => stripDiacritics(String(v ?? '').trim().toLowerCase());

function fibMatches(ans: any, q: any): boolean {
  const expected = q.correctText ?? q.correctAnswer ?? q.answer ?? q.correct ?? '';
  const alts: string[] = Array.isArray(q.correctAlt) ? q.correctAlt : Array.isArray(expected) ? expected : [];
  const target = Array.isArray(expected) ? expected[0] : expected;
  const a = norm(ans);
  if (!a) return false;
  if (a === norm(target)) return true;
  return alts.some((alt) => a === norm(alt));
}

function isCorrect(q: any, ans: any): boolean {
  if (ans === undefined || ans === null || ans === '') return false;
  if (q.type === 'mcq' || q.type === 'tf') return Number(ans) === Number(q.correctIndex);
  return fibMatches(ans, q);
}

function typeLabel(t: string) {
  if (t === 'mcq') return 'Multiple Choice';
  if (t === 'tf') return 'True / False';
  if (t === 'fib' || t === 'fill') return 'Fill in the Blank';
  return t || 'Question';
}

function expectedFibText(q: any): string {
  const v = q.correctText ?? q.correctAnswer ?? q.answer ?? q.correct ?? '';
  if (Array.isArray(v)) return v[0] ?? '—';
  return String(v || '—');
}

export default function AttemptDetailDialog({
  open,
  onOpenChange,
  attempts,
  attemptId,
  setAttemptId,
  sessionNumberMap,
  attemptNumberMap,
}: Props) {
  const attempt = useMemo(() => attempts.find((a) => a.id === attemptId), [attempts, attemptId]);
  const idx = useMemo(() => attempts.findIndex((a) => a.id === attemptId), [attempts, attemptId]);

  if (!attempt) return null;

  // Prefer server-graded results (stored at submission). Fall back to recomputing locally.
  const storedResults: any[] = Array.isArray(attempt.results) ? attempt.results : [];
  const fallbackQuestions: any[] = Array.isArray(attempt.questions) ? attempt.questions : [];
  const answers: Record<string, any> = attempt.answers || {};

  const items: any[] =
    storedResults.length > 0
      ? storedResults
      : fallbackQuestions.map((q, i) => ({
          ...q,
          userAnswer: answers[String(i)],
          correct: isCorrect(q, answers[String(i)]),
        }));

  const lang = attempt.quiz_bank?.language || '';
  const isRTL = ['ar', 'ur'].includes(lang);
  const passThreshold = attempt.quiz_bank?.passing_percentage ?? 50;
  const pct = Number(attempt.percentage) || 0;
  const isPass = pct >= passThreshold;

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  items.forEach((it) => {
    const a = it.userAnswer ?? answers[String(items.indexOf(it))];
    if (a === undefined || a === null || a === '') skippedCount++;
    else if (it.correct) correctCount++;
    else wrongCount++;
  });

  const prev = () => idx > 0 && setAttemptId(attempts[idx - 1].id);
  const next = () => idx < attempts.length - 1 && setAttemptId(attempts[idx + 1].id);

  const heroGradient = isPass
    ? 'bg-gradient-to-br from-green-500/15 via-green-500/5 to-transparent border-green-500/30'
    : 'bg-gradient-to-br from-destructive/15 via-destructive/5 to-transparent border-destructive/30';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-card">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" />
            Quiz Review
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-5">
            {/* Hero — mirrors the student's submission screen */}
            <div className={cn('rounded-xl border p-6 text-center space-y-3', heroGradient)}>
              <div
                className={cn(
                  'text-6xl font-black tracking-tight',
                  isPass ? 'text-green-600 dark:text-green-400' : 'text-destructive',
                )}
              >
                {pct}%
              </div>
              <div className="flex items-center justify-center gap-2">
                <Badge
                  className={cn(
                    'text-xs px-3 py-1 border-transparent text-white',
                    isPass ? 'bg-green-600 hover:bg-green-600' : 'bg-destructive hover:bg-destructive',
                  )}
                >
                  {isPass ? '✓ PASSED' : '✕ NOT PASSED'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {attempt.score}/{attempt.max_score} correct · pass ≥ {passThreshold}%
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-green-600" /> {correctCount} correct
                </span>
                <span className="flex items-center gap-1">
                  <X className="h-3.5 w-3.5 text-destructive" /> {wrongCount} wrong
                </span>
                <span className="flex items-center gap-1">
                  <Minus className="h-3.5 w-3.5" /> {skippedCount} skipped
                </span>
                {attempt.time_taken_seconds ? (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {Math.floor(attempt.time_taken_seconds / 60)}m {attempt.time_taken_seconds % 60}s
                  </span>
                ) : null}
              </div>
            </div>

            {/* Identity strip */}
            <div className="rounded-lg border bg-muted/30 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">{attempt.guest_name || 'Anonymous'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground truncate">{attempt.guest_email || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {attempt.quiz_bank?.name || attempt.session?.title || 'Quiz'} · Session #
                  {sessionNumberMap.get(attempt.session_id) || '—'} · Attempt #
                  {attemptNumberMap.get(attempt.id) || 1}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {format(new Date(attempt.created_at), 'MMM d, yyyy · HH:mm')}
                </span>
              </div>
            </div>

            {/* Per-question review */}
            <div className="space-y-3">
              {items.map((it, i) => {
                const q = it;
                const ans = it.userAnswer !== undefined ? it.userAnswer : answers[String(i)];
                const answered = !(ans === undefined || ans === null || ans === '');
                const correct = !!it.correct;
                const correctIdx = Number(q.correctIndex);
                const accent = !answered
                  ? 'border-l-muted-foreground/40'
                  : correct
                  ? 'border-l-green-500'
                  : 'border-l-destructive';

                return (
                  <div
                    key={i}
                    className={cn(
                      'border border-l-4 rounded-lg bg-card p-4 space-y-3 transition-colors',
                      accent,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px] h-5 font-mono">
                          Q{i + 1}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {typeLabel(q.type)}
                        </Badge>
                        {q.difficulty && (
                          <Badge variant="outline" className="text-[10px] h-5 capitalize">
                            {q.difficulty}
                          </Badge>
                        )}
                        {q.skill_layer && (
                          <Badge variant="outline" className="text-[10px] h-5 capitalize">
                            {q.skill_layer}
                          </Badge>
                        )}
                      </div>
                      {!answered ? (
                        <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                          <Minus className="h-3 w-3 mr-0.5" />
                          Not answered
                        </Badge>
                      ) : correct ? (
                        <Badge className="text-[10px] h-5 shrink-0 bg-green-600 hover:bg-green-600 text-white border-transparent">
                          <Check className="h-3 w-3 mr-0.5" />
                          Correct
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] h-5 shrink-0 bg-destructive hover:bg-destructive text-white border-transparent">
                          <X className="h-3 w-3 mr-0.5" />
                          Incorrect
                        </Badge>
                      )}
                    </div>

                    <p
                      className={cn('text-sm font-semibold leading-snug', isRTL && 'text-right')}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      {q.text}
                    </p>

                    {(q.type === 'mcq' || q.type === 'tf') && Array.isArray(q.options) && (
                      <div className="space-y-1.5">
                        {q.options.map((opt: string, oi: number) => {
                          const isCorrectOpt = oi === correctIdx;
                          const isPicked = Number(ans) === oi;
                          const cls = isCorrectOpt
                            ? 'border-green-600/70 bg-green-500/10'
                            : isPicked
                            ? 'border-destructive/70 bg-destructive/10'
                            : 'border-border bg-background';
                          return (
                            <div
                              key={oi}
                              dir={isRTL ? 'rtl' : 'ltr'}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-md border text-sm',
                                cls,
                                isRTL && 'text-right',
                              )}
                            >
                              <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">
                                {String.fromCharCode(65 + oi)}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isCorrectOpt && <Check className="h-4 w-4 text-green-600 shrink-0" />}
                              {isPicked && !isCorrectOpt && (
                                <X className="h-4 w-4 text-destructive shrink-0" />
                              )}
                              {isPicked && (
                                <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                                  Picked
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.type !== 'mcq' && q.type !== 'tf' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="border rounded-md px-3 py-2 bg-muted/30">
                          <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-0.5">
                            Student answer
                          </div>
                          <div
                            dir={isRTL ? 'rtl' : 'ltr'}
                            className={cn(
                              isRTL && 'text-right',
                              !answered && 'italic text-muted-foreground',
                            )}
                          >
                            {answered ? String(ans) : '—'}
                          </div>
                        </div>
                        <div className="border border-green-500/40 rounded-md px-3 py-2 bg-green-500/10">
                          <div className="text-[10px] uppercase text-green-700 dark:text-green-400 tracking-wide mb-0.5">
                            Correct answer
                          </div>
                          <div
                            dir={isRTL ? 'rtl' : 'ltr'}
                            className={cn('font-medium', isRTL && 'text-right')}
                          >
                            {expectedFibText(q)}
                          </div>
                        </div>
                      </div>
                    )}

                    {q.explanation && (
                      <div className="text-xs bg-primary/5 rounded-md px-3 py-2 border-l-2 border-primary">
                        <span className="font-semibold mr-1">Explanation:</span>
                        <span dir={isRTL ? 'rtl' : 'ltr'}>{q.explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No question detail stored for this attempt.
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="border-t px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-card print:hidden">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={prev} disabled={idx <= 0}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              {idx + 1} / {attempts.length}
            </span>
            <Button size="sm" variant="outline" onClick={next} disabled={idx >= attempts.length - 1}>
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
