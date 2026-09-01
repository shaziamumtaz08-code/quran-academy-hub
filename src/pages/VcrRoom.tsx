import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle2, ClipboardList, ListOrdered, Timer } from 'lucide-react';
import { VcrReader } from '@/components/vcr/VcrReader';
import { UnifiedAttendanceForm } from '@/components/attendance/UnifiedAttendanceForm';
import { useMushafAdapter } from '@/components/vcr/adapters/useMushafAdapter';
import { useQaidaAdapter } from '@/components/vcr/adapters/useQaidaAdapter';
import { VcrCallPanel } from '@/components/vcr/VcrCallPanel';
import { useVcrViewSync } from '@/hooks/useVcrViewSync';


import { cn } from '@/lib/utils';

const STAFF_ROLES = ['teacher', 'admin', 'super_admin', 'admin_academic', 'admin_division'];

interface SyllabusItem { id: string; level: string; title: string; sequence_order: number }

const clock = (secs: number) => {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export default function VcrRoom() {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const { user, activeRole, profile } = useAuth();

  const roles: string[] = (profile as any)?.roles || (activeRole ? [activeRole] : []);
  const canControl = roles.some((r) => STAFF_ROLES.includes(r));
  /** The student viewing their own room: read-only mirror of the teacher's screen. */
  const isFollower = !canControl && !!user?.id && user.id === studentId;

  const { remoteState, publish } = useVcrViewSync({
    roomId: studentId,
    isPresenter: canControl,
    enabled: !!studentId,
  });


  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<{ id: string; full_name: string } | null>(null);
  const [items, setItems] = useState<SyllabusItem[]>([]);
  const [progress, setProgress] = useState<any | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [attendance, setAttendance] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [turnSignal, setTurnSignal] = useState(0);
  const [saving, setSaving] = useState(false);
  const notesTimer = useRef<number | null>(null);
  const bootstrapped = useRef(false);

  const currentItem = useMemo(
    () => items.find((i) => i.id === progress?.current_item_id) ?? null,
    [items, progress]
  );
  const nextItem = useMemo(() => {
    if (!currentItem) return items[0] ?? null;
    return items.find((i) => i.sequence_order > currentItem.sequence_order) ?? null;
  }, [items, currentItem]);

  /* ── Load student, syllabus, progress, today's attendance and open a session ── */
  useEffect(() => {
    if (!studentId || bootstrapped.current) return;
    bootstrapped.current = true;
    let cancelled = false;

    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [p, syl, prog, att] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('id', studentId).maybeSingle(),
        supabase.from('syllabus_items' as any).select('id, level, title, sequence_order').eq('is_active', true).order('sequence_order'),
        supabase.from('student_progress' as any).select('*').eq('student_id', studentId).maybeSingle(),
        supabase.from('attendance').select('status').eq('student_id', studentId).eq('class_date', today).order('updated_at', { ascending: false }).limit(1),
      ]);
      if (cancelled) return;

      setStudent((p.data as any) ?? null);
      const list = ((syl.data as any[]) ?? []) as SyllabusItem[];
      setItems(list);
      setAttendance(((att.data as any[]) ?? [])[0]?.status ?? null);

      let current = prog.data as any;
      if (!current && canControl) {
        const { data } = await supabase
          .from('student_progress' as any)
          .insert({ student_id: studentId, current_item_id: list[0]?.id ?? null, status: 'in_progress', content_type: 'mushaf' })
          .select('*')
          .maybeSingle();
        current = data;
      }
      setProgress(current ?? null);
      setNotes('');

      if (canControl && user?.id) {
        const { data: s } = await supabase
          .from('vcr_sessions' as any)
          .insert({ student_id: studentId, teacher_id: user.id, item_covered_id: current?.current_item_id ?? null, content_type: 'mushaf' })
          .select('id, started_at')
          .maybeSingle();
        if (s) {
          setSessionId((s as any).id);
          setStartedAt(new Date((s as any).started_at).getTime());
        }
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [studentId, canControl, user?.id]);

  /* Session timer */
  useEffect(() => {
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [startedAt]);

  /* Notes autosave (debounced) */
  const onNotes = (value: string) => {
    setNotes(value);
    setNotesSaved(false);
    if (!sessionId) return;
    if (notesTimer.current) window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(async () => {
      await supabase.from('vcr_sessions' as any).update({ notes: value }).eq('id', sessionId);
      setNotesSaved(true);
    }, 900);
  };

  const markComplete = async () => {
    if (!canControl || saving) return;
    setSaving(true);
    const reference = `Page ${currentPage}`;

    if (sessionId) {
      await supabase.from('vcr_sessions' as any).update({
        ended_at: new Date().toISOString(),
        item_covered_id: currentItem?.id ?? null,
        reference_covered: reference,
        content_type: adapter.contentType,
        library_item_id: adapter.libraryItemId ?? null,
        reference: adapter.referenceFor?.(currentPage) ?? { page: currentPage },
        notes,
      }).eq('id', sessionId);
    }

    const payload = {
      student_id: studentId,
      current_item_id: nextItem?.id ?? currentItem?.id ?? null,
      current_page_or_ayah: reference,
      content_type: adapter.contentType,
      library_item_id: adapter.libraryItemId ?? null,
      reference: adapter.referenceFor?.(currentPage) ?? { page: currentPage },
      status: nextItem ? 'in_progress' : 'completed',
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabase.from('student_progress' as any)
      .update(payload).eq('student_id', studentId).select('*').maybeSingle();

    // No progress row yet — create one instead of silently doing nothing.
    if (!error && !data) {
      const res = await supabase.from('student_progress' as any).insert(payload).select('*').maybeSingle();
      data = res.data as any;
      error = res.error as any;
    }

    if (error) {
      setSaving(false);
      toast({
        title: 'Could not save',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
      return;
    }
    setProgress(data ?? progress);

    /* Signature page-turn, then open the next session record */
    setTurnSignal((n) => n + 1);
    setSaving(false);
    toast({
      title: 'Lesson marked complete',
      description: nextItem ? `Next up: ${nextItem.title}` : 'Syllabus finished.',
    });

    if (user?.id) {
      const { data: s } = await supabase
        .from('vcr_sessions' as any)
        .insert({ student_id: studentId, teacher_id: user.id, item_covered_id: nextItem?.id ?? currentItem?.id ?? null, content_type: 'mushaf' })
        .select('id, started_at')
        .maybeSingle();
      if (s) {
        setSessionId((s as any).id);
        setStartedAt(new Date((s as any).started_at).getTime());
        setNotes('');
      }
    }
  };

  const resumeAyah = useMemo(() => {
    const m = String(progress?.current_page_or_ayah ?? '').match(/(\d+):(\d+)/);
    return m ? { surah: Number(m[1]), ayah: Number(m[2]) } : null;
  }, [progress?.current_page_or_ayah]);

  const resumePage = useMemo(() => {
    const m = String(progress?.current_page_or_ayah ?? '').match(/Page\s+(\d+)/i);
    return m ? Number(m[1]) : 1;
  }, [progress?.current_page_or_ayah]);

  const resumeJuz = useMemo(() => {
    const m = String(currentItem?.title ?? '').match(/juz\s*(\d+)/i);
    return m ? Number(m[1]) : null;
  }, [currentItem?.title]);

  /* Which content the reader shows. Seeded from progress / syllabus wording,
     and switchable by staff for the rest of the session. */
  const suggestedContent: 'mushaf' | 'qaida' = useMemo(() => {
    if (progress?.content_type === 'qaida') return 'qaida';
    const text = `${currentItem?.level ?? ''} ${currentItem?.title ?? ''}`.toLowerCase();
    return /qaida|qa'ida|noorani/.test(text) ? 'qaida' : 'mushaf';
  }, [progress?.content_type, currentItem?.level, currentItem?.title]);

  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [contentMode, setContentMode] = useState<'mushaf' | 'qaida' | null>(null);
  /* Students mirror whichever reader the teacher is driving. */
  const content = isFollower
    ? (remoteState?.content ?? contentMode ?? suggestedContent)
    : (contentMode ?? suggestedContent);

  /* Keep the last broadcast view so word flips can be published without
     the reader having to own highlight state. */
  const lastView = useRef({ page: 1, fontScale: 1 });
  const publishView = React.useCallback(
    (state: { page: number; fontScale: number; highlight: any }) => {
      lastView.current = { page: state.page, fontScale: state.fontScale };
      publish({ ...state, content });
    },
    [publish, content]
  );
  const publishWord = React.useCallback(
    (wordId: string | null) => {
      publish({ ...lastView.current, highlight: wordId ? { wordId } : null, content });
    },
    [publish, content]
  );


  const mushafAdapter = useMushafAdapter({ resumeAyah, resumeJuz });
  const qaidaAdapter = useQaidaAdapter({
    resumePage: content === 'qaida' ? resumePage : null,
    canControl,
    onSelectWord: publishWord,
  });
  const adapter = content === 'qaida' ? qaidaAdapter : mushafAdapter;

  if (loading) {
    return (
      <div className="vcr-canvas min-h-screen space-y-4 p-6">
        <Skeleton className="h-16 w-full bg-white/5" />
        <Skeleton className="h-[60vh] w-full bg-white/5" />
      </div>
    );
  }

  return (
    <div className="vcr-canvas flex min-h-screen flex-col text-vcr-chrome">
      {/* Header — stays legible when screen-shared */}
      <header className="sticky top-0 z-20 border-b border-vcr-chrome/10 bg-[#0C1B1E]/90 backdrop-blur">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2 px-4 pt-3 text-xs text-vcr-chrome/55 sm:px-6"
        >
          <button type="button" onClick={() => navigate('/dashboard')} className="transition-colors hover:text-vcr-chrome">Home</button>
          <span aria-hidden>›</span>
          {canControl && (
            <>
              <button type="button" onClick={() => navigate('/class-room')} className="transition-colors hover:text-vcr-chrome">Class Room</button>
              <span aria-hidden>›</span>
              <span className="truncate text-vcr-chrome/80">{student?.full_name ?? 'Student'}</span>
              <span aria-hidden>›</span>
            </>
          )}
          <span className="font-medium text-vcr-chrome">Virtual Class Room</span>
        </nav>
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
          {canControl && (
            <button
              type="button"
              onClick={() => navigate('/class-room')}
              className="vcr-btn inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Class Room
            </button>
          )}
          <h1 className="font-display text-2xl font-semibold tracking-tight text-vcr-chrome sm:text-3xl">
            {student?.full_name ?? 'Student'}
          </h1>
          <span className="rounded-full border border-vcr-gold/40 bg-vcr-gold/10 px-3 py-1 text-base text-vcr-gold">
            {currentItem ? `${currentItem.level} · ${currentItem.title}` : 'No syllabus item set'}
          </span>
          {progress?.current_page_or_ayah && (
            <span className="font-mono text-sm tabular-nums text-vcr-chrome/70" dir="auto">
              Resume: {progress.current_page_or_ayah}
            </span>
          )}
          <span
            className={cn(
              'rounded-full px-3 py-1 text-sm',
              attendance ? 'bg-vcr-emerald text-vcr-chrome' : 'bg-vcr-oxide/25 text-vcr-chrome/80'
            )}
          >
            {attendance ? `Attendance: ${attendance}` : 'Attendance: not marked'}
          </span>
          <span className="ms-auto inline-flex items-center gap-2 font-mono text-2xl tabular-nums text-vcr-chrome">
            <Timer className="h-5 w-5 text-vcr-gold" />
            <span className="font-sans text-xs uppercase tracking-wide text-vcr-chrome/50">Session</span>
            {clock(elapsed)}
          </span>

        </div>
        {/* Content switcher — Mushaf or Noorani Qaida, staff only */}
        {canControl && (
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-4 pb-2 sm:px-6">
            {(['mushaf', 'qaida'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setContentMode(c)}
                className={cn(
                  'h-9 rounded-full border px-4 text-sm transition-colors',
                  content === c
                    ? 'border-vcr-gold bg-vcr-gold/15 text-vcr-gold'
                    : 'border-vcr-chrome/20 text-vcr-chrome/65 hover:text-vcr-chrome'
                )}
              >
                {c === 'mushaf' ? 'Mushaf' : 'Noorani Qaida'}
              </button>
            ))}
          </div>
        )}
        {/* In-app audio call — additive, sits alongside the existing Zoom option */}
        {user?.id && (
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 pb-3 sm:px-6">
            <VcrCallPanel
              roomId={studentId}
              peerId={user.id}
              isCaller={canControl}
              callerName={(profile as any)?.full_name ?? 'Your teacher'}
            />

          </div>
        )}

      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row">
        {/* Reading card — the lit centre of the room */}
        <main className="min-w-0 flex-1">
          <VcrReader
            key={content}
            adapter={adapter}
            initialUnit={resumePage}
            canControl={canControl}
            turnSignal={turnSignal}
            isFollower={isFollower}
            followState={remoteState}
            onViewChange={publishView}
            onUnitChange={(p) => setCurrentPage(p)}
          />

        </main>

        {/* Receded side panel */}
        {canControl && (
          <aside className="vcr-panel w-full shrink-0 space-y-4 rounded-2xl p-4 lg:w-[22rem]">
            <div className="flex items-center gap-2 font-display text-lg text-vcr-chrome">
              <ClipboardList className="h-5 w-5 text-vcr-gold" /> Private teacher notes
            </div>
            <p className="text-sm text-vcr-chrome/60">Autosaved. Never shown to the student or parent.</p>
            <textarea
              value={notes}
              onChange={(e) => onNotes(e.target.value)}
              rows={8}
              placeholder="What to practise before the next class…"
              className="w-full resize-y rounded-xl border border-vcr-chrome/15 bg-[#0A1618] p-3 text-base text-vcr-chrome placeholder:text-vcr-chrome/35 focus:border-vcr-gold/60 focus:outline-none"
            />
            <p className="font-mono text-xs text-vcr-chrome/45">{notesSaved ? 'Saved' : 'Saving…'}</p>

            <div className="space-y-2 rounded-xl border border-vcr-chrome/10 bg-black/20 p-3 text-sm text-vcr-chrome/70">
              <div className="flex items-center gap-2 text-vcr-chrome">
                <ListOrdered className="h-4 w-4 text-vcr-gold" /> Next in syllabus
              </div>
              <p>{nextItem ? `${nextItem.level} · ${nextItem.title}` : 'End of syllabus'}</p>
            </div>

            <button
              type="button"
              onClick={markComplete}
              disabled={saving}
              className="vcr-btn-gold inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold disabled:opacity-60"
            >
              <CheckCircle2 className="h-5 w-5" /> Mark page/lesson complete
            </button>
            <button
              type="button"
              onClick={() => setAttendanceOpen(true)}
              className="vcr-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base"
            >
              <ClipboardList className="h-4 w-4" /> Mark attendance from this page
            </button>
            <button
              type="button"
              onClick={() => navigate(`/syllabus/${studentId}`)}
              className="vcr-btn inline-flex h-12 w-full items-center justify-center rounded-xl text-base"
            >
              Open syllabus
            </button>
          </aside>
        )}
      </div>

      {/* Tap-to-mark attendance without leaving the live class */}
      {canControl && studentId && (
        <UnifiedAttendanceForm
          open={attendanceOpen}
          onOpenChange={setAttendanceOpen}
          student={{ id: studentId, full_name: student?.full_name ?? 'Student', subject_name: null, last_lesson: null }}
          teacherId={user?.id}
          lessonEntryMode="tap"
          initialContentPage={currentPage}
          onSuccess={() => {
            setAttendanceOpen(false);
            setAttendance('marked');
          }}
        />
      )}
    </div>
  );
}
