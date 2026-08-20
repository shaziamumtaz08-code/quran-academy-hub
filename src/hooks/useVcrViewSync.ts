import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Real-time view sync for the Virtual Class Room.
 *
 * Uses its own Realtime topic (`vcr-call:${roomId}`), separate from the audio
 * call topic (`vcr-audio:${roomId}`) — two channels sharing one topic on the
 * same socket do not both subscribe. Completely independent of whether the
 * audio call connected — a teacher on the Zoom audio fallback still drives the
 * student's screen.
 */

export interface VcrViewState {
  page: number;
  fontScale: number;
  highlight: { lineId?: string | null; wordId?: string | null } | null;
  /** Which reader the teacher is on, so students mirror Mushaf vs Qaida. */
  content?: 'mushaf' | 'qaida';
}

const DEFAULT_STATE: VcrViewState = { page: 1, fontScale: 1, highlight: null, content: 'mushaf' };

interface Options {
  roomId: string;
  /** Teacher drives the view; student follows it. */
  isPresenter: boolean;
  enabled?: boolean;
}

export function useVcrViewSync({ roomId, isPresenter, enabled = true }: Options) {
  const [remoteState, setRemoteState] = useState<VcrViewState | null>(null);
  const [presenterOnline, setPresenterOnline] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef<string>('');

  useEffect(() => {
    if (!roomId || !enabled) return;

    const channel = supabase.channel(`vcr-call:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'view-state' }, ({ payload }) => {
        if (isPresenter) return;
        setPresenterOnline(true);
        setRemoteState({ ...DEFAULT_STATE, ...(payload as VcrViewState) });
      })
      .on('broadcast', { event: 'view-presenter-left' }, () => {
        if (!isPresenter) setPresenterOnline(false);
      })
      .on('broadcast', { event: 'view-request' }, () => {
        // A student joined — re-announce current state.
        if (isPresenter && lastSent.current) {
          channel.send({ type: 'broadcast', event: 'view-state', payload: JSON.parse(lastSent.current) });
        }
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        if (!isPresenter) {
          channel.send({ type: 'broadcast', event: 'view-request', payload: {} });
        }
      });

    channelRef.current = channel;

    return () => {
      if (isPresenter) {
        channel.send({ type: 'broadcast', event: 'view-presenter-left', payload: {} });
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
      lastSent.current = '';
    };
  }, [roomId, isPresenter, enabled]);

  /** Presenter-side: broadcast the current view position. */
  const publish = useCallback((state: VcrViewState) => {
    if (!isPresenter) return;
    const serialised = JSON.stringify(state);
    if (serialised === lastSent.current) return;
    lastSent.current = serialised;
    channelRef.current?.send({ type: 'broadcast', event: 'view-state', payload: state });
  }, [isPresenter]);

  return { remoteState, presenterOnline, publish };
}

export default useVcrViewSync;
