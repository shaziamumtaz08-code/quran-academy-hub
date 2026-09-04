import React from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, RotateCcw, AlertTriangle, BellRing, X, Users, Eye } from 'lucide-react';
import { useVcrCall, type CallStatus } from '@/hooks/useVcrCall';
import { useVcrCallLog } from '@/hooks/useVcrCallLog';
import { useVcrRingHost, useVcrRingListener, useVcrKnockSender, useVcrKnockListener } from '@/hooks/useVcrRing';
import { VcrCallRecorder } from '@/components/vcr/VcrCallRecorder';
import { cn } from '@/lib/utils';

interface Props {
  /** VCR session id when one exists, otherwise the student id — scopes signalling. */
  roomId: string;
  peerId: string;
  /** Staff side — owns the recorder. Either side may place the call. */
  isCaller: boolean;
  /** Role recorded on the call log. */
  role?: string;
  /** Ask for recording consent automatically when the call connects. */
  autoRecord?: boolean;
  /** Shown to the student in the ring banner. */
  callerName?: string;
  /** Student's own name — announced to the teacher when they ring. */
  knockerName?: string;
  /** Participants, used to attribute a consented recording. */
  studentId?: string | null;
  teacherId?: string | null;
  /** Own name, shown to the others in the participant list. */
  displayName?: string;
  /** Join silently as an observer (examiner/admin) — starts muted, can unmute. */
  observer?: boolean;
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
export function VcrCallPanel({ roomId, peerId, isCaller, role = 'participant', autoRecord = false, callerName, knockerName, studentId = null, teacherId = null, displayName = 'Participant', observer = false }: Props) {
  const { status, muted, error, busy, peers, remoteJoined, remotePeerId, start, end, toggleMute, retry, getStreams } =
    useVcrCall({ roomId, peerId, displayName, observer });
  const [showPeople, setShowPeople] = React.useState(false);
  const live = status === 'connecting' || status === 'connected' || status === 'reconnecting';

  /* Log every call — recorded or not. */
  const { markRecorded } = useVcrCallLog({
    roomId, studentId, selfId: peerId, role: observer ? `${role} (observer)` : role,
    status, remoteJoined, remotePeerId, observer,
  });

  /* Announce / observe the call — either side may be the one on the line. */
  useVcrRingHost(roomId, live && !observer, callerName);
  const { ringing } = useVcrRingListener(roomId, !live);

  /* Bell: either side can ring the other when no call is up. */
  const { knock, sentAt } = useVcrKnockSender(!live ? roomId : null);
  const { knockerName: knocking, dismiss: dismissKnock } = useVcrKnockListener(roomId, !live);
  const knockCooldown = sentAt != null && Date.now() - sentAt < 15000;

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

      {live && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPeople((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-vcr-chrome/15 bg-black/25 px-3 py-1 text-xs text-vcr-chrome/75"
          >
            <Users className="h-3.5 w-3.5" aria-hidden />
            Participants ({peers.length + 1})
          </button>
          {showPeople && (
            <ul className="absolute left-0 top-full z-50 mt-1 min-w-44 space-y-1 rounded-lg border border-vcr-chrome/20 bg-black/85 p-2 text-xs text-vcr-chrome/85 shadow-xl">
              <li className="flex items-center gap-2">
                {observer && <Eye className="h-3 w-3 text-vcr-gold" aria-hidden />}
                {displayName} (you){observer ? ' · observer' : ''}
              </li>
              {peers.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  {p.observer && <Eye className="h-3 w-3 text-vcr-gold" aria-hidden />}
                  {p.name}{p.observer ? ' · observer' : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {ringing && !live && (
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200">
          <span className="h-2 w-2 animate-ping rounded-full bg-emerald-300" aria-hidden />
          {isCaller ? 'The student is on the call' : 'Your teacher is on the call'}
        </span>
      )}

      {knocking && !live && (
        <span className="inline-flex items-center gap-2 rounded-full border border-vcr-gold/50 bg-vcr-gold/15 px-3 py-1 text-xs text-vcr-gold">
          <BellRing className="h-3.5 w-3.5 animate-pulse" aria-hidden />
          {knocking} is ringing you
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissKnock}
            className="rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}

      {!live ? (
        <>
          <button
            type="button"
            onClick={() => void start()}
            className={cn(
              'vcr-btn inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm',
              ringing && 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
            )}
          >
            <PhoneCall className="h-4 w-4 text-vcr-gold" />
            {observer ? (ringing ? 'Sit in on the call' : 'Sit in (observer)') : ringing ? 'Join call now' : 'Start In-App Call'}
            <span className="text-vcr-chrome/45">· audio</span>
          </button>
          {!ringing && !observer && (
            <button
              type="button"
              onClick={() => void knock(knockerName)}
              disabled={knockCooldown}
              className="vcr-btn inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm disabled:opacity-50"
            >
              <BellRing className="h-4 w-4 text-vcr-gold" />
              {knockCooldown ? 'Rang — waiting…' : isCaller ? 'Ring student' : 'Ring teacher'}
            </button>
          )}
        </>
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
        isHost={isCaller && !observer}
        live={status === 'connected' || status === 'reconnecting'}
        studentId={studentId}
        teacherId={teacherId}
        getStreams={getStreams}
        autoRecord={autoRecord}
        onRecorded={markRecorded}
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

      {busy && !live && (
        <span className="text-xs text-amber-200">This call is already full (three people).</span>
      )}

      {status !== 'failed' && error && (
        <span className="text-xs text-amber-200">{error}</span>
      )}
    </div>
  );
}
