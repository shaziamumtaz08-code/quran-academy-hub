import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, BookMarked, CheckCircle2, Circle, ClipboardList, ListOrdered, PenLine, PlayCircle, Save, Square, Upload } from 'lucide-react';
import {
  getResource, getAnnotations, saveAnnotations, saveVersion, resolveResourceFile,
  type UserResource,
} from '@/lib/myResources';
import {
  getSubmissionById, markUnderReview, saveSyncedReview, SUBMISSION_STATUS_LABEL,
  type AssignmentSubmission,
} from '@/lib/syncedSubmissions';
import { SubmitToAssignmentDialog, type SyncedSource } from '@/components/assignments/SubmitToAssignmentDialog';
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
import { VcrAppRail, type VcrRailKey } from '@/components/vcr/VcrAppRail';
import { VcrAppPanel, type VcrOpenTarget } from '@/components/vcr/VcrAppPanel';
import { VcrEmbedViewer } from '@/components/vcr/VcrEmbedViewer';
import { useVcrRoomState } from '@/hooks/useVcrRoomState';




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
  const submissionIdParam = searchParams.get('submission');
  const [resource, setResource] = useState<UserResource | null>(null);
  const [savingMarks, setSavingMarks] = useState(false);
  const loadedMarksKey = useRef<string>('');
  const [sharedEditable, setSharedEditable] = useState(false);
  const canMarkResource = !!resource && (resource.user_id === user?.id || sharedEditable);

  /* Assignment-linked synced submission (teacher marking view). */
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  /* May I edit a copy someone shared with me (e.g. a handed-in assignment)? */
  useEffect(() => {
    setSharedEditable(false);
    if (!resourceId || !user?.id) return;
    void (async () => {
      const { data } = await supabase
        .from('user_resource_shares' as any)
        .select('can_edit')
        .eq('resource_id', resourceId)
        .eq('shared_with', user.id)
        .maybeSingle();
      setSharedEditable(!!(data as any)?.can_edit);
    })();
  }, [resourceId, user?.id]);

  useEffect(() => {
    if (!submissionIdParam) { setSubmission(null); return; }
    void getSubmissionById(submissionIdParam)
      .then(async (s) => {
        setSubmission(s);
        if (s && canControl) await markUnderReview(s.id).catch(() => {});
      })
      .catch(() => setSubmission(null));
  }, [submissionIdParam, canControl]);


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

  /* Teacher marking an assignment-linked synced copy: marks auto-save onto the
     assignment copy (never onto the student's own resource). */
  useEffect(() => {
    if (!submission?.synced_resource_id || !resource || !user?.id) return;
    if (resource.id !== submission.synced_resource_id || !canMarkResource) return;
    const id = window.setTimeout(() => {
      void saveAnnotations({ resourceId: resource.id, page: currentPage, strokes, userId: user.id }).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(id);
  }, [strokes, currentPage, submission?.synced_resource_id, resource?.id, canMarkResource, user?.id]);

  const saveReview = async (returnNow: boolean) => {
    if (!submission || !submission.synced_resource_id || !user?.id) return;
    setSavingReview(true);
    try {
      await saveAnnotations({ resourceId: submission.synced_resource_id, page: currentPage, strokes, userId: user.id });
      await saveSyncedReview({
        submissionId: submission.id,
        resourceId: submission.synced_resource_id,
        reviewerId: user.id,
        comment: reviewComment.trim() || null,
        returnNow,
      });
      const fresh = await getSubmissionById(submission.id);
      setSubmission(fresh);
      toast({
        title: returnNow ? 'Returned to the student' : 'Review saved',
        description: returnNow ? 'She can now see your checked copy.' : 'Your marks are kept as a new version.',
      });
    } catch (e: any) {
      toast({ title: 'Could not save the review', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingReview(false);
    }
  };

  /** What the student would hand in from this room right now. */
  const syncedSource: SyncedSource | null = resource
    ? { kind: 'resource', resource }
    : content === 'doc' && activeDocId
      ? { kind: 'doc', docId: activeDocId, title: activeDoc?.title ?? 'Class document' }
      : content === 'qaida' || content === 'mushaf'
        ? { kind: 'content', content, title: content === 'qaida' ? 'Noorani Qaida' : 'Mushaf' }
        : null;
  const canSubmitToAssignment = !canControl && !!user?.id && user.id === studentId && !!syncedSource;



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

  /* ── VCR app rail + shared classroom workspace ─────────────────────────── */
  const [railKey, setRailKey] = useState<VcrRailKey | null>(null);
  const [railExpanded, setRailExpanded] = useState<boolean>(
    () => localStorage.getItem('vcr-rail-expanded') !== '0',
  );
  const [embed, setEmbed] = useState<{ title: string; url: string; synced?: boolean } | null>(null);
  const { state: roomState, patch: patchRoom } = useVcrRoomState(studentId || null, user?.id ?? null);
  const synced = !!roomState?.sync_enabled;

  const railPanelApp = railKey && !['whiteboard', 'call', 'recordings'].includes(railKey)
    ? (railKey as Exclude<VcrRailKey, 'whiteboard' | 'call' | 'recordings'>)
    : null;

  const onRailSelect = React.useCallback((key: VcrRailKey) => {
    if (key === 'whiteboard') { setBoardMode('board'); setWhiteboardOn((v) => !v); setRailKey('whiteboard'); return; }
    if (key === 'recordings') { navigate('/class-recordings'); return; }
    setRailKey((prev) => (prev === key ? null : key));
  }, [navigate]);

  /** Put a target on my own screen, or on the shared classroom workspace. */
  const openTarget = React.useCallback(
    (t: VcrOpenTarget, share: boolean) => {
      if (t.kind === 'link') {
        if (!t.url) return;
        setEmbed({ title: t.title, url: t.url, synced: share });
      } else if (t.kind === 'content') {
        setEmbed(null);
        setContentMode(t.content === 'qaida' ? 'qaida' : 'mushaf');
      } else if (t.kind === 'doc' && t.docId) {
        setEmbed(null);
        setDocId(t.docId);
        setContentMode('doc');
      } else if (t.kind === 'resource' && t.resourceId) {
        navigate(`/vcr/${studentId}?resource=${t.resourceId}`);
        return;
      }
      if (share) {
        void patchRoom({
          sync_enabled: true,
          presenter_id: user?.id ?? null,
          presenter_name: (profile as any)?.full_name ?? null,
          presenter_role: canControl ? 'staff' : 'student',
          app: (t.kind === 'content' ? t.content : t.kind === 'doc' ? 'doc' : (t.app ?? 'url')) as any,
          payload: { title: t.title, url: t.url, docId: t.docId ?? null, resourceId: t.resourceId ?? null },
        });
      }
    },
    [navigate, studentId, patchRoom, user?.id, profile, canControl],
  );

  /** Teacher takes presentation priority away from the student. */
  const takeOver = React.useCallback(async () => {
    await patchRoom({
      presenter_id: user?.id ?? null,
      presenter_name: (profile as any)?.full_name ?? null,
      presenter_role: 'staff',
    });
  }, [patchRoom, user?.id, profile]);

  /* Followers mirror whatever is on the shared workspace while sharing is on. */
  useEffect(() => {
    if (!synced || !roomState) return;
    if (roomState.presenter_id && roomState.presenter_id === user?.id) return;
    const p = roomState.payload ?? {};
    if (roomState.app === 'mushaf' || roomState.app === 'qaida') { setEmbed(null); setContentMode(roomState.app); }
    else if (roomState.app === 'doc' && p.docId) { setEmbed(null); setDocId(p.docId); setContentMode('doc'); }
    else if (p.url) setEmbed({ title: p.title ?? 'Shared with the class', url: p.url, synced: true });
  }, [synced, roomState, user?.id]);




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
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs',
              attendance ? 'bg-vcr-emerald text-vcr-chrome' : 'bg-vcr-oxide/25 text-vcr-chrome/70'
            )}
          >
            {attendance ? `Attendance: ${attendance}` : 'Attendance: not marked'}
          </span>


        </div>
        {/* Content and tools now live in the VCR app rail and the reader strip
            below, so the header stays clean and never duplicates them. */}

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

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        {/* The VCR's own app rail — separate from the LMS main sidebar */}
        <VcrAppRail
          active={railKey}
          expanded={railExpanded}
          onToggle={() => setRailExpanded((v) => { localStorage.setItem('vcr-rail-expanded', v ? '0' : '1'); return !v; })}
          onSelect={onRailSelect}
        />

        {/* Reading card — the lit centre of the room */}
        <main className="relative min-w-0 flex-1 space-y-3">
          {/* Sharing / sync state */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-vcr-chrome/12 bg-black/20 px-3 py-2 text-xs text-vcr-chrome/70">
            <button
              type="button"
              onClick={() => void patchRoom({ sync_enabled: !synced })}
              aria-pressed={synced}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3',
                synced ? 'border-vcr-gold/60 bg-vcr-gold/15 text-vcr-gold' : 'border-vcr-chrome/20 text-vcr-chrome/70',
              )}
            >
              {synced ? 'Sharing is ON' : 'Sharing is OFF (private)'}
            </button>
            <span className="truncate">
              {roomState?.presenter_id
                ? `Presenting: ${roomState.presenter_name ?? 'Someone in the class'}`
                : 'Nobody is presenting yet'}
            </span>
            {roomState?.app && (
              <span className="rounded-full border border-vcr-chrome/20 px-2 py-0.5">
                On the shared workspace: {roomState.payload?.title ?? roomState.app}
              </span>
            )}
            {canControl && roomState?.presenter_id && roomState.presenter_id !== user?.id && (
              <button
                type="button"
                onClick={() => void takeOver()}
                className="ms-auto inline-flex h-8 items-center rounded-full border border-vcr-gold/50 bg-vcr-gold/15 px-3 text-vcr-gold"
              >
                Take over presenting
              </button>
            )}
          </div>

          {/* Compact page tools — annotation and recording preference only.
              Opening content lives in the app rail. */}
          {canControl && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-vcr-chrome/60">
              <button
                type="button"
                onClick={() => { setBoardMode('annotate'); setWhiteboardOn((v) => !(v && boardMode === 'annotate')); }}
                aria-pressed={whiteboardOn && boardMode === 'annotate'}
                title="Draw on top of this page"
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3',
                  whiteboardOn && boardMode === 'annotate'
                    ? 'border-vcr-gold/60 bg-vcr-gold/15 text-vcr-gold'
                    : 'border-vcr-chrome/20 hover:text-vcr-chrome',
                )}
              >
                <PenLine className="h-3.5 w-3.5" /> Annotate this page
              </button>
              <button
                type="button"
                onClick={() => setAutoRecord((v) => { localStorage.setItem('vcr-auto-record', v ? '0' : '1'); return !v; })}
                aria-pressed={autoRecord}
                title="Ask for recording consent automatically when a call connects"
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3',
                  autoRecord ? 'border-red-400/60 bg-red-500/15 text-red-200' : 'border-vcr-chrome/20 hover:text-vcr-chrome',
                )}
              >
                <Circle className="h-3 w-3" /> {autoRecord ? 'Auto-record on' : 'Auto-record off'}
              </button>
              <span className="truncate text-vcr-chrome/40">
                {content === 'qaida' ? 'Noorani Qaida' : content === 'mushaf' ? 'Mushaf' : activeDoc?.title ?? 'No file open'}
              </span>
            </div>
          )}

          {/* Whatever app the rail is pointing at */}

          {railPanelApp && (
            <div className="rounded-2xl border border-vcr-chrome/12 bg-black/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-vcr-chrome/45">
                  {railPanelApp === 'myspace' ? 'My Drive / My Resources' : railPanelApp}
                </span>
                <button
                  type="button"
                  onClick={() => setRailKey(null)}
                  className="ms-auto text-xs text-vcr-chrome/50 hover:text-vcr-chrome"
                >
                  Hide
                </button>
              </div>
              <VcrAppPanel
                app={railPanelApp}
                docs={docs as any}
                docsLoading={loading}
                docsError={null}
                userId={user?.id ?? null}
                onOpenPrivate={(t) => openTarget(t, false)}
                onOpenSynced={(t) => openTarget(t, true)}
                onUpload={canControl ? () => setUploadOpen(true) : undefined}
              />
            </div>
          )}

          {embed && (
            <VcrEmbedViewer
              title={embed.title}
              src={embed.url}
              synced={!!embed.synced}
              onClose={() => setEmbed(null)}
            />
          )}

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

          {/* Hand this shared work in as an assignment */}
          {canSubmitToAssignment && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-vcr-chrome/15 bg-black/20 px-3 py-2 text-sm text-vcr-chrome/75">
              <span className="text-xs">Finished this piece of work?</span>
              <button
                type="button"
                onClick={() => setSubmitOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-vcr-gold/50 bg-vcr-gold/15 px-3 text-xs text-vcr-gold"
              >
                <ClipboardList className="h-3.5 w-3.5" /> Submit to assignment
              </button>
              <span className="text-[11px] text-vcr-chrome/50">Hands in a synced copy · your own copy stays private</span>
            </div>
          )}

          {/* Assignment-linked synced submission — teacher marking bar */}
          {submission && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-vcr-gold/30 bg-vcr-gold/5 px-3 py-2 text-sm text-vcr-chrome/80">
              <span className="font-medium text-vcr-chrome">Assignment submission</span>
              <span className="rounded-full border border-vcr-chrome/20 px-2 py-0.5 text-xs">
                {SUBMISSION_STATUS_LABEL[submission.status] ?? submission.status}
              </span>
              {canControl && canMarkResource && (
                <>
                  <input
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Comment for the student (optional)"
                    className="h-8 min-w-[12rem] flex-1 rounded-full border border-vcr-chrome/20 bg-black/30 px-3 text-xs text-vcr-chrome placeholder:text-vcr-chrome/40"
                  />
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void saveReview(false)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-vcr-chrome/20 px-3 text-xs disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" /> Save review
                  </button>
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void saveReview(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-vcr-gold/50 bg-vcr-gold/15 px-3 text-xs text-vcr-gold disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Save &amp; return to student
                  </button>
                </>
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

      <SubmitToAssignmentDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        studentId={studentId}
        source={syncedSource}
        syncedState={{
          page: currentPage,
          content,
          docId: activeDocId ?? null,
          resourceId: resource?.id ?? null,
          synced: !!roomState?.sync_enabled,
        }}
        origin="vcr"
      />
    </div>

  );
}
