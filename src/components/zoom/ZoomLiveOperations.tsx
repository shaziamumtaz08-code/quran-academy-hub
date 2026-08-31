import React from 'react';
import { differenceInSeconds } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ExternalLink, Power, Users, Radio, Clock } from 'lucide-react';
import {
  useZoomLicenses,
  useLiveSessionsMonitor,
  useEndSessionMutation,
  useZoomLiveRealtime,
  useTodayScheduledClasses,
  useTodaySessions,
  type TodayClass,
} from '@/hooks/useZoomLiveOps';
import { useZoomRealtimeEvents } from '@/hooks/useZoomRealtimeEvents';
import {
  useAcademyTimezone,
  zonedParts,
  zonedClockLabel,
  zonedDateLabel,
} from '@/hooks/useAcademyTimezone';
import { getTimezoneAbbr } from '@/lib/timezones';
import { parseZoomLink } from '@/lib/zoomLink';
import { ZoomSdkMeeting } from '@/components/classroom/ZoomSdkMeeting';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';

type SlotState = 'live' | 'completed' | 'overdue' | 'upcoming';
type TileFilter = 'all' | 'live' | 'upcoming' | 'completed' | 'overdue';

interface DerivedSlot extends TodayClass {
  state: SlotState;
  session?: any;
}

const DAY_START = 6 * 60;
const DAY_END = 23 * 60;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

/** Timeline block colours drawn from the workspace palette (no rainbow). */
const STATE_COLOR: Record<SlotState, string> = {
  completed: 'hsl(var(--zw-sage))',
  live: 'hsl(var(--zw-live))',
  overdue: 'hsl(var(--zw-warn))',
  upcoming: 'hsl(var(--zw-ink-3) / 0.45)',
};

export function ZoomLiveOperations() {
  const [now, setNow] = React.useState(new Date());
  const [filter, setFilter] = React.useState<TileFilter>('all');
  const [recordingLinks, setRecordingLinks] = React.useState<Record<string, string>>({});
  const { user, profile } = useAuth() as any;
  // In-app player state for the admin "Join class" action.
  const [sdkJoin, setSdkJoin] = React.useState<
    | {
        sessionId: string;
        teacherName: string;
        zoomAccountId: string;
        meetingNumber: string;
        passcode: string;
        joinUrl: string;
      }
    | null
   >(null);
  const [sdkFailed, setSdkFailed] = React.useState<string | null>(null);

  const openExternally = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  const handleJoin = (session: any, joinUrl: string) => {
    const parsed = session.zoom_account_id ? parseZoomLink(joinUrl) : null;
    if (session.zoom_account_id && parsed) {
      setSdkFailed(null);
      setSdkJoin({
        sessionId: session.id,
        teacherName: session.teacherName,
        zoomAccountId: session.zoom_account_id,
        meetingNumber: parsed.meetingNumber,
        passcode: parsed.passcode,
        joinUrl,
      });
      return;
    }
    openExternally(joinUrl);
  };

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useZoomLiveRealtime('zoom-live-operations');
  useZoomRealtimeEvents({ showToasts: true });

  const { data: licenses } = useZoomLicenses();
  const { data: liveSessions, isLoading: liveLoading } = useLiveSessionsMonitor();
  const timeZone = useAcademyTimezone();
  const { data: todayClasses, isLoading: classesLoading } = useTodayScheduledClasses(undefined, timeZone);
  const { data: todaySessions } = useTodaySessions(timeZone);

  const endSession = useEndSessionMutation((sessionId) =>
    setRecordingLinks((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    }),
  );

  // Scheduled slot times are stored as wall-clock times in the academy timezone,
  // so "now" must be resolved in that same timezone (never the browser's local clock).
  const nowMinutes = zonedParts(now, timeZone).minutesOfDay;

  const slots: DerivedSlot[] = React.useMemo(() => {
    const sessions = todaySessions || [];
    return (todayClasses || []).map((c) => {
      const session =
        sessions.find((s) => s.schedule_id === c.scheduleId) ||
        sessions.find((s) => s.assignment_id === c.assignmentId);

      let state: SlotState = 'upcoming';
      if (session?.status === 'live') state = 'live';
      else if (session?.status === 'completed') state = 'completed';
      else if (!session && nowMinutes - c.startMinutes > 5) state = 'overdue';

      return { ...c, state, session };
    });
  }, [todayClasses, todaySessions, nowMinutes]);

  // A live session that isn't linked to a scheduled slot (e.g. a teacher started
  // their dedicated Zoom room directly) must still be counted as "in progress",
  // otherwise the tile reads 0 while the On air panel shows the class.
  const unlinkedLive = React.useMemo(() => {
    const linkedIds = new Set(slots.map((s) => s.session?.id).filter(Boolean));
    return (liveSessions || []).filter((s: any) => !linkedIds.has(s.id));
  }, [slots, liveSessions]);

  const counts = React.useMemo(
    () => ({
      live: slots.filter((s) => s.state === 'live').length + unlinkedLive.length,
      upcoming: slots.filter((s) => s.state === 'upcoming').length,
      completed: slots.filter((s) => s.state === 'completed').length,
      overdue: slots.filter((s) => s.state === 'overdue').length,
    }),
    [slots, unlinkedLive],
  );

  const liveNow = liveSessions?.length || 0;
  const totalLicenses = licenses?.length || 0;
  const busyLicenses = licenses?.filter((l) => l.status !== 'available').length || 0;

  const upNext = React.useMemo(() => {
    const rows = slots.filter((s) => s.state === 'upcoming' || s.state === 'overdue');
    const filtered =
      filter === 'all' || filter === 'live' || filter === 'completed'
        ? rows
        : rows.filter((r) => r.state === filter);
    return filtered.sort((a, b) => {
      if (a.state !== b.state) return a.state === 'overdue' ? -1 : 1;
      return a.startMinutes - b.startMinutes;
    });
  }, [slots, filter]);

  const showOnAir = filter === 'all' || filter === 'live';
  const showUpNext = filter !== 'live' && filter !== 'completed';

  const tiles: { key: TileFilter; label: string; value: number; tone: string }[] = [
    { key: 'live', label: 'In progress', value: counts.live, tone: 'live' },
    { key: 'upcoming', label: 'Still to go', value: counts.upcoming, tone: 'quiet' },
    { key: 'completed', label: 'Completed', value: counts.completed, tone: 'sage' },
    { key: 'overdue', label: 'Needs attention', value: counts.overdue, tone: 'warn' },
  ];

  const formatElapsed = (start: string | null) => {
    if (!start) return '00:00';
    const sec = Math.max(0, differenceInSeconds(now, new Date(start)));
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  };

  if (liveLoading || classesLoading) {
    return (
      <div className="zoom-ws space-y-4">
        <Skeleton className="h-24 w-full rounded-[18px]" />
        <Skeleton className="h-28 w-full rounded-[18px]" />
        <Skeleton className="h-56 w-full rounded-[18px]" />
      </div>
    );
  }

  const renderSession = (session: any, featured: boolean) => {
    const license = session.license as any;
    const joinUrl: string | null = session.joinUrl || license?.meeting_link || null;
    const elapsedSec = session.actual_start
      ? Math.max(0, differenceInSeconds(now, new Date(session.actual_start)))
      : 0;
    const expectedMin = slots.find((s) => s.session?.id === session.id)?.durationMinutes || 30;
    const pct = Math.min(100, (elapsedSec / (expectedMin * 60)) * 100);
    const overrun = elapsedSec > expectedMin * 60;
    const tone = overrun ? 'warn' : 'live';

    return (
      <div key={session.id} className="zw-session" data-tone={tone} data-featured={featured}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn('zw-avatar', featured && 'zw-avatar-lg')}>{initials(session.teacherName)}</div>
            <div className="min-w-0">
              <p className={cn('truncate font-semibold', featured ? 'text-base' : 'text-sm')}>
                {session.teacherName}
              </p>
              <p className="zw-meta truncate">
                {slots.find((s) => s.session?.id === session.id)?.subjectName || 'Class'} ·{' '}
                {session.studentName || 'Group session'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="zw-chip" data-tone="quiet">
                  <Users className="h-3 w-3" />
                  {session.activeCount}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {session.participants.map((p: any) => (
                  <p key={p.userId} className="text-xs">
                    {p.userName}
                    {p.isTeacher ? ' (teacher)' : ''}
                  </p>
                ))}
              </TooltipContent>
            </Tooltip>
            <span className="zw-chip" data-tone={overrun ? 'warn' : 'live'}>
              <span className="zw-dot" />
              {overrun ? 'Overrunning' : 'On air'}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="zw-eyebrow">Elapsed</span>
            <span className="text-sm font-semibold tabular-nums">
              {formatElapsed(session.actual_start)} <span className="zw-meta">/ {expectedMin}:00</span>
            </span>
          </div>
          <div className="zw-bar mt-2" data-tone={overrun ? 'warn' : 'live'}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <button
                  type="button"
                  className="zw-btn-primary"
                  disabled={!joinUrl}
                  onClick={() => joinUrl && handleJoin(session, joinUrl)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Join class
                </button>
              </span>
            </TooltipTrigger>
            {!joinUrl && (
              <TooltipContent className="max-w-xs text-xs">
                No meeting link on file for this teacher. Add one on their Zoom profile or assign a licence.
              </TooltipContent>
            )}
          </Tooltip>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" className="zw-btn-secondary">
                <Power className="h-3.5 w-3.5" />
                End
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End this session?</AlertDialogTitle>
                <AlertDialogDescription>
                  {session.teacherName}'s session will be marked completed and the Zoom licence released.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor={`rec-${session.id}`} className="text-xs">
                  Recording link (optional)
                </Label>
                <Input
                  id={`rec-${session.id}`}
                  placeholder="https://…"
                  value={recordingLinks[session.id] || ''}
                  onChange={(e) => setRecordingLinks((prev) => ({ ...prev, [session.id]: e.target.value }))}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    endSession.mutate({
                      sessionId: session.id,
                      licenseId: license?.id,
                      recordingLink: recordingLinks[session.id],
                    })
                  }
                >
                  End session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  };

  const [featuredSession, ...otherSessions] = (liveSessions || []) as any[];

  return (
    <TooltipProvider>
      <div className="zoom-ws animate-fade-in space-y-7">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="zw-eyebrow">Operations</p>
            <h2 className="zw-display mt-2">Live today</h2>
            <p className="zw-body mt-1">
              {zonedDateLabel(timeZone, now)} · {slots.length} {slots.length === 1 ? 'class' : 'classes'} scheduled
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="zw-meta inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="h-3.5 w-3.5" />
              {zonedClockLabel(timeZone, now)} {getTimezoneAbbr(timeZone)}
            </span>
            <span className="zw-chip" data-tone={liveNow > 0 ? 'live' : 'quiet'}>
              <span className="zw-dot" />
              {liveNow} live now
            </span>
          </div>
        </div>

        {/* Status rail */}
        <div className="zw-rail">
          {tiles.map((tile) => {
            const active = filter === tile.key;
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => setFilter(active ? 'all' : tile.key)}
                className="zw-rail-seg"
                data-active={active}
              >
                <p className="zw-eyebrow">{tile.label}</p>
                <p className="zw-rail-value mt-2">{tile.value}</p>
                <span className="zw-metric-rule mt-3 block" data-tone={tile.tone} />
              </button>
            );
          })}
        </div>

        {/* Day timeline */}
        <section className="zw-card zw-card-flush">
          <div className="flex items-center justify-between">
            <p className="zw-eyebrow">Today's timeline</p>
            <p className="zw-meta tabular-nums">6:00 AM — 11:00 PM</p>
          </div>
          <div className="zw-timeline mt-3">
            {slots.map((slot) => {
              const left = ((slot.startMinutes - DAY_START) / (DAY_END - DAY_START)) * 100;
              const width = (slot.durationMinutes / (DAY_END - DAY_START)) * 100;
              if (left > 100 || left + width < 0) return null;
              return (
                <Tooltip key={slot.scheduleId}>
                  <TooltipTrigger asChild>
                    <div
                      className="zw-timeline-block"
                      style={{
                        left: `${Math.max(0, left)}%`,
                        width: `${Math.max(0.8, width)}%`,
                        background: STATE_COLOR[slot.state],
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-semibold">{slot.teacherName}</p>
                    <p className="text-xs">{slot.studentName}</p>
                    <p className="text-[11px] opacity-70">
                      {slot.subjectName || 'Class'} · {slot.startLabel}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {nowMinutes >= DAY_START && nowMinutes <= DAY_END && (
              <div
                className="absolute inset-y-0 w-px"
                style={{
                  left: `${((nowMinutes - DAY_START) / (DAY_END - DAY_START)) * 100}%`,
                  background: 'hsl(var(--zw-ink))',
                }}
              >
                <span
                  className="absolute -top-0.5 left-1 whitespace-nowrap rounded px-1 text-[9px] font-semibold tabular-nums"
                  style={{ background: 'hsl(var(--zw-ink))', color: 'hsl(var(--zw-surface))' }}
                >
                  {zonedClockLabel(timeZone, now)}
                </span>
              </div>
            )}
          </div>
          <div className="zw-meta mt-3 flex flex-wrap items-center gap-4">
            {([
              ['completed', 'Completed'],
              ['live', 'Live'],
              ['upcoming', 'Upcoming'],
              ['overdue', 'Overdue'],
            ] as [SlotState, string][]).map(([state, label]) => (
              <span key={state} className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded-full" style={{ background: STATE_COLOR[state] }} />
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* On air */}
        {showOnAir && (
          <section className="space-y-3">
            <p className="zw-eyebrow flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5" /> On air
            </p>
            {featuredSession ? (
              <div className="space-y-3">
                {renderSession(featuredSession, true)}
                {otherSessions.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {otherSessions.map((s) => renderSession(s, false))}
                  </div>
                )}
              </div>
            ) : (
              <div className="zw-card zw-card-flush flex flex-col items-center gap-3 py-10 text-center">
                <div className="zw-motif" />
                <p className="zw-body">No classes running right now.</p>
              </div>
            )}
          </section>
        )}

        {/* Up next */}
        {showUpNext && (
          <section className="space-y-3">
            <p className="zw-eyebrow">Up next</p>
            {upNext.length === 0 ? (
              <p className="zw-body">Nothing else scheduled for today.</p>
            ) : (
              <div className="zw-card overflow-hidden">
                {upNext.map((slot) => {
                  const minsAway = slot.startMinutes - nowMinutes;
                  const overdue = slot.state === 'overdue';
                  const soon = !overdue && minsAway <= 10;
                  return (
                    <div key={slot.scheduleId} className="zw-row" data-tone={overdue ? 'warn' : undefined}>
                      <div className="flex min-w-0 items-center gap-4">
                        <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{slot.startLabel}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {slot.teacherName} → {slot.studentName}
                          </p>
                          <p className="zw-meta truncate">
                            {slot.subjectName || 'Class'} · {slot.durationMinutes} min
                          </p>
                        </div>
                      </div>
                      <span className="zw-chip shrink-0" data-tone={overdue ? 'warn' : soon ? 'brass' : 'quiet'}>
                        <span className="zw-dot" />
                        {overdue
                          ? `${nowMinutes - slot.startMinutes} min late`
                          : soon
                            ? 'Starting soon'
                            : `in ${minsAway} min`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Room capacity */}
        <div className="zw-card flex items-center gap-4 px-5 py-4">
          <p className="zw-eyebrow shrink-0">Rooms</p>
          <div className="flex flex-1 gap-1">
            {(licenses || []).map((l) => (
              <Tooltip key={l.id}>
                <TooltipTrigger asChild>
                  <span
                    className="h-2 flex-1 rounded-full"
                    style={{
                      background:
                        l.status === 'available' ? 'hsl(var(--zw-sage) / 0.55)' : 'hsl(var(--zw-live) / 0.6)',
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{l.zoom_email}</p>
                  <p className="text-[11px] opacity-70">{l.status}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <span className="zw-meta shrink-0 tabular-nums">
            {busyLicenses} of {totalLicenses} in use
          </span>
        </div>

        {/* In-app Zoom player (admin joins as attendee; teacher stays host) */}
        <Dialog
          open={!!sdkJoin}
          onOpenChange={(o) => {
            if (!o) {
              setSdkJoin(null);
              setSdkFailed(null);
            }
          }}
        >
          <DialogContent
            className="max-w-4xl"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{sdkJoin ? `${sdkJoin.teacherName}'s class` : 'Class'}</DialogTitle>
            </DialogHeader>
            {sdkJoin && !sdkFailed && (
              <ZoomSdkMeeting
                zoomAccountId={sdkJoin.zoomAccountId}
                meetingNumber={sdkJoin.meetingNumber}
                passcode={sdkJoin.passcode}
                userName={profile?.full_name || user?.email || 'Admin'}
                userEmail={user?.email || undefined}
                role={0}
                height={580}
                onFailure={(msg) => setSdkFailed(msg || 'The in-app player could not start')}
              />
            )}
            {sdkJoin && sdkFailed && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="max-w-md text-sm text-muted-foreground">
                  The built-in Zoom player couldn't start ({sdkFailed}). You can join this class in the Zoom app instead.
                </p>
                <a
                  href={sdkJoin.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Open class in Zoom
                </a>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>

  );
}

export default ZoomLiveOperations;
