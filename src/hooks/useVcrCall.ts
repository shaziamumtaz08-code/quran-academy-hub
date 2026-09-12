import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getIceServers, hasTurnConfigured } from '@/lib/call/iceConfig';
import { ensureRealtimeSession } from '@/lib/ensureSession';

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
  /** Whether that person's microphone is currently off. */
  muted: boolean;
  /** True while that person is actually talking. */
  speaking: boolean;
  /** True while that person's camera is on. */
  camera?: boolean;
}

export interface RemoteVideo {
  id: string;
  name: string;
  stream: MediaStream;
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
  const [cameraOn, setCameraOn] = useState(false);
  const [localVideo, setLocalVideo] = useState<MediaStream | null>(null);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  /** One pre-negotiated video slot per peer — lets the camera turn on without re-negotiating. */
  const videoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const remoteVideoRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const peersRef = useRef<Map<string, CallPeer>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const observerRef = useRef(observer);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const mutedRef = useRef(false);
  const levelCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const levelTimerRef = useRef<number | null>(null);
  /** Ask for a fresh offer/answer with one peer (set up when the call starts). */
  const renegotiateRef = useRef<((remoteId: string) => void) | null>(null);

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

  /**
   * Voice-activity metering: everyone can see who is actually talking, which
   * removes the "whose mic is on?" confusion during a class.
   */
  const attachLevel = useCallback((id: string, stream: MediaStream) => {
    try {
      if (!stream.getAudioTracks().length) return;
      const ctx = levelCtxRef.current ?? new AudioContext();
      levelCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analysersRef.current.set(id, analyser);

      if (levelTimerRef.current == null) {
        const buf = new Uint8Array(analyser.frequencyBinCount);
        levelTimerRef.current = window.setInterval(() => {
          let selfLoud = false;
          analysersRef.current.forEach((a, key) => {
            a.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const loud = Math.sqrt(sum / buf.length) > 0.045;
            if (key === 'self') {
              selfLoud = loud && !mutedRef.current;
              return;
            }
            const peer = peersRef.current.get(key);
            if (peer && peer.speaking !== loud) {
              peersRef.current.set(key, { ...peer, speaking: loud });
              syncPeers();
            }
          });
          setSpeaking(selfLoud);
        }, 250);
      }
    } catch {
      /* metering is a nicety — never break the call for it */
    }
  }, []);

  const stopLevels = useCallback(() => {
    if (levelTimerRef.current != null) window.clearInterval(levelTimerRef.current);
    levelTimerRef.current = null;
    analysersRef.current.clear();
    levelCtxRef.current?.close().catch(() => {});
    levelCtxRef.current = null;
    setSpeaking(false);
  }, []);

  const dropPeer = useCallback((id: string) => {
    pcsRef.current.get(id)?.close();
    pcsRef.current.delete(id);
    remoteStreamsRef.current.delete(id);
    analysersRef.current.delete(id);
    const el = audioElsRef.current.get(id);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioElsRef.current.delete(id);
    }
    pendingIce.current.delete(id);
    videoSendersRef.current.delete(id);
    remoteVideoRef.current.delete(id);
    setRemoteVideos((v) => v.filter((r) => r.id !== id));
    peersRef.current.delete(id);
    syncPeers();
  }, []);

  const teardown = useCallback(
    (next: CallStatus) => {
      if (activeRef.current) send('leave', {});
      activeRef.current = false;
      clearTimer();
      stopLevels();

      Array.from(pcsRef.current.keys()).forEach(dropPeer);
      pcsRef.current.clear();
      remoteStreamsRef.current.clear();
      pendingIce.current.clear();
      peersRef.current.clear();

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
      videoTrackRef.current = null;
      videoSendersRef.current.clear();
      remoteVideoRef.current.clear();
      setRemoteVideos([]);
      setLocalVideo(null);
      setCameraOn(false);

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setPeers([]);
      mutedRef.current = false;
      setMuted(false);
      setStatus(next);
    },
    [dropPeer, send, stopLevels]
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
        if (e.track.kind === 'video') {
          const stream = e.streams[0] ?? new MediaStream([e.track]);
          remoteVideoRef.current.set(remoteId, stream);
          const publish = () =>
            setRemoteVideos(
              Array.from(remoteVideoRef.current.entries())
                .filter(([id]) => id !== peerId)
                .map(([id, s]) => ({ id, name: peersRef.current.get(id)?.name ?? 'Participant', stream: s }))
            );
          publish();
          e.track.onmute = publish;
          e.track.onunmute = publish;
          e.track.onended = () => {
            remoteVideoRef.current.delete(remoteId);
            publish();
          };
          return;
        }
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
        attachLevel(remoteId, e.streams[0]);
        el.play().catch(() => setError('Tap anywhere on the page to allow audio playback.'));
      };

      pc.onconnectionstatechange = () => refreshStatus();

      const local = localStreamRef.current;
      if (local) local.getAudioTracks().forEach((t) => pc.addTrack(t, local));

      // Reserve a video slot up front so turning the camera on later never
      // needs a fresh offer/answer round.
      const videoTx = pc.addTransceiver('video', { direction: 'sendrecv' });
      videoSendersRef.current.set(remoteId, videoTx.sender);
      if (videoTrackRef.current) videoTx.sender.replaceTrack(videoTrackRef.current).catch(() => {});

      pcsRef.current.set(remoteId, pc);
      return pc;
    },
    [send, refreshStatus, attachLevel]
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

    try {
      await ensureRealtimeSession();
    } catch {
      activeRef.current = false;
      setStatus('failed');
      setError('Your session expired. Please sign in again before starting the call.');
      return;
    }

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
    attachLevel('self', stream);

    // Observers arrive silently — they can unmute to speak.
    if (observerRef.current) {
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      mutedRef.current = true;
      setMuted(true);
    } else {
      mutedRef.current = false;
      setMuted(false);
    }

    // NOTE: must NOT share a topic with useVcrViewSync (`vcr-call:*`).
    const channel = supabase.channel(`vcr-audio:${roomId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    const me = () => ({ name: displayName, observer: observerRef.current, muted: mutedRef.current });

    /** Track a peer; refuse a fourth participant. */
    const claimPeer = (from?: string, name?: string, isObserver?: boolean, isMuted?: boolean) => {
      if (!from || from === peerId) return false;
      if (!peersRef.current.has(from) && peersRef.current.size >= MAX_OTHERS) {
        channelRef.current?.send({ type: 'broadcast', event: 'busy', payload: { from: peerId, to: from } });
        return false;
      }
      const prev = peersRef.current.get(from);
      peersRef.current.set(from, {
        id: from,
        name: name || prev?.name || 'Participant',
        observer: isObserver ?? prev?.observer ?? false,
        muted: isMuted ?? prev?.muted ?? false,
        speaking: prev?.speaking ?? false,
      });
      syncPeers();
      armConnectTimer();
      return true;
    };

    /** Deterministic, role-free: the higher peer id creates the offer. */
    const amOfferer = (other: string) => peerId > other;

    const makeOffer = async (remoteId: string, force = false) => {
      if (!amOfferer(remoteId)) return;
      const pc = ensurePc(remoteId);
      if (pc.signalingState !== 'stable') return;
      if (!force && pc.currentRemoteDescription) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send('offer', { to: remoteId, sdp: offer });
      } catch {
        /* retried when the peer re-announces */
      }
    };

    const mine = (payload: any) => !payload?.to || payload.to === peerId;

    /* Turning a camera on needs a fresh offer/answer. Only one side may make
       offers, so the other side simply asks for one. */
    renegotiateRef.current = (remoteId: string) => {
      if (amOfferer(remoteId)) void makeOffer(remoteId, true);
      else send('renegotiate', { to: remoteId });
    };

    channel
      .on('broadcast', { event: 'renegotiate' }, async ({ payload }) => {
        if (!mine(payload) || payload?.from === peerId) return;
        await makeOffer(payload.from, true);
      })
      .on('broadcast', { event: 'join' }, async ({ payload }) => {
        if (!claimPeer(payload?.from, payload?.name, payload?.observer, payload?.muted)) return;
        send('present', me());
        await makeOffer(payload.from);
      })
      .on('broadcast', { event: 'present' }, async ({ payload }) => {
        if (!claimPeer(payload?.from, payload?.name, payload?.observer, payload?.muted)) return;
        await makeOffer(payload.from);
      })
      .on('broadcast', { event: 'mic' }, ({ payload }) => {
        const peer = payload?.from ? peersRef.current.get(payload.from) : undefined;
        if (!peer) return;
        peersRef.current.set(peer.id, { ...peer, muted: !!payload.muted, speaking: payload.muted ? false : peer.speaking });
        syncPeers();
      })
      .on('broadcast', { event: 'cam' }, ({ payload }) => {
        const peer = payload?.from ? peersRef.current.get(payload.from) : undefined;
        if (!peer) return;
        peersRef.current.set(peer.id, { ...peer, camera: !!payload.camera });
        syncPeers();
        if (!payload.camera) {
          remoteVideoRef.current.delete(peer.id);
          setRemoteVideos((v) => v.filter((r) => r.id !== peer.id));
        }
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (!mine(payload) || payload?.from === peerId) return;
        if (!claimPeer(payload.from, payload.name, payload.observer, payload.muted) || amOfferer(payload.from)) return;
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
        if (!pc || pc.signalingState !== 'have-local-offer') return;
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
      /* The other person leaving must not hang up on me: a refreshed page or a
         dropped mobile connection would end the class. The line stays open and
         simply waits for them to come back. */
      .on('broadcast', { event: 'leave' }, ({ payload }) => {
        if (!payload?.from || payload.from === peerId) return;
        dropPeer(payload.from);
        if (peersRef.current.size === 0 && activeRef.current) { clearTimer(); setStatus('connecting'); }
      })
      /* An explicit hangup is intentional (unlike a reload): the line closes on
         both sides at once, so nobody is left staring at a call that is over. */
      .on('broadcast', { event: 'hangup' }, ({ payload }) => {
        if (payload?.from === peerId) return;
        dropPeer(payload.from);
        if (peersRef.current.size === 0 && activeRef.current) teardown('ended');
      })

      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          setError(null);
          setStatus('connecting');
          send('join', me());
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          teardown('failed');
          setError('The live call connection was interrupted. Tap Try again to reconnect.');
        }
      });

    // No failure timer until someone else is present — whoever opens first
    // simply waits instead of being told the call failed.
    clearTimer();
  }, [roomId, peerId, displayName, ensurePc, send, teardown, dropPeer, armConnectTimer, attachLevel]);

  const end = useCallback(() => {
    teardown('ended');
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    mutedRef.current = !track.enabled;
    setMuted(!track.enabled);
    if (!track.enabled) setSpeaking(false);
    // Tell the others straight away, so nobody talks into a muted mic.
    send('mic', { muted: !track.enabled });
  }, [send]);

  /**
   * Camera is opt-in: it starts off, and turning it on simply fills the video
   * slot that was reserved when the call connected.
   */
  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      videoTrackRef.current = null;
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
      setLocalVideo(null);
      setCameraOn(false);
      videoSendersRef.current.forEach((s, id) => {
        void s.replaceTrack(null).catch(() => {});
        renegotiateRef.current?.(id);
      });
      send('cam', { camera: false });
      return;
    }
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      const track = cam.getVideoTracks()[0] ?? null;
      videoStreamRef.current = cam;
      videoTrackRef.current = track;
      setLocalVideo(cam);
      setCameraOn(true);
      videoSendersRef.current.forEach((s, id) => {
        void s.replaceTrack(track).then(() => renegotiateRef.current?.(id)).catch(() => {});
      });
      send('cam', { camera: true });
    } catch {
      setError('Camera access was blocked. Allow the camera in your browser to turn video on.');
    }
  }, [cameraOn, send]);

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
    speaking,
    error,
    busy,
    peers,
    remoteJoined,
    remotePeerId: peers[0]?.id ?? null,
    start,
    end,
    toggleMute,
    cameraOn,
    localVideo,
    remoteVideos,
    toggleCamera,
    retry,
    getStreams,
  };
}
