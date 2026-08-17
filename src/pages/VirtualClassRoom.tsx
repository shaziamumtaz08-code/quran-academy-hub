import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, ClipboardList, ListChecks, PanelRightClose, PanelRightOpen, Timer } from 'lucide-react';
import { VcrMushafPage, type VcrSelection } from '@/components/vcr/VcrMushafPage';
import { cn } from '@/lib/utils';

const STAFF_ROLES = ['teacher', 'admin', 'super_admin', 'admin_academic', 'admin_division'];
const MISTAKE_TYPES = ['Makhraj', 'Tajweed', 'Fluency'] as const;
type MistakeType = (typeof MISTAKE_TYPES)[number];

interface SyllabusItem { id: string; level: string; title: string; sequence_order: number }
interface Mistake { id: string; reference: string; mistake_type: string; created_at: string }

const clock = (secs: number) => {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function VirtualClassRoom() {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const { user, activeRole, profile } = useAuth();

  const roles: string[] = (profile as any)?.roles || (activeRole ? [activeRole] : []);
  const canControl = roles.some((r) => STAFF_ROLES.includes(r));

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<{ id: string; full_name: string } | null>(null);
  const [items, setItems] = useState<SyllabusItem[]>([]);
  const [progress, setProgress] = useState<any | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [attendance, setAttendance] = useState<string | null>(null);
  const [selection, setSelection] = useState<VcrSelection | null>(null);
  const [tagFor, setTagFor] = useState<VcrSelection | null>(null);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [notes, setNotes] = useState('');
  const [tajweed, setTajweed] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
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
          .insert({ student_id: studentId, current_item_id: list[0]?.id ?? null, status: 'in_progress' })
          .select('*')
          .maybeSingle();
        current = data;
      }
      setProgress(current ?? null);

      if (canControl && user?.id) {
        const { data: s } = await supabase
          .from('vcr_sessions' as any)
          .insert({ student_id: studentId, teacher_id: user.id, item_covered_id: current?.current_item_id ?? null })
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
    if (!sessionId) return;
    if (notesTimer.current) window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(async () => {
      await supabase.from('vcr_sessions' as any).update({ notes: value }).eq('id', sessionId);
    }, 900);
  };

  const logMistake = useCallback(async (type: MistakeType) => {
    if (!sessionId || !tagFor) return;
    const { data, error } = await supabase
      .from('mistake_log' as any)
      .insert({ session_id: sessionId, reference: tagFor.reference, mistake_type: type })
      .select('id, reference, mistake_type, created_at')
      .maybeSingle();
    setTagFor(null);
    if (error) { toast({ title: 'Could not save', description: error.message, variant: 'destructive' }); return; }
    if (data) setMistakes((m) => [data as any, ...m]);
  }, [sessionId, tagFor]);

  const markComplete = async () => {
    if (!sessionId || !canControl) return;
    setSaving(true);
    const reference = selection?.reference ?? null;
    await supabase.from('vcr_sessions' as any).update({
      ended_at: new Date().toISOString(),
      item_covered_id: currentItem?.id ?? null,
      reference_covered: reference,
      notes,
    }).eq('id', sessionId);

    const { data } = await supabase.from('student_progress' as any).update({
      current_item_id: nextItem?.id ?? currentItem?.id ?? null,
      current_page_or_ayah: reference,
      status: nextItem ? 'in_progress' : 'completed',
      updated_at: new Date().toISOString(),
    }).eq('student_id', studentId).select('*').maybeSingle();
    setProgress(data ?? progress);
    setSaving(false);
    toast({
      title: 'Lesson marked complete',
      description: nextItem ? `Next up: ${nextItem.title}` : 'Syllabus finished.',
    });
    navigate(`/syllabus/${studentId}`);
  };

  const resumeAyah = useMemo(() => {
    const m = String(progress?.current_page_or_ayah ?? '').match(/(\d+):(\d+)/);
    return m ? { surah: Number(m[1]), ayah: Number(m[2]) } : null;
  }, [progress?.current_page_or_ayah]);

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-[60vh] w-full" /></div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — readable when screen-shared */}
      <header className="sticky top-0 z-20 border-b bg-lms-navy text-white">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{student?.full_name ?? 'Student'}</h1>
          <Badge className="bg-white/15 text-white text-sm hover:bg-white/25">
            {currentItem ? `${currentItem.level} · ${currentItem.title}` : 'No syllabus item set'}
          </Badge>
          {progress?.current_page_or_ayah && (
            <Badge variant="outline" className="border-white/40 text-white text-sm" dir="auto">
              Resume: {progress.current_page_or_ayah}
            </Badge>
          )}
          <Badge className={cn('text-sm', attendance ? 'bg-lms-success' : 'bg-white/15 hover:bg-white/25')}>
            {attendance ? `Attendance: ${attendance}` : 'Attendance: not marked'}
          </Badge>
          <div className="ms-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-lg font-semibold tabular-nums">
              <Timer className="h-5 w-5" /> {clock(elapsed)}
            </span>
            <div className="flex items-center gap-2">
              <Label htmlFor="tajweed" className="text-sm text-white/80">Tajweed</Label>
              <Switch id="tajweed" checked={tajweed} onCheckedChange={setTajweed} />
            </div>
            <Button variant="secondary" size="sm" className="h-9" onClick={() => setPanelOpen((o) => !o)}>
              {panelOpen ? <PanelRightClose className="h-4 w-4 me-1" /> : <PanelRightOpen className="h-4 w-4 me-1" />}
              Mistakes ({mistakes.length})
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-w-0">
        <main className="flex-1 min-w-0 p-3 sm:p-5">
          <VcrMushafPage
            tajweed={tajweed}
            canControl={canControl}
            selection={selection}
            resumeAyah={resumeAyah}
            onSelect={setSelection}
            onWordTap={(sel) => canControl && sessionId && setTagFor(sel)}
          />
        </main>

        {/* Mistake log — collapses so it never eats width on a shared screen */}
        {panelOpen && (
          <aside className="w-[19rem] shrink-0 border-s bg-lms-surface p-4 space-y-4 hidden lg:block">
            <div className="flex items-center gap-2 text-lms-text-1 font-semibold">
              <ListChecks className="h-5 w-5" /> Mistake log
            </div>
            {tagFor ? (
              <div className="rounded-lg border-2 border-primary bg-card p-3 space-y-2">
                <p className="text-sm text-lms-text-2">Tag this:</p>
                <p className="text-base font-semibold" dir="auto">{tagFor.reference}</p>
                <div className="grid grid-cols-1 gap-2">
                  {MISTAKE_TYPES.map((t) => (
                    <Button key={t} size="sm" className="h-9 justify-start" onClick={() => logMistake(t)}>{t}</Button>
                  ))}
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setTagFor(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-lms-text-3">Tap any word on the page to tag a mistake.</p>
            )}

            <div className="space-y-2 max-h-[52vh] overflow-y-auto">
              {mistakes.length === 0 && (
                <p className="text-sm text-lms-text-3">No mistakes tagged in this session yet.</p>
              )}
              {mistakes.map((m) => (
                <div key={m.id} className="rounded-lg border bg-card px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-xs">{m.mistake_type}</Badge>
                    <span className="text-xs text-lms-text-3 tabular-nums">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm mt-1" dir="auto">{m.reference}</p>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Bottom bar: private notes + complete */}
      {canControl && (
        <footer className="sticky bottom-0 z-20 border-t bg-card px-3 sm:px-5 py-3">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-lms-text-3 inline-flex items-center gap-1">
                <ClipboardList className="h-3.5 w-3.5" /> Private teacher notes (autosaved, never shown to the student)
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => onNotes(e.target.value)}
                rows={2}
                className="mt-1 text-base"
                placeholder="What to practise before the next class…"
              />
            </div>
            <div className="flex sm:flex-col gap-2 sm:w-56">
              <Button size="lg" className="flex-1 h-12 text-base" onClick={markComplete} disabled={saving}>
                <CheckCircle2 className="h-5 w-5 me-2" /> Mark lesson complete
              </Button>
              <Button variant="outline" size="lg" className="h-12" onClick={() => navigate(`/syllabus/${studentId}`)}>
                Syllabus
              </Button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
