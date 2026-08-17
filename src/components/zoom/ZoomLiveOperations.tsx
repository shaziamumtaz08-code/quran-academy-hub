import React from 'react';
import { format, differenceInSeconds } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { ExternalLink, Power, Users } from 'lucide-react';
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

type SlotState = 'live' | 'completed' | 'overdue' | 'upcoming';
type TileFilter = 'all' | 'live' | 'upcoming' | 'completed' | 'overdue';

interface DerivedSlot extends TodayClass {
  state: SlotState;
  session?: any;
}

const DAY_START = 6 * 60;
const DAY_END = 23 * 60;

/** Scoped mission-control palette — local to this view only. */
const MC_VARS = {
  '--mc-bg': '#0A0E14',
  '--mc-panel': '#0E1620',
  '--mc-border': '#1E2733',
  '--mc-text': '#E8EEF5',
  '--mc-muted': '#5C6B7F',
  '--mc-green': '#00E5A0',
  '--mc-red': '#FF3B4E',
  '--mc-amber': '#FFB020',
  '--mc-blue': '#2E82FF',
} as React.CSSProperties;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

const STATE_COLOR: Record<SlotState, string> = {
  completed: 'var(--mc-green)',
  live: 'var(--mc-red)',
  overdue: 'var(--mc-amber)',
  upcoming: 'var(--mc-blue)',
};

export function ZoomLiveOperations() {
  const [now, setNow] = React.useState(new Date());
  const [filter, setFilter] = React.useState<TileFilter>('all');
  const [recordingLinks, setRecordingLinks] = React.useState<Record<string, string>>({});

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

  const tiles: { key: TileFilter; label: string; value: number; color: string }[] = [
    { key: 'live', label: 'In progress', value: counts.live, color: 'var(--mc-red)' },
    { key: 'upcoming', label: 'Still to go', value: counts.upcoming, color: 'var(--mc-blue)' },
    { key: 'completed', label: 'Completed', value: counts.completed, color: 'var(--mc-green)' },
    { key: 'overdue', label: 'Needs attention', value: counts.overdue, color: 'var(--mc-amber)' },
  ];

  const formatElapsed = (start: string | null) => {
    if (!start) return '00:00';
    const sec = Math.max(0, differenceInSeconds(now, new Date(start)));
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  };

  if (liveLoading || classesLoading) {
    return (
      <div className="space-y-4 rounded-xl p-4" style={{ ...MC_VARS, background: 'var(--mc-bg)' }}>
        <Skeleton className="h-20 w-full rounded-xl bg-white/5" />
        <Skeleton className="h-24 w-full rounded-xl bg-white/5" />
        <Skeleton className="h-48 w-full rounded-xl bg-white/5" />
      </div>
    );
  }

  const panel = 'rounded-xl border' as const;
  const panelStyle: React.CSSProperties = {
    background: 'var(--mc-panel)',
    borderColor: 'var(--mc-border)',
    borderWidth: '0.5px',
  };

  return (
    <TooltipProvider>
      <style>{`
        @keyframes mc-pulse { 0%,100% { opacity:1; box-shadow:0 0 0 0 var(--mc-red); } 50% { opacity:.55; box-shadow:0 0 10px 3px var(--mc-red); } }
        .mc-scope :focus-visible { outline: 2px solid var(--mc-green); outline-offset: 2px; }
      `}</style>
      <div
        className="mc-scope animate-fade-in space-y-6 rounded-2xl p-4 sm:p-6"
        style={{ ...MC_VARS, background: 'var(--mc-bg)', color: 'var(--mc-text)' }}
      >
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-mono text-xl font-bold uppercase tracking-widest sm:text-2xl" style={{ color: 'var(--mc-text)' }}>
              Live operations
            </h2>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--mc-muted)' }}>
              {zonedDateLabel(timeZone, now)} · {slots.length} {slots.length === 1 ? 'class' : 'classes'} scheduled today
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start sm:flex-col sm:items-end">
            <span className="font-mono text-lg font-bold tabular-nums sm:text-xl" style={{ color: 'var(--mc-green)' }}>
              Now {zonedClockLabel(timeZone, now)} · {getTimezoneAbbr(timeZone)}
            </span>
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ border: '0.5px solid var(--mc-red)', background: 'rgba(255,59,78,0.1)' }}
            >
              <span
                className="inline-flex h-2 w-2 rounded-full"
                style={{
                  background: liveNow > 0 ? 'var(--mc-red)' : 'var(--mc-muted)',
                  animation: liveNow > 0 ? 'mc-pulse 1.6s ease-in-out infinite' : undefined,
                }}
              />
              <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: 'var(--mc-red)' }}>
                {liveNow} LIVE NOW
              </span>
            </div>
          </div>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile) => {
            const active = filter === tile.key;
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => setFilter(active ? 'all' : tile.key)}
                className="rounded-xl p-4 text-left transition-opacity hover:opacity-90"
                style={{
                  ...panelStyle,
                  borderStyle: 'solid',
                  borderLeft: `2px solid ${tile.color}`,
                  boxShadow: active ? `0 0 0 1px ${tile.color}` : undefined,
                }}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--mc-muted)' }}>
                  {tile.label}
                </p>
                <p className="mt-1 font-mono text-3xl font-bold tabular-nums" style={{ color: tile.color }}>
                  {tile.value}
                </p>
              </button>
            );
          })}
        </div>

        {/* Day timeline */}
        <div className={cn(panel, 'p-4')} style={panelStyle}>
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--mc-muted)' }}>
            <span>6:00 AM</span>
            <span>Today's timeline</span>
            <span>11:00 PM</span>
          </div>
          <div className="relative h-8 w-full overflow-hidden rounded-md" style={{ background: '#070A0F' }}>
            {slots.map((slot) => {
              const left = ((slot.startMinutes - DAY_START) / (DAY_END - DAY_START)) * 100;
              const width = (slot.durationMinutes / (DAY_END - DAY_START)) * 100;
              if (left > 100 || left + width < 0) return null;
              return (
                <Tooltip key={slot.scheduleId}>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute top-1 h-6 rounded-sm"
                      style={{
                        left: `${Math.max(0, left)}%`,
                        width: `${Math.max(0.8, width)}%`,
                        background: STATE_COLOR[slot.state],
                        boxShadow: slot.state === 'live' ? `0 0 8px 1px ${STATE_COLOR.live}` : undefined,
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    className="font-mono"
                    style={{ background: 'var(--mc-panel)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }}
                  >
                    <p className="text-xs font-semibold">{slot.teacherName}</p>
                    <p className="text-xs">{slot.studentName}</p>
                    <p className="text-[11px]" style={{ color: 'var(--mc-muted)' }}>
                      {slot.subjectName || 'Class'} · {slot.startLabel}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {nowMinutes >= DAY_START && nowMinutes <= DAY_END && (
              <div
                className="absolute inset-y-0 w-0.5"
                style={{
                  left: `${((nowMinutes - DAY_START) / (DAY_END - DAY_START)) * 100}%`,
                  background: 'var(--mc-text)',
                  boxShadow: '0 0 6px 1px rgba(232,238,245,0.6)',
                }}
              >
                <span
                  className="absolute -top-0.5 left-1 whitespace-nowrap rounded px-1 font-mono text-[9px] font-medium"
                  style={{ background: 'var(--mc-text)', color: 'var(--mc-bg)' }}
                >
                  {zonedClockLabel(timeZone, now)}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--mc-muted)' }}>
            {([
              ['completed', 'Completed'],
              ['live', 'Live'],
              ['upcoming', 'Upcoming'],
              ['overdue', 'Overdue'],
            ] as [SlotState, string][]).map(([state, label]) => (
              <span key={state} className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm" style={{ background: STATE_COLOR[state] }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* On air */}
        {showOnAir && (
          <section className="space-y-3">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--mc-muted)' }}>
              On air
            </h3>
            {liveSessions && liveSessions.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {liveSessions.map((session: any) => {
                  const license = session.license as any;
                  const elapsedSec = session.actual_start
                    ? Math.max(0, differenceInSeconds(now, new Date(session.actual_start)))
                    : 0;
                  const expectedMin =
                    slots.find((s) => s.session?.id === session.id)?.durationMinutes || 30;
                  const pct = Math.min(100, (elapsedSec / (expectedMin * 60)) * 100);
                  const overrun = elapsedSec > expectedMin * 60;
                  const statusColor = overrun ? 'var(--mc-amber)' : 'var(--mc-red)';

                  return (
                    <div
                      key={session.id}
                      className="rounded-xl p-4"
                      style={{ background: 'var(--mc-panel)', border: `1px solid ${statusColor}` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-11 w-11 items-center justify-center rounded-full font-mono text-sm font-bold"
                            style={{ background: 'rgba(46,130,255,0.15)', color: 'var(--mc-blue)' }}
                          >
                            {initials(session.teacherName)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: 'var(--mc-text)' }}>
                              {session.teacherName}
                            </p>
                            <p className="font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--mc-muted)' }}>
                              {slots.find((s) => s.session?.id === session.id)?.subjectName || 'Class'} ·{' '}
                              {session.studentName || 'Group session'}
                            </p>
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="flex items-center gap-1 rounded-full px-2 py-1 font-mono text-xs font-medium tabular-nums"
                              style={{ background: 'rgba(232,238,245,0.08)', color: 'var(--mc-text)' }}
                            >
                              <Users className="h-3 w-3" />
                              {session.activeCount}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            className="font-mono"
                            style={{ background: 'var(--mc-panel)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }}
                          >
                            {session.participants.map((p: any) => (
                              <p key={p.userId} className="text-xs">
                                {p.userName}
                                {p.isTeacher ? ' (teacher)' : ''}
                              </p>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="mt-3">
                        <p className="font-mono text-sm tabular-nums" style={{ color: statusColor }}>
                          {formatElapsed(session.actual_start)} / {expectedMin}:00
                        </p>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full" style={{ background: 'rgba(232,238,245,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: statusColor }} />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                size="sm"
                                className="gap-1 border-0 font-mono text-xs font-semibold uppercase tracking-wider hover:opacity-90"
                                style={{ background: 'var(--mc-green)', color: '#04140E' }}
                                disabled={!joinUrl}
                                onClick={() => joinUrl && window.open(joinUrl, '_blank', 'noopener,noreferrer')}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Join
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!joinUrl && (
                            <TooltipContent
                              className="font-mono text-xs"
                              style={{ background: 'var(--mc-panel)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }}
                            >
                              No meeting link on file for this teacher. Add one on their Zoom profile
                              or assign a licence.
                            </TooltipContent>
                          )}
                        </Tooltip>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 bg-transparent font-mono text-xs font-semibold uppercase tracking-wider hover:bg-transparent hover:opacity-80"
                              style={{ borderColor: 'var(--mc-red)', color: 'var(--mc-red)' }}
                            >
                              <Power className="h-3.5 w-3.5" />
                              End
                            </Button>
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
                                onChange={(e) =>
                                  setRecordingLinks((prev) => ({ ...prev, [session.id]: e.target.value }))
                                }
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
                })}
              </div>
            ) : (
              <p className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--mc-muted)' }}>
                No classes running right now.
              </p>
            )}
          </section>
        )}

        {/* Up next */}
        {showUpNext && (
          <section className="space-y-2">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--mc-muted)' }}>
              Up next
            </h3>
            {upNext.length === 0 ? (
              <p className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--mc-muted)' }}>
                Nothing else scheduled for today.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl" style={panelStyle}>
                {upNext.map((slot, idx) => {
                  const minsAway = slot.startMinutes - nowMinutes;
                  const overdue = slot.state === 'overdue';
                  const soon = !overdue && minsAway <= 10;
                  return (
                    <div
                      key={slot.scheduleId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                      style={{
                        background: overdue ? 'rgba(255,176,32,0.07)' : 'transparent',
                        borderTop: idx === 0 ? undefined : '0.5px solid var(--mc-border)',
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-mono text-xs tabular-nums" style={{ color: 'var(--mc-text)' }}>
                          {slot.startLabel}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium" style={{ color: 'var(--mc-text)' }}>
                            {slot.teacherName} → {slot.studentName}
                          </p>
                          <p
                            className="truncate font-mono text-[11px] uppercase tracking-wider"
                            style={{ color: 'var(--mc-muted)' }}
                          >
                            {slot.subjectName || 'Class'} · {slot.durationMinutes} min
                          </p>
                        </div>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider"
                        style={
                          overdue
                            ? { background: 'var(--mc-amber)', color: '#1A1000' }
                            : soon
                              ? { border: '1px solid var(--mc-green)', color: 'var(--mc-green)' }
                              : { border: '1px solid var(--mc-border)', color: 'var(--mc-muted)' }
                        }
                      >
                        {overdue
                          ? `${nowMinutes - slot.startMinutes} min late`
                          : soon
                            ? 'starting soon'
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
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={panelStyle}>
          <div className="flex flex-1 gap-1">
            {(licenses || []).map((l) => (
              <Tooltip key={l.id}>
                <TooltipTrigger asChild>
                  <span
                    className="h-2 flex-1 rounded-full"
                    style={{ background: l.status === 'available' ? 'var(--mc-green)' : 'var(--mc-red)' }}
                  />
                </TooltipTrigger>
                <TooltipContent
                  className="font-mono"
                  style={{ background: 'var(--mc-panel)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }}
                >
                  <p className="text-xs">{l.zoom_email}</p>
                  <p className="text-[11px]" style={{ color: 'var(--mc-muted)' }}>
                    {l.status}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider tabular-nums" style={{ color: 'var(--mc-muted)' }}>
            {busyLicenses} of {totalLicenses} in use
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default ZoomLiveOperations;
