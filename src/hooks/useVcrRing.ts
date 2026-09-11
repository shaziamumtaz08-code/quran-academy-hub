import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playPingChime } from '@/lib/pingChime';
import { ensureRealtimeSession } from '@/lib/ensureSession';

/**
 * Lightweight "a call is happening" presence signal for the Virtual Class Room.
 *
 * Kept deliberately separate from the media signalling channel (`vcr-audio:*`)
 * so a student can be told about a live call from anywhere in the app without
 * opening a peer connection.
 */
const topic = (roomId: string) => `vcr-ring:${roomId}`;
/* Knocking must use its own topic — two channels on the same topic over one
 * socket can both fail to reach SUBSCRIBED (same failure mode as vcr-audio vs
 * vcr-view-sync), which would silently kill either the ring or the knock. */
const knockTopic = (roomId: string) => `vcr-knock:${roomId}`;

/**
 * Teacher / student side: announce that a call is live while `active` is true.
 * `extraRooms` lets the announcement also reach the other person's personal
 * room (their user id), so they are alerted anywhere in the app.
 */
export function useVcrRingHost(roomId: string, active: boolean, callerName?: string, extraRooms: string[] = []) {
  const extraKey = extraRooms.filter(Boolean).sort().join(',');

  useEffect(() => {
    if (!roomId || !active) return;
    let cancelled = false;
    const rooms = Array.from(new Set([roomId, ...extraKey.split(',').filter(Boolean)]));
    const channels: Array<{ room: string; channel: ReturnType<typeof supabase.channel> }> = [];

    const announce = () =>
      channels.forEach(({ channel }) =>
        void channel.send({
          type: 'broadcast',
          event: 'ring',
          payload: { callerName: callerName ?? 'Your teacher', room: roomId },
        })
      );

    void ensureRealtimeSession().then(() => {
      if (cancelled) return;
      rooms.forEach((r) => {
        const channel = supabase.channel(topic(r), { config: { broadcast: { self: false } } });
        channels.push({ room: r, channel });
        channel
          .on('broadcast', { event: 'ping' }, () => void announce())
          .subscribe((state) => {
            if (state === 'SUBSCRIBED') void announce();
          });
      });
    }).catch(() => {});

    // Re-announce periodically so a student opening the app late still sees it.
    const beat = window.setInterval(() => void announce(), 8000);

    return () => {
      cancelled = true;
      window.clearInterval(beat);
      channels.forEach(({ channel }) => {
        void channel.send({ type: 'broadcast', event: 'ring-end', payload: { room: roomId } });
        supabase.removeChannel(channel);
      });
    };
  }, [roomId, active, callerName, extraKey]);
}

/** Listen for a live call in a room (own personal room, or a class room). */
export function useVcrRingListener(roomId: string | null | undefined, enabled = true) {
  const [ringing, setRinging] = useState(false);
  const [callerName, setCallerName] = useState<string>('Your teacher');
  const [sourceRoom, setSourceRoom] = useState<string | null>(null);
  const expiry = useRef<number | null>(null);
  const ringingRef = useRef(false);

  useEffect(() => {
    if (!roomId || !enabled) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const bump = (name?: string, room?: string) => {
      if (name) setCallerName(name);
      if (room) setSourceRoom(room);
      // Chime only on the transition into ringing — the host re-announces
      // every 8s, and chiming on each heartbeat would beep nonstop.
      if (!ringingRef.current) playPingChime();
      ringingRef.current = true;
      setRinging(true);
      if (expiry.current) window.clearTimeout(expiry.current);
      // Auto-clear if the heartbeat stops (teacher closed the tab).
      expiry.current = window.setTimeout(() => {
        ringingRef.current = false;
        setRinging(false);
      }, 20000);
    };

    void ensureRealtimeSession().then(() => {
      if (cancelled) return;
      channel = supabase.channel(topic(roomId), { config: { broadcast: { self: false } } });
      channel
        .on('broadcast', { event: 'ring' }, ({ payload }) => bump(payload?.callerName, payload?.room))
        .on('broadcast', { event: 'ring-end' }, () => {
          if (expiry.current) window.clearTimeout(expiry.current);
          ringingRef.current = false;
          setRinging(false);
        })
        .subscribe((state) => {
          if (state === 'SUBSCRIBED') void channel?.send({ type: 'broadcast', event: 'ping', payload: {} });
        });
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (expiry.current) window.clearTimeout(expiry.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, enabled]);

  return { ringing, callerName, sourceRoom: sourceRoom ?? roomId ?? null };
}

/** Tap "Ring teacher"/"Ring student" — a one-off knock with a bell on the other screen. */
export function useVcrKnockSender(roomId: string | null | undefined) {
  const [sentAt, setSentAt] = useState<number | null>(null);

  const knock = async (fromName?: string, extraRooms: string[] = []) => {
    if (!roomId) return;
    const rooms = Array.from(new Set([roomId, ...extraRooms.filter(Boolean)]));
    await Promise.all(
      rooms.map(
        (r) =>
          new Promise<void>((resolve) => {
            const channel = supabase.channel(knockTopic(r), { config: { broadcast: { self: false } } });
            channel.subscribe((state) => {
              if (state !== 'SUBSCRIBED') return;
              void channel
                .send({
                  type: 'broadcast',
                  event: 'knock',
                  payload: { fromName: fromName ?? 'Your student', room: roomId },
                })
                .then(() => resolve());
            });
            // Keep the channel briefly so the broadcast flush completes, then drop it.
            window.setTimeout(() => supabase.removeChannel(channel), 1500);
          })
      )
    );
    setSentAt(Date.now());
  };

  return { knock, sentAt };
}

/** Hear someone knocking on a room (a class room, or your own personal room). */
export function useVcrKnockListener(roomId: string | null | undefined, enabled = true) {
  const [knockerName, setKnockerName] = useState<string | null>(null);
  const [sourceRoom, setSourceRoom] = useState<string | null>(null);
  const expiry = useRef<number | null>(null);

  useEffect(() => {
    if (!roomId || !enabled) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void ensureRealtimeSession().then(() => {
      if (cancelled) return;
      channel = supabase.channel(knockTopic(roomId), { config: { broadcast: { self: false } } });
      channel
        .on('broadcast', { event: 'knock' }, ({ payload }) => {
          setKnockerName(payload?.fromName ?? 'Your student');
          setSourceRoom(payload?.room ?? roomId);
          playPingChime();
          if (expiry.current) window.clearTimeout(expiry.current);
          expiry.current = window.setTimeout(() => setKnockerName(null), 30000);
        })
        .subscribe();
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (expiry.current) window.clearTimeout(expiry.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, enabled]);

  const dismiss = () => {
    if (expiry.current) window.clearTimeout(expiry.current);
    setKnockerName(null);
  };

  return { knockerName, dismiss, sourceRoom: sourceRoom ?? roomId ?? null };
}
