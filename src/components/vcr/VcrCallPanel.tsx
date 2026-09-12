import React from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, RotateCcw, AlertTriangle, BellRing, X, Eye, Video, VideoOff } from 'lucide-react';
import { useVcrCall, type CallStatus } from '@/hooks/useVcrCall';
import { useVcrCallLog } from '@/hooks/useVcrCallLog';
import { useVcrRingHost, useVcrRingListener, useVcrKnockSender, useVcrKnockListener } from '@/hooks/useVcrRing';
import { VcrCallRecorder } from '@/components/vcr/VcrCallRecorder';
import { VcrVideoTiles } from '@/components/vcr/VcrVideoTiles';
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
  /** Personal rooms (user ids) of the other participants — they get alerted anywhere in the app. */
  notifyRooms?: string[];
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
  idle: 'bg-white/40',
  connecting: 'bg-amber-300 animate-pulse',
  connected: 'bg-emerald-400',
  reconnecting: 'bg-amber-300 animate-pulse',
  failed: 'bg-red-400',
  ended: 'bg-white/40',
};

const mmss = (secs: number) => {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** One compact, clearly readable control. */
const btn =
  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors';

/**
 * Audio and video call controls for the classroom, kept to a single slim line
 * so the lesson itself keeps the screen. Fully separate from the Zoom flow.
 */
export function VcrCallPanel({ roomId, peerId, isCaller, role = 'participant', autoRecord = false, callerName, knockerName, studentId = null, teacherId = null, displayName = 'Participant', observer = false, notifyRooms = [] }: Props) {
  const { status, muted, speaking, error, busy, peers, remoteJoined, remotePeerId, start, end, toggleMute, retry, getStreams,
    cameraOn, localVideo, remoteVideos, toggleCamera } = useVcrCall({ roomId, peerId, displayName, observer });
  const live = status === 'connecting' || status === 'connected' || status === 'reconnecting';

  /* Log every call — recorded or not. */
  const { markRecorded } = useVcrCallLog({
    roomId, studentId, selfId: peerId, role: observer ? `${role} (observer)` : role,
    status, remoteJoined, remotePeerId, observer,
  });

  /* Announce / observe the call — either side may be the one on the line. */
  useVcrRingHost(roomId, live && !observer, callerName, notifyRooms);
  /**
   * Who is actually on the call is read from the room's shared record, not from
   * a local flag fed by broadcasts: each person writes only their own entry and
   * clears it when they hang up, so one side ending a call can never leave the
   * other side showing a stale "is on the call" badge.
   */
  const { others, someoneElseOnCall } = useVcrCallPresence(
    studentId ?? roomId,
    peerId,
    live && !observer,
    displayName,
    observer ? `${role} (observer)` : role,
  );
  const ringing = someoneElseOnCall;
  const onCallName = others[0]?.name ?? (isCaller ? 'The student' : 'Your teacher');


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

  /* Video stays tucked away until there is something to see — then it opens by
     itself, so nobody has to hunt for the other person's camera. */
  const [showVideo, setShowVideo] = React.useState(false);
  const videoCount = (localVideo ? 1 : 0) + remoteVideos.length;
  const hasVideo = videoCount > 0;
  React.useEffect(() => {
    if (hasVideo) setShowVideo(true);
  }, [hasVideo]);
  React.useEffect(() => {
    if (!live) setShowVideo(false);
  }, [live]);


  const label =
    status === 'connecting' && !remoteJoined
      ? 'Waiting for the other person…'
      : STATUS_LABEL[status];

  return (
    <div className="flex w-full flex-col gap-2">
      {/* One slim line: state, who is talking, and the controls */}
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-2 text-[13px] font-medium text-white" role="status" aria-live="polite">
          <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_DOT[status])} aria-hidden />
          {label}
        </span>

        {(status === 'connected' || status === 'reconnecting') && (
          <span className="font-mono text-xs tabular-nums text-emerald-200">{mmss(duration)}</span>
        )}

        {live && peers.map((p) => (
          <span
            key={p.id}
            className={cn(
              'inline-flex items-center gap-1 text-xs',
              p.speaking && !p.muted ? 'text-emerald-300' : 'text-white/70',
            )}
            title={p.muted ? `${p.name}'s microphone is off` : `${p.name} is on the call`}
          >
            {p.muted ? <MicOff className="h-3.5 w-3.5 text-amber-300" aria-hidden /> : <Mic className="h-3.5 w-3.5" aria-hidden />}
            {p.observer && <Eye className="h-3 w-3 text-vcr-gold" aria-hidden />}
            <span className="max-w-[8rem] truncate">{p.name}</span>
          </span>
        ))}

        {ringing && !live && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-300" aria-hidden />
            {isCaller ? 'The student is on the call' : 'Your teacher is on the call'}
          </span>
        )}

        {knocking && !live && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-vcr-gold">
            <BellRing className="h-3.5 w-3.5 animate-pulse" aria-hidden />
            {knocking} is ringing you
            <button type="button" aria-label="Dismiss" onClick={dismissKnock} className="opacity-70 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {!live ? (
            <>
              <button
                type="button"
                onClick={() => void start()}
                className={cn(btn, ringing ? 'bg-emerald-400 text-[#06231C] hover:bg-emerald-300' : 'bg-vcr-gold text-[#0C1B1E] hover:brightness-110')}
              >
                <PhoneCall className="h-4 w-4" />
                {observer ? (ringing ? 'Sit in on the call' : 'Sit in') : ringing ? 'Join call' : 'Start call'}
              </button>
              {!ringing && !observer && (
                <button
                  type="button"
                  onClick={() => void knock(knockerName, notifyRooms)}
                  disabled={knockCooldown}
                  className={cn(btn, 'bg-white/15 text-white hover:bg-white/25 disabled:opacity-50')}
                >
                  <BellRing className="h-4 w-4 text-vcr-gold" />
                  {knockCooldown ? 'Ringing…' : isCaller ? 'Ring student' : 'Ring teacher'}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                aria-pressed={muted}
                className={cn(btn, muted ? 'bg-amber-400 text-[#2A1C00] hover:bg-amber-300' : 'bg-white/15 text-white hover:bg-white/25')}
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className={cn('h-4 w-4', speaking && 'text-emerald-300')} />}
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                onClick={() => { void toggleCamera(); setShowVideo(true); }}
                aria-pressed={cameraOn}
                className={cn(btn, cameraOn ? 'bg-emerald-400 text-[#06231C] hover:bg-emerald-300' : 'bg-white/15 text-white hover:bg-white/25')}
              >
                {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                {cameraOn ? 'Camera on' : 'Camera'}
              </button>
              <button
                type="button"
                onClick={() => setShowVideo((v) => !v)}
                aria-pressed={showVideo}
                className={cn(btn, 'bg-white/15 text-white hover:bg-white/25')}
              >
                {showVideo ? 'Hide video' : `Show video${videoCount ? ` (${videoCount})` : ''}`}
              </button>

              <button
                type="button"
                onClick={end}
                className={cn(btn, 'bg-red-500 text-white hover:bg-red-400')}
              >
                <PhoneOff className="h-4 w-4" /> End
              </button>
            </>
          )}
        </div>
      </div>

      {live && showVideo && (
        <div className="w-full max-w-2xl rounded-xl bg-black/20 p-1.5">
          <VcrVideoTiles
            localStream={localVideo}
            localName={displayName}
            remotes={remoteVideos}
            /* Everyone sees their own picture, exactly like the other side does. */
            alwaysShowSelf
          />
        </div>
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
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void retry()} className={cn(btn, 'bg-white/15 text-white hover:bg-white/25')}>
            <RotateCcw className="h-4 w-4 text-vcr-gold" /> Try again
          </button>
          <span className="inline-flex items-start gap-1.5 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {error ?? 'The call could not connect. Please use the Zoom link instead.'}
          </span>
        </div>
      )}

      {busy && !live && <span className="text-xs text-amber-200">This call is already full (three people).</span>}
      {status !== 'failed' && error && <span className="text-xs text-amber-200">{error}</span>}
    </div>
  );
}
