import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getIceServers, hasTurnConfigured } from '@/lib/call/iceConfig';

/**
 * Audio-only mesh call for the Virtual Class Room.
 *
 * Completely independent of the Zoom integration: signalling rides on a
 * Supabase Realtime broadcast channel scoped to the student/session, media is
 * a plain RTCPeerConnection per remote peer with a single audio track.
 *
 * Seats: teacher + student + one observer (examiner/admin). The observer joins
 * muted and can unmute to speak. A fourth joiner is politely refused.
 */

export type CallStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'ended';

export interface CallPeer {
  id: string;
  name: string;
  observer: boolean;
}

const CONNECT_TIMEOUT_MS = 25_000;
/** Self + this many others. */
const MAX_OTHERS = 2;

interface Options {
  /** Scopes the signalling channel — the VCR session id, falling back to the student id. */
  roomId: string;
  /** Unique id for this participant (auth user id). */
  peerId: string;
  /** Shown in the participant list. */
  displayName?: string;
  /** Join silently as an observer (starts muted). */
  observer?: boolean;
  /** Legacy hint only — either side may place the call; the offerer is negotiated. */
  isCaller?: boolean;
}

export function useVcrCall({ roomId, peerId, displayName = 'Participant', observer = false }: Options) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<CallPeer[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const peersRef = useRef<Map<string, CallPeer>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const observerRef = useRef(observer);
  const [busy, setBusy] = useState(false);

  observerRef.current = observer;

  const syncPeers = () => setPeers(Array.from(peersRef.current.values()));

  const clearTimer = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const send = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      channelRef.current?.send({ type: 'broadcast', event, payload: { ...payload, from: peerId } });
    },
    [peerId]
  );

  const dropPeer = useCallback((id: string) => {
    pcsRef.current.get(id)?.close();
    pcsRef.current.delete(id);
    remoteStreamsRef.current.delete(id);
    const el = audioElsRef.current.get(id);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioElsRef.current.delete(id);
    }
    pendingIce.current.delete(id);
    peersRef.current.delete(id);
    syncPeers();
  }, []);

  const teardown = useCallback(
    (next: CallStatus) => {
      if (activeRef.current) send('leave', {});
      activeRef.current = false;
      clearTimer();

      Array.from(pcsRef.current.keys()).forEach(dropPeer);
      pcsRef.current.clear();
      remoteStreamsRef.current.clear();
      pendingIce.current.clear();
      peersRef.current.clear();

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setPeers([]);
      setMuted(false);
      setStatus(next);
    },
    [dropPeer, send]
  );

  /** Only start counting down once someone else is actually in the room. */
  const armConnectTimer = useCallback(() => {
    if (timeoutRef.current) return;
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      if (!activeRef.current) return;
      const anyConnected = Array.from(pcsRef.current.values()).some((p) => p.connectionState === 'connected');
      if (!anyConnected) {
        setStatus('failed');
        setError('The call could not connect in time. Please use the Zoom link instead.');
      }
    }, CONNECT_TIMEOUT_MS);
  }, []);

  const refreshStatus = useCallback(() => {
    if (!activeRef.current) return;
    const states = Array.from(pcsRef.current.values()).map((p) => p.connectionState);
    if (states.some((s) => s === 'connected')) {
      clearTimer();
      setError(null);
      setStatus('connected');
    } else if (states.length && states.every((s) => s === 'failed')) {
      setStatus('failed');
      setError(
        hasTurnConfigured()
          ? 'The call could not connect. Please use the Zoom link instead.'
          : 'The call could not connect through the network (no relay server configured). Please use the Zoom link instead.'
      );
    } else if (states.some((s) => s === 'disconnected')) {
      setStatus('reconnecting');
    }
  }, []);

  const ensurePc = useCallback(
    (remoteId: string) => {
      const existing = pcsRef.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });

      pc.onicecandidate = (e) => {
        if (e.candidate) send('ice', { to: remoteId, candidate: e.candidate.toJSON() });
      };

      pc.ontrack = (e) => {
        let el = audioElsRef.current.get(remoteId);
        if (!el) {
          el = document.createElement('audio');
          el.autoplay = true;
          el.setAttribute('playsinline', 'true');
          document.body.appendChild(el);
          audioElsRef.current.set(remoteId, el);
        }
        remoteStreamsRef.current.set(remoteId, e.streams[0]);
        el.srcObject = e.streams[0];
        el.play().catch(() => setError('Tap anywhere on the page to allow audio playback.'));
      };

      pc.onconnectionstatechange = () => refreshStatus();

      const local = localStreamRef.current;
      if (local) local.getAudioTracks().forEach((t) => pc.addTrack(t, local));

      pcsRef.current.set(remoteId, pc);
      return pc;
    },
    [send, refreshStatus]
  );

  const drainIce = async (remoteId: string, pc: RTCPeerConnection) => {
    for (const c of pendingIce.current.get(remoteId) ?? []) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }
    pendingIce.current.delete(remoteId);
  };

  const start = useCallback(async () => {
    if (!roomId || !peerId || activeRef.current) return;
    setError(null);
    setBusy(false);
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

    // Observers arrive silently — they can unmute to speak.
    if (observerRef.current) {
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      setMuted(true);
    }

    // NOTE: must NOT share a topic with useVcrViewSync (`vcr-call:*`).
    const channel = supabase.channel(`vcr-audio:${roomId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    const me = () => ({ name: displayName, observer: observerRef.current });

    /** Track a peer; refuse a fourth participant. */
    const claimPeer = (from?: string, name?: string, isObserver?: boolean) => {
      if (!from || from === peerId) return false;
      if (!peersRef.current.has(from) && peersRef.current.size >= MAX_OTHERS) {
        channelRef.current?.send({ type: 'broadcast', event: 'busy', payload: { from: peerId, to: from } });
        return false;
      }
      peersRef.current.set(from, { id: from, name: name || 'Participant', observer: !!isObserver });
      syncPeers();
      armConnectTimer();
      return true;
    };

    /** Deterministic, role-free: the higher peer id creates the offer. */
    const amOfferer = (other: string) => peerId > other;

    const makeOffer = async (remoteId: string) => {
      if (!amOfferer(remoteId)) return;
      const pc = ensurePc(remoteId);
      if (pc.signalingState !== 'stable' || pc.currentRemoteDescription) return;
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        send('offer', { to: remoteId, sdp: offer });
      } catch {
        /* retried when the peer re-announces */
      }
    };

    const mine = (payload: any) => !payload?.to || payload.to === peerId;

    channel
      .on('broadcast', { event: 'join' }, async ({ payload }) => {
        if (!claimPeer(payload?.from, payload?.name, payload?.observer)) return;
        send('present', me());
        await makeOffer(payload.from);
      })
      .on('broadcast', { event: 'present' }, async ({ payload }) => {
        if (!claimPeer(payload?.from, payload?.name, payload?.observer)) return;
        await makeOffer(payload.from);
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (!mine(payload) || payload?.from === peerId) return;
        if (!claimPeer(payload.from, payload.name, payload.observer) || amOfferer(payload.from)) return;
        const pc = ensurePc(payload.from);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await drainIce(payload.from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send('answer', { to: payload.from, sdp: answer });
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!mine(payload) || payload?.from === peerId) return;
        const pc = pcsRef.current.get(payload.from);
        if (!pc || pc.currentRemoteDescription) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await drainIce(payload.from, pc);
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (!mine(payload) || payload?.from === peerId) return;
        const pc = pcsRef.current.get(payload.from);
        if (!pc || !pc.remoteDescription) {
          const list = pendingIce.current.get(payload.from) ?? [];
          list.push(payload.candidate);
          pendingIce.current.set(payload.from, list);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
      })
      .on('broadcast', { event: 'busy' }, ({ payload }) => {
        if (payload?.to !== peerId) return;
        setBusy(true);
        setError('This class call is full (three people). Ask someone to leave, then try again.');
        teardown('failed');
      })
      .on('broadcast', { event: 'leave' }, ({ payload }) => {
        if (!payload?.from || payload.from === peerId) return;
        dropPeer(payload.from);
        if (peersRef.current.size === 0) teardown('ended');
      })
      .on('broadcast', { event: 'hangup' }, ({ payload }) => {
        if (payload?.from === peerId) return;
        dropPeer(payload.from);
        if (peersRef.current.size === 0) teardown('ended');
      })
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          send('join', me());
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          setStatus('failed');
          setError('Could not reach the signalling service. Please use the Zoom link instead.');
        }
      });

    // No failure timer until someone else is present — whoever opens first
    // simply waits instead of being told the call failed.
    clearTimer();
  }, [roomId, peerId, displayName, ensurePc, send, teardown, dropPeer, armConnectTimer]);

  const end = useCallback(() => {
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
    window.setTimeout(() => { void start(); }, 150);
  }, [teardown, start]);

  useEffect(() => () => teardown('idle'), [teardown]);

  /** Live media handles for the (consented) call recorder. */
  const getStreams = useCallback(
    () => ({ local: localStreamRef.current, remotes: Array.from(remoteStreamsRef.current.values()) }),
    []
  );

  const remoteJoined = peers.length > 0;

  return {
    status,
    muted,
    error,
    busy,
    peers,
    remoteJoined,
    remotePeerId: peers[0]?.id ?? null,
    start,
    end,
    toggleMute,
    retry,
    getStreams,
  };
}
