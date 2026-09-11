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
  /** Which reader the teacher is on, so students mirror Mushaf vs Qaida vs a file. */
  content?: 'mushaf' | 'qaida' | 'doc';
  /** Library item open in the file reader, so students see the same document. */
  libraryItemId?: string | null;

  /** Whiteboard overlay visible on the presenter's screen. */
  whiteboard?: boolean;
  /** 'annotate' draws over the page; 'board' is a separate blank board. */
  whiteboardMode?: 'annotate' | 'board';
}

/**
 * One mark in normalised (0..1) coordinates so it maps to any screen size.
 *
 * `layer` keeps each working area separate: the whiteboard is its own canvas,
 * and every Mushaf / Qaida / document page keeps its own marks, so nothing
 * drawn on a page ever leaks onto the whiteboard or onto another page.
 */
export interface VcrStroke {
  id: string;
  layer?: string;
  color: string;
  width: number;
  /** Freehand line (default), or a rectangle / oval drawn corner to corner. */
  shape?: 'free' | 'box' | 'circle';
  points: Array<{ x: number; y: number }>;
}


/**
 * Live teaching pointer position, in normalised (0..1) page coordinates.
 * Ephemeral only — never saved and never part of the page's marks.
 */
export interface VcrPointer {
  x: number;
  y: number;
  style: 'laser' | 'finger';
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
  const [remotePointer, setRemotePointer] = useState<VcrPointer | null>(null);
  const pointerTimer = useRef<number | null>(null);

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
        const incoming = ((payload as any)?.strokes ?? []) as VcrStroke[];
        const layer = (payload as any)?.layer as string | undefined;
        setStrokes((prev) => (layer
          ? [...prev.filter((s) => (s.layer ?? 'whiteboard') !== layer), ...incoming]
          : incoming));
      })
      .on('broadcast', { event: 'wb-clear' }, ({ payload }) => {
        if (isPresenter) return;
        const layer = (payload as any)?.layer as string | undefined;
        setStrokes((prev) => (layer ? prev.filter((s) => (s.layer ?? 'whiteboard') !== layer) : []));
      })

      .on('broadcast', { event: 'pointer' }, ({ payload }) => {
        if (isPresenter) return;
        const p = payload as (VcrPointer & { off?: boolean }) | null;
        if (pointerTimer.current) window.clearTimeout(pointerTimer.current);
        if (!p || p.off) { setRemotePointer(null); return; }
        setRemotePointer({ x: p.x, y: p.y, style: p.style ?? 'laser' });
        /* Safety net: if the teacher's screen goes quiet, the dot fades away. */
        pointerTimer.current = window.setTimeout(() => setRemotePointer(null), 4000);
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

  const layerOf = (s: VcrStroke) => s.layer ?? 'whiteboard';

  /**
   * Add or update a mark. Everyone may mark their own screen (a student can
   * work on her page before the teacher joins); only the presenter's marks are
   * mirrored to the other side.
   */
  const pushStroke = useCallback((stroke: VcrStroke) => {
    setStrokes((prev) => {
      const next = prev.some((s) => s.id === stroke.id)
        ? prev.map((s) => (s.id === stroke.id ? stroke : s))
        : [...prev, stroke];
      strokesRef.current = next;
      return next;
    });
    if (isPresenter) channelRef.current?.send({ type: 'broadcast', event: 'wb-stroke', payload: stroke });
  }, [isPresenter]);

  /** Undo the last mark on one working area only. */
  const undoStroke = useCallback((layer?: string) => {
    setStrokes((prev) => {
      const key = layer ?? 'whiteboard';
      const idx = [...prev].reverse().findIndex((s) => layerOf(s) === key);
      const next = idx === -1 ? prev : prev.filter((_, i) => i !== prev.length - 1 - idx);
      strokesRef.current = next;
      if (isPresenter) {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'wb-sync',
          payload: { layer: key, strokes: next.filter((s) => layerOf(s) === key) },
        });
      }
      return next;
    });
  }, [isPresenter]);

  /** Clear one working area — never the others. */
  const clearBoard = useCallback((layer?: string) => {
    const key = layer ?? 'whiteboard';
    setStrokes((prev) => {
      const next = prev.filter((s) => layerOf(s) !== key);
      strokesRef.current = next;
      return next;
    });
    if (isPresenter) channelRef.current?.send({ type: 'broadcast', event: 'wb-clear', payload: { layer: key } });
  }, [isPresenter]);

  /** Replace the saved marks of one working area (reopening a page). */
  const loadStrokes = useCallback((layer: string, incoming: VcrStroke[]) => {
    const stamped = incoming.map((s) => ({ ...s, layer }));
    setStrokes((prev) => {
      const next = [...prev.filter((s) => layerOf(s) !== layer), ...stamped];
      strokesRef.current = next;
      return next;
    });
    if (isPresenter) {
      channelRef.current?.send({ type: 'broadcast', event: 'wb-sync', payload: { layer, strokes: stamped } });
    }
  }, [isPresenter]);


  /**
   * Live teaching pointer — purely ephemeral. Never stored, never mixed with
   * marks: it is only a position broadcast that fades away on its own.
   */
  const sendPointer = useCallback((pointer: VcrPointer | null) => {
    if (!isPresenter) return;
    channelRef.current?.send({ type: 'broadcast', event: 'pointer', payload: pointer ?? { off: true } });
  }, [isPresenter]);

  return { remoteState, presenterOnline, publish, strokes, pushStroke, undoStroke, clearBoard, loadStrokes, remotePointer, sendPointer };
}

export default useVcrViewSync;
