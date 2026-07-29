import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle, RotateCw, X, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cancelQuizJob, fetchActiveQuizJobs, resumeQuizJob, type QuizJob } from '@/lib/quizJobs';

const ACTIVE = ['queued', 'extracting', 'generating'];

/**
 * Live progress for background book-extraction jobs.
 * Safe to leave the page — the worker keeps running server-side.
 */
export function QuizJobProgress({ onCompleted }: { onCompleted?: () => void }) {
  const [jobs, setJobs] = useState<QuizJob[]>([]);

  const load = async () => setJobs(await fetchActiveQuizJobs());

  useEffect(() => {
    load();
    const channel = supabase
      .channel('quiz-generation-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_generation_jobs' }, (payload) => {
        const row = payload.new as QuizJob;
        setJobs((prev) => {
          const next = prev.some((j) => j.id === row.id)
            ? prev.map((j) => (j.id === row.id ? { ...j, ...row } : j))
            : [row, ...prev];
          return next;
        });
        if ((payload.new as QuizJob)?.status === 'completed') onCompleted?.();
      })
      .subscribe();
    const poll = setInterval(load, 20000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = jobs.filter(
    (j) => ACTIVE.includes(j.status) || j.status === 'failed' ||
      (j.status === 'completed' && Date.now() - new Date(j.created_at).getTime() < 30 * 60 * 1000),
  );

  if (!visible.length) return null;

  return (
    <div className="space-y-3">
      {visible.map((job) => {
        const pct = job.total_units > 0
          ? Math.min(100, Math.round((job.processed_units / job.total_units) * 100))
          : 0;
        const failed = job.status === 'failed';
        const complete = job.status === 'completed';
        return (
          <Card key={job.id} className="border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    : failed ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    : <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {job.files?.map((f) => f.name).join(', ') || 'Source material'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {job.error || job.stage_message || 'Working…'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={complete ? 'default' : failed ? 'destructive' : 'secondary'} className="capitalize">
                    {job.status}
                  </Badge>
                  {failed && (
                    <Button size="sm" variant="outline" onClick={() => resumeQuizJob(job.id)}>
                      <RotateCw className="h-3.5 w-3.5 mr-1" /> Resume
                    </Button>
                  )}
                  {ACTIVE.includes(job.status) && (
                    <Button size="sm" variant="ghost" onClick={() => cancelQuizJob(job.id).then(load)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <Progress value={complete ? 100 : pct} className="h-2" />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {job.stage === 'extract' ? 'Reading pages' : job.stage === 'generate' ? 'Writing questions' : 'Done'}
                  {' · '}{job.processed_units}/{job.total_units || '?'} steps
                </span>
                <span>{job.questions_generated} questions</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
