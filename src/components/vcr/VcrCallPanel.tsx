import React from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, RotateCcw, AlertTriangle, BellRing, X } from 'lucide-react';
import { useVcrCall, type CallStatus } from '@/hooks/useVcrCall';
import { useVcrRingHost, useVcrRingListener, useVcrKnockSender, useVcrKnockListener } from '@/hooks/useVcrRing';
import { VcrCallRecorder } from '@/components/vcr/VcrCallRecorder';
import { cn } from '@/lib/utils';

interface Props {
  /** VCR session id when one exists, otherwise the student id — scopes signalling. */
  roomId: string;
  peerId: string;
  /** Staff side places the call. */
  isCaller: boolean;
  /** Shown to the student in the ring banner. */
  callerName?: string;
  /** Student's own name — announced to the teacher when they ring. */
  knockerName?: string;
  /** Participants, used to attribute a consented recording. */
  studentId?: string | null;
  teacherId?: string | null;
}

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  failed: 'Call failed',
  ended: 'Call ended',
};

const STATUS_DOT: Record<CallStatus, string> = {
  idle: 'bg-vcr-chrome/40',
  connecting: 'bg-vcr-gold animate-pulse',
  connected: 'bg-emerald-400',
  reconnecting: 'bg-amber-400 animate-pulse',
  failed: 'bg-red-400',
  ended: 'bg-vcr-chrome/40',
};

const mmss = (secs: number) => {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Audio-only in-app call controls. Fully separate from the Zoom flow —
 * the Zoom option stays available alongside it.
 */
export function VcrCallPanel({ roomId, peerId, isCaller, callerName, studentId = null, teacherId = null }: Props) {
  const { status, muted, error, remoteJoined, start, end, toggleMute, retry, getStreams } = useVcrCall({ roomId, peerId, isCaller });
  const live = status === 'connecting' || status === 'connected' || status === 'reconnecting';

  /* Announce / observe the call so the other side knows one is running. */
  useVcrRingHost(roomId, isCaller && live, callerName);
  const { ringing } = useVcrRingListener(roomId, !isCaller && !live);

  /* Call duration — starts on connect, stops (and resets) when the call ends. */
  const [duration, setDuration] = React.useState(0);
  React.useEffect(() => {
    if (status === 'connected' || status === 'reconnecting') {
      const t = window.setInterval(() => setDuration((d) => d + 1), 1000);
      return () => window.clearInterval(t);
    }
    if (!live) setDuration(0);
  }, [status, live]);

  const label =
    status === 'connecting' && !remoteJoined
      ? 'Waiting for the other person…'
      : STATUS_LABEL[status];

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center gap-2 rounded-xl border px-3 py-2 transition-colors',
        status === 'connected' || status === 'reconnecting'
          ? 'border-emerald-400/50 bg-emerald-500/10'
          : ringing
            ? 'border-emerald-400/50 bg-emerald-500/10'
            : 'border-transparent'
      )}
    >
      <span
        className="inline-flex items-center gap-2 rounded-full border border-vcr-chrome/15 bg-black/25 px-3 py-1 text-xs text-vcr-chrome/75"
        role="status"
        aria-live="polite"
      >
        <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} aria-hidden />
        {label}
      </span>

      {(status === 'connected' || status === 'reconnecting') && (
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 font-mono text-xs tabular-nums text-emerald-200">
          Call {mmss(duration)}
        </span>
      )}

      {ringing && !live && (
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200">
          <span className="h-2 w-2 animate-ping rounded-full bg-emerald-300" aria-hidden />
          Your teacher is on the call
        </span>
      )}

      {!live ? (
        <button
          type="button"
          onClick={() => void start()}
          className={cn(
            'vcr-btn inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm',
            ringing && 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
          )}
        >
          <PhoneCall className="h-4 w-4 text-vcr-gold" />
          {isCaller ? 'Start In-App Call' : ringing ? 'Join call now' : 'Join In-App Call'}
          <span className="text-vcr-chrome/45">· audio</span>
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            className="vcr-btn inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm"
          >
            {muted ? <MicOff className="h-4 w-4 text-amber-300" /> : <Mic className="h-4 w-4 text-vcr-gold" />}
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button
            type="button"
            onClick={end}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/15 px-3 text-sm text-red-200 transition-colors hover:bg-red-500/25"
          >
            <PhoneOff className="h-4 w-4" /> End call
          </button>
        </>
      )}

      {/* Opt-in call recording — requires the student's explicit consent */}
      <VcrCallRecorder
        roomId={roomId}
        peerId={peerId}
        isHost={isCaller}
        live={status === 'connected' || status === 'reconnecting'}
        studentId={studentId}
        teacherId={teacherId}
        getStreams={getStreams}
      />

      {status === 'failed' && (
        <>
          <button
            type="button"
            onClick={() => void retry()}
            className="vcr-btn inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm"
          >
            <RotateCcw className="h-4 w-4 text-vcr-gold" /> Try again
          </button>
          <span className="inline-flex max-w-full items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{error ?? 'The call could not connect. Please use the Zoom link instead.'}</span>
          </span>
        </>
      )}

      {status !== 'failed' && error && (
        <span className="text-xs text-amber-200">{error}</span>
      )}
    </div>
  );
}
