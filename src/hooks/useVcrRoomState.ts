import { useCallback, useEffect, useState } from 'react';
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
}

const TABLE = 'vcr_room_state' as any;

export function useVcrRoomState(studentId: string | null, selfId: string | null) {
  const [state, setState] = useState<VcrRoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [studentId]);

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

  return { state, loading, error, patch, reload: load };
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
