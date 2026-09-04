import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playPingChime } from '@/lib/pingChime';

/**
 * Lightweight "a call is happening" presence signal for the Virtual Class Room.
 *
 * Kept deliberately separate from the media signalling channel (`vcr-audio:*`)
 * so a student can be told about a live call from anywhere in the app without
 * opening a peer connection.
 */
const topic = (roomId: string) => `vcr-ring:${roomId}`;

/** Teacher side: announce that a call is live while `active` is true. */
export function useVcrRingHost(roomId: string, active: boolean, callerName?: string) {
  useEffect(() => {
    if (!roomId || !active) return;
    const channel = supabase.channel(topic(roomId), { config: { broadcast: { self: false } } });
    const announce = () =>
      channel.send({ type: 'broadcast', event: 'ring', payload: { callerName: callerName ?? 'Your teacher' } });

    channel
      .on('broadcast', { event: 'ping' }, () => void announce())
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') void announce();
      });

    // Re-announce periodically so a student opening the app late still sees it.
    const beat = window.setInterval(() => void announce(), 8000);

    return () => {
      window.clearInterval(beat);
      void channel.send({ type: 'broadcast', event: 'ring-end', payload: {} });
      supabase.removeChannel(channel);
    };
  }, [roomId, active, callerName]);
}

/** Student side: listen for a live call in their own room. */
export function useVcrRingListener(roomId: string | null | undefined, enabled = true) {
  const [ringing, setRinging] = useState(false);
  const [callerName, setCallerName] = useState<string>('Your teacher');
  const expiry = useRef<number | null>(null);

  useEffect(() => {
    if (!roomId || !enabled) return;
    const channel = supabase.channel(topic(roomId), { config: { broadcast: { self: false } } });

    const bump = (name?: string) => {
      if (name) setCallerName(name);
      playPingChime();
      setRinging(true);
      if (expiry.current) window.clearTimeout(expiry.current);
      // Auto-clear if the heartbeat stops (teacher closed the tab).
      expiry.current = window.setTimeout(() => setRinging(false), 20000);
    };

    channel
      .on('broadcast', { event: 'ring' }, ({ payload }) => bump(payload?.callerName))
      .on('broadcast', { event: 'ring-end' }, () => {
        if (expiry.current) window.clearTimeout(expiry.current);
        setRinging(false);
      })
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') void channel.send({ type: 'broadcast', event: 'ping', payload: {} });
      });

    return () => {
      if (expiry.current) window.clearTimeout(expiry.current);
      supabase.removeChannel(channel);
    };
  }, [roomId, enabled]);

  return { ringing, callerName };
}
