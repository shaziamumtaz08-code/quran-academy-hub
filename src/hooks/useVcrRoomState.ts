import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * The shared classroom workspace for one student's VCR.
 *
 * This is deliberately persisted (not just realtime): a student can open the
 * room and put material on the shared workspace *before* the teacher connects,
 * and the teacher sees it as soon as she opens the room.
 *
 * `sync_enabled === false` is the default — opening content is a private view
 * and does not broadcast anything.
 */
export type VcrApp =
  | 'syllabus'
  | 'library'
  | 'myspace'
  | 'drive'
  | 'youtube'
  | 'url'
  | 'whiteboard';

export interface VcrRoomState {
  student_id: string;
  presenter_id: string | null;
  presenter_name: string | null;
  presenter_role: string | null;
  sync_enabled: boolean;
  /** Which classroom app is on the shared workspace. */
  app: VcrApp | 'mushaf' | 'qaida' | 'doc' | null;
  payload: {
    url?: string;
    title?: string;
    docId?: string | null;
    resourceId?: string | null;
    content?: 'mushaf' | 'qaida' | 'doc';
  };
  updated_by: string | null;
  updated_at?: string;

  /* ---- The one shared "what is on screen" record for this room ---------- */
  /** Which reader is open on the shared workspace. */
  view_content?: 'mushaf' | 'qaida' | 'doc' | null;
  /** Library file open in the document reader. */
  view_library_item_id?: string | null;
  /** Page / unit inside that content. */
  view_page?: number | null;
  /** Cover / index page of a book, when one is showing instead of a page. */
  view_front?: number | null;
  view_font_scale?: number | null;
  view_whiteboard?: boolean | null;
  view_whiteboard_mode?: 'annotate' | 'board' | null;
  /** Who is on the call right now, keyed by user id. Written only via RPC. */
  call_participants?: Record<string, { name?: string; role?: string; ts?: number }> | null;
}

const TABLE = 'vcr_room_state' as any;
/** A heartbeat older than this means that person is gone (tab closed, network lost). */
const PRESENCE_TTL_MS = 90_000;

export function useVcrRoomState(studentId: string | null, selfId: string | null) {
  const [state, setState] = useState<VcrRoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Ticks so stale call presence expires without a further database write. */
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!studentId) return;
    const { data, error } = await supabase.from(TABLE).select('*').eq('student_id', studentId).maybeSingle();
    if (error) setError(error.message);
    setState((data as any) ?? null);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  /* Live updates for the other participant. */
  useEffect(() => {
    if (!studentId) return;
    const ch = supabase
      .channel(`vcr-room-state:${studentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vcr_room_state', filter: `student_id=eq.${studentId}` },
        (payload) => setState((payload.new as any) ?? null),
      )
      .subscribe((status) => {
        /* Re-read on (re)connect so a client that was offline never keeps
           showing its own last local view. */
        if (status === 'SUBSCRIBED') void load();
      });
    return () => { void supabase.removeChannel(ch); };
  }, [studentId, load]);

  /* Re-read whenever the tab comes back or the network returns. */
  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('online', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      window.removeEventListener('online', again);
    };
  }, [load]);

  /* Expire stale call presence locally. */
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 5000);
    return () => window.clearInterval(t);
  }, []);

  /** Write part of the shared workspace. Optimistic so the UI feels instant. */
  const patch = useCallback(
    async (next: Partial<Omit<VcrRoomState, 'student_id'>>) => {
      if (!studentId) return;
      setState((prev) => ({
        student_id: studentId,
        presenter_id: null, presenter_name: null, presenter_role: null,
        sync_enabled: false, app: null, payload: {}, updated_by: selfId,
        ...(prev ?? {}),
        ...next,
      } as VcrRoomState));
      const { error } = await supabase
        .from(TABLE)
        .upsert({ student_id: studentId, updated_by: selfId, ...next }, { onConflict: 'student_id' });
      if (error) { setError(error.message); void load(); }
    },
    [studentId, selfId, load],
  );

  /**
   * Page turns come fast; the row is the single source of truth, so writes are
   * coalesced rather than dropped — the last position always lands.
   */
  const pending = useRef<Partial<VcrRoomState> | null>(null);
  const timer = useRef<number | null>(null);
  const patchThrottled = useCallback(
    (next: Partial<Omit<VcrRoomState, 'student_id'>>) => {
      pending.current = { ...(pending.current ?? {}), ...next };
      if (timer.current != null) return;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        const payload = pending.current;
        pending.current = null;
        if (payload) void patch(payload);
      }, 250);
    },
    [patch],
  );
  useEffect(() => () => { if (timer.current != null) window.clearTimeout(timer.current); }, []);

  /** Join / leave the room's call presence. Atomic, per-user, server-side. */
  const setCallPresence = useCallback(
    async (active: boolean, name?: string, role?: string) => {
      if (!studentId) return;
      const { data, error } = await (supabase as any).rpc('vcr_set_call_presence', {
        p_student_id: studentId,
        p_active: active,
        p_name: name ?? null,
        p_role: role ?? null,
      });
      if (error) { setError(error.message); return; }
      setState((prev) => (prev ? { ...prev, call_participants: data ?? {} } : prev));
    },
    [studentId],
  );

  /** Everyone on the call other than me, with stale heartbeats dropped. */
  const othersOnCall = useMemo(() => {
    const now = Date.now();
    return Object.entries(state?.call_participants ?? {})
      .filter(([id, v]) => id !== selfId && (v?.ts ?? 0) * 1000 > now - PRESENCE_TTL_MS)
      .map(([id, v]) => ({ id, name: v?.name ?? 'Participant', role: v?.role ?? 'member' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.call_participants, selfId, Math.floor(Date.now() / 5000)]);

  return { state, loading, error, patch, patchThrottled, setCallPresence, othersOnCall, reload: load };
}


/** Turn a pasted Drive / YouTube / web link into something an iframe can show. */
export function toEmbedUrl(raw: string, kind: 'drive' | 'youtube' | 'url'): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (kind === 'youtube') {
    const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }
  if (kind === 'drive') {
    const m = url.match(/\/d\/([A-Za-z0-9_-]+)/) || url.match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    const folder = url.match(/\/folders\/([A-Za-z0-9_-]+)/);
    if (folder) return `https://drive.google.com/embeddedfolderview?id=${folder[1]}#grid`;
    return null;
  }
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
