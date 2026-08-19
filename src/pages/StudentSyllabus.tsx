import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, PlayCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyllabusItem { id: string; level: string; title: string; sequence_order: number }
interface SessionRow {
  id: string; started_at: string; ended_at: string | null;
  item_covered_id: string | null; reference_covered: string | null;
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
          .select('id, started_at, ended_at, item_covered_id, reference_covered')
          .eq('student_id', studentId).order('started_at', { ascending: false }).limit(10),
      ]);
      if (cancelled) return;
      setStudent((p.data as any) ?? null);
      setItems(((syl.data as any[]) ?? []) as SyllabusItem[]);
      setProgress(prog.data ?? null);
      setSessions(((sess.data as any[]) ?? []) as SessionRow[]);
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

  if (loading) {
    return (
      <div className="vcr-canvas min-h-screen space-y-4 p-6">
        <Skeleton className="h-24 w-full bg-white/5" />
        <Skeleton className="h-64 w-full bg-white/5" />
      </div>
    );
  }

  return (
    <div className="vcr-canvas min-h-screen text-vcr-chrome">
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-8">
        {/* Breadcrumb / back nav */}
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-vcr-chrome/60">
          <button type="button" onClick={() => navigate('/class-room')} className="vcr-btn inline-flex h-9 items-center gap-1.5 rounded-lg px-3">
            <ArrowLeft className="h-4 w-4" /> Back to Class Room
          </button>
          <span className="mx-1 h-5 w-px bg-vcr-chrome/20" aria-hidden />
          <button type="button" onClick={() => navigate('/dashboard')} className="transition-colors hover:text-vcr-chrome">Home</button>
          <span aria-hidden>›</span>
          <button type="button" onClick={() => navigate('/class-room')} className="transition-colors hover:text-vcr-chrome">Class Room</button>
          <span aria-hidden>›</span>
          <span className="truncate text-vcr-chrome/80">{student?.full_name ?? 'Student'}</span>
          <span aria-hidden>›</span>
          <span className="font-medium text-vcr-chrome">Syllabus</span>
        </nav>

        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-semibold tracking-tight text-vcr-chrome">
              {student?.full_name ?? 'Student'}
            </h1>
            <p className="text-sm text-vcr-chrome/60">Current level, pace and recent class history.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/vcr/${studentId}`)}
            className="vcr-btn-gold ms-auto inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base font-semibold"
          >
            <PlayCircle className="h-5 w-5" /> Open VCR
          </button>
        </div>

        {/* Current position — lighter parchment card, this is a review screen */}
        <section className="vcr-reading-card rounded-2xl p-5 sm:p-7">
          <h2 className="font-display text-xl text-vcr-ink">Current position</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-vcr-emerald px-3 py-1 text-sm text-vcr-parchment">
              {currentItem?.level ?? 'Not started'}
            </span>
            <span className="text-xl font-semibold text-vcr-ink">
              {currentItem?.title ?? 'No item assigned yet'}
            </span>
            {progress?.current_page_or_ayah && (
              <span className="rounded-full border border-vcr-ink/25 px-3 py-1 font-mono text-sm text-vcr-ink/80" dir="auto">
                At: {progress.current_page_or_ayah}
              </span>
            )}
          </div>

          <div className="mt-5">
            <div className="mb-1 flex justify-between font-mono text-sm tabular-nums text-vcr-ink/70">
              <span>Syllabus progress</span><span>{pct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-vcr-ink/10">
              <div className="h-full rounded-full bg-vcr-gold transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div
            className={cn(
              'mt-5 flex items-start gap-2 rounded-xl px-4 py-3 text-sm',
              pace.onTrack ? 'bg-vcr-emerald/12 text-vcr-emerald' : 'bg-vcr-oxide/12 text-vcr-oxide'
            )}
          >
            <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <span className="font-mono tabular-nums">{pace.recent}</span> classes in the last 30 days
              {' '}(plan: <span className="font-mono tabular-nums">{pace.expected}</span>)
              {' — '}{pace.onTrack ? 'on track' : 'behind plan'}
            </p>
          </div>

        </section>

        {/* Recent sessions */}
        <section className="vcr-panel rounded-2xl p-4 sm:p-6">
          <h2 className="font-display text-xl text-vcr-chrome">Recent sessions</h2>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-vcr-chrome/60">No class-room sessions recorded yet. Open the VCR to start one.</p>
          ) : (
            <ul className="mt-3 divide-y divide-vcr-chrome/10">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-28 font-mono text-sm tabular-nums text-vcr-chrome/70">
                    {new Date(s.started_at).toLocaleDateString()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base text-vcr-chrome" dir="auto">
                    {itemTitle(s.item_covered_id)}
                    {s.reference_covered ? ` — ${s.reference_covered}` : ''}
                  </span>
                  {!s.ended_at && (
                    <button
                      type="button"
                      onClick={() => navigate(`/vcr/${studentId}`)}
                      className="rounded-full bg-vcr-oxide/25 px-3 py-1 text-xs font-semibold text-vcr-chrome transition-colors hover:bg-vcr-oxide/45"
                      title="Resume this session in the Virtual Class Room"
                    >
                      Resume in VCR
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
