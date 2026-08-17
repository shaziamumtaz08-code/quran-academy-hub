import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyllabusItem { id: string; level: string; title: string; sequence_order: number }
interface SessionRow {
  id: string; started_at: string; ended_at: string | null;
  item_covered_id: string | null; reference_covered: string | null;
  mistakes: number;
}

export default function StudentSyllabus() {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<{ full_name: string } | null>(null);
  const [items, setItems] = useState<SyllabusItem[]>([]);
  const [progress, setProgress] = useState<any | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      const [p, syl, prog, sess] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', studentId).maybeSingle(),
        supabase.from('syllabus_items' as any).select('id, level, title, sequence_order').eq('is_active', true).order('sequence_order'),
        supabase.from('student_progress' as any).select('*').eq('student_id', studentId).maybeSingle(),
        supabase.from('vcr_sessions' as any)
          .select('id, started_at, ended_at, item_covered_id, reference_covered, mistake_log(id)')
          .eq('student_id', studentId).order('started_at', { ascending: false }).limit(10),
      ]);
      if (cancelled) return;
      setStudent((p.data as any) ?? null);
      setItems(((syl.data as any[]) ?? []) as SyllabusItem[]);
      setProgress(prog.data ?? null);
      setSessions(((sess.data as any[]) ?? []).map((s) => ({
        ...s, mistakes: (s.mistake_log ?? []).length,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  const currentItem = useMemo(
    () => items.find((i) => i.id === progress?.current_item_id) ?? null,
    [items, progress]
  );
  const pct = useMemo(() => {
    if (!items.length || !currentItem) return 0;
    return Math.round((currentItem.sequence_order / items.length) * 100);
  }, [items, currentItem]);

  /* Pace: sessions completed in the last 30 days vs an expected 3/week baseline */
  const pace = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    const recent = sessions.filter((s) => new Date(s.started_at).getTime() >= cutoff).length;
    const expected = 12;
    return { recent, expected, onTrack: recent >= expected * 0.8 };
  }, [sessions]);

  const itemTitle = (id: string | null) => items.find((i) => i.id === id)?.title ?? '—';

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-lms-text-1 truncate">{student?.full_name ?? 'Student'} — Syllabus</h1>
          <p className="text-sm text-lms-text-3">Current level, pace and recent class history.</p>
        </div>
        <Button size="lg" className="ms-auto h-12" onClick={() => navigate(`/vcr/${studentId}`)}>
          <PlayCircle className="h-5 w-5 me-2" /> Open Virtual Class Room
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">Current position</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="text-sm">{currentItem?.level ?? 'Not started'}</Badge>
            <span className="text-lg font-semibold text-lms-text-1">{currentItem?.title ?? 'No item assigned yet'}</span>
            {progress?.current_page_or_ayah && (
              <Badge variant="outline" className="text-sm" dir="auto">At: {progress.current_page_or_ayah}</Badge>
            )}
          </div>
          <div>
            <div className="flex justify-between text-sm text-lms-text-2 mb-1">
              <span>Syllabus progress</span><span>{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
          <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
            pace.onTrack ? 'bg-lms-success/10 text-lms-success' : 'bg-lms-warning/10 text-lms-warning')}>
            <TrendingUp className="h-4 w-4" />
            Pace: {pace.recent} classes in the last 30 days (plan: {pace.expected}) — {pace.onTrack ? 'on track' : 'behind plan'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">Recent sessions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-lms-text-3">No class-room sessions recorded yet. Open the VCR to start one.</p>
          ) : (
            <ul className="divide-y">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  <span className="text-sm tabular-nums text-lms-text-2 w-28">
                    {new Date(s.started_at).toLocaleDateString()}
                  </span>
                  <span className="text-sm font-medium text-lms-text-1 flex-1 min-w-0 truncate" dir="auto">
                    {s.reference_covered || itemTitle(s.item_covered_id)}
                  </span>
                  <Badge variant={s.mistakes > 0 ? 'secondary' : 'outline'} className="text-xs">
                    {s.mistakes} mistake{s.mistakes === 1 ? '' : 's'}
                  </Badge>
                  {!s.ended_at && <Badge className="text-xs bg-lms-warning">Open</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
