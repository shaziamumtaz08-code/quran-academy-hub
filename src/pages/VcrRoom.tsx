import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { openExternal } from '@/lib/popupWindow';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, BookMarked, Bookmark, CheckCircle2, ChevronLeft, Chrome, Circle, ClipboardList, Eye, Folder, Grid2X2, HardDrive, Library, Link2, ListOrdered, Lock, MousePointer2, PenLine, PhoneCall, PlayCircle, Presentation, Save, Share2, Video, X, Youtube } from 'lucide-react';
import {
  getResource, getAnnotations, saveAnnotations, saveVersion, resolveResourceFile,
  type UserResource,
} from '@/lib/myResources';
import { getLessonAnnotations, saveLessonAnnotations } from '@/lib/lessonAnnotations';

import {
  getSubmissionById, markUnderReview, saveSyncedReview, SUBMISSION_STATUS_LABEL,
  type AssignmentSubmission,
} from '@/lib/syncedSubmissions';
import { SubmitToAssignmentDialog, type SyncedSource } from '@/components/assignments/SubmitToAssignmentDialog';
import { LibraryAddItemDialog } from '@/components/library/LibraryAddItemDialog';
import { VcrReader } from '@/components/vcr/VcrReader';
import { VcrPointerLayer } from '@/components/vcr/VcrPointerLayer';
import { UnifiedAttendanceForm } from '@/components/attendance/UnifiedAttendanceForm';
import { useMushafAdapter } from '@/components/vcr/adapters/useMushafAdapter';
import { useQaidaAdapter } from '@/components/vcr/adapters/useQaidaAdapter';
import { useDocAdapter, type DocSource } from '@/components/vcr/adapters/useDocAdapter';
import { VcrBookmarkBar } from '@/components/vcr/VcrBookmarkBar';
import { useVcrBookmarks } from '@/hooks/useVcrBookmarks';
import { VcrCallPanel } from '@/components/vcr/VcrCallPanel';
import { useVcrRingListener, useVcrKnockListener } from '@/hooks/useVcrRing';

import { VcrWhiteboard } from '@/components/vcr/VcrWhiteboard';
import { useVcrViewSync } from '@/hooks/useVcrViewSync';
import { VcrAppRail, type VcrRailKey } from '@/components/vcr/VcrAppRail';
import { VcrAppPanel, type VcrOpenTarget } from '@/components/vcr/VcrAppPanel';
import { VcrEmbedViewer } from '@/components/vcr/VcrEmbedViewer';
import { VcrRecordingsPanel } from '@/components/vcr/VcrRecordingsPanel';
import { type VcrTab } from '@/components/vcr/VcrTabStrip';

/** The real Library and My Drive screens, mounted inside classroom tabs. */
const LibraryPage = React.lazy(() => import('@/pages/Library'));
const MyResourcesPage = React.lazy(() => import('@/pages/MyResources'));

import { useVcrRoomState } from '@/hooks/useVcrRoomState';




import { useIsMobile } from '@/hooks/use-mobile';
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

  /**
   * The shared classroom workspace. Loaded up front because whether the
   * student mirrors the teacher depends on it: sharing OFF (the default) means
   * she reads and reviews her own syllabus freely, with or without a teacher.
   */
  const { state: roomState, patch: patchRoom } = useVcrRoomState(studentId || null, user?.id ?? null);
  const synced = !!roomState?.sync_enabled;

  /** Mirror the teacher's screen only while the shared workspace is on. */
  const isFollower = !canControl && !!user?.id && user.id === studentId && synced;


  const { remoteState, publish, strokes, pushStroke, undoStroke, clearBoard, loadStrokes, remotePointer, sendPointer } = useVcrViewSync({
    roomId: studentId,
    isPresenter: canControl,
    enabled: !!studentId,
  });



  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<{ id: string; full_name: string } | null>(null);
  /** The student's enrolled subject — decides which reader opens by default. */
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const [items, setItems] = useState<SyllabusItem[]>([]);
  const [progress, setProgress] = useState<any | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  /** Zoom-style automatic recording — consent is still asked every call. */
  const [autoRecord, setAutoRecord] = useState<boolean>(() => localStorage.getItem('vcr-auto-record') === '1');
  /** Any staff member can choose to sit in silently instead of taking a speaking seat. */
  const [listenOnly, setListenOnly] = useState(false);
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
      void (async () => {
        const { data: asg } = await (supabase as any)
          .from('student_teacher_assignments')
          .select('subject_id, subjects(name)')
          .eq('student_id', studentId)
          .eq('status', 'active')
          .limit(1);
        const nm = (asg as any[])?.[0]?.subjects?.name ?? null;
        if (!cancelled) setSubjectName(nm);
      })();
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
  const suggestedContent: 'mushaf' | 'qaida' | 'doc' = useMemo(() => {
    if (progress?.content_type === 'qaida') return 'qaida';
    if (progress?.content_type === 'mushaf') return 'mushaf';
    const subject = (subjectName ?? '').toLowerCase();
    /* Qaida students land on the Noorani Qaida; Nazra, Hifz and Tafseer
       students land on the Mushaf; every other subject opens its own book. */
    if (/qaida|qa'ida|noorani/.test(subject)) return 'qaida';
    if (/nazra|nazira|hifz|hifdh|tafseer|tafsir|quran|qur'an/.test(subject)) return 'mushaf';
    if (subject) return 'doc';
    const text = `${currentItem?.level ?? ''} ${currentItem?.title ?? ''}`.toLowerCase();
    return /qaida|qa'ida|noorani/.test(text) ? 'qaida' : 'mushaf';
  }, [progress?.content_type, subjectName, currentItem?.level, currentItem?.title]);

  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [contentMode, setContentMode] = useState<'mushaf' | 'qaida' | 'doc' | null>(null);
  /* Live teaching pointer — separate from Annotate; nothing is ever saved. */
  const pageAreaRef = React.useRef<HTMLDivElement | null>(null);
  const [pointerOn, setPointerOn] = useState(false);
  const [pointerStyle, setPointerStyle] = useState<'laser' | 'finger'>('laser');
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
  /* A non-Qaida / non-Quran subject opens its own book: the first syllabus
     file filed under that subject, else the first syllabus file we have. */
  useEffect(() => {
    if (docId || contentMode || suggestedContent !== 'doc' || !docs.length) return;
    const subject = (subjectName ?? '').toLowerCase();
    const match = docs.find((d: any) =>
      String(d.syllabus_folder ?? '').toLowerCase().includes(subject) ||
      String(d.title ?? '').toLowerCase().includes(subject));
    setDocId((match ?? docs[0]).id);
  }, [docId, contentMode, suggestedContent, docs, subjectName]);

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

  /* Opening an assignment link without an explicit resource: load the copy the
     student handed in, so the teacher can mark it straight away. */
  const effectiveResourceId = resourceId ?? submission?.synced_resource_id ?? null;

  /* May I edit a copy someone shared with me (e.g. a handed-in assignment)? */
  useEffect(() => {
    setSharedEditable(false);
    const resourceId = effectiveResourceId;
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
  }, [effectiveResourceId, user?.id]);

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
    const resourceId = effectiveResourceId;
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
  }, [effectiveResourceId]);

  /* Followers show the board whenever the teacher has it open. */
  const whiteboardVisible = isFollower ? !!remoteState?.whiteboard : whiteboardOn;
  const whiteboardMode = isFollower ? (remoteState?.whiteboardMode ?? 'board') : boardMode;

  /* Every working area keeps its own marks: each Mushaf / Qaida / document
     page has its own layer, and the whiteboard is a separate canvas that never
     shares anything with the pages. */
  const pageLayer = resource
    ? `resource:${resource.id}:${currentPage}`
    : content === 'doc'
      ? `doc:${activeDocId ?? 'none'}:${currentPage}`
      : `${content}:${currentPage}`;
  const annotationLayer = whiteboardMode === 'board' ? 'whiteboard' : pageLayer;
  const layerOf = (s: any) => s.layer ?? 'whiteboard';
  const pageStrokes = React.useMemo(
    () => strokes.filter((s) => layerOf(s) === pageLayer),
    [strokes, pageLayer],
  );
  const activeStrokes = React.useMemo(
    () => strokes.filter((s) => layerOf(s) === annotationLayer),
    [strokes, annotationLayer],
  );

  /* Reopen the marks that were saved on this page last time. */
  useEffect(() => {
    if (!resource) return;
    const key = `${resource.id}:${currentPage}`;
    if (loadedMarksKey.current === key) return;
    loadedMarksKey.current = key;
    void (async () => {
      try {
        const saved = await getAnnotations(resource.id, currentPage);
        loadStrokes(`resource:${resource.id}:${currentPage}`, saved as any);
      } catch { /* nothing saved yet */ }
    })();
  }, [resource?.id, currentPage, loadStrokes]);

  const saveLessonMarks = async () => {
    if (!studentId || !user?.id) return;
    setSavingMarks(true);
    try {
      await saveLessonAnnotations({
        studentId,
        contentType: content,
        unit: currentPage,
        strokes: pageStrokes,
        userId: user.id,
        reference: { libraryItemId: docId ?? null },
      });
      toast({ title: 'Markings saved', description: 'They will be here when this page is opened again.' });
    } catch (e: any) {
      toast({ title: 'Could not save the markings', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingMarks(false);
    }
  };

  const saveMarks = async (alsoVersion: boolean) => {

    if (!resource || !user?.id) return;
    setSavingMarks(true);
    try {
      await saveAnnotations({ resourceId: resource.id, page: currentPage, strokes: pageStrokes, userId: user.id });
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
      void saveAnnotations({ resourceId: resource.id, page: currentPage, strokes: pageStrokes, userId: user.id }).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(id);
  }, [pageStrokes, currentPage, submission?.synced_resource_id, resource?.id, canMarkResource, user?.id]);

  const saveReview = async (returnNow: boolean) => {
    if (!submission || !submission.synced_resource_id || !user?.id) return;
    setSavingReview(true);
    try {
      await saveAnnotations({ resourceId: submission.synced_resource_id, page: currentPage, strokes: pageStrokes, userId: user.id });
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



  /* Teacher pointing at a Mushaf line — mirrored to the student's screen. */
  const publishLine = React.useCallback(
    (lineId: string | null) => {
      publish({ ...lastView.current, highlight: lineId ? { lineId } : null, content, libraryItemId: docId, whiteboard: whiteboardOn, whiteboardMode: boardMode });
    },
    [publish, content, docId, whiteboardOn, boardMode]
  );

  const mushafAdapter = useMushafAdapter({ resumeAyah, resumeJuz, canControl, onPointLine: publishLine });
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

  /* Qaida and Mushaf have no file behind them, so their markings are kept
     against the lesson itself — reopened next time, and attributed to whoever
     saved them. Library files keep using the personal-copy marks above. */
  const isLessonContent = !resource && (content === 'qaida' || content === 'mushaf');
  /* The student may mark her own lesson pages too, even before the teacher joins. */
  const canMarkLesson = canControl || (!!user?.id && user.id === studentId);
  const loadedLessonMarksKey = useRef<string>('');
  useEffect(() => {
    if (!isLessonContent || !studentId) return;
    const key = `${content}:${studentId}:${currentPage}`;
    if (loadedLessonMarksKey.current === key) return;
    loadedLessonMarksKey.current = key;
    void (async () => {
      const saved = await getLessonAnnotations(studentId, content, currentPage);
      loadStrokes(`${content}:${currentPage}`, saved as any);
    })();
  }, [isLessonContent, studentId, content, currentPage, loadStrokes]);

  useEffect(() => {
    if (!isLessonContent || !studentId || !user?.id || !canMarkLesson) return;
    if (loadedLessonMarksKey.current !== `${content}:${studentId}:${currentPage}`) return;
    const id = window.setTimeout(() => {
      void saveLessonAnnotations({
        studentId,
        contentType: content,
        unit: currentPage,
        strokes: pageStrokes,
        userId: user.id,
        reference: { libraryItemId: docId ?? null },
      }).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(id);
  }, [pageStrokes, isLessonContent, studentId, content, currentPage, user?.id, canMarkLesson, docId]);


  /* ── VCR tabs: a browser-like workspace inside the classroom ───────────── */
  const isMobile = useIsMobile();
  const [launcherOpen, setLauncherOpen] = useState(false);
  useEffect(() => { if (isMobile) setLauncherOpen(false); }, [isMobile]);
  const [callOpen, setCallOpen] = useState(false);

  /* Personal rooms of the other side, so a ring reaches them anywhere in the app.
   * Staff ring the student's own room (= the class room id); the student rings
   * every teacher currently assigned to her. */
  const [teacherRooms, setTeacherRooms] = useState<string[]>([]);
  useEffect(() => {
    if (!studentId || canControl) { setTeacherRooms([]); return; }
    let cancelled = false;
    void (async () => {
      const { data } = await (supabase as any)
        .from('student_teacher_assignments')
        .select('teacher_id')
        .eq('student_id', studentId)
        .eq('status', 'active');
      if (cancelled) return;
      setTeacherRooms(Array.from(new Set(((data as any[]) ?? []).map((r) => r.teacher_id).filter(Boolean))));
    })();
    return () => { cancelled = true; };
  }, [studentId, canControl]);
  const notifyRooms = canControl ? [] : teacherRooms;

  /* Someone calling or ringing while the call bar is closed must still be noticed. */
  const { ringing: roomRinging, callerName: roomCaller } = useVcrRingListener(studentId, !callOpen);
  const { knockerName: roomKnocker, dismiss: dismissRoomKnock } = useVcrKnockListener(studentId, !callOpen);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [embed, setEmbed] = useState<{ title: string; url: string; synced?: boolean } | null>(null);

  const lessonTitle = content === 'qaida' ? 'Noorani Qaida' : content === 'mushaf' ? 'Mushaf' : activeDoc?.title ?? 'Lesson';
  const [tabs, setTabs] = useState<VcrTab[]>([
    { id: 'lesson', kind: 'lesson', title: 'Lesson', icon: BookMarked, pinned: true },
  ]);
  const [activeTab, setActiveTab] = useState('lesson');

  /* The lesson tab always names whatever the reader is showing. */
  useEffect(() => {
    setTabs((prev) => prev.map((t) => (t.id === 'lesson' ? { ...t, title: lessonTitle } : t)));
  }, [lessonTitle]);

  const openTab = React.useCallback((tab: VcrTab) => {
    setTabs((prev) => (prev.some((t) => t.id === tab.id) ? prev.map((t) => (t.id === tab.id ? { ...t, ...tab } : t)) : [...prev, tab]));
    setActiveTab(tab.id);
  }, []);

  const closeTab = React.useCallback((id: string) => {
    if (id === 'whiteboard') setWhiteboardOn(false);
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveTab((cur) => (cur === id ? 'lesson' : cur));
  }, []);


  /** Highlight the launcher entry matching whatever tab is in front. */
  const railActive: VcrRailKey | null = useMemo(() => {
    const t = tabs.find((x) => x.id === activeTab);
    if (!t) return null;
    if (t.kind === 'web') return (t.app ?? 'url') as VcrRailKey;
    if (t.kind === 'lesson') return 'syllabus';
    return t.kind as VcrRailKey;
  }, [tabs, activeTab]);

  const goExternal = React.useCallback((url: string) => {
    const ok = openExternal(url);
    if (!ok) {
      toast({
        title: 'Your browser blocked the new tab',
        description: `Allow pop-ups for this site, or open ${url} yourself.`,
        variant: 'destructive',
      });
    }
  }, []);

  const onRailSelect = React.useCallback((key: VcrRailKey) => {
    setLauncherOpen(false);
    switch (key) {
      case 'whiteboard':
        setBoardMode('board');
        setWhiteboardOn(true);
        openTab({ id: 'whiteboard', kind: 'whiteboard', title: 'Whiteboard', icon: Presentation });
        return;
      case 'recordings':
        openTab({ id: 'recordings', kind: 'recordings', title: 'Recordings', icon: PlayCircle });
        return;
      case 'syllabus':
        openTab({ id: 'syllabus', kind: 'syllabus', title: 'Syllabus', icon: BookMarked });
        return;
      case 'library':
        openTab({ id: 'library', kind: 'library', title: 'Library', icon: Library });
        return;
      case 'myspace':
        openTab({ id: 'myspace', kind: 'myspace', title: 'My Drive', icon: Folder });
        return;
      case 'drive':
        goExternal('https://drive.google.com/drive/my-drive');
        return;
      case 'youtube':
        goExternal('https://www.youtube.com/');
        return;
      case 'google':
        goExternal('https://www.google.com/');
        return;
      case 'zoom':
        goExternal('https://zoom.us/join');
        return;
      default: {
        const typed = window.prompt('Web address to open');
        if (typed && typed.trim()) {
          const href = /^https?:\/\//i.test(typed.trim()) ? typed.trim() : `https://${typed.trim()}`;
          goExternal(href);
        }
        return;
      }
    }
  }, [openTab, goExternal]);





  /** Put a target on my own screen, or on the shared classroom workspace. */
  const openTarget = React.useCallback(
    (t: VcrOpenTarget, share: boolean) => {
      if (t.kind === 'link') {
        if (!t.url) return;
        setEmbed({ title: t.title, url: t.url, synced: share });
      } else if (t.kind === 'content') {
        setEmbed(null);
        setContentMode(t.content === 'qaida' ? 'qaida' : 'mushaf');
        /* Chapters open at their own first page. */
        if (t.page && t.page > 0) setJumpRequest({ unit: t.page, nonce: Date.now() });

      } else if (t.kind === 'doc' && t.docId) {
        setEmbed(null);
        setDocId(t.docId);
        setContentMode('doc');
      } else if (t.kind === 'resource' && t.resourceId) {
        setEmbed(null);
        navigate(`/vcr/${studentId}?resource=${t.resourceId}`);
      }
      /* The launcher is a launcher: once it has opened something, get out
         of the way so the material owns the workspace. */
      setActiveTab('lesson');

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
    else if (p.resourceId) {
      if (p.resourceId !== resourceId) navigate(`/vcr/${studentId}?resource=${p.resourceId}`, { replace: true });
    }
    else if (p.url) setEmbed({ title: p.title ?? 'Shared with the class', url: p.url, synced: true });
  }, [synced, roomState, user?.id, resourceId, studentId, navigate]);




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
      {/* Header — one compact line: who the class is with, plus room state */}
      <header className="sticky top-0 z-20 border-b border-vcr-chrome/10 bg-[#0C1B1E]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2 px-3 py-2 sm:flex-nowrap sm:px-5">
          {/* Class Apps launcher — lives in the header so the Quran/Qaida
              canvas below keeps its full width on mobile and desktop. */}
          <VcrAppRail
            active={railActive}
            open={launcherOpen}
            onToggle={() => setLauncherOpen((v) => !v)}
            onSelect={onRailSelect}
            isMobile={isMobile}
            className="self-center"
          />

          {canControl && (
            <button
              type="button"
              onClick={() => goBackToClassRoom(navigate)}
              title="Back to Class Room"
              aria-label="Back to Class Room"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-vcr-chrome/60 hover:bg-white/5 hover:text-vcr-chrome"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h1 className="min-w-0 truncate font-display text-lg font-semibold tracking-tight text-vcr-chrome sm:text-xl">
            {student?.full_name ?? 'Student'}
          </h1>
          {attendance && (
            <span className="shrink-0 rounded-full bg-vcr-emerald px-2 py-0.5 text-[11px] text-vcr-chrome">
              {attendance}
            </span>
          )}

          <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:ms-auto sm:w-auto sm:flex-nowrap">
            {/* One clear control: whose workspace am I looking at? */}
            <div
              role="tablist"
              aria-label="Viewing mode"
              className="flex items-center gap-0.5 rounded-full border border-vcr-chrome/15 bg-white/5 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!synced}
                onClick={() => { if (synced) void patchRoom({ sync_enabled: false }); }}
                title="Only you can see what you open here"
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs',
                  !synced ? 'bg-vcr-chrome/90 font-medium text-[#0C1B1E]' : 'text-vcr-chrome/60',
                )}
              >
                <Lock className="h-3.5 w-3.5" /> My Copy
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={synced}
                onClick={() => { if (!synced) void patchRoom({ sync_enabled: true }); }}
                title="The other person in this class sees and works on the same workspace"
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs',
                  synced ? 'bg-vcr-gold font-medium text-[#0C1B1E]' : 'text-vcr-chrome/60',
                )}
              >
                <Share2 className="h-3.5 w-3.5" /> Synced
              </button>
            </div>
            {user?.id && (
              <button
                type="button"
                onClick={() => setCallOpen((v) => !v)}
                aria-pressed={callOpen}
                title="Audio & video call"
                aria-label="Audio and video call"
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full border',
                  callOpen ? 'border-vcr-gold/60 bg-vcr-gold/15 text-vcr-gold' : 'border-vcr-chrome/20 text-vcr-chrome/65',
                )}
              >
                <PhoneCall className="h-3.5 w-3.5" />
              </button>
            )}
            {canControl && (
              <button
                type="button"
                onClick={() => {
                  // Open only this panel — never leave another one half-open on top of it.
                  setToolsOpen((v) => {
                    const next = !v;
                    if (next) { setCallOpen(false); setBookmarksOpen(false); setLauncherOpen(false); }
                    return next;
                  });
                }}
                aria-pressed={toolsOpen}
                title="Lesson tools: notes, mark complete, attendance"
                aria-label="Lesson tools"
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full border',
                  toolsOpen ? 'border-vcr-gold/60 bg-vcr-gold/15 text-vcr-gold' : 'border-vcr-chrome/20 text-vcr-chrome/65',
                )}
              >
                <ClipboardList className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* A call or a bell arriving while the call bar is closed */}
        {!callOpen && user?.id && (roomRinging || roomKnocker) && (
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2 border-t border-emerald-400/30 bg-emerald-500/15 px-3 py-2 sm:px-5">
            <span className="inline-flex items-center gap-2 text-sm text-emerald-100">
              <span className="h-2 w-2 animate-ping rounded-full bg-emerald-300" aria-hidden />
              {roomRinging ? `${roomCaller} is on the call` : `${roomKnocker} is ringing you`}
            </span>
            <button
              type="button"
              onClick={() => { dismissRoomKnock(); setCallOpen(true); }}
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-emerald-500/30 px-3 text-sm text-emerald-50 transition-colors hover:bg-emerald-500/45"
            >
              <PhoneCall className="h-3.5 w-3.5" /> {roomRinging ? 'Join call' : 'Open call'}
            </button>
          </div>
        )}

      </header>

      {/* Call bar — sits in the normal page flow so it never covers the lesson */}
      {callOpen && user?.id && (
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2 rounded-2xl border border-vcr-chrome/10 bg-[#0C1B1E] px-3 py-3 text-vcr-chrome sm:px-5">
            {wantsObserver && mayObserve === null && (
              <span className="text-xs text-vcr-chrome/60">Checking your sit-in access…</span>
            )}
            {wantsObserver && mayObserve === false && (
              <span className="text-xs text-vcr-chrome/60">
                {observeError
                  ? `Sit-in unavailable: ${observeError}`
                  : 'You do not have sit-in access for this student yet.'}
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
                teacherId={canControl && !wantsObserver && !listenOnly ? user.id : null}
                displayName={(profile as any)?.full_name ?? 'Participant'}
                observer={wantsObserver || listenOnly}
                notifyRooms={notifyRooms}
              />
            )}
            {canControl && !wantsObserver && (
              <button
                type="button"
                onClick={() => setListenOnly((v) => !v)}
                aria-pressed={listenOnly}
                title="Join the call silently — you can still unmute if you need to speak"
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px]',
                  listenOnly ? 'border-vcr-gold/60 bg-vcr-gold/15 text-vcr-gold' : 'border-vcr-chrome/20 text-vcr-chrome/60',
                )}
              >
                <Eye className="h-3.5 w-3.5" /> {listenOnly ? 'Joining as listener' : 'Join as listener'}
              </button>
            )}
            {canControl && (
              <button
                type="button"
                onClick={() => setAutoRecord((v) => { localStorage.setItem('vcr-auto-record', v ? '0' : '1'); return !v; })}
                aria-pressed={autoRecord}
                title="Ask for recording consent automatically when a call connects"
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px]',
                  autoRecord ? 'border-red-400/60 bg-red-500/15 text-red-200' : 'border-vcr-chrome/20 text-vcr-chrome/60',
                )}
              >
                <Circle className="h-3 w-3" /> {autoRecord ? 'Auto-record on' : 'Auto-record off'}
              </button>
            )}
            <button
              type="button"
              onClick={() => openTab({ id: 'recordings', kind: 'recordings', title: 'Recordings', icon: PlayCircle })}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-vcr-chrome/20 px-2.5 text-[11px] text-vcr-chrome/60 hover:text-vcr-chrome"
            >
              <PlayCircle className="h-3.5 w-3.5" /> Recordings
            </button>
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-3 p-2 sm:p-4">
        {/* The workspace — the material is the page */}
        <main className="relative min-w-0 flex-1">
          
          <div className={cn(activeTab !== 'lesson' && 'hidden')}>
          {/* One slim toolbar over the material */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-vcr-chrome/55">
            {/* Classroom -> Syllabus -> item -> page: this step goes back one
                level only. The arrow in the header still leaves the classroom. */}
            <button
              type="button"
              onClick={() => openTab({ id: 'syllabus', kind: 'syllabus', title: 'Syllabus', icon: BookMarked })}
              title="Back to the syllabus list"
              className="inline-flex h-7 items-center gap-1 rounded-full border border-vcr-chrome/20 px-2 text-vcr-chrome/70 hover:text-vcr-chrome"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back to Syllabus
            </button>

            {roomState?.presenter_id && (
              <span className="truncate text-vcr-chrome/45">
                · presenting: {roomState.presenter_name ?? 'someone in the class'}
              </span>
            )}
            {canControl && roomState?.presenter_id && roomState.presenter_id !== user?.id && (
              <button
                type="button"
                onClick={() => void takeOver()}
                className="rounded-full border border-vcr-gold/50 px-2 py-0.5 text-vcr-gold"
              >
                Take over
              </button>
            )}

            <span className="ms-auto flex items-center gap-1.5">
              {canControl && (
                <button
                  type="button"
                  onClick={() => { setBoardMode('annotate'); setWhiteboardOn((v) => !(v && boardMode === 'annotate')); }}
                  aria-pressed={whiteboardOn && boardMode === 'annotate'}
                  title="Draw on top of this page"
                  className={cn(
                    'inline-flex h-7 items-center gap-1 rounded-full border px-2',
                    whiteboardOn && boardMode === 'annotate'
                      ? 'border-vcr-gold/60 bg-vcr-gold/15 text-vcr-gold'
                      : 'border-vcr-chrome/20 hover:text-vcr-chrome',
                  )}
                >
                  <PenLine className="h-3.5 w-3.5" /> Annotate
                </button>
              )}
              {canControl && (
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPointerOn((v) => !v)}
                    aria-pressed={pointerOn}
                    title="Point at a word for the student — nothing is saved"
                    className={cn(
                      'inline-flex h-7 items-center gap-1 rounded-full border px-2',
                      pointerOn
                        ? 'border-vcr-gold/60 bg-vcr-gold/15 text-vcr-gold'
                        : 'border-vcr-chrome/20 hover:text-vcr-chrome',
                    )}
                  >
                    <MousePointer2 className="h-3.5 w-3.5" /> Live Pointer
                  </button>
                  {pointerOn && (
                    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-vcr-chrome/20 px-1">
                      <button
                        type="button"
                        onClick={() => setPointerStyle('laser')}
                        aria-pressed={pointerStyle === 'laser'}
                        title="Laser dot"
                        className={cn('rounded-full px-1.5', pointerStyle === 'laser' ? 'text-vcr-gold' : 'text-vcr-chrome/55')}
                      >
                        Laser
                      </button>
                      <button
                        type="button"
                        onClick={() => setPointerStyle('finger')}
                        aria-pressed={pointerStyle === 'finger'}
                        title="Soft finger spotlight"
                        className={cn('rounded-full px-1.5', pointerStyle === 'finger' ? 'text-vcr-gold' : 'text-vcr-chrome/55')}
                      >
                        Finger
                      </button>
                    </span>
                  )}
                </span>
              )}
              <button
                type="button"
                onClick={() => setBookmarksOpen((v) => !v)}
                aria-pressed={bookmarksOpen}
                title="Bookmarks"
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-full border px-2',
                  bookmarksOpen ? 'border-vcr-gold/60 bg-vcr-gold/15 text-vcr-gold' : 'border-vcr-chrome/20 hover:text-vcr-chrome',
                )}
              >
                <Bookmark className="h-3.5 w-3.5" /> {bookmarks.length || ''}
              </button>
              {canSubmitToAssignment && (
                <button
                  type="button"
                  onClick={() => setSubmitOpen(true)}
                  title="Hand this work in — your own copy stays private"
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-vcr-gold/50 bg-vcr-gold/15 px-2 text-vcr-gold"
                >
                  <ClipboardList className="h-3.5 w-3.5" /> Submit
                </button>
              )}
            </span>
          </div>

          {/* Bookmarks — a small panel, only when opened */}
          {bookmarksOpen && (
            <div className="mb-2">
              <VcrBookmarkBar
                bookmarks={bookmarks}
                currentUnit={currentPage}
                unitNoun={adapter.unitNoun}
                canAdd={!isFollower}
                onAdd={(u) => void addBookmark(u)}
                onOpen={(u) => { setJumpRequest({ unit: u, nonce: Date.now() }); setBookmarksOpen(false); }}
                onRemove={(id) => void removeBookmark(id)}
              />
            </div>
          )}

          {/* Personal working copy — one slim line, marks autosave */}
          {resource && (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-vcr-chrome/60">
              <span className="truncate text-vcr-chrome/80">{resource.title}</span>
              <span className="text-vcr-chrome/40">
                {resource.kind === 'copy' ? 'My copy' : 'Linked to Library'}
                {resource.current_version > 0 ? ` · v${resource.current_version}` : ''}
              </span>
              {canMarkResource ? (
                <>
                  <button
                    type="button"
                    disabled={savingMarks}
                    onClick={() => void saveMarks(false)}
                    className="rounded-full border border-vcr-chrome/20 px-2 py-0.5 hover:text-vcr-chrome disabled:opacity-60"
                  >
                    Save marks
                  </button>
                  <button
                    type="button"
                    disabled={savingMarks}
                    onClick={() => void saveMarks(true)}
                    className="rounded-full border border-vcr-gold/50 px-2 py-0.5 text-vcr-gold disabled:opacity-60"
                  >
                    Save as new version
                  </button>
                </>
              ) : (
                <span className="text-vcr-chrome/45">Shared with you · read-only</span>
              )}
            </div>
          )}

          {/* Assignment-linked synced submission — teacher marking strip */}
          {submission && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-vcr-gold/25 bg-vcr-gold/5 px-2.5 py-1.5 text-[11px] text-vcr-chrome/75">
              <span className="font-medium text-vcr-chrome">Assignment</span>
              <span className="text-vcr-chrome/55">{SUBMISSION_STATUS_LABEL[submission.status] ?? submission.status}</span>
              {canControl && canMarkResource && (
                <>
                  <input
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Comment for the student (optional)"
                    className="h-7 min-w-[10rem] flex-1 rounded-full border border-vcr-chrome/20 bg-black/30 px-2.5 text-[11px] text-vcr-chrome placeholder:text-vcr-chrome/40"
                  />
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void saveReview(false)}
                    className="rounded-full border border-vcr-chrome/20 px-2 py-0.5 disabled:opacity-60"
                  >
                    Save review
                  </button>
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void saveReview(true)}
                    className="rounded-full border border-vcr-gold/50 px-2 py-0.5 text-vcr-gold disabled:opacity-60"
                  >
                    Save &amp; return
                  </button>
                </>
              )}
            </div>
          )}

          <div ref={pageAreaRef} className="relative">
          {embed ? (
            <VcrEmbedViewer
              title={embed.title}
              src={embed.url}
              synced={!!embed.synced}
              onClose={() => setEmbed(null)}
            />
          ) : (
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
          )}

          {/* Live teaching pointer — a temporary dot only, nothing is saved */}
          <VcrPointerLayer
            targetRef={pageAreaRef}
            active={canControl && pointerOn}
            style={pointerStyle}
            onMove={canControl ? sendPointer : undefined}
            remote={canControl ? null : remotePointer}
          />
          </div>
          </div>

          {/* Shared whiteboard layer — teacher draws, student mirrors live */}
          {whiteboardVisible && (activeTab === 'lesson' || activeTab === 'whiteboard') && (
            <VcrWhiteboard
              strokes={activeStrokes}
              mode={whiteboardMode}
              layer={annotationLayer}
              canDraw={canMarkLesson}
              onStroke={pushStroke}
              onUndo={() => undoStroke(annotationLayer)}
              onClear={() => clearBoard(annotationLayer)}
              onClose={() => { if (whiteboardMode === 'board') closeTab('whiteboard'); else setWhiteboardOn(false); }}
            />
          )}

          {/* Marks already made on this page stay visible after the drawing
              tools are closed — they belong to the page, for this session. */}
          {!whiteboardVisible && activeTab === 'lesson' && pageStrokes.length > 0 && (
            <VcrWhiteboard strokes={pageStrokes} mode="annotate" layer={pageLayer} canDraw={false} />
          )}

          {/* Native app tabs — Syllabus (class material), Library, My Drive */}
          {tabs
            .filter((t) => t.kind === 'syllabus' || t.kind === 'library' || t.kind === 'myspace')
            .map((t) => (
              <div
                key={t.id}
                className={cn(
                  'max-h-[78vh] overflow-y-auto rounded-2xl border border-slate-900/10 bg-white p-3 text-slate-900 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)] sm:p-4',
                  activeTab !== t.id && 'hidden',
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{t.title}</span>
                  <button
                    type="button"
                    onClick={() => closeTab(t.id)}
                    className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
                  >
                    Back to lesson
                  </button>
                </div>
                {t.kind === 'syllabus' ? (
                  <VcrAppPanel
                    app="syllabus"
                    docs={docs as any}
                    docsLoading={loading}
                    docsError={null}
                    userId={user?.id ?? null}
                    onOpenPrivate={(target) => { openTarget(target, false); setActiveTab('lesson'); }}
                    onOpenSynced={(target) => { openTarget(target, true); setActiveTab('lesson'); }}
                    onUpload={canControl ? () => setUploadOpen(true) : undefined}
                  />
                ) : (
                  <React.Suspense
                    fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}
                  >
                    {t.kind === 'library' ? <LibraryPage /> : <MyResourcesPage />}
                  </React.Suspense>
                )}
              </div>
            ))}


          {/* Class recordings — inside the classroom, as its own tab */}
          {studentId && tabs.some((t) => t.kind === 'recordings') && (
            <div
              className={cn(
                'max-h-[78vh] overflow-y-auto rounded-2xl border border-slate-900/10 bg-white/95 p-3 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.45)]',
                activeTab !== 'recordings' && 'hidden',
              )}
            >
              <VcrRecordingsPanel
                roomId={studentId}
                canDownload={canControl}
                onClose={() => closeTab('recordings')}
              />
            </div>
          )}



        </main>
          {/* Lesson tools — a contextual drawer, not a permanent column */}
          {canControl && toolsOpen && (
            <aside className="fixed inset-y-0 end-0 z-50 w-full max-w-sm space-y-3 overflow-y-auto border-s border-vcr-chrome/15 bg-[#0C1B1E]/95 p-4 shadow-2xl backdrop-blur lg:static lg:z-auto lg:w-[22rem] lg:shrink-0 lg:self-start lg:max-h-[80vh] lg:rounded-2xl lg:border lg:shadow-xl">
              <div className="flex items-center gap-2">
                <span className="font-display text-base text-vcr-chrome">Lesson tools</span>
                <button
                  type="button"
                  onClick={() => setToolsOpen(false)}
                  aria-label="Close lesson tools"
                  className="ms-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-vcr-chrome/50 hover:bg-white/5 hover:text-vcr-chrome"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <textarea
                value={notes}
                onChange={(e) => onNotes(e.target.value)}
                rows={6}
                placeholder="Private notes — what to practise before the next class…"
                className="w-full resize-y rounded-xl border border-vcr-chrome/15 bg-[#0A1618] p-3 text-sm text-vcr-chrome placeholder:text-vcr-chrome/35 focus:border-vcr-gold/60 focus:outline-none"
              />
              <p className="font-mono text-[11px] text-vcr-chrome/40">
                {notesSaved ? 'Saved · never shown to the student or parent' : 'Saving…'}
              </p>

              <p className="flex items-center gap-2 text-xs text-vcr-chrome/60">
                <ListOrdered className="h-3.5 w-3.5 text-vcr-gold" />
                Next: {nextItem ? `${nextItem.level} · ${nextItem.title}` : 'End of syllabus'}
              </p>

              <button
                type="button"
                onClick={markComplete}
                disabled={saving}
                className="vcr-btn-gold inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" /> Mark page/lesson complete
              </button>
              <button
                type="button"
                onClick={() => setAttendanceOpen(true)}
                className="vcr-btn inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm"
              >
                <ClipboardList className="h-4 w-4" /> Mark attendance from this page
              </button>
              {isLessonContent && (
                <button
                  type="button"
                  disabled={savingMarks}
                  onClick={() => void saveLessonMarks()}
                  className="vcr-btn inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> Save markings now
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate(`/syllabus/${studentId}`)}
                className="vcr-btn inline-flex h-10 w-full items-center justify-center rounded-xl text-sm"
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
