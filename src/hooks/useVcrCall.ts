import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getIceServers, hasTurnConfigured } from '@/lib/call/iceConfig';

/**
 * Audio-only peer-to-peer call for the Virtual Class Room.
 *
 * Completely independent of the Zoom integration: signalling rides on a
 * Supabase Realtime broadcast channel scoped to the student/session, media is
 * a plain RTCPeerConnection with a single audio track.
 *
 * The staff side is the caller (creates the offer); the student side answers.
 */

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'ended';

const CONNECT_TIMEOUT_MS = 25_000;

interface Options {
  /** Scopes the signalling channel — the VCR session id, falling back to the student id. */
  roomId: string;
  /** Unique id for this participant (auth user id). */
  peerId: string;
  /** Staff create the offer, students answer. */
  isCaller: boolean;
}

export function useVcrCall({ roomId, peerId, isCaller }: Options) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteJoined, setRemoteJoined] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const activeRef = useRef(false);
  const remoteJoinedRef = useRef(false);
  const offeringRef = useRef(false);


  const clearTimer = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const teardown = useCallback((next: CallStatus) => {
    activeRef.current = false;
    offeringRef.current = false;
    remoteJoinedRef.current = false;
    clearTimer();
    pendingIce.current = [];


    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setRemoteJoined(false);
    setMuted(false);
    setStatus(next);
  }, []);

  const send = (event: string, payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: 'broadcast', event, payload: { ...payload, from: peerId } });
  };

  const buildPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    pc.onicecandidate = (e) => {
      if (e.candidate) send('ice', { candidate: e.candidate.toJSON() });
    };

    pc.ontrack = (e) => {
      if (!audioRef.current) {
        const el = document.createElement('audio');
        el.autoplay = true;
        el.setAttribute('playsinline', 'true');
        document.body.appendChild(el);
        audioRef.current = el;
      }
      audioRef.current.srcObject = e.streams[0];
      audioRef.current.play().catch(() => {
        setError('Tap anywhere on the page to allow audio playback.');
      });
    };

    pc.onconnectionstatechange = () => {
      if (!activeRef.current) return;
      const state = pc.connectionState;
      if (state === 'connected') {
        clearTimer();
        setError(null);
        setStatus('connected');
      } else if (state === 'disconnected') {
        setStatus('reconnecting');
      } else if (state === 'failed') {
        setStatus('failed');
        setError(
          hasTurnConfigured()
            ? 'The call could not connect. Please use the Zoom link instead.'
            : 'The call could not connect through the network (no relay server configured). Please use the Zoom link instead.'
        );
      }
    };

    pcRef.current = pc;
    return pc;
  }, [peerId]);

  const drainIce = async (pc: RTCPeerConnection) => {
    for (const c of pendingIce.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }
    pendingIce.current = [];
  };

  const start = useCallback(async () => {
    if (!roomId || !peerId || activeRef.current) return;
    setError(null);
    setStatus('connecting');
    activeRef.current = true;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      activeRef.current = false;
      setStatus('failed');
      setError('Microphone access was blocked. Allow the microphone, or use the Zoom link instead.');
      return;
    }
    localStreamRef.current = stream;

    const pc = buildPeerConnection();
    stream.getAudioTracks().forEach((t) => pc.addTrack(t, stream));

    const channel = supabase.channel(`vcr-call:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'join' }, async ({ payload }) => {
        if (payload?.from === peerId) return;
        setRemoteJoined(true);
        if (!isCaller || !pcRef.current) return;
        const offer = await pcRef.current.createOffer({ offerToReceiveAudio: true });
        await pcRef.current.setLocalDescription(offer);
        send('offer', { sdp: offer });
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload?.from === peerId || isCaller || !pcRef.current) return;
        setRemoteJoined(true);
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await drainIce(pcRef.current);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        send('answer', { sdp: answer });
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload?.from === peerId || !isCaller || !pcRef.current) return;
        if (pcRef.current.currentRemoteDescription) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await drainIce(pcRef.current);
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (payload?.from === peerId || !pcRef.current) return;
        if (!pcRef.current.remoteDescription) {
          pendingIce.current.push(payload.candidate);
          return;
        }
        await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
      })
      .on('broadcast', { event: 'hangup' }, ({ payload }) => {
        if (payload?.from === peerId) return;
        teardown('ended');
      })
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          send('join', {});
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          setStatus('failed');
          setError('Could not reach the signalling service. Please use the Zoom link instead.');
        }
      });

    clearTimer();
    timeoutRef.current = window.setTimeout(() => {
      if (pcRef.current?.connectionState !== 'connected') {
        setStatus('failed');
        setError(
          remoteJoinedRef.current
            ? 'The call could not connect in time. Please use the Zoom link instead.'
            : 'The other person has not joined the in-app call. Please use the Zoom link instead.'
        );
      }
    }, CONNECT_TIMEOUT_MS);
  }, [roomId, peerId, isCaller, buildPeerConnection, teardown]);

  // Keep a ref copy so the timeout message can read the latest value.
  useEffect(() => { remoteJoinedRef.current = remoteJoined; }, [remoteJoined]);

  const end = useCallback(() => {
    send('hangup', {});
    teardown('ended');
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const retry = useCallback(async () => {
    teardown('idle');
    // Let teardown flush before re-establishing.
    window.setTimeout(() => { void start(); }, 150);
  }, [teardown, start]);

  useEffect(() => () => teardown('idle'), [teardown]);

  return { status, muted, error, remoteJoined, start, end, toggleMute, retry };
}
