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
  /** Whiteboard overlay visible on the presenter's screen. */
  whiteboard?: boolean;
}

/** A freehand stroke in normalised (0..1) coordinates so it maps to any screen size. */
export interface VcrStroke {
  id: string;
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

const DEFAULT_STATE: VcrViewState = {
  page: 1,
  fontScale: 1,
  highlight: null,
  content: 'mushaf',
  whiteboard: false,
};

interface Options {
  roomId: string;
  /** Teacher drives the view; student follows it. */
  isPresenter: boolean;
  enabled?: boolean;
}

export function useVcrViewSync({ roomId, isPresenter, enabled = true }: Options) {
  const [remoteState, setRemoteState] = useState<VcrViewState | null>(null);
  const [presenterOnline, setPresenterOnline] = useState(false);
  const [strokes, setStrokes] = useState<VcrStroke[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef<string>('');
  const strokesRef = useRef<VcrStroke[]>([]);

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
      .on('broadcast', { event: 'wb-stroke' }, ({ payload }) => {
        if (isPresenter) return;
        const stroke = payload as VcrStroke;
        setStrokes((prev) => (prev.some((s) => s.id === stroke.id)
          ? prev.map((s) => (s.id === stroke.id ? stroke : s))
          : [...prev, stroke]));
      })
      .on('broadcast', { event: 'wb-sync' }, ({ payload }) => {
        if (isPresenter) return;
        setStrokes(((payload as any)?.strokes ?? []) as VcrStroke[]);
      })
      .on('broadcast', { event: 'wb-clear' }, () => {
        if (!isPresenter) setStrokes([]);
      })
      .on('broadcast', { event: 'view-request' }, () => {
        // A student joined — re-announce current state.
        if (!isPresenter) return;
        if (lastSent.current) {
          channel.send({ type: 'broadcast', event: 'view-state', payload: JSON.parse(lastSent.current) });
        }
        channel.send({ type: 'broadcast', event: 'wb-sync', payload: { strokes: strokesRef.current } });
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

  /** Presenter-side: add or update a stroke and mirror it to the student. */
  const pushStroke = useCallback((stroke: VcrStroke) => {
    if (!isPresenter) return;
    setStrokes((prev) => {
      const next = prev.some((s) => s.id === stroke.id)
        ? prev.map((s) => (s.id === stroke.id ? stroke : s))
        : [...prev, stroke];
      strokesRef.current = next;
      return next;
    });
    channelRef.current?.send({ type: 'broadcast', event: 'wb-stroke', payload: stroke });
  }, [isPresenter]);

  const undoStroke = useCallback(() => {
    if (!isPresenter) return;
    setStrokes((prev) => {
      const next = prev.slice(0, -1);
      strokesRef.current = next;
      channelRef.current?.send({ type: 'broadcast', event: 'wb-sync', payload: { strokes: next } });
      return next;
    });
  }, [isPresenter]);

  const clearBoard = useCallback(() => {
    if (!isPresenter) return;
    strokesRef.current = [];
    setStrokes([]);
    channelRef.current?.send({ type: 'broadcast', event: 'wb-clear', payload: {} });
  }, [isPresenter]);

  return { remoteState, presenterOnline, publish, strokes, pushStroke, undoStroke, clearBoard };
}

export default useVcrViewSync;
