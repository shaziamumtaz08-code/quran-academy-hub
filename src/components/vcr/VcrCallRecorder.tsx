import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Loader2, ShieldCheck, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface Props {
  /** Same room key as the call/signalling channels. */
  roomId: string;
  peerId: string;
  /** Staff side owns the recorder; the student only consents. */
  isHost: boolean;
  /** True while the audio call is actually up. */
  live: boolean;
  studentId: string | null;
  teacherId: string | null;
  getStreams: () => { local: MediaStream | null; remotes: MediaStream[] };
  /** Zoom-style: ask for consent automatically as soon as the call connects. */
  autoRecord?: boolean;
  /** Called once a recording row exists, so the call log can be stamped. */
  onRecorded?: (recordingId: string | null) => void;
}

type HostPhase = 'idle' | 'awaiting-consent' | 'recording' | 'saving';

/**
 * Opt-in recording of the in-app VCR audio call.
 *
 * Nothing is captured until the teacher asks and the student explicitly agrees;
 * both consents are stamped on the recording row. Both sides see a persistent
 * "Recording" indicator for as long as capture is running.
 */
export function VcrCallRecorder({ roomId, peerId, isHost, live, studentId, teacherId, getStreams, autoRecord = false, onRecorded }: Props) {
  const [phase, setPhase] = useState<HostPhase>('idle');
  const [remoteRecording, setRemoteRecording] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef<number>(0);
  const recordIdRef = useRef<string | null>(null);
  const pathRef = useRef<string | null>(null);

  const send = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    channelRef.current?.send({ type: 'broadcast', event, payload: { ...payload, from: peerId } });
  }, [peerId]);

  /* Consent + status signalling on its own topic. */
  useEffect(() => {
    if (!roomId || !peerId) return;
    const channel = supabase.channel(`vcr-record:${roomId}`, { config: { broadcast: { self: false } } });

    channel
      .on('broadcast', { event: 'record-request' }, ({ payload }) => {
        if (isHost || payload?.from === peerId) return;
        setConsentOpen(true);
      })
      .on('broadcast', { event: 'record-response' }, ({ payload }) => {
        if (!isHost || payload?.from === peerId) return;
        if (payload?.accepted) void beginCapture();
        else {
          setPhase('idle');
          toast({ title: 'Recording declined', description: 'The student did not agree to being recorded.' });
        }
      })
      .on('broadcast', { event: 'record-started' }, ({ payload }) => {
        if (payload?.from === peerId) return;
        setRemoteRecording(true);
      })
      .on('broadcast', { event: 'record-stopped' }, ({ payload }) => {
        if (payload?.from === peerId) return;
        setRemoteRecording(false);
        setConsentOpen(false);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, peerId, isHost]);

  /** Mix every participant into one track so the saved file has the whole call. */
  const mixedStream = () => {
    const { local, remotes } = getStreams();
    const sources = [local, ...remotes];
    if (!sources.some(Boolean)) return null;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const dest = ctx.createMediaStreamDestination();
    sources.forEach((s) => {
      if (!s || s.getAudioTracks().length === 0) return;
      ctx.createMediaStreamSource(s).connect(dest);
    });
    return dest.stream;
  };

  const beginCapture = useCallback(async () => {
    const stream = mixedStream();
    if (!stream) {
      setPhase('idle');
      toast({ title: 'Nothing to record', description: 'The call audio is not available yet.', variant: 'destructive' });
      return;
    }

    // The teaching staff member owns the recording — never attribute it to
    // whoever happens to be holding the recorder seat.
    if (!teacherId) {
      setPhase('idle');
      toast({ title: 'Recording unavailable', description: 'Only the class teacher can record this call.', variant: 'destructive' });
      return;
    }

    // The id and storage path are fixed up front so the upload policy can match
    // the pending row exactly.
    const recordingId = crypto.randomUUID();
    const path = `${roomId}/${recordingId}.webm`;

    const { data, error } = await supabase
      .from('vcr_call_recordings' as any)
      .insert({
        id: recordingId,
        room_id: roomId,
        student_id: studentId,
        teacher_id: teacherId,
        created_by: teacherId,
        storage_path: path,
        consent_teacher: true,
        consent_student: true,
        consent_at: new Date().toISOString(),
        status: 'recording',
      })
      .select('id')
      .maybeSingle();

    if (error || !data) {
      setPhase('idle');
      toast({ title: 'Could not start recording', description: error?.message ?? 'Please try again.', variant: 'destructive' });
      return;
    }
    recordIdRef.current = recordingId;
    pathRef.current = path;
    onRecorded?.(recordingId);

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => void finalise();
    recorder.start(1000);
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();

    setPhase('recording');
    send('record-started');
  }, [roomId, studentId, teacherId, peerId, send, onRecorded]);

  const finalise = useCallback(async () => {
    setPhase('saving');
    const id = recordIdRef.current;
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;

    const seconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    const path = pathRef.current ?? `${roomId}/${id ?? Date.now()}.webm`;

    const { error: upErr } = await supabase.storage
      .from('vcr-call-recordings')
      .upload(path, blob, { contentType: 'audio/webm', upsert: true });

    if (id) {
      await supabase.from('vcr_call_recordings' as any).update({
        storage_path: upErr ? null : path,
        ended_at: new Date().toISOString(),
        duration_seconds: seconds,
        status: upErr ? 'failed' : 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    }

    recordIdRef.current = null;
    pathRef.current = null;
    setPhase('idle');
    send('record-stopped');
    toast(upErr
      ? { title: 'Recording not saved', description: upErr.message, variant: 'destructive' }
      : { title: 'Recording saved', description: `${seconds}s of call audio stored securely.` });
  }, [roomId, send]);

  const stop = () => {
    const r = recorderRef.current;
    recorderRef.current = null;
    if (r && r.state !== 'inactive') r.stop();
    else void finalise();
  };

  /* Never hang on a request the student never answers. */
  useEffect(() => {
    if (phase !== 'awaiting-consent') return;
    const t = window.setTimeout(() => {
      setPhase('idle');
      toast({ title: 'No answer', description: 'The student did not respond to the recording request.' });
    }, 45000);
    return () => window.clearTimeout(t);
  }, [phase]);

  /* Auto-record: ask for consent once, as soon as the call is up. */
  const autoAskedRef = useRef(false);
  useEffect(() => {
    if (!isHost || !autoRecord) return;
    if (!live) { autoAskedRef.current = false; return; }
    if (autoAskedRef.current || phase !== 'idle') return;
    autoAskedRef.current = true;
    setPhase('awaiting-consent');
    send('record-request', { auto: true });
  }, [isHost, autoRecord, live, phase, send]);

  /* Never keep recording after the call drops. */
  useEffect(() => {
    if (!live && recorderRef.current) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    audioCtxRef.current?.close().catch(() => {});
  }, []);

  const recording = phase === 'recording' || remoteRecording;

  return (
    <>
      {recording && (
        <span className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-200" role="status" aria-live="polite">
          <Circle className="h-2.5 w-2.5 animate-pulse fill-red-400 text-red-400" aria-hidden />
          Recording — both sides agreed
        </span>
      )}

      {isHost && live && (
        phase === 'recording' ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/15 px-3 text-sm text-red-200 transition-colors hover:bg-red-500/25"
          >
            <Square className="h-4 w-4" /> Stop recording
          </button>
        ) : (
          <button
            type="button"
            disabled={phase === 'saving'}
            onClick={() => {
              if (phase === 'awaiting-consent') { setPhase('idle'); return; }
              setPhase('awaiting-consent');
              send('record-request');
            }}
            title={phase === 'awaiting-consent' ? 'Tap to cancel the request' : undefined}
            className={cn('vcr-btn inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-60')}
          >
            {phase === 'idle' ? <Circle className="h-4 w-4 text-red-300" /> : <Loader2 className="h-4 w-4 animate-spin text-vcr-gold" />}
            {phase === 'awaiting-consent' ? 'Waiting for consent… (tap to cancel)' : phase === 'saving' ? 'Saving…' : 'Record call'}
          </button>
        )
      )}

      {/* Student-side consent — recording never starts without this */}
      <AlertDialog
        open={consentOpen && !isHost}
        onOpenChange={(open) => {
          // Escape / outside-dismiss must still answer the teacher, otherwise
          // their button stays stuck on "Waiting for consent…".
          if (!open && consentOpen) send('record-response', { accepted: false });
          setConsentOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Allow this class to be recorded?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your teacher would like to record the audio of this class. The recording is stored privately and can
              only be opened by you, your teacher and academy administrators. You can say no — the class continues
              either way.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { send('record-response', { accepted: false }); setConsentOpen(false); }}>
              No, don't record
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { send('record-response', { accepted: true }); setConsentOpen(false); }}>
              Yes, I agree
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default VcrCallRecorder;
