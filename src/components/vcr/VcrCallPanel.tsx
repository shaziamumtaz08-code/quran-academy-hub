import React from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, RotateCcw, AlertTriangle } from 'lucide-react';
import { useVcrCall, type CallStatus } from '@/hooks/useVcrCall';
import { cn } from '@/lib/utils';

interface Props {
  /** VCR session id when one exists, otherwise the student id — scopes signalling. */
  roomId: string;
  peerId: string;
  /** Staff side places the call. */
  isCaller: boolean;
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

/**
 * Audio-only in-app call controls. Fully separate from the Zoom flow —
 * the Zoom option stays available alongside it.
 */
export function VcrCallPanel({ roomId, peerId, isCaller }: Props) {
  const { status, muted, error, remoteJoined, start, end, toggleMute, retry } = useVcrCall({ roomId, peerId, isCaller });
  const live = status === 'connecting' || status === 'connected' || status === 'reconnecting';
  const label =
    status === 'connecting' && !remoteJoined
      ? 'Waiting for the other person…'
      : STATUS_LABEL[status];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="inline-flex items-center gap-2 rounded-full border border-vcr-chrome/15 bg-black/25 px-3 py-1 text-xs text-vcr-chrome/75"
        role="status"
        aria-live="polite"
      >
        <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} aria-hidden />
        {label}
      </span>


      {!live ? (
        <button
          type="button"
          onClick={() => void start()}
          className="vcr-btn inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm"
        >
          <PhoneCall className="h-4 w-4 text-vcr-gold" />
          {isCaller ? 'Start In-App Call' : 'Join In-App Call'}
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
