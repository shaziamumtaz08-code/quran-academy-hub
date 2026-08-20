import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PhoneCall, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVcrRingListener } from '@/hooks/useVcrRing';

/**
 * App-wide banner telling a student that their teacher has a live class call
 * waiting. Only rendered for students, and hidden once they are in the room.
 */
export function IncomingCallAlert() {
  const { user, activeRole, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = React.useState(false);

  const roles: string[] = (profile as any)?.roles || (activeRole ? [activeRole] : []);
  const isStudent = roles.includes('student') && !roles.some((r) => r !== 'student' && r !== 'parent');
  const inRoom = location.pathname.startsWith(`/vcr/${user?.id ?? ''}`);

  const { ringing, callerName } = useVcrRingListener(user?.id, isStudent && !inRoom);

  React.useEffect(() => {
    if (!ringing) setDismissed(false);
  }, [ringing]);

  if (!ringing || dismissed || inRoom || !user?.id) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-600 px-4 py-3 text-primary-foreground shadow-2xl">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/25" aria-hidden />
          <PhoneCall className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Class call in progress</p>
          <p className="truncate text-xs opacity-90">{callerName} is waiting in your Virtual Class Room.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/vcr/${user.id}`)}
          className="rounded-lg bg-white/20 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/30"
        >
          Join
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="rounded-lg p-2 opacity-80 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
