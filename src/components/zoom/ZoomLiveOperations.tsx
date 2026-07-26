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

const STATE_BAR: Record<SlotState, string> = {
  completed: 'bg-emerald-500',
  live: 'bg-destructive',
  overdue: 'bg-amber-500',
  upcoming: 'bg-muted-foreground/30',
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
  const { data: todayClasses, isLoading: classesLoading } = useTodayScheduledClasses();
  const { data: todaySessions } = useTodaySessions();

  const endSession = useEndSessionMutation((sessionId) =>
    setRecordingLinks((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    }),
  );

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

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

  const counts = React.useMemo(
    () => ({
      live: slots.filter((s) => s.state === 'live').length,
      upcoming: slots.filter((s) => s.state === 'upcoming').length,
      completed: slots.filter((s) => s.state === 'completed').length,
      overdue: slots.filter((s) => s.state === 'overdue').length,
    }),
    [slots],
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

  const tiles: { key: TileFilter; label: string; value: number; amber?: boolean }[] = [
    { key: 'live', label: 'In progress', value: counts.live },
    { key: 'upcoming', label: 'Still to go', value: counts.upcoming },
    { key: 'completed', label: 'Completed', value: counts.completed },
    { key: 'overdue', label: 'Needs attention', value: counts.overdue, amber: true },
  ];

  const formatElapsed = (start: string | null) => {
    if (!start) return '00:00';
    const sec = Math.max(0, differenceInSeconds(now, new Date(start)));
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  };

  if (liveLoading || classesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold text-foreground sm:text-2xl">Live operations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(now, 'EEEE, dd MMM yyyy')} · {slots.length} {slots.length === 1 ? 'class' : 'classes'} scheduled today
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              {liveNow > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              )}
              <span className={cn('relative inline-flex h-2 w-2 rounded-full', liveNow > 0 ? 'bg-destructive' : 'bg-muted-foreground')} />
            </span>
            <span className="text-sm font-semibold text-destructive">{liveNow} live now</span>
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
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors',
                  tile.amber
                    ? 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15'
                    : 'border-border bg-muted/40 hover:bg-muted',
                  active && 'ring-2 ring-primary/40',
                )}
              >
                <p className={cn('text-xs', tile.amber ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                  {tile.label}
                </p>
                <p className={cn('mt-1 text-2xl font-bold', tile.amber ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
                  {tile.value}
                </p>
              </button>
            );
          })}
        </div>

        {/* Day timeline */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>6:00 AM</span>
            <span>Today's timeline</span>
            <span>11:00 PM</span>
          </div>
          <div className="relative h-8 w-full overflow-hidden rounded-md bg-muted/50">
            {slots.map((slot) => {
              const left = ((slot.startMinutes - DAY_START) / (DAY_END - DAY_START)) * 100;
              const width = (slot.durationMinutes / (DAY_END - DAY_START)) * 100;
              if (left > 100 || left + width < 0) return null;
              return (
                <Tooltip key={slot.scheduleId}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn('absolute top-1 h-6 rounded-sm opacity-90', STATE_BAR[slot.state])}
                      style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(0.8, width)}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs font-semibold">{slot.teacherName}</p>
                    <p className="text-xs">{slot.studentName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {slot.subjectName || 'Class'} · {slot.startLabel}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {nowMinutes >= DAY_START && nowMinutes <= DAY_END && (
              <div
                className="absolute inset-y-0 w-0.5 bg-foreground"
                style={{ left: `${((nowMinutes - DAY_START) / (DAY_END - DAY_START)) * 100}%` }}
              >
                <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-foreground px-1 text-[9px] font-medium text-background">
                  {format(now, 'h:mm a')}
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            {([
              ['completed', 'Completed'],
              ['live', 'Live'],
              ['upcoming', 'Upcoming'],
              ['overdue', 'Overdue'],
            ] as [SlotState, string][]).map(([state, label]) => (
              <span key={state} className="flex items-center gap-1.5">
                <span className={cn('h-2 w-3 rounded-sm', STATE_BAR[state])} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* On air */}
        {showOnAir && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">On air</h3>
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

                  return (
                    <div key={session.id} className="rounded-xl border border-destructive/20 bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                            {initials(session.teacherName)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{session.teacherName}</p>
                            <p className="text-xs text-muted-foreground">
                              {slots.find((s) => s.session?.id === session.id)?.subjectName || 'Class'} ·{' '}
                              {session.studentName || 'Group session'}
                            </p>
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
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
                      </div>

                      <div className="mt-3">
                        <p className={cn('font-mono text-sm', overrun ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
                          {formatElapsed(session.actual_start)} / {expectedMin}:00
                        </p>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', overrun ? 'bg-amber-500' : 'bg-destructive')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={!license?.meeting_link}
                          onClick={() => window.open(license?.meeting_link, '_blank', 'noopener,noreferrer')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Join
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="gap-1">
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
              <p className="text-sm text-muted-foreground">No classes running right now.</p>
            )}
          </section>
        )}

        {/* Up next */}
        {showUpNext && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">Up next</h3>
            {upNext.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing else scheduled for today.</p>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {upNext.map((slot) => {
                  const minsAway = slot.startMinutes - nowMinutes;
                  const overdue = slot.state === 'overdue';
                  return (
                    <div
                      key={slot.scheduleId}
                      className={cn(
                        'flex items-center justify-between gap-3 px-4 py-3',
                        overdue ? 'bg-amber-500/10' : 'bg-card',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">{slot.startLabel}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {slot.teacherName} → {slot.studentName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {slot.subjectName || 'Class'} · {slot.durationMinutes} min
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
                          overdue
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                            : minsAway <= 10
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {overdue
                          ? `${nowMinutes - slot.startMinutes} min late`
                          : minsAway <= 10
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
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div className="flex flex-1 gap-1">
            {(licenses || []).map((l) => (
              <Tooltip key={l.id}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'h-2 flex-1 rounded-full',
                      l.status === 'available' ? 'bg-emerald-500' : 'bg-destructive',
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{l.zoom_email}</p>
                  <p className="text-[11px] text-muted-foreground">{l.status}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {busyLicenses} of {totalLicenses} in use
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default ZoomLiveOperations;
