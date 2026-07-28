import { useEffect, useMemo, useRef, useState } from 'react';
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
  FileDown,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { generateReportCardPdf } from '@/lib/quizReportCard';

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

// Distinct colour scheme per tag category
const TYPE_TAG = 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
const DIFF_TAG: Record<string, string> = {
  easy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  hard: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
};
const SKILL_TAG = 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30';
const TOPIC_TAG = 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30';

function ScoreRing({ pct, isPass }: { pct: number; isPass: boolean }) {
  const [display, setDisplay] = useState(0);
  const R = 54;
  const C = 2 * Math.PI * R;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(pct * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  return (
    <div className="relative h-[136px] w-[136px] shrink-0">
      <svg viewBox="0 0 130 130" className="h-full w-full -rotate-90">
        <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="11" />
        <circle
          cx="65"
          cy="65"
          r={R}
          fill="none"
          stroke="white"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (C * Math.min(100, Math.max(0, display))) / 100}
          style={{ transition: 'stroke-dashoffset 120ms linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-4xl font-black tracking-tight tabular-nums drop-shadow">{display}%</span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-90">
          {isPass ? 'Passed' : 'Keep going'}
        </span>
      </div>
    </div>
  );
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
  // Always resolve by unique attempt id — never by array position.
  const attempt = useMemo(() => attempts.find((a) => a.id === attemptId) || null, [attempts, attemptId]);
  const idx = useMemo(() => attempts.findIndex((a) => a.id === attemptId), [attempts, attemptId]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const firedConfetti = useRef<string | null>(null);

  const pct = Number(attempt?.percentage) || 0;
  const passThreshold = attempt?.quiz_bank?.passing_percentage ?? 50;
  const isPass = !!attempt && pct >= passThreshold;

  // Celebrate once per attempt shown
  useEffect(() => {
    if (!open || !attempt || !isPass) return;
    if (firedConfetti.current === attempt.id) return;
    firedConfetti.current = attempt.id;
    let cancelled = false;
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (cancelled) return;
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.28 }, zIndex: 9999, disableForReducedMotion: true });
        setTimeout(
          () => confetti({ particleCount: 50, spread: 100, origin: { y: 0.25 }, zIndex: 9999, disableForReducedMotion: true }),
          220,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, attempt, isPass]);

  // Reset scroll + animate when the shown attempt changes
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (el) el.scrollTop = 0;
  }, [attemptId]);

  if (!attempt) return null;

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

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  items.forEach((it, i) => {
    const a = it.userAnswer !== undefined ? it.userAnswer : answers[String(i)];
    if (a === undefined || a === null || a === '') skippedCount++;
    else if (it.correct) correctCount++;
    else wrongCount++;
  });

  const prev = () => {
    if (idx > 0) setAttemptId(attempts[idx - 1].id);
  };
  const next = () => {
    if (idx >= 0 && idx < attempts.length - 1) setAttemptId(attempts[idx + 1].id);
  };

  const timeText = attempt.time_taken_seconds
    ? `${Math.floor(attempt.time_taken_seconds / 60)}m ${attempt.time_taken_seconds % 60}s`
    : '—';

  const downloadReportCard = async () => {
    await generateReportCardPdf({
      studentName: attempt.guest_name || 'Anonymous',
      studentEmail: attempt.guest_email || '—',
      quizName: attempt.quiz_bank?.name || attempt.session?.title || 'Quiz',
      sessionNumber: sessionNumberMap.get(attempt.session_id) || '—',
      attemptNumber: attemptNumberMap.get(attempt.id) || 1,
      date: format(new Date(attempt.created_at), 'MMM d, yyyy · HH:mm'),
      score: Number(attempt.score) || 0,
      maxScore: Number(attempt.max_score) || 0,
      percentage: pct,
      passThreshold,
      correct: correctCount,
      wrong: wrongCount,
      skipped: skippedCount,
      timeTaken: timeText,
      questions: items.map((it, i) => {
        const a = it.userAnswer !== undefined ? it.userAnswer : answers[String(i)];
        const answered = !(a === undefined || a === null || a === '');
        return {
          index: i + 1,
          text: String(it.text || ''),
          type: typeLabel(it.type),
          status: (!answered ? 'skipped' : it.correct ? 'correct' : 'wrong') as 'correct' | 'wrong' | 'skipped',
        };
      }),
    });
  };

  const heroGradient = isPass
    ? 'bg-gradient-to-br from-emerald-500 via-green-600 to-amber-500'
    : 'bg-gradient-to-br from-rose-600 via-red-500 to-orange-500';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Quiz Review</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1" ref={scrollRef as any}>
          {/* key forces a fresh mount + fade/slide transition per attempt */}
          <div key={attempt.id} className="animate-in fade-in slide-in-from-right-4 duration-300">
            {/* ===== Gamified hero ===== */}
            <div className={cn('relative overflow-hidden px-6 pt-7 pb-6 text-white', heroGradient)}>
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-black/10" />
              <div className="relative flex flex-col sm:flex-row items-center gap-6">
                <ScoreRing pct={pct} isPass={isPass} />
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold uppercase tracking-[0.18em] opacity-90">
                    <Sparkles className="h-3.5 w-3.5" /> Quiz Review
                  </div>
                  <h2 className="text-2xl font-black leading-tight drop-shadow-sm">
                    {attempt.guest_name || 'Anonymous'}
                  </h2>
                  <p className="text-sm text-white/85">
                    {attempt.quiz_bank?.name || attempt.session?.title || 'Quiz'} · Session #
                    {sessionNumberMap.get(attempt.session_id) || '—'} · Attempt #
                    {attemptNumberMap.get(attempt.id) || 1}
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-black text-slate-900">
                      {isPass ? '🏆 PASSED' : '💪 NOT PASSED'}
                    </span>
                    <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold">
                      {attempt.score}/{attempt.max_score} · pass ≥ {passThreshold}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat chips */}
              <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { icon: Check, label: 'Correct', value: correctCount },
                  { icon: X, label: 'Wrong', value: wrongCount },
                  { icon: Minus, label: 'Skipped', value: skippedCount },
                  { icon: Clock, label: 'Time', value: timeText },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2 text-center border border-white/20"
                  >
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide opacity-90">
                      <s.icon className="h-3 w-3" /> {s.label}
                    </div>
                    <div className="text-lg font-black tabular-nums">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Identity strip */}
              <div className="rounded-xl border bg-muted/30 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
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
                  const shell = !answered
                    ? 'border-l-amber-400 bg-amber-500/5'
                    : correct
                    ? 'border-l-emerald-500 bg-emerald-500/5'
                    : 'border-l-rose-500 bg-rose-500/5';

                  return (
                    <div
                      key={i}
                      className={cn(
                        'border border-l-[5px] rounded-xl p-4 space-y-3 transition-all hover:shadow-sm',
                        shell,
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className="text-[10px] h-5 font-mono bg-slate-900 text-white border-transparent hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900">
                            Q{i + 1}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[10px] h-5', TYPE_TAG)}>
                            {typeLabel(q.type)}
                          </Badge>
                          {q.difficulty && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] h-5 capitalize',
                                DIFF_TAG[String(q.difficulty).toLowerCase()] || DIFF_TAG.medium,
                              )}
                            >
                              {q.difficulty}
                            </Badge>
                          )}
                          {q.skill_layer && (
                            <Badge variant="outline" className={cn('text-[10px] h-5 capitalize', SKILL_TAG)}>
                              {q.skill_layer}
                            </Badge>
                          )}
                          {q.topic && (
                            <Badge variant="outline" className={cn('text-[10px] h-5 capitalize', TOPIC_TAG)}>
                              {q.topic}
                            </Badge>
                          )}
                        </div>
                        {!answered ? (
                          <Badge className="text-[10px] h-5 shrink-0 bg-amber-500 hover:bg-amber-500 text-white border-transparent">
                            <Minus className="h-3 w-3 mr-0.5" />
                            Skipped
                          </Badge>
                        ) : correct ? (
                          <Badge className="text-[10px] h-5 shrink-0 bg-emerald-600 hover:bg-emerald-600 text-white border-transparent">
                            <Check className="h-3 w-3 mr-0.5" />
                            Correct
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] h-5 shrink-0 bg-rose-600 hover:bg-rose-600 text-white border-transparent">
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
                              ? 'border-emerald-600/70 bg-emerald-500/15'
                              : isPicked
                              ? 'border-rose-600/70 bg-rose-500/15'
                              : 'border-border bg-background';
                            return (
                              <div
                                key={oi}
                                dir={isRTL ? 'rtl' : 'ltr'}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                                  cls,
                                  isRTL && 'text-right',
                                )}
                              >
                                <span
                                  className={cn(
                                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                                    isCorrectOpt
                                      ? 'bg-emerald-600 text-white'
                                      : isPicked
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {String.fromCharCode(65 + oi)}
                                </span>
                                <span className="flex-1">{opt}</span>
                                {isCorrectOpt && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                                {isPicked && !isCorrectOpt && <X className="h-4 w-4 text-rose-600 shrink-0" />}
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
                          <div className="border rounded-lg px-3 py-2 bg-background">
                            <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-0.5">
                              Student answer
                            </div>
                            <div
                              dir={isRTL ? 'rtl' : 'ltr'}
                              className={cn(isRTL && 'text-right', !answered && 'italic text-muted-foreground')}
                            >
                              {answered ? String(ans) : '—'}
                            </div>
                          </div>
                          <div className="border border-emerald-500/40 rounded-lg px-3 py-2 bg-emerald-500/10">
                            <div className="text-[10px] uppercase text-emerald-700 dark:text-emerald-400 tracking-wide mb-0.5">
                              Correct answer
                            </div>
                            <div dir={isRTL ? 'rtl' : 'ltr'} className={cn('font-medium', isRTL && 'text-right')}>
                              {expectedFibText(q)}
                            </div>
                          </div>
                        </div>
                      )}

                      {q.explanation && (
                        <div className="text-xs bg-indigo-500/10 rounded-lg px-3 py-2 border-l-2 border-indigo-500">
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
          </div>
        </ScrollArea>

        <div className="border-t px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-card print:hidden">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={prev} disabled={idx <= 0}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {idx >= 0 ? idx + 1 : '—'} / {attempts.length}
            </span>
            <Button size="sm" variant="outline" onClick={next} disabled={idx < 0 || idx >= attempts.length - 1}>
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print
            </Button>
            <Button size="sm" onClick={downloadReportCard}>
              <FileDown className="h-3.5 w-3.5 mr-1" /> Download Report Card
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
