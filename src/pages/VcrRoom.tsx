import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle2, Circle, ClipboardList, ListOrdered, PenLine, Save, Square, Upload } from 'lucide-react';
import {
  getResource, getAnnotations, saveAnnotations, saveVersion, resolveResourceFile,
  type UserResource,
} from '@/lib/myResources';
import { LibraryAddItemDialog } from '@/components/library/LibraryAddItemDialog';
import { VcrReader } from '@/components/vcr/VcrReader';
import { UnifiedAttendanceForm } from '@/components/attendance/UnifiedAttendanceForm';
import { useMushafAdapter } from '@/components/vcr/adapters/useMushafAdapter';
import { useQaidaAdapter } from '@/components/vcr/adapters/useQaidaAdapter';
import { useDocAdapter, type DocSource } from '@/components/vcr/adapters/useDocAdapter';
import { VcrBookmarkBar } from '@/components/vcr/VcrBookmarkBar';
import { useVcrBookmarks } from '@/hooks/useVcrBookmarks';
import { VcrCallPanel } from '@/components/vcr/VcrCallPanel';

import { VcrWhiteboard } from '@/components/vcr/VcrWhiteboard';
import { useVcrViewSync } from '@/hooks/useVcrViewSync';



import { cn } from '@/lib/utils';
import { goBackToClassRoom } from '@/lib/classRoomBack';


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
  /**
   * Observer seat: examiners, and admins who are not the teaching staff on this
   * room, sit in muted. Teachers always join as a normal participant.
   */
  const isTeacher = roles.includes('teacher');
  const wantsObserver = !isTeacher && (roles.includes('examiner') || canControl);
  const [mayObserve, setMayObserve] = useState<boolean | null>(null);
  const [observeError, setObserveError] = useState<string | null>(null);
  useEffect(() => {
    if (!wantsObserver || !studentId) { setMayObserve(null); setObserveError(null); return; }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc('can_observe_vcr' as any, { _student_id: studentId });
      if (cancelled) return;
      if (error) { console.error('can_observe_vcr failed', error); setObserveError(error.message); setMayObserve(false); return; }
      setObserveError(null);
      setMayObserve(!!data);
    })();
    return () => { cancelled = true; };
  }, [wantsObserver, studentId]);

  /** The student viewing their own room: read-only mirror of the teacher's screen. */
  const isFollower = !canControl && !!user?.id && user.id === studentId;

  const { remoteState, publish, strokes, pushStroke, undoStroke, clearBoard, loadStrokes } = useVcrViewSync({
    roomId: studentId,
    isPresenter: canControl,
    enabled: !!studentId,
  });



  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<{ id: string; full_name: string } | null>(null);
  const [items, setItems] = useState<SyllabusItem[]>([]);
  const [progress, setProgress] = useState<any | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  /** Zoom-style automatic recording — consent is still asked every call. */
  const [autoRecord, setAutoRecord] = useState<boolean>(() => localStorage.getItem('vcr-auto-record') === '1');
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
        }
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [studentId, canControl, user?.id]);

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
  const [contentMode, setContentMode] = useState<'mushaf' | 'qaida' | 'doc' | null>(null);
  const [whiteboardOn, setWhiteboardOn] = useState(false);
  const [boardMode, setBoardMode] = useState<'annotate' | 'board'>('board');

  /* Library is the single source of syllabus material: books, worksheets,
     PDFs and images that were marked for the syllabus folders. */
  const [docs, setDocs] = useState<DocSource[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [libCategories, setLibCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const loadDocs = React.useCallback(async (selectLatest = false) => {
    if (!user?.id) return;
    /* Syllabus files plus the teacher's own personal uploads. */
    const { data, error } = await supabase
      .from('library_items' as any)
      .select('id, title, file_path, url, type, pages_count, syllabus_folder, syllabus_order, created_at, is_personal, uploaded_by')
      .eq('status', 'published')
      .or(`is_syllabus.eq.true,uploaded_by.eq.${user.id}`)
      .order('syllabus_folder', { nullsFirst: true })
      .order('syllabus_order');
    if (error) return;
    const rows = ((data as any[]) ?? []) as (DocSource & { created_at?: string; is_personal?: boolean; uploaded_by?: string })[];
    setDocs(rows);
    if (selectLatest && rows.length) {
      const latest = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      setDocId(latest.id);
    }
  }, [user?.id]);
  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);
  /* Categories for the in-room upload dialog (staff only). */
  useEffect(() => {
    if (!canControl) return;
    void (async () => {
      const { data } = await supabase.from('library_categories' as any).select('id, name, slug').order('name');
      setLibCategories(((data as any[]) ?? []) as { id: string; name: string; slug: string }[]);
    })();
  }, [canControl]);

  /* Students mirror whichever reader the teacher is driving. */
  const content = isFollower
    ? (remoteState?.content ?? contentMode ?? suggestedContent)
    : (contentMode ?? suggestedContent);
  const activeDocId = isFollower ? (remoteState?.libraryItemId ?? null) : docId;
  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeDocId) ?? null,
    [docs, activeDocId],
  );

  /* Shown in class = shared with the student: when a teacher opens one of
     their own personal files, record the share so the student (and linked
     parents) can reopen it from their Library afterwards. */
  useEffect(() => {
    const doc = activeDoc as any;
    if (!canControl || !user?.id || !studentId) return;
    if (!doc?.is_personal || doc.uploaded_by !== user.id) return;
    void (supabase.from('personal_item_shares') as any)
      .upsert(
        { item_id: doc.id, student_id: studentId, shared_by: user.id },
        { onConflict: 'item_id,student_id' }
      )
      .then(({ error }: any) => { if (error) console.error('share failed', error); });
  }, [canControl, user?.id, studentId, activeDoc]);

  /* Follower fallback: the teacher may open one of their own personal files,
     which is not in the student's syllabus list. Fetch it by id — the share
     recorded above (plus RLS) makes it readable for this student. */
  useEffect(() => {
    if (!isFollower || !activeDocId || activeDoc) return;
    void (async () => {
      const { data } = await supabase
        .from('library_items' as any)
        .select('id, title, file_path, url, type, pages_count, syllabus_folder, syllabus_order, is_personal, uploaded_by')
        .eq('id', activeDocId)
        .maybeSingle();
      if (data) {
        setDocs((prev) => (prev.some((d) => d.id === (data as any).id) ? prev : [...prev, data as any]));
      }
    })();
  }, [isFollower, activeDocId, activeDoc]);

  /* ── A personal resource from My Resources opened in this room ──────────
     The canonical Library file is shown as-is; the marks live on the personal
     copy only, so the original is never changed. */
  const [searchParams] = useSearchParams();
  const resourceId = searchParams.get('resource');
  const [resource, setResource] = useState<UserResource | null>(null);
  const [savingMarks, setSavingMarks] = useState(false);
  const loadedMarksKey = useRef<string>('');
  const canMarkResource = !!resource && resource.user_id === user?.id;

  useEffect(() => {
    if (!resourceId) { setResource(null); return; }
    let cancelled = false;
    void (async () => {
      try {
        const r = await getResource(resourceId);
        if (cancelled || !r) return;
        setResource(r);
        const f = await resolveResourceFile(r);
        if (cancelled) return;
        if (f.itemId) {
          const row = {
            id: f.itemId, title: f.title, file_path: f.file_path, url: f.url,
            type: f.type, pages_count: f.pages_count,
          } as DocSource;
          setDocs((prev) => (prev.some((d) => d.id === row.id) ? prev : [...prev, row]));
          setDocId(f.itemId);
        }
        setContentMode('doc');
      } catch (e: any) {
        toast({ title: 'Could not open this resource', description: e?.message, variant: 'destructive' });
      }
    })();
    return () => { cancelled = true; };
  }, [resourceId]);

  /* Reopen the marks that were saved on this page last time. */
  useEffect(() => {
    if (!resource) return;
    const key = `${resource.id}:${currentPage}`;
    if (loadedMarksKey.current === key) return;
    loadedMarksKey.current = key;
    void (async () => {
      try {
        const saved = await getAnnotations(resource.id, currentPage);
        loadStrokes(saved as any);
        if (saved.length) { setBoardMode('annotate'); setWhiteboardOn(true); }
      } catch { /* nothing saved yet */ }
    })();
  }, [resource?.id, currentPage, loadStrokes]);

  const saveMarks = async (alsoVersion: boolean) => {
    if (!resource || !user?.id) return;
    setSavingMarks(true);
    try {
      await saveAnnotations({ resourceId: resource.id, page: currentPage, strokes, userId: user.id });
      if (alsoVersion) {
        const v = await saveVersion({ resourceId: resource.id, userId: user.id, note: `Marked in class` });
        setResource({ ...resource, current_version: v.version_no });
        toast({ title: `Saved as version ${v.version_no}`, description: 'Find it in My Resources · Versions.' });
      } else {
        toast({ title: 'Marks saved', description: 'They will be here when you reopen this page.' });
      }
    } catch (e: any) {
      toast({ title: 'Could not save your marks', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingMarks(false);
    }
  };

  /* Followers show the board whenever the teacher has it open. */
  const whiteboardVisible = isFollower ? !!remoteState?.whiteboard : whiteboardOn;
  const whiteboardMode = isFollower ? (remoteState?.whiteboardMode ?? 'board') : boardMode;

  /* Keep the last broadcast view so word flips can be published without
     the reader having to own highlight state. */
  const lastView = useRef({ page: 1, fontScale: 1 });
  const publishView = React.useCallback(
    (state: { page: number; fontScale: number; highlight: any }) => {
      lastView.current = { page: state.page, fontScale: state.fontScale };
      publish({ ...state, content, libraryItemId: docId, whiteboard: whiteboardOn, whiteboardMode: boardMode });
    },
    [publish, content, docId, whiteboardOn, boardMode]
  );
  const publishWord = React.useCallback(
    (wordId: string | null) => {
      publish({ ...lastView.current, highlight: wordId ? { wordId } : null, content, libraryItemId: docId, whiteboard: whiteboardOn, whiteboardMode: boardMode });
    },
    [publish, content, docId, whiteboardOn, boardMode]
  );

  /* Announce whiteboard open/close immediately, not just on the next page turn. */
  useEffect(() => {
    if (!canControl) return;
    publish({ ...lastView.current, highlight: null, content, libraryItemId: docId, whiteboard: whiteboardOn, whiteboardMode: boardMode });
  }, [whiteboardOn, boardMode, canControl, content, docId, publish]);



  const mushafAdapter = useMushafAdapter({ resumeAyah, resumeJuz });
  const qaidaAdapter = useQaidaAdapter({
    resumePage: content === 'qaida' ? resumePage : null,
    canControl,
    studentId: studentId || null,
    onSelectWord: publishWord,
  });
  const docAdapter = useDocAdapter({ item: content === 'doc' ? activeDoc : null, resumePage: null });
  const adapter = content === 'doc' ? docAdapter : content === 'qaida' ? qaidaAdapter : mushafAdapter;

  /* Bookmarks — identical behaviour across Mushaf, Qaida and Library files. */
  const { bookmarks, add: addBookmark, remove: removeBookmark } = useVcrBookmarks({
    studentId: studentId || null,
    contentType: adapter.contentType,
    libraryItemId: adapter.libraryItemId ?? null,
  });
  const [jumpRequest, setJumpRequest] = useState<{ unit: number; nonce: number } | null>(null);


  if (loading) {
    return (
      <div className="vcr-canvas min-h-screen space-y-4 p-6">
        <Skeleton className="h-16 w-full bg-white/5" />
        <Skeleton className="h-[60vh] w-full bg-white/5" />
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-screen flex-col text-vcr-chrome', content === 'qaida' ? 'qaida-room' : 'vcr-canvas')}>
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
              onClick={() => goBackToClassRoom(navigate)}

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

        </div>
        {/* Row 1 — CLASS CONTENT: Mushaf, Noorani Qaida or a Library/syllabus file */}
        {canControl && (
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2 border-t border-vcr-chrome/10 px-4 py-2 sm:px-6">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-vcr-chrome/40">Class content</span>

            {(['mushaf', 'qaida', 'doc'] as const).map((c) => (
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
                {c === 'mushaf' ? 'Mushaf' : c === 'qaida' ? 'Noorani Qaida' : 'Book / PDF'}
              </button>
            ))}
            {content === 'doc' && (
              <select
                value={docId ?? ''}
                onChange={(e) => setDocId(e.target.value || null)}
                className="h-9 max-w-[22rem] rounded-full border border-vcr-chrome/20 bg-black/25 px-3 text-sm text-vcr-chrome focus:border-vcr-gold/60 focus:outline-none"
              >
                <option value="">
                  {docs.length ? 'Choose syllabus file…' : 'No syllabus files in the Library yet'}
                </option>
                {(() => {
                  const mine = (docs as any[]).filter((d) => d.is_personal && d.uploaded_by === user?.id);
                  const shared = (docs as any[]).filter((d) => !(d.is_personal && d.uploaded_by === user?.id));
                  const groups = new Map<string, any[]>();
                  for (const d of shared) {
                    const k = d.syllabus_folder || 'Other resources';
                    groups.set(k, [...(groups.get(k) ?? []), d]);
                  }
                  const sortDocs = (a: any, b: any) =>
                    (a.syllabus_order ?? 0) - (b.syllabus_order ?? 0) || String(a.title).localeCompare(String(b.title));
                  return (
                    <>
                      {[...groups.entries()]
                        .sort(([a], [b]) => (a === 'Other resources' ? 1 : b === 'Other resources' ? -1 : a.localeCompare(b)))
                        .map(([folder, items]) => (
                          <optgroup key={folder} label={folder}>
                            {items.sort(sortDocs).map((d) => (
                              <option key={d.id} value={d.id}>{d.title}</option>
                            ))}
                          </optgroup>
                        ))}
                      {mine.length > 0 && (
                        <optgroup label="My files">
                          {mine.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                        </optgroup>
                      )}
                    </>
                  );
                })()}

              </select>
            )}
            {content === 'doc' && (
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                title="Upload a PDF or image to the Library and show it here"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-vcr-chrome/20 px-4 text-sm text-vcr-chrome/65 transition-colors hover:text-vcr-chrome"
              >
                <Upload className="h-4 w-4" /> Add file
              </button>
            )}

            <span className="ms-auto hidden text-xs text-vcr-chrome/40 lg:inline">
              {content === 'mushaf'
                ? 'Mushaf — the built-in Qur’an pages'
                : content === 'qaida'
                  ? 'Noorani Qaida — the built-in Qaida lessons'
                  : 'Book / PDF — files from the Library and syllabus folders'}
            </span>
          </div>
        )}

        {/* Row 2 — TOOLS: board, annotation, recording preference and shortcuts */}
        {canControl && (
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2 border-t border-vcr-chrome/10 px-4 py-2 sm:px-6">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-vcr-chrome/40">Tools</span>
            <button
              type="button"
              onClick={() => {
                setBoardMode('board');
                setWhiteboardOn((v) => !(v && boardMode === 'board'));
              }}
              aria-pressed={whiteboardOn && boardMode === 'board'}
              title="Open a separate blank whiteboard"
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors',
                whiteboardOn && boardMode === 'board'
                  ? 'border-vcr-gold bg-vcr-gold/15 text-vcr-gold'
                  : 'border-vcr-chrome/20 text-vcr-chrome/65 hover:text-vcr-chrome'
              )}
            >
              <Square className="h-4 w-4" /> Whiteboard
            </button>
            <button
              type="button"
              onClick={() => {
                setBoardMode('annotate');
                setWhiteboardOn((v) => !(v && boardMode === 'annotate'));
              }}
              aria-pressed={whiteboardOn && boardMode === 'annotate'}
              title="Draw on top of the page"
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors',
                whiteboardOn && boardMode === 'annotate'
                  ? 'border-vcr-gold bg-vcr-gold/15 text-vcr-gold'
                  : 'border-vcr-chrome/20 text-vcr-chrome/65 hover:text-vcr-chrome'
              )}
            >
              <PenLine className="h-4 w-4" /> Annotate
            </button>
            <button
              type="button"
              onClick={() => setAutoRecord((v) => { localStorage.setItem('vcr-auto-record', v ? '0' : '1'); return !v; })}
              aria-pressed={autoRecord}
              title="Ask the student for recording consent automatically when a call connects"
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors',
                autoRecord
                  ? 'border-red-400/60 bg-red-500/15 text-red-200'
                  : 'border-vcr-chrome/20 text-vcr-chrome/65 hover:text-vcr-chrome'
              )}
            >
              <Circle className="h-3.5 w-3.5" /> {autoRecord ? 'Auto-record on' : 'Auto-record off'}
            </button>

            <div className="ms-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/my-resources')}
                title="Your own files and working copies"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-vcr-chrome/20 px-4 text-sm text-vcr-chrome/65 transition-colors hover:text-vcr-chrome"
              >
                <BookMarked className="h-4 w-4" /> My Resources
              </button>
              <button
                type="button"
                onClick={() => navigate('/class-recordings')}
                title="Saved recordings of in-app class calls"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-vcr-chrome/20 px-4 text-sm text-vcr-chrome/65 transition-colors hover:text-vcr-chrome"
              >
                <PlayCircle className="h-4 w-4" /> Class recordings
              </button>
            </div>
          </div>
        )}

        {/* Row 3 — CALL: in-app audio, additive to the existing Zoom option */}
        {user?.id && (
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3 border-t border-vcr-chrome/10 px-4 py-2 pb-3 sm:px-6">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-vcr-chrome/40">Call</span>
            {wantsObserver && mayObserve === null && (
              <span className="text-sm text-vcr-chrome/60">Checking your sit-in access…</span>
            )}
            {wantsObserver && mayObserve === false && (
              <span className="text-sm text-vcr-chrome/60">
                {observeError
                  ? `Sit-in unavailable: ${observeError}`
                  : 'You do not have sit-in access for this student yet. Ask a super admin to grant it in Class Call Observers.'}
              </span>
            )}
            {(!wantsObserver || mayObserve === true) && (
              <VcrCallPanel
                roomId={studentId}
                peerId={user.id}
                isCaller={canControl}
                role={canControl ? (roles[0] ?? 'staff') : 'student'}
                autoRecord={autoRecord}
                callerName={(profile as any)?.full_name ?? 'Your teacher'}
                knockerName={student?.full_name ?? 'Your student'}
                studentId={studentId}
                teacherId={canControl && !wantsObserver ? user.id : null}
                displayName={(profile as any)?.full_name ?? 'Participant'}
                observer={wantsObserver}
              />
            )}
            {!canControl && (
              <button
                type="button"
                onClick={() => navigate('/class-recordings')}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-vcr-chrome/20 px-4 text-sm text-vcr-chrome/65 transition-colors hover:text-vcr-chrome"
              >
                <PlayCircle className="h-4 w-4" /> My class recordings
              </button>
            )}
          </div>
        )}



      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row">
        {/* Reading card — the lit centre of the room */}
        <main className="relative min-w-0 flex-1 space-y-3">
          {/* Personal working copy — mark it, save it, reopen it later */}
          {resource && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-vcr-chrome/15 bg-black/20 px-3 py-2 text-sm text-vcr-chrome/75">
              <span className="truncate font-medium text-vcr-chrome">{resource.title}</span>
              <span className="rounded-full border border-vcr-chrome/20 px-2 py-0.5 text-xs">
                {resource.kind === 'copy' ? 'My copy' : 'Linked to Library'}
                {resource.current_version > 0 ? ` · v${resource.current_version}` : ''}
              </span>
              {canMarkResource ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setBoardMode('annotate'); setWhiteboardOn(true); }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-vcr-chrome/20 px-3 text-xs transition-colors hover:text-vcr-chrome"
                  >
                    <PenLine className="h-3.5 w-3.5" /> Mark this page
                  </button>
                  <button
                    type="button"
                    disabled={savingMarks}
                    onClick={() => void saveMarks(false)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-vcr-chrome/20 px-3 text-xs transition-colors hover:text-vcr-chrome disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" /> Save marks
                  </button>
                  <button
                    type="button"
                    disabled={savingMarks}
                    onClick={() => void saveMarks(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-vcr-gold/50 bg-vcr-gold/15 px-3 text-xs text-vcr-gold disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Save as new version
                  </button>
                </>
              ) : (
                <span className="text-xs text-vcr-chrome/55">Shared with you · marks are read-only</span>
              )}
            </div>
          )}
          <VcrBookmarkBar
            bookmarks={bookmarks}
            currentUnit={currentPage}
            unitNoun={adapter.unitNoun}
            canAdd={!isFollower}
            onAdd={(u) => void addBookmark(u)}
            onOpen={(u) => setJumpRequest({ unit: u, nonce: Date.now() })}
            onRemove={(id) => void removeBookmark(id)}
          />
          <VcrReader
            key={`${content}:${activeDocId ?? 'none'}`}
            adapter={adapter}
            initialUnit={content === 'doc' ? 1 : resumePage}
            canControl={canControl}
            turnSignal={turnSignal}
            isFollower={isFollower}
            followState={remoteState}
            onViewChange={publishView}
            onUnitChange={(p) => setCurrentPage(p)}
            jumpRequest={jumpRequest}
          />


          {/* Shared whiteboard layer — teacher draws, student mirrors live */}
          {whiteboardVisible && (
            <VcrWhiteboard
              strokes={strokes}
              mode={whiteboardMode}
              canDraw={canControl}
              onStroke={pushStroke}
              onUndo={undoStroke}
              onClear={clearBoard}
              onClose={() => setWhiteboardOn(false)}
            />
          )}
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

      {/* In-room Library upload: the file lands in the Library syllabus list
          and is selected for viewing straight away. */}
      <LibraryAddItemDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        categories={libCategories}
        defaultSyllabus
        onSaved={() => { void loadDocs(true); setContentMode('doc'); }}
      />
    </div>
  );
}
