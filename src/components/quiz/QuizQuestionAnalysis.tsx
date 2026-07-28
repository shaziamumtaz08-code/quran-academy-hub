import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  attempts: any[];
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
  return t || 'Other';
}

type Bucket = { key: string; label: string; correct: number; wrong: number; skipped: number; total: number };

function pctOf(b: Bucket) {
  return b.total ? Math.round((b.correct / b.total) * 100) : 0;
}

function toneFor(pct: number, threshold: number) {
  if (pct >= threshold) return 'text-success';
  if (pct >= Math.max(0, threshold - 20)) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

function Bar({ b, threshold }: { b: Bucket; threshold: number }) {
  const c = b.total ? (b.correct / b.total) * 100 : 0;
  const w = b.total ? (b.wrong / b.total) * 100 : 0;
  const s = b.total ? (b.skipped / b.total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium truncate">{b.label}</span>
        <span className={cn('text-xs font-bold tabular-nums', toneFor(pctOf(b), threshold))}>{pctOf(b)}%</span>
      </div>
      <div className="h-2 w-full rounded-full overflow-hidden bg-muted flex">
        <div className="bg-success h-full" style={{ width: `${c}%` }} />
        <div className="bg-destructive h-full" style={{ width: `${w}%` }} />
        <div className="bg-muted-foreground/40 h-full" style={{ width: `${s}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground tabular-nums">
        {b.correct} correct · {b.wrong} wrong · {b.skipped} skipped
      </p>
    </div>
  );
}

export default function QuizQuestionAnalysis({ attempts }: Props) {
  const [showAll, setShowAll] = useState(false);

  const analysis = useMemo(() => {
    const byType = new Map<string, Bucket>();
    const byDiff = new Map<string, Bucket>();
    const byTopic = new Map<string, Bucket>();
    const byQuestion = new Map<string, Bucket & { type: string; difficulty?: string }>();
    let threshold = 50;
    let graded = 0;

    const add = (map: Map<string, any>, key: string, label: string, outcome: 'c' | 'w' | 's', extra?: any) => {
      if (!key) return;
      let b = map.get(key);
      if (!b) {
        b = { key, label, correct: 0, wrong: 0, skipped: 0, total: 0, ...(extra || {}) };
        map.set(key, b);
      }
      b.total += 1;
      if (outcome === 'c') b.correct += 1;
      else if (outcome === 'w') b.wrong += 1;
      else b.skipped += 1;
    };

    attempts.forEach((a: any) => {
      threshold = a.quiz_bank?.passing_percentage ?? threshold;
      const stored: any[] = Array.isArray(a.results) ? a.results : [];
      const fallback: any[] = Array.isArray(a.questions) ? a.questions : [];
      const answers: Record<string, any> = a.answers || {};
      const items = stored.length > 0 ? stored : fallback;
      if (!items.length) return;
      graded += 1;

      items.forEach((it: any, i: number) => {
        const ans = it.userAnswer !== undefined ? it.userAnswer : answers[String(i)];
        const outcome: 'c' | 'w' | 's' =
          ans === undefined || ans === null || ans === ''
            ? 's'
            : (typeof it.correct === 'boolean' ? it.correct : isCorrect(it, ans))
              ? 'c'
              : 'w';

        add(byType, it.type || 'other', typeLabel(it.type), outcome);
        if (it.difficulty) add(byDiff, String(it.difficulty), String(it.difficulty), outcome);
        const topic = it.topic || it.skill || it.category;
        if (topic) add(byTopic, String(topic), String(topic), outcome);

        const qText = String(it.question || it.prompt || `Question ${i + 1}`);
        add(byQuestion, qText, qText, outcome, { type: it.type || 'other', difficulty: it.difficulty });
      });
    });

    const sortBuckets = (m: Map<string, any>) => [...m.values()].sort((x, y) => y.total - x.total);
    const questions = [...byQuestion.values()].sort((x, y) => pctOf(x) - pctOf(y));

    return {
      threshold,
      graded,
      types: sortBuckets(byType),
      difficulties: sortBuckets(byDiff),
      topics: sortBuckets(byTopic).slice(0, 12),
      questions,
    };
  }, [attempts]);

  if (!analysis.graded) return null;

  const weak = analysis.questions.filter((q) => pctOf(q) < analysis.threshold);
  const strong = analysis.questions.filter((q) => pctOf(q) >= analysis.threshold);
  const shown = showAll ? analysis.questions : analysis.questions.slice(0, 8);

  return (
    <Card className="border-primary/20">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Question analysis
          <Badge variant="secondary" className="ml-1 text-[10px]">
            {analysis.graded} attempt{analysis.graded === 1 ? '' : 's'}
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Pass mark {analysis.threshold}% · questions below it are flagged for improvement.
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">By question type</p>
            {analysis.types.map((b) => <Bar key={b.key} b={b} threshold={analysis.threshold} />)}
          </div>
          {analysis.difficulties.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">By difficulty</p>
              {analysis.difficulties.map((b) => <Bar key={b.key} b={b} threshold={analysis.threshold} />)}
            </div>
          )}
          {analysis.topics.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">By topic / skill</p>
              {analysis.topics.map((b) => <Bar key={b.key} b={b} threshold={analysis.threshold} />)}
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Needs improvement ({weak.length})
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Questions answered correctly by fewer than {analysis.threshold}% of attempts.</p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
            <p className="text-xs font-semibold text-success flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Mastered ({strong.length})
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Questions meeting or beating the pass mark.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 pr-2 font-medium">Question</th>
                <th className="py-2 px-2 font-medium whitespace-nowrap">Type</th>
                <th className="py-2 px-2 font-medium text-right">Correct</th>
                <th className="py-2 px-2 font-medium text-right">Wrong</th>
                <th className="py-2 px-2 font-medium text-right">Skipped</th>
                <th className="py-2 px-2 font-medium text-right">Success</th>
                <th className="py-2 pl-2 font-medium text-right">Result</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((q) => {
                const p = pctOf(q);
                const pass = p >= analysis.threshold;
                return (
                  <tr key={q.key} className="border-b last:border-0 even:bg-muted/20">
                    <td className="py-2 pr-2 max-w-[420px]">
                      <span className="line-clamp-2">{q.label}</span>
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">{typeLabel(q.type)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{q.correct}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{q.wrong}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{q.skipped}</td>
                    <td className={cn('py-2 px-2 text-right font-bold tabular-nums', toneFor(p, analysis.threshold))}>{p}%</td>
                    <td className="py-2 pl-2 text-right">
                      <Badge variant="outline" className={cn('text-[10px]', pass ? 'border-success/40 text-success' : 'border-destructive/40 text-destructive')}>
                        {pass ? 'Pass' : 'Fail'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {analysis.questions.length > 8 && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll((v) => !v)}>
            {showAll ? <><ChevronUp className="h-3.5 w-3.5 mr-1" /> Show top 8 weakest</> : <><ChevronDown className="h-3.5 w-3.5 mr-1" /> Show all {analysis.questions.length} questions</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
