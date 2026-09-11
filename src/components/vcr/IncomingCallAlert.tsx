import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PhoneCall, BellRing, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVcrRingListener, useVcrKnockListener } from '@/hooks/useVcrRing';
import { playPingChime } from '@/lib/pingChime';

/**
 * App-wide banner telling anyone (student, parent, teacher, admin) that a
 * class call is waiting for them, or that someone is ringing their bell.
 * Everyone listens on their own personal room (their user id); the caller
 * announces there as well as in the class room.
 */
export function IncomingCallAlert() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = React.useState(false);

  const inRoom = location.pathname.startsWith('/vcr/');

  const { ringing, callerName, sourceRoom } = useVcrRingListener(user?.id, !inRoom);
  const { knockerName, dismiss: dismissKnock, sourceRoom: knockRoom } = useVcrKnockListener(user?.id, !inRoom);

  const active = ringing || !!knockerName;
  const targetRoom = (ringing ? sourceRoom : knockRoom) || user?.id;

  React.useEffect(() => {
    if (!active) setDismissed(false);
  }, [active]);

  /* Keep chiming every few seconds while it is unanswered — one beep is easy to miss. */
  React.useEffect(() => {
    if (!active || dismissed) return;
    const t = window.setInterval(() => playPingChime(), 5000);
    return () => window.clearInterval(t);
  }, [active, dismissed]);

  if (!active || dismissed || inRoom || !user?.id || !targetRoom) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-600 px-4 py-3 text-primary-foreground shadow-2xl">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/25" aria-hidden />
          {ringing ? <PhoneCall className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{ringing ? 'Class call in progress' : 'Someone is ringing you'}</p>
          <p className="truncate text-xs opacity-90">
            {ringing
              ? `${callerName} is waiting in the Virtual Class Room.`
              : `${knockerName} would like to start a class call.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/vcr/${targetRoom}`)}
          className="rounded-lg bg-white/20 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/30"
        >
          Join
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setDismissed(true);
            dismissKnock();
          }}
          className="rounded-lg p-2 opacity-80 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
