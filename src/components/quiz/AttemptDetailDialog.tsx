import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, ChevronLeft, ChevronRight, Printer, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attempts: any[];
  attemptId: string | null;
  setAttemptId: (id: string | null) => void;
  sessionNumberMap: Map<string, number>;
  attemptNumberMap: Map<string, number>;
}

const norm = (v: any) => String(v ?? '').trim().toLowerCase();

function isCorrect(q: any, ans: any): boolean {
  if (ans === undefined || ans === null || ans === '') return false;
  if (q.type === 'mcq' || q.type === 'tf') {
    return Number(ans) === Number(q.correctIndex);
  }
  // fill-in / short
  const expected = q.correctAnswer ?? q.answer ?? q.correct ?? '';
  if (Array.isArray(expected)) return expected.map(norm).includes(norm(ans));
  return norm(ans) === norm(expected);
}

function typeLabel(t: string) {
  if (t === 'mcq') return 'MCQ';
  if (t === 'tf') return 'True/False';
  if (t === 'fib' || t === 'fill') return 'Fill-in';
  return t || 'Question';
}

export default function AttemptDetailDialog({
  open, onOpenChange, attempts, attemptId, setAttemptId,
  sessionNumberMap, attemptNumberMap,
}: Props) {
  const attempt = useMemo(() => attempts.find(a => a.id === attemptId), [attempts, attemptId]);
  const idx = useMemo(() => attempts.findIndex(a => a.id === attemptId), [attempts, attemptId]);

  if (!attempt) return null;

  const questions: any[] = Array.isArray(attempt.questions) ? attempt.questions : [];
  const answers: Record<string, any> = attempt.answers || {};
  const lang = attempt.quiz_bank?.language || '';
  const isRTL = ['ar', 'ur'].includes(lang);
  const passThreshold = attempt.quiz_bank?.passing_percentage ?? 50;
  const pct = Number(attempt.percentage) || 0;
  const isPass = pct >= passThreshold;

  let correctCount = 0, wrongCount = 0, skippedCount = 0;
  questions.forEach((q, i) => {
    const a = answers[String(i)];
    if (a === undefined || a === null || a === '') skippedCount++;
    else if (isCorrect(q, a)) correctCount++;
    else wrongCount++;
  });

  const prev = () => idx > 0 && setAttemptId(attempts[idx - 1].id);
  const next = () => idx < attempts.length - 1 && setAttemptId(attempts[idx + 1].id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <DialogTitle className="text-base">
                {attempt.guest_name || 'Anonymous'}
                <span className="text-muted-foreground font-normal text-sm ml-2">{attempt.guest_email || ''}</span>
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{attempt.quiz_bank?.name || attempt.session?.title || 'Quiz'}</span>
                <span>·</span>
                <span>Session #{sessionNumberMap.get(attempt.session_id) || '—'}</span>
                <span>·</span>
                <span>Attempt #{attemptNumberMap.get(attempt.id) || 1}</span>
                <span>·</span>
                <span>{format(new Date(attempt.created_at), 'MMM d, yyyy HH:mm')}</span>
                {attempt.time_taken_seconds ? (
                  <>
                    <span>·</span>
                    <span>{Math.floor(attempt.time_taken_seconds / 60)}m {attempt.time_taken_seconds % 60}s</span>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className="text-xs">{attempt.score}/{attempt.max_score}</Badge>
                <Badge className={`text-xs ${pct >= 70 ? 'bg-primary' : pct >= 50 ? 'bg-secondary text-secondary-foreground' : 'bg-destructive'} text-white border-transparent`}>{pct}%</Badge>
                <Badge className={`text-xs ${isPass ? 'bg-green-600' : 'bg-destructive'} text-white border-transparent`}>{isPass ? 'Pass' : 'Fail'}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4 print:overflow-visible">
          <div className="space-y-4">
            {questions.map((q, i) => {
              const ans = answers[String(i)];
              const answered = !(ans === undefined || ans === null || ans === '');
              const correct = answered && isCorrect(q, ans);
              const correctIdx = Number(q.correctIndex);

              return (
                <div key={i} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <Badge variant="outline" className="text-[10px] h-5">Q{i + 1}</Badge>
                      <Badge variant="outline" className="text-[10px] h-5">{typeLabel(q.type)}</Badge>
                      {q.difficulty && <Badge variant="outline" className="text-[10px] h-5 capitalize">{q.difficulty}</Badge>}
                      {q.skill_layer && <Badge variant="outline" className="text-[10px] h-5 capitalize">{q.skill_layer}</Badge>}
                    </div>
                    {!answered ? (
                      <Badge variant="outline" className="text-[10px] h-5"><Minus className="h-3 w-3 mr-0.5" />Not answered</Badge>
                    ) : correct ? (
                      <Badge className="text-[10px] h-5 bg-green-600 text-white border-transparent"><Check className="h-3 w-3 mr-0.5" />Correct</Badge>
                    ) : (
                      <Badge className="text-[10px] h-5 bg-destructive text-white border-transparent"><X className="h-3 w-3 mr-0.5" />Incorrect</Badge>
                    )}
                  </div>

                  <p
                    className={`text-sm font-medium ${isRTL ? 'text-right' : ''}`}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    {q.text}
                  </p>

                  {(q.type === 'mcq' || q.type === 'tf') && Array.isArray(q.options) && (
                    <div className="space-y-1">
                      {q.options.map((opt: string, oi: number) => {
                        const isCorrectOpt = oi === correctIdx;
                        const isPicked = Number(ans) === oi;
                        let cls = 'border-border bg-background';
                        if (isCorrectOpt && isPicked) cls = 'border-green-600 bg-green-50 dark:bg-green-950/30';
                        else if (isCorrectOpt) cls = 'border-green-600 bg-background';
                        else if (isPicked) cls = 'border-destructive bg-destructive/10';
                        return (
                          <div
                            key={oi}
                            dir={isRTL ? 'rtl' : 'ltr'}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-sm ${cls} ${isRTL ? 'text-right' : ''}`}
                          >
                            <span className="flex-1">{opt}</span>
                            {isCorrectOpt && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                            {isPicked && !isCorrectOpt && <X className="h-3.5 w-3.5 text-destructive shrink-0" />}
                            {isPicked && <Badge variant="outline" className="text-[9px] h-4 shrink-0">Picked</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type !== 'mcq' && q.type !== 'tf' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="border rounded px-2.5 py-1.5 bg-muted/30">
                        <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Student answer</div>
                        <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'text-right' : ''}>{answered ? String(ans) : <span className="italic text-muted-foreground">—</span>}</div>
                      </div>
                      <div className="border rounded px-2.5 py-1.5 bg-green-50 dark:bg-green-950/20">
                        <div className="text-[10px] uppercase text-green-700 dark:text-green-400 tracking-wide">Expected</div>
                        <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'text-right' : ''}>{String(q.correctAnswer ?? q.answer ?? q.correct ?? '—')}</div>
                      </div>
                    </div>
                  )}

                  {q.explanation && (
                    <div className="text-xs bg-muted/40 rounded px-2.5 py-1.5 border-l-2 border-primary">
                      <span className="font-semibold mr-1">Explanation:</span>
                      <span dir={isRTL ? 'rtl' : 'ltr'}>{q.explanation}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No question detail stored for this attempt.</p>
            )}
          </div>
        </ScrollArea>

        <div className="border-t px-6 py-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" /> Correct: <b>{correctCount}</b></span>
            <span className="flex items-center gap-1"><X className="h-3.5 w-3.5 text-destructive" /> Wrong: <b>{wrongCount}</b></span>
            <span className="flex items-center gap-1 text-muted-foreground"><Minus className="h-3.5 w-3.5" /> Skipped: <b>{skippedCount}</b></span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={prev} disabled={idx <= 0}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">{idx + 1} / {attempts.length}</span>
            <Button size="sm" variant="outline" onClick={next} disabled={idx >= attempts.length - 1}>
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
