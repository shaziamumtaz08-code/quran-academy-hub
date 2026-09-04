import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CallStatus } from '@/hooks/useVcrCall';

interface Options {
  roomId: string;
  studentId: string | null;
  selfId: string;
  role: string;
  status: CallStatus;
  /** True when the other side is present — used to decide who owns the log row. */
  remoteJoined: boolean;
  remotePeerId?: string | null;
  recorded?: boolean;
  /** Observers never own the log row — they stamp the open one instead. */
  observer?: boolean;
}

/**
 * Writes a row for EVERY in-app call, recorded or not.
 *
 * Ownership rule: the participant who was alone in the room when the call
 * started owns the log row (they are the initiator). The joiner writes nothing,
 * so a 1:1 call produces exactly one row.
 */
export function useVcrCallLog({
  roomId, studentId, selfId, role, status, remoteJoined, remotePeerId, recorded, observer = false,
}: Options) {
  const idRef = useRef<string | null>(null);
  const startedRef = useRef<number>(0);
  const connectedRef = useRef(false);
  const initiatorRef = useRef(false);
  const prevStatus = useRef<CallStatus>('idle');

  useEffect(() => {
    const live = status === 'connecting' || status === 'connected' || status === 'reconnecting';
    const wasLive = prevStatus.current === 'connecting' || prevStatus.current === 'connected' || prevStatus.current === 'reconnecting';

    // Call is starting: only the side that was alone opens the log.
    if (live && !wasLive && roomId && selfId && observer) {
      // Observer: stamp the call that is already running.
      // Observers have no direct UPDATE rights on call logs; a security-definer
      // RPC stamps only observer_id / observer_joined after checking their scope.
      void supabase.rpc('vcr_stamp_observer_joined' as any, { _room_id: roomId });
    }

    if (live && !wasLive && roomId && selfId && !observer) {
      initiatorRef.current = !remoteJoined;
      startedRef.current = Date.now();
      connectedRef.current = false;
      if (initiatorRef.current) {
        void (async () => {
          const { data } = await supabase
            .from('vcr_call_logs' as any)
            .insert({
              room_id: roomId,
              student_id: studentId,
              initiator_id: selfId,
              initiator_role: role,
              status: 'ringing',
            })
            .select('id')
            .maybeSingle();
          idRef.current = (data as any)?.id ?? null;
        })();
      }
    }

    // Connected for the first time.
    if (status === 'connected' && !connectedRef.current && idRef.current) {
      connectedRef.current = true;
      void supabase.from('vcr_call_logs' as any).update({
        status: 'connected',
        connected_at: new Date().toISOString(),
        peer_id: remotePeerId ?? null,
        updated_at: new Date().toISOString(),
      }).eq('id', idRef.current);
    }

    // Call finished (or failed): close the row out.
    if (!live && wasLive && idRef.current) {
      const id = idRef.current;
      idRef.current = null;
      const seconds = Math.max(0, Math.round((Date.now() - startedRef.current) / 1000));
      void supabase.from('vcr_call_logs' as any).update({
        status: status === 'failed' ? (connectedRef.current ? 'ended' : 'failed') : 'ended',
        ended_at: new Date().toISOString(),
        duration_seconds: seconds,
        recorded: !!recorded,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    }

    prevStatus.current = status;
  }, [status, roomId, selfId, studentId, role, remoteJoined, remotePeerId, recorded, observer]);

  /** Lets the recorder stamp the call log once a recording actually happens. */
  const markRecorded = (recordingId?: string | null) => {
    if (!idRef.current) return;
    void supabase.from('vcr_call_logs' as any).update({
      recorded: true,
      recording_id: recordingId ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', idRef.current);
  };

  return { markRecorded };
}
