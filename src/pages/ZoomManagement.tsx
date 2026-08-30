import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Video, Users, RefreshCw, Radio, ArrowUpRight, ArrowDownLeft, Timer, Power, UserPlus, Play, ShieldCheck, Download, AlertTriangle } from 'lucide-react';
import { format, differenceInMinutes, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { TeacherZoomAccountsPanel } from '@/components/zoom/TeacherZoomAccountsPanel';
import { ZoomLiveOperations } from '@/components/zoom/ZoomLiveOperations';

import { ZoomAccountCredentialsPanel } from '@/components/zoom/ZoomAccountCredentialsPanel';

import ZoomVaultPage from '@/pages/ZoomVault';
import SharedPoolPage from '@/pages/SharedPool';
import { ExportDialog } from '@/components/export/ExportDialog';




function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const calc = () => setElapsed(differenceInMinutes(new Date(), new Date(startTime)));
    calc();
    const interval = setInterval(calc, 30000);
    return () => clearInterval(interval);
  }, [startTime]);
  return <span className="tabular-nums font-mono text-sm font-semibold">{elapsed} min</span>;
}

export default function ZoomManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = React.useState<'live' | 'accounts' | 'vault' | 'pool'>('live');
  const [activeSection, setActiveSection] = React.useState<'accounts' | 'credentials' | 'sessions' | 'logs'>('accounts');
  const [exportSessionsOpen, setExportSessionsOpen] = React.useState(false);
  const [exportLogsOpen, setExportLogsOpen] = React.useState(false);







  // Shares the query key with TeacherZoomAccountsPanel so linking/deleting an
  // account (which invalidates 'zoom-accounts-list') also refreshes this badge.
  const { data: zoomAccounts } = useQuery({
    queryKey: ['zoom-accounts-list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zoom_accounts')
        .select('id, teacher_id, zoom_account_email, zoom_user_id, tier, meeting_link, is_active, last_validated_at, created_at, profile:profiles!zoom_accounts_teacher_id_fkey(id, full_name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });


  const { data: licenses } = useQuery({
    queryKey: ['zoom-licenses-management'],
    queryFn: async () => {
      const { data, error } = await supabase.from('zoom_licenses').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: liveSessions } = useQuery({
    queryKey: ['all-live-sessions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('live_sessions')
        .select('id, teacher_id, student_id, actual_start, actual_end, status, created_at, recording_link, recording_status, license_id, schedule_id, assignment_id, zoom_meeting_uuid, session_source, zoom_account_id')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const realZoomSessions = data.filter((session: any) => Boolean(session.zoom_meeting_uuid));
      const uniqueSessions = Array.from(
        realZoomSessions.reduce((map: Map<string, any>, session: any) => {
          const key = session.zoom_meeting_uuid || session.id;
          const existing = map.get(key);
          if (!existing) {
            map.set(key, session);
            return map;
          }

          const existingHasSchedule = Boolean(existing.assignment_id || existing.schedule_id);
          const sessionHasSchedule = Boolean(session.assignment_id || session.schedule_id);
          if (sessionHasSchedule && !existingHasSchedule) {
            map.set(key, session);
            return map;
          }

          const existingCreated = existing.created_at ? new Date(existing.created_at).getTime() : Number.MAX_SAFE_INTEGER;
          const sessionCreated = session.created_at ? new Date(session.created_at).getTime() : Number.MAX_SAFE_INTEGER;
          if (sessionCreated < existingCreated && sessionHasSchedule === existingHasSchedule) map.set(key, session);
          return map;
        }, new Map<string, any>()).values()
      );

      const profileIds = [...new Set(uniqueSessions.flatMap((s: any) => [s.teacher_id, s.student_id]).filter(Boolean))] as string[];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', profileIds);
      const profileMap = new Map(profiles?.map(t => [t.id, t.full_name]) || []);

      return uniqueSessions.map((session: any) => ({
        ...session,
        teacherName: profileMap.get(session.teacher_id) || 'Unknown',
        studentName: session.student_id ? (profileMap.get(session.student_id) || 'Student') : null,
      }));
    },
    refetchInterval: 15000,
  });

  const { data: attendanceLogs } = useQuery({
    queryKey: ['all-attendance-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zoom_attendance_logs')
        .select('id, user_id, action, timestamp, session_id, join_time, leave_time, total_duration_minutes, participant_name, participant_email, role, zoom_license_id, zoom_meeting_uuid, zoom_host_id, zoom_event_type')
        .order('timestamp', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const zoomRows = data.filter((log: any) =>
        ['meeting.started', 'meeting.ended', 'meeting.participant_joined', 'meeting.participant_left'].includes(log.zoom_event_type),
      );
      const uniqueLogs = zoomRows.filter((log: any, index: number, rows: any[]) => {
        const eventMinute = log.timestamp ? new Date(log.timestamp).toISOString().slice(0, 16) : '';
        const participantKey = (log.participant_email || log.participant_name || log.user_id || '').toLowerCase();
        const meetingKey = log.zoom_meeting_uuid || log.session_id || log.zoom_license_id || '';
        const key = `${meetingKey}:${participantKey}:${log.action}:${eventMinute}`;
        return rows.findIndex((candidate: any) => {
          const candidateMinute = candidate.timestamp ? new Date(candidate.timestamp).toISOString().slice(0, 16) : '';
          const candidateParticipant = (candidate.participant_email || candidate.participant_name || candidate.user_id || '').toLowerCase();
          const candidateMeeting = candidate.zoom_meeting_uuid || candidate.session_id || candidate.zoom_license_id || '';
          return `${candidateMeeting}:${candidateParticipant}:${candidate.action}:${candidateMinute}` === key;
        }) === index;
      });

      const userIds = [...new Set(uniqueLogs.map((l: any) => l.user_id).filter(Boolean))] as string[];
      const { data: users } = userIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] } as { data: Array<{ id: string; full_name: string | null }> };
      const userMap = new Map(users?.map(u => [u.id, u.full_name]) || []);

      return uniqueLogs.map((log: any) => ({
        ...log,
        userName: log.participant_name || userMap.get(log.user_id) || 'Zoom participant',
        matchedProfileName: log.user_id ? userMap.get(log.user_id) : null,
      }));
    },
    refetchInterval: 15000,
  });

  const visibleAttendanceLogs = React.useMemo(() => {
    return attendanceLogs || [];
  }, [attendanceLogs]);



  const participantNamesBySession = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    visibleAttendanceLogs.forEach((log: any) => {
      if (!log.session_id) return;
      const label = log.participant_name || log.userName;
      if (!label) return;
      const existing = map.get(log.session_id) || new Set<string>();
      existing.add(label);
      map.set(log.session_id, existing);
    });
    return map;
  }, [visibleAttendanceLogs]);

  const getSessionPrimaryLabel = React.useCallback((session: any) => {
    const participantNames = Array.from(participantNamesBySession.get(session.id) || []);
    if (participantNames.length > 0) return participantNames.join(', ');
    if (session.studentName) return session.studentName;
    if (session.assignment_id || session.schedule_id) return session.teacherName;
    return 'Monitor session';
  }, [participantNamesBySession]);

  const liveSessionsList = liveSessions?.filter((s: any) => s.status === 'live') || [];


  // Rooms = dedicated teacher accounts + legacy pool licenses that are NOT the
  // same Zoom account already linked to a teacher. Room 1 and Shazia's dedicated
  // account are one physical Zoom login, so counting both double-counted capacity
  // ("2 Ready" when there is really only 1 room).
  // "Live" is driven by actual live sessions, not by the legacy license.status
  // flag (dedicated accounts never flip that flag, which is why the header used
  // to read "0 Live" while a class was clearly running).
  const accountsCount = zoomAccounts?.length || 0;
  const dedicatedEmails = new Set(
    (zoomAccounts || [])
      .map((a: any) => (a.zoom_account_email || '').trim().toLowerCase())
      .filter(Boolean),
  );
  const legacyLicenses = licenses || [];
  const unclaimedLegacy = legacyLicenses.filter(
    (l: any) => !dedicatedEmails.has((l.zoom_email || '').trim().toLowerCase()),
  );
  
  const busyCount = liveSessionsList.length;
  const availableCount = Math.max(0, unclaimedLegacy.length + accountsCount - busyCount);

  const sessionExportRows = React.useMemo(() => (liveSessions || []).map((s: any) => {
    const duration = s.actual_start && s.actual_end
      ? differenceInMinutes(new Date(s.actual_end), new Date(s.actual_start))
      : s.actual_start && s.status === 'live'
        ? differenceInMinutes(new Date(), new Date(s.actual_start))
        : 0;
    return {
      session: getSessionPrimaryLabel(s),
      teacher: s.teacherName || '',
      status: s.status || '',
      scheduled_start: s.scheduled_start ? format(new Date(s.scheduled_start), 'yyyy-MM-dd HH:mm') : '',
      actual_start: s.actual_start ? format(new Date(s.actual_start), 'yyyy-MM-dd HH:mm') : '',
      actual_end: s.actual_end ? format(new Date(s.actual_end), 'yyyy-MM-dd HH:mm') : '',
      duration_minutes: duration || '',
      recording_status: s.recording_status || '',
      recording_link: s.recording_link || '',
      session_id: s.id,
    };
  }), [liveSessions, getSessionPrimaryLabel]);

  const logExportRows = React.useMemo(() => visibleAttendanceLogs.map((log: any) => {
    const isLeave = log.action === 'leave' || (log.action !== 'join_intent' && (Boolean(log.leave_time) || log.zoom_event_type === 'meeting.participant_left'));
    const durationMin = (log.join_time && log.leave_time)
      ? Math.max(0, Math.round((new Date(log.leave_time).getTime() - new Date(log.join_time).getTime()) / 60000))
      : (typeof log.total_duration_minutes === 'number' ? log.total_duration_minutes : '');
    return {
      participant: log.userName || '',
      email: log.participant_email || '',
      role: log.role || '',
      action: isLeave ? 'Left' : 'Joined',
      timestamp: log.timestamp ? format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss') : '',
      join_time: log.join_time ? format(new Date(log.join_time), 'yyyy-MM-dd HH:mm:ss') : '',
      leave_time: log.leave_time ? format(new Date(log.leave_time), 'yyyy-MM-dd HH:mm:ss') : '',
      duration_minutes: durationMin,
      session_id: log.session_id || '',
    };
  }), [visibleAttendanceLogs]);

  const sectionButtons = [
    { id: 'accounts' as const, label: 'Zoom seats', icon: ShieldCheck, count: accountsCount },
    { id: 'credentials' as const, label: 'Credentials', icon: ShieldCheck, count: accountsCount },
    { id: 'sessions' as const, label: 'Sessions', icon: Video, count: liveSessions?.length || 0 },
    { id: 'logs' as const, label: 'Join logs', icon: Users, count: visibleAttendanceLogs.length },
  ];



  return (
    <DashboardLayout>
      <div className="zoom-ws zw-canvas -m-4 space-y-7 p-4 sm:-m-6 sm:p-6">
        {/* Workspace hero */}
        <header className="zw-hero px-6 py-7 sm:px-8 sm:py-8">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="zw-eyebrow" style={{ color: 'hsl(38 55% 72%)' }}>Academy operations</p>
              <h1 className="zw-display mt-2" style={{ color: 'hsl(42 45% 96%)' }}>Zoom Management</h1>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'hsl(40 22% 78%)' }}>
                Live classes, teacher seats, spare capacity and Zoom activity for the whole academy — in one workspace.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight" style={{ color: 'hsl(42 45% 96%)' }}>{availableCount}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: 'hsl(40 22% 74%)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'hsl(168 45% 58%)' }} /> Rooms ready
                </p>
              </div>
              <div className="h-10 w-px" style={{ background: 'hsl(40 30% 80% / 0.2)' }} />
              <div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight" style={{ color: busyCount ? 'hsl(6 75% 72%)' : 'hsl(42 45% 96%)' }}>{busyCount}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: 'hsl(40 22% 74%)' }}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', busyCount && 'animate-pulse')} style={{ background: busyCount ? 'hsl(6 75% 62%)' : 'hsl(40 12% 55%)' }} /> Live now
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Top-level navigation */}
        <nav className="zw-nav w-fit max-w-full flex-wrap" aria-label="Zoom sections">
          {([
            { id: 'live' as const, label: 'Live operations' },
            { id: 'accounts' as const, label: 'Accounts' },
            { id: 'pool' as const, label: 'Pool Booking' },
            { id: 'vault' as const, label: 'Zoom Vault' },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMainTab(tab.id)}
              data-active={mainTab === tab.id}
              aria-current={mainTab === tab.id ? 'page' : undefined}
              className="zw-nav-item"
            >
              {tab.label}
            </button>
          ))}
        </nav>



        {mainTab === 'live' && <ZoomLiveOperations />}

        {mainTab === 'pool' && <SharedPoolPage />}

        {mainTab === 'vault' && <ZoomVaultPage />}

        {mainTab === 'accounts' && (<>
        {/* Accounts sub-navigation */}
        <div className="flex flex-wrap items-center gap-1.5">
          {sectionButtons.map(btn => (
            <button
              key={btn.id}
              onClick={() => setActiveSection(btn.id)}
              data-active={activeSection === btn.id}
              className="zw-subnav-item inline-flex items-center gap-2"
            >
              {btn.label}
              <span className="tabular-nums text-[11px] opacity-60">{btn.count}</span>
            </button>
          ))}
        </div>

        {/* Zoom seats workspace (master/detail) */}
        {activeSection === 'accounts' && <TeacherZoomAccountsPanel />}

        {/* Account-scoped credentials: webhook + Meeting SDK + class links */}
        {activeSection === 'credentials' && (
          <ZoomAccountCredentialsPanel zoomAccounts={(zoomAccounts || []) as any} />
        )}



        {/* Sessions */}
        {activeSection === 'sessions' && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Session history</h2>
                <p className="mt-1 text-sm text-muted-foreground">Every live session with its duration and recording.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['all-live-sessions'] })} className="gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={() => setExportSessionsOpen(true)} disabled={sessionExportRows.length === 0} className="gap-2">
                  <Download className="h-4 w-4" /> Download CSV
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[560px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10">Session</TableHead>
                    <TableHead className="h-10">Started</TableHead>
                    <TableHead className="h-10">Ended</TableHead>
                    <TableHead className="h-10">Duration</TableHead>
                    <TableHead className="h-10">Recording</TableHead>
                    <TableHead className="h-10">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveSessions?.map((session: any) => {
                    const duration = session.actual_start && session.actual_end
                      ? differenceInMinutes(new Date(session.actual_end), new Date(session.actual_start))
                      : session.actual_start && session.status === 'live'
                        ? differenceInMinutes(new Date(), new Date(session.actual_start))
                        : 0;

                    return (
                      <TableRow key={session.id}>
                        <TableCell className="py-3">
                          <p className="text-sm font-medium text-foreground">{getSessionPrimaryLabel(session)}</p>
                          {session.teacherName && (
                            <p className="text-xs text-muted-foreground">Room owner · {session.teacherName}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{session.actual_start ? format(new Date(session.actual_start), 'MMM d, HH:mm') : '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{session.actual_end ? format(new Date(session.actual_end), 'HH:mm') : '—'}</TableCell>
                        <TableCell className="text-sm tabular-nums">{duration > 0 ? `${duration} min` : '—'}</TableCell>
                        <TableCell>
                          {session.recording_link ? (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary" onClick={() => window.open(session.recording_link, '_blank')}>
                              <Play className="h-3 w-3" /> Watch
                            </Button>
                          ) : session.status === 'completed' && session.recording_status === 'pending' ? (
                            <span className="text-xs text-amber-700 dark:text-amber-400">Processing</span>
                          ) : session.status === 'completed' && session.recording_status === 'failed' ? (
                            <span className="text-xs text-destructive">Failed</span>
                          ) : session.status === 'live' ? (
                            <span className="text-xs text-muted-foreground">Recording…</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            'inline-flex items-center gap-1.5 text-xs',
                            session.status === 'live' ? 'text-destructive' : 'text-muted-foreground',
                          )}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', session.status === 'live' ? 'bg-destructive' : 'bg-muted-foreground/40')} />
                            {session.status === 'live' ? 'Live' : session.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!liveSessions || liveSessions.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">No sessions yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </section>
        )}

        {/* Join logs */}
        {activeSection === 'logs' && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Join &amp; leave activity</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Zoom telemetry only — attendance is always marked manually.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setExportLogsOpen(true)} disabled={logExportRows.length === 0} className="gap-2">
                <Download className="h-4 w-4" /> Download CSV
              </Button>
            </div>

            <ScrollArea className="h-[560px]">
              <ul className="divide-y divide-border/60">
                {visibleAttendanceLogs.map((log: any) => {
                  const isLeave = log.action === 'leave' || (log.action !== 'join_intent' && (Boolean(log.leave_time) || log.zoom_event_type === 'meeting.participant_left'));
                  const isJoin = !isLeave && (log.action === 'join' || log.action === 'join_intent');
                  const durationMin = (log.join_time && log.leave_time)
                    ? Math.max(0, Math.round((new Date(log.leave_time).getTime() - new Date(log.join_time).getTime()) / 60000))
                    : (typeof log.total_duration_minutes === 'number' ? log.total_duration_minutes : null);
                  return (
                    <li key={log.id} className="flex items-center gap-3 py-3">
                      {isJoin
                        ? <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-600" />
                        : <ArrowDownLeft className="h-4 w-4 shrink-0 text-amber-600" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{log.userName}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          {log.role ? ` • ${log.role}` : ''}
                          {log.participant_email ? ` • ${log.participant_email}` : ''}
                          {log.join_time ? ` • joined ${format(new Date(log.join_time), 'HH:mm:ss')}` : ''}
                          {log.leave_time ? ` → left ${format(new Date(log.leave_time), 'HH:mm:ss')}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn('text-xs', isJoin ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
                          {isJoin ? 'Joined' : isLeave ? 'Left' : log.action}
                        </p>
                        {durationMin !== null && durationMin > 0 && (
                          <p className="text-[11px] tabular-nums text-muted-foreground">{durationMin} min</p>
                        )}
                      </div>
                    </li>
                  );
                })}
                {visibleAttendanceLogs.length === 0 && (
                  <li className="py-14 text-center text-sm text-muted-foreground">No join logs recorded yet.</li>
                )}
              </ul>
            </ScrollArea>
          </section>
        )}

        </>)}

        <ExportDialog
          open={exportSessionsOpen}
          onOpenChange={setExportSessionsOpen}
          title="Zoom Sessions"
          filename="zoom-sessions"
          data={sessionExportRows}
          fields={[
            { key: 'session', label: 'Session' },
            { key: 'teacher', label: 'Teacher / Room owner' },
            { key: 'status', label: 'Status' },
            { key: 'scheduled_start', label: 'Scheduled start' },
            { key: 'actual_start', label: 'Actual start' },
            { key: 'actual_end', label: 'Actual end' },
            { key: 'duration_minutes', label: 'Duration (min)' },
            { key: 'recording_status', label: 'Recording status' },
            { key: 'recording_link', label: 'Recording link', defaultChecked: false },
            { key: 'session_id', label: 'Session ID', defaultChecked: false },
          ]}
        />

        <ExportDialog
          open={exportLogsOpen}
          onOpenChange={setExportLogsOpen}
          title="Zoom Join Logs"
          filename="zoom-join-logs"
          data={logExportRows}
          fields={[
            { key: 'participant', label: 'Participant' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role' },
            { key: 'action', label: 'Action' },
            { key: 'timestamp', label: 'Event time' },
            { key: 'join_time', label: 'Join time' },
            { key: 'leave_time', label: 'Leave time' },
            { key: 'duration_minutes', label: 'Duration (min)' },
            { key: 'session_id', label: 'Session ID', defaultChecked: false },
          ]}
        />
      </div>


    </DashboardLayout>
  );
}