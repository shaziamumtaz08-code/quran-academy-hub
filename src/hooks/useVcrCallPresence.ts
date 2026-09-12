import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Who is on the classroom call — one shared record, not a local guess.
 *
 * Every client writes only its own entry in `vcr_room_state.call_participants`
 * (through an atomic database function) and reads everyone's from the same row
 * over Realtime. So a call that ended on one screen cannot keep showing as
 * "on the call" on the other, and a refresh re-reads the truth instead of
 * trusting whatever the tab last remembered.
 */

export interface CallPresenceEntry {
  id: string;
  name: string;
  role: string;
}

/** A heartbeat older than this means the person is gone (tab closed, offline). */
/* Generous, because a backgrounded tab has its timers throttled; hanging up
   clears the entry immediately, so this only covers crashes. */
const TTL_MS = 90_000;
const BEAT_MS = 20_000;

export function useVcrCallPresence(
  studentId: string | null | undefined,
  selfId: string | null | undefined,
  onCall: boolean,
  displayName?: string,
  role?: string,
) {
  const [participants, setParticipants] = useState<Record<string, { name?: string; role?: string; ts?: number }>>({});
  const [, setTick] = useState(0);

  const read = useMemo(
    () => async () => {
      if (!studentId) return;
      const { data } = await supabase
        .from('vcr_room_state' as any)
        .select('call_participants')
        .eq('student_id', studentId)
        .maybeSingle();
      setParticipants(((data as any)?.call_participants ?? {}) as any);
    },
    [studentId],
  );

  /* Read once, then follow the row live. */
  useEffect(() => {
    if (!studentId) return;
    void read();
    const ch = supabase
      .channel(`vcr-presence:${studentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vcr_room_state', filter: `student_id=eq.${studentId}` },
        (payload) => setParticipants((((payload.new as any)?.call_participants) ?? {}) as any),
      )
      .subscribe((status) => { if (status === 'SUBSCRIBED') void read(); });
    return () => { void supabase.removeChannel(ch); };
  }, [studentId, read]);

  /* Re-read when the tab or the network comes back. */
  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') void read(); };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('online', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      window.removeEventListener('online', again);
    };
  }, [read]);

  /* Announce myself while I am on the call, and clear the moment I am not. */
  useEffect(() => {
    if (!studentId || !selfId) return;
    let cancelled = false;
    const write = (active: boolean) =>
      (supabase as any).rpc('vcr_set_call_presence', {
        p_student_id: studentId,
        p_active: active,
        p_name: displayName ?? null,
        p_role: role ?? null,
      });

    if (!onCall) {
      void write(false).then(() => { if (!cancelled) void read(); });
      return () => { cancelled = true; };
    }

    void write(true).then(() => { if (!cancelled) void read(); });
    const beat = window.setInterval(() => void write(true), BEAT_MS);
    const bye = () => { void write(false); };
    window.addEventListener('pagehide', bye);
    return () => {
      cancelled = true;
      window.clearInterval(beat);
      window.removeEventListener('pagehide', bye);
      void write(false);
    };
  }, [studentId, selfId, onCall, displayName, role, read]);

  /* Expire stale heartbeats without needing another write. */
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 5000);
    return () => window.clearInterval(t);
  }, []);

  const others: CallPresenceEntry[] = useMemo(() => {
    const now = Date.now();
    return Object.entries(participants)
      .filter(([id, v]) => id !== selfId && (v?.ts ?? 0) * 1000 > now - TTL_MS)
      .map(([id, v]) => ({ id, name: v?.name ?? 'Participant', role: v?.role ?? 'member' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, selfId, Math.floor(Date.now() / 5000)]);

  /** Write my own entry directly — used when hanging up, so the other side
      never keeps a stale "is on the call" badge waiting for a heartbeat. */
  const setPresence = useMemo(
    () => async (active: boolean) => {
      if (!studentId) return;
      await (supabase as any).rpc('vcr_set_call_presence', {
        p_student_id: studentId,
        p_active: active,
        p_name: displayName ?? null,
        p_role: role ?? null,
      });
      await read();
    },
    [studentId, displayName, role, read],
  );

  return { others, someoneElseOnCall: others.length > 0, refresh: read, setPresence };
}
