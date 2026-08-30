import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Video, Plus, Trash2, Wifi, WifiOff, Settings, Users, Clock, ExternalLink, RefreshCw, Radio, ArrowUpRight, ArrowDownLeft, Timer, Power, UserPlus, Play, Pencil, Shield, ShieldOff, ShieldCheck, Copy, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInMinutes, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { ValidateZoomAccountDialog } from '@/components/zoom/ValidateZoomAccountDialog';
import { TeacherZoomAccountsPanel } from '@/components/zoom/TeacherZoomAccountsPanel';
import { SharedZoomAvailabilityPanel } from '@/components/zoom/SharedZoomAvailabilityPanel';
import { ZoomLiveOperations } from '@/components/zoom/ZoomLiveOperations';
import { SyncZoomUsersButton } from '@/components/zoom/SyncZoomUsersButton';
import { ZoomWebhookHealthPanel } from '@/components/zoom/ZoomWebhookHealthPanel';
import { ZoomAccountCredentialsPanel } from '@/components/zoom/ZoomAccountCredentialsPanel';

import ZoomVaultPage from '@/pages/ZoomVault';
import SharedPoolPage from '@/pages/SharedPool';
import { ExportDialog } from '@/components/export/ExportDialog';
import { Download } from 'lucide-react';



import { AlertTriangle } from 'lucide-react';

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
  const [newLicense, setNewLicense] = React.useState({ zoom_email: '', meeting_link: '', host_id: '' });
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingLicense, setEditingLicense] = React.useState<{ id: string; zoom_email: string; meeting_link: string; host_id: string; license_type: string; priority: number } | null>(null);
  const [mainTab, setMainTab] = React.useState<'live' | 'accounts' | 'shared' | 'vault' | 'pool'>('live');
  const [activeSection, setActiveSection] = React.useState<'accounts' | 'health' | 'rooms' | 'sessions' | 'logs'>('accounts');
  const [exportSessionsOpen, setExportSessionsOpen] = React.useState(false);
  const [exportLogsOpen, setExportLogsOpen] = React.useState(false);







  const [zoomSetupOpen, setZoomSetupOpen] = React.useState(false);
  const [zoomCreds, setZoomCreds] = React.useState({ account_id: '', client_id: '', client_secret: '' });
  const [hostIdResults, setHostIdResults] = React.useState<Array<{ email: string; host_id: string | null; status: string; error?: string }> | null>(null);
  const [refreshingHostIds, setRefreshingHostIds] = React.useState(false);

  const fetchHostIds = async (creds?: { account_id: string; client_id: string; client_secret: string }) => {
    setRefreshingHostIds(true);
    setHostIdResults(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sienlnxwwdqnybugipdt';
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/zoom-fetch-host-ids`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(creds || {}),
      });

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to fetch host IDs');

      setHostIdResults(result.results);
      queryClient.invalidateQueries({ queryKey: ['zoom-licenses-management'] });
      toast({ title: 'Host IDs Updated', description: `${result.results.filter((r: any) => r.status === 'updated').length} of ${result.results.length} licenses updated.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRefreshingHostIds(false);
    }
  };

  // Allocation mode query
  const { data: allocationMode } = useQuery({
    queryKey: ['zoom-allocation-mode'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('setting_value').eq('setting_key', 'zoom_allocation_mode').single();
      if (error) return 'round_robin';
      const val = typeof data.setting_value === 'string' ? data.setting_value : JSON.stringify(data.setting_value);
      return val.replace(/"/g, '') || 'round_robin';
    },
  });

  const updateAllocationModeMutation = useMutation({
    mutationFn: async (mode: string) => {
      const { error } = await supabase.from('app_settings').update({ setting_value: JSON.stringify(mode) as any }).eq('setting_key', 'zoom_allocation_mode');
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Allocation mode updated' });
      queryClient.invalidateQueries({ queryKey: ['zoom-allocation-mode'] });
    },
  });

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


  const { data: licenses, isLoading: licensesLoading } = useQuery({
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

  // Active sessions mapped by license_id
  const activeSessionsByLicense = React.useMemo(() => {
    const map = new Map<string, any>();
    liveSessions?.filter((s: any) => s.status === 'live').forEach((s: any) => {
      if (s.license_id) map.set(s.license_id, s);
    });
    return map;
  }, [liveSessions]);

  const visibleAttendanceLogs = React.useMemo(() => {
    return attendanceLogs || [];
  }, [attendanceLogs]);

  const activeParticipantNamesBySession = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    visibleAttendanceLogs.forEach((log: any) => {
      if (!log.session_id || log.action !== 'join_intent' || log.leave_time) return;
      if (!['meeting.started', 'meeting.participant_joined'].includes(log.zoom_event_type)) return;
      const label = log.participant_name || log.userName;
      if (!label) return;
      const existing = map.get(log.session_id) || new Set<string>();
      existing.add(label);
      map.set(log.session_id, existing);
    });
    return map;
  }, [visibleAttendanceLogs]);

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

  // Count distinct participants per live session — used to surface the
  // free-tier 40-min cap warning when a group class hits 3+ attendees.
  const participantCountBySession = React.useMemo(() => {
    const map = new Map<string, number>();
    visibleAttendanceLogs.forEach((log: any) => {
      if (!log.session_id) return;
      const key = `${log.session_id}::${log.user_id || log.participant_email || log.participant_name}`;
      const existing = map.get(log.session_id) || 0;
      // Simple dedupe by session — using a Set-per-session would be cleaner but this suffices
      if (!(map as any)[`__seen_${key}`]) {
        (map as any)[`__seen_${key}`] = true;
        map.set(log.session_id, existing + 1);
      }
    });
    return map;
  }, [visibleAttendanceLogs]);

  const addLicenseMutation = useMutation({
    mutationFn: async (license: typeof newLicense) => {
      const { error } = await supabase.from('zoom_licenses').insert({
        zoom_email: license.zoom_email,
        meeting_link: license.meeting_link,
        host_id: license.host_id || null,
        status: 'available',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'License Added' });
      setNewLicense({ zoom_email: '', meeting_link: '', host_id: '' });
      setAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['zoom-licenses-management'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteLicenseMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      // Clear FK references in live_sessions
      await (supabase as any).from('live_sessions')
        .update({ license_id: null, status: 'completed', actual_end: new Date().toISOString() })
        .eq('license_id', licenseId);
      // Clear FK references in course_classes
      await (supabase as any).from('course_classes')
        .update({ zoom_license_id: null })
        .eq('zoom_license_id', licenseId);
      const { error } = await supabase.from('zoom_licenses').delete().eq('id', licenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'License Removed' });
      queryClient.invalidateQueries({ queryKey: ['zoom-licenses-management'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const editLicenseMutation = useMutation({
    mutationFn: async (license: { id: string; zoom_email: string; meeting_link: string; host_id: string; license_type: string; priority: number }) => {
      const { error } = await supabase.from('zoom_licenses').update({
        zoom_email: license.zoom_email,
        meeting_link: license.meeting_link,
        host_id: license.host_id || null,
        license_type: license.license_type,
        priority: license.priority,
      } as any).eq('id', license.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'License Updated' });
      setEditDialogOpen(false);
      setEditingLicense(null);
      queryClient.invalidateQueries({ queryKey: ['zoom-licenses-management'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // End session mutation for admin
  const endSessionMutation = useMutation({
    mutationFn: async ({ sessionId, licenseId }: { sessionId: string; licenseId?: string | null }) => {
      const { error: sessionError } = await (supabase as any)
        .from('live_sessions')
        .update({ status: 'completed', actual_end: new Date().toISOString() })
        .eq('id', sessionId);
      if (sessionError) throw sessionError;

      // Sessions running on a teacher's dedicated account have no pooled licence.
      if (licenseId) {
        const { error: licenseError } = await supabase
          .from('zoom_licenses')
          .update({ status: 'available' })
          .eq('id', licenseId);
        if (licenseError) throw licenseError;
      }
    },
    onSuccess: () => {
      toast({ title: 'Session Ended', description: 'The session was marked completed.' });
      queryClient.invalidateQueries({ queryKey: ['zoom-licenses-management'] });
      queryClient.invalidateQueries({ queryKey: ['all-live-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['active-live-sessions-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['zoom-licenses-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['zoom-today-sessions'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const liveSessionsList = liveSessions?.filter((s: any) => s.status === 'live') || [];
  const completedSessions = liveSessions?.filter((s: any) => s.status === 'completed') || [];

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
  const totalCount = legacyLicenses.length;
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

    { id: 'accounts' as const, label: 'Teacher Accounts', icon: ShieldCheck, count: accountsCount },
    { id: 'health' as const, label: 'Webhook Health', icon: Shield, count: accountsCount },
    { id: 'rooms' as const, label: 'Shared Pool (legacy)', icon: Settings, count: unclaimedLegacy.length },

    { id: 'sessions' as const, label: 'Sessions', icon: Video, count: liveSessions?.length || 0 },
    { id: 'logs' as const, label: 'Join Logs', icon: Users, count: visibleAttendanceLogs.length },
  ];


  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Top-level tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: 'live' as const, label: 'Live operations' },
            { id: 'accounts' as const, label: 'Accounts' },
            { id: 'shared' as const, label: 'Shared Pool' },
            { id: 'pool' as const, label: 'Pool Booking' },
            { id: 'vault' as const, label: 'Zoom Vault' },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMainTab(tab.id)}
              className={cn(
                'h-10 rounded-full px-4 text-sm font-medium transition-colors',
                mainTab === tab.id
                  ? 'bg-[hsl(var(--navy))] text-white dark:bg-primary dark:text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted',
              )}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto">
            <SyncZoomUsersButton />
          </div>
        </div>


        {mainTab === 'live' && <ZoomLiveOperations />}

        {mainTab === 'shared' && <SharedZoomAvailabilityPanel />}

        {mainTab === 'pool' && <SharedPoolPage />}

        {mainTab === 'vault' && <ZoomVaultPage />}

        {mainTab === 'accounts' && (<>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Zoom Engine</h1>
            <p className="text-muted-foreground text-sm mt-1">Live room management & session monitoring</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{availableCount} Ready</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-semibold text-destructive">{busyCount} Live</span>
            </div>
          </div>
        </div>

        {/* Webhook URL — per-app endpoint builder */}
        <Card className="border border-border/60 bg-card shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="sm:w-64">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Zoom app</p>
                <Select value={webhookApp || '__default'} onValueChange={(v) => setWebhookApp(v === '__default' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Shared / default app" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default">Shared / default app</SelectItem>
                    {(zoomAccounts || [])
                      .filter((a: any) => a.is_active)
                      .map((a: any) => {
                        const name = a.profile?.full_name || a.zoom_account_email || '';
                        const slug = String(name).trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'app';
                        return (
                          <SelectItem key={a.id} value={slug}>
                            {name} — ?app={slug}
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Event Subscription endpoint</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 block rounded-md bg-muted px-3 py-2 text-sm font-mono text-foreground break-all">
                    {webhookUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={handleCopyWebhook}
                  >
                    {webhookCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {webhookCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
            {webhookApp ? (
              <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-1">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Secret Token for this app
                  </p>
                  <Input
                    type="password"
                    value={webhookToken}
                    onChange={(e) => setWebhookToken(e.target.value)}
                    placeholder="Paste the Secret Token from Zoom → Feature → Event Subscriptions"
                  />
                </div>
                <Button size="sm" disabled={!webhookToken || savingToken} onClick={saveWebhookToken}>
                  {savingToken ? 'Saving…' : 'Save token'}
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Give each teacher app its own tagged URL (<code className="font-mono">?app=slug</code>) under <strong>Feature → Event Subscriptions</strong>, then paste that app’s <strong>Secret Token</strong> above and press <em>Save token</em> — it is stored against the teacher’s Zoom account, so no developer step is needed. Save it <em>before</em> pressing “Validate” in Zoom.
            </p>

          </CardContent>
        </Card>

        <MeetingSdkPanel zoomAccounts={(zoomAccounts || []) as any} />

        {/* Room Cards Grid */}
        <div>

          <div className="flex items-center gap-2 mb-3">
            <Radio className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground uppercase tracking-wide">Room Status</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {licenses?.map((license, idx) => {
              const session = activeSessionsByLicense.get(license.id);
              // A room is live if a session claims it, even when the legacy
              // status flag was never flipped (dedicated-account flow).
              const isBusy = license.status === 'busy' || Boolean(session);
              const statusColor = isBusy ? 'border-destructive/40 bg-destructive/5' : 'border-emerald-500/30 bg-emerald-500/5';
              return (
                <Card key={license.id} className={cn("relative overflow-hidden transition-all hover:shadow-md", statusColor)}>
                  {isBusy && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive to-destructive/60 animate-pulse" />
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">Room {idx + 1}</span>
                      <Badge className={cn(
                        "text-[10px] px-2",
                        isBusy
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      )} variant="outline">
                        {isBusy ? '● Live' : '● Ready'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mb-2">
                      {license.zoom_email?.split('@')[0]}@...
                    </p>
                    {session ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground truncate">
                          {Array.from(activeParticipantNamesBySession.get(session.id) || []).join(', ') || 'Waiting for participant'}
                        </p>
                        <div className="flex items-center gap-1 text-destructive">
                          <Timer className="h-3 w-3" />
                          <LiveTimer startTime={session.actual_start} />
                        </div>
                        <div className="flex gap-1 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] gap-1 flex-1"
                            onClick={() => window.open(license.meeting_link, '_blank')}
                          >
                            <UserPlus className="h-3 w-3" /> Join
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 text-[10px] gap-1 flex-1"
                            onClick={() => endSessionMutation.mutate({ sessionId: session.id, licenseId: license.id })}
                            disabled={endSessionMutation.isPending}
                          >
                            <Power className="h-3 w-3" /> End
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        {license.last_used_at
                          ? `Last used ${formatDistanceToNow(new Date(license.last_used_at), { addSuffix: true })}`
                          : 'Never used'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {(!licenses || licenses.length === 0) && (
              <Card className="col-span-full border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  No Zoom rooms configured yet.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Live Class Queue - Horizontal Scrollable */}
        {liveSessionsList.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Video className="h-4 w-4 text-destructive" />
              <h2 className="font-semibold text-sm text-foreground uppercase tracking-wide">Live Now</h2>
              <Badge className="bg-destructive/10 text-destructive border-destructive/20 animate-pulse" variant="outline">
                {liveSessionsList.length} active
              </Badge>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
              {liveSessionsList.map((session: any) => (
                <Card key={session.id} className="min-w-[260px] snap-start border-destructive/20 bg-gradient-to-br from-destructive/5 to-transparent flex-shrink-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-destructive">{getSessionPrimaryLabel(session).charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold truncate max-w-[140px]">{getSessionPrimaryLabel(session)}</p>
                        </div>
                      </div>
                      <Badge className="bg-destructive text-destructive-foreground animate-pulse text-[10px]">LIVE</Badge>
                    </div>
                    <Separator className="my-2" />
                    {(() => {
                      const pcount = participantCountBySession.get(session.id) || 0;
                      const startedMin = session.actual_start
                        ? Math.floor((Date.now() - new Date(session.actual_start).getTime()) / 60000)
                        : 0;
                      const groupAtRisk = pcount >= 3;
                      return groupAtRisk ? (
                        <div className={cn(
                          "flex items-center gap-1.5 rounded-md px-2 py-1 mb-2 border text-[10px]",
                          startedMin >= 30
                            ? "bg-destructive/10 border-destructive/30 text-destructive"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                        )}>
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span className="font-semibold">
                            {pcount} participants · Basic tier cap 40 min
                            {startedMin >= 30 && ` · ${40 - startedMin}m left`}
                          </span>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Duration</span>
                      {session.actual_start && <LiveTimer startTime={session.actual_start} />}
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Started</span>
                      <span className="text-muted-foreground">
                        {session.actual_start ? format(new Date(session.actual_start), 'HH:mm') : '-'}
                      </span>
                    </div>
                    {(() => {
                      const account = zoomAccounts?.find((item: any) => item.id === session.zoom_account_id);
                      const license = licenses?.find((item: any) => item.id === session.license_id);
                      const roomEmail = account?.zoom_account_email || license?.zoom_email;
                      return roomEmail ? (
                        <div className="flex items-center justify-between gap-2 text-xs mt-1">
                          <span className="text-muted-foreground">Zoom room</span>
                          <span className="truncate text-muted-foreground" title={roomEmail}>{roomEmail}</span>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex gap-2 mt-3 pt-2 border-t border-border/30">
                      {(session.license_id || session.zoom_account_id) && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1 text-[10px] h-7"
                            onClick={() => {
                              const lic = licenses?.find(l => l.id === session.license_id);
                              const account = zoomAccounts?.find((item: any) => item.id === session.zoom_account_id);
                              const meetingLink = account?.meeting_link || lic?.meeting_link;
                              if (meetingLink) window.open(meetingLink, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            <UserPlus className="h-3 w-3" /> Join
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1 gap-1 text-[10px] h-7"
                            onClick={() => endSessionMutation.mutate({ sessionId: session.id, licenseId: session.license_id })}
                            disabled={endSessionMutation.isPending}
                          >
                            <Power className="h-3 w-3" /> End
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Section Switcher */}
        <div className="flex gap-2 border-b border-border pb-0">
          {sectionButtons.map(btn => (
            <button
              key={btn.id}
              onClick={() => setActiveSection(btn.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeSection === btn.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <btn.icon className="h-4 w-4" />
              {btn.label}
              <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded-full">{btn.count}</span>
            </button>
          ))}
        </div>

        {/* Teacher Zoom Accounts (dedicated) */}
        {activeSection === 'accounts' && <TeacherZoomAccountsPanel />}

        {/* Per-seat webhook health */}
        {activeSection === 'health' && <ZoomWebhookHealthPanel />}


        {/* Rooms Section (legacy shared pool) */}
        {activeSection === 'rooms' && (<>
          {/* Allocation Mode Settings */}
          <Card className="border-dashed">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">Room Allocation Mode</p>
                  <p className="text-xs text-muted-foreground">
                    {allocationMode === 'priority'
                      ? 'Rooms are picked by priority number (lowest first). Licensed rooms get used before basic ones.'
                      : 'Rooms are picked in round-robin order, spreading usage evenly across all rooms.'}
                  </p>
                </div>
              </div>
              <Select value={allocationMode || 'round_robin'} onValueChange={(v) => updateAllocationModeMutation.mutate(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority-based</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif">Zoom Licenses</CardTitle>
                <CardDescription>Manage your Zoom meeting room licenses</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ValidateZoomAccountDialog />
                <Button variant="outline" size="sm" className="gap-2" onClick={() => fetchHostIds()} disabled={refreshingHostIds}>
                  <RefreshCw className={cn("h-4 w-4", refreshingHostIds && "animate-spin")} />
                  {refreshingHostIds ? 'Fetching...' : 'Refresh Host IDs'}
                </Button>
                <Dialog open={zoomSetupOpen} onOpenChange={setZoomSetupOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Shield className="h-4 w-4" /> Zoom API Setup
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="font-serif">Zoom API Credentials</DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-muted-foreground">
                      Enter your Server-to-Server OAuth credentials from <a href="https://marketplace.zoom.us" target="_blank" rel="noopener noreferrer" className="text-primary underline">Zoom Marketplace</a>. These are used to auto-fetch Host IDs for all rooms.
                    </p>
                    <div className="space-y-3 py-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Account ID</Label>
                        <Input placeholder="KhGiGCUa..." value={zoomCreds.account_id} onChange={(e) => setZoomCreds(p => ({ ...p, account_id: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Client ID</Label>
                        <Input placeholder="QO1NrH6s..." value={zoomCreds.client_id} onChange={(e) => setZoomCreds(p => ({ ...p, client_id: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Client Secret</Label>
                        <Input type="password" placeholder="••••••••" value={zoomCreds.client_secret} onChange={(e) => setZoomCreds(p => ({ ...p, client_secret: e.target.value }))} />
                      </div>
                    </div>
                    {hostIdResults && (
                      <div className="border rounded-md p-3 bg-muted/50 max-h-48 overflow-y-auto">
                        <p className="text-xs font-semibold mb-2">Results:</p>
                        {hostIdResults.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                            <span className={cn("w-2 h-2 rounded-full flex-shrink-0",
                              r.status === 'updated' ? 'bg-emerald-500' : 'bg-destructive'
                            )} />
                            <span className="truncate flex-1">{r.email}</span>
                            <span className="font-mono text-muted-foreground">{r.host_id || r.error || 'failed'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setZoomSetupOpen(false); setHostIdResults(null); }}>Close</Button>
                      <Button
                        onClick={() => fetchHostIds(zoomCreds)}
                        disabled={!zoomCreds.account_id || !zoomCreds.client_id || !zoomCreds.client_secret || refreshingHostIds}
                      >
                        {refreshingHostIds ? 'Fetching...' : 'Fetch & Update Host IDs'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" size="sm">
                      <Plus className="h-4 w-4" />
                      Add Room
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-serif">Add New Zoom Room</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="zoom_email">Zoom Email</Label>
                        <Input id="zoom_email" placeholder="room1@academy.com" value={newLicense.zoom_email} onChange={(e) => setNewLicense({ ...newLicense, zoom_email: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meeting_link">Meeting Link (PMI)</Label>
                        <Input id="meeting_link" placeholder="https://zoom.us/j/1234567890" value={newLicense.meeting_link} onChange={(e) => setNewLicense({ ...newLicense, meeting_link: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="host_id">Host ID (Optional)</Label>
                        <Input id="host_id" placeholder="Optional Zoom Host ID" value={newLicense.host_id} onChange={(e) => setNewLicense({ ...newLicense, host_id: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                      <Button onClick={() => addLicenseMutation.mutate(newLicense)} disabled={!newLicense.zoom_email || !newLicense.meeting_link || addLicenseMutation.isPending}>
                        Add Room
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead>Room</TableHead>
                     <TableHead>Email</TableHead>
                     <TableHead>Type</TableHead>
                     <TableHead>Priority</TableHead>
                     <TableHead>Link</TableHead>
                     <TableHead>Host ID</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Last Used</TableHead>
                     <TableHead className="w-[100px]" />
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {licenses?.map((license, idx) => (
                    <TableRow key={license.id}>
                       <TableCell className="font-semibold">Room {idx + 1}</TableCell>
                      <TableCell className="text-sm">{license.zoom_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          (license as any).license_type === 'basic'
                            ? 'bg-muted text-muted-foreground border-border'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        )}>
                          {(license as any).license_type === 'basic' ? 'Basic' : '● Licensed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{(license as any).priority ?? 0}</TableCell>
                      <TableCell>
                        <a href={license.meeting_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline text-sm">
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">
                        {(license as any).host_id || <span className="text-amber-500 text-xs">Not set</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          license.status === 'available'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : (license.status as string) === 'cooldown'
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              : 'bg-destructive/10 text-destructive border-destructive/20'
                        )} variant="outline">
                          {license.status === 'available' ? '● Ready' : (license.status as string) === 'cooldown' ? '● Cooldown' : '● Live'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {license.last_used_at ? formatDistanceToNow(new Date(license.last_used_at), { addSuffix: true }) : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditingLicense({
                              id: license.id,
                              zoom_email: license.zoom_email || '',
                              meeting_link: license.meeting_link || '',
                              host_id: (license as any).host_id || '',
                              license_type: (license as any).license_type || 'licensed',
                              priority: (license as any).priority ?? 0,
                            });
                            setEditDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (confirm('Delete this room?')) deleteLicenseMutation.mutate(license.id); }} disabled={license.status === 'busy'}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!licenses || licenses.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No rooms configured.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Edit License Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingLicense(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">Edit Zoom Room</DialogTitle>
              </DialogHeader>
              {editingLicense && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Zoom Email</Label>
                    <Input value={editingLicense.zoom_email} onChange={(e) => setEditingLicense({ ...editingLicense, zoom_email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Meeting Link (PMI)</Label>
                    <Input value={editingLicense.meeting_link} onChange={(e) => setEditingLicense({ ...editingLicense, meeting_link: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Host ID</Label>
                    <Input placeholder="Zoom Host ID for webhook matching" value={editingLicense.host_id} onChange={(e) => setEditingLicense({ ...editingLicense, host_id: e.target.value })} />
                    <p className="text-xs text-muted-foreground">Required for join/leave tracking via Zoom webhooks.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>License Type</Label>
                      <Select value={editingLicense.license_type} onValueChange={(v) => setEditingLicense({ ...editingLicense, license_type: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="licensed">Licensed (Recording)</SelectItem>
                          <SelectItem value="basic">Basic (Free)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Input type="number" min={0} value={editingLicense.priority} onChange={(e) => setEditingLicense({ ...editingLicense, priority: parseInt(e.target.value) || 0 })} />
                      <p className="text-xs text-muted-foreground">Lower = used first</p>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditingLicense(null); }}>Cancel</Button>
                <Button onClick={() => editingLicense && editLicenseMutation.mutate(editingLicense)} disabled={!editingLicense?.zoom_email || !editingLicense?.meeting_link || editLicenseMutation.isPending}>
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>)}

        {/* Sessions Section */}
        {activeSection === 'sessions' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif">Session History</CardTitle>
                <CardDescription>All live sessions with duration and recording</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setExportSessionsOpen(true)} disabled={sessionExportRows.length === 0} className="gap-2">
                  <Download className="h-4 w-4" /> Download CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['all-live-sessions'] })} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
              </div>

            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Ended</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Recording</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liveSessions?.map((session: any) => {
                      const duration = session.actual_start && session.actual_end
                        ? differenceInMinutes(new Date(session.actual_end), new Date(session.actual_start))
                        : session.actual_start && session.status === 'live'
                          ? differenceInMinutes(new Date(), new Date(session.actual_start))
                          : 0;
                      const expectedDuration = 30;
                      const durationPct = Math.min(100, Math.round((duration / expectedDuration) * 100));

                      return (
                        <TableRow key={session.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">{getSessionPrimaryLabel(session).charAt(0)}</span>
                              </div>
                              <div>
                                <span className="font-medium text-sm">{getSessionPrimaryLabel(session)}</span>
                                {session.teacherName && (
                                  <p className="text-xs text-muted-foreground">
                                    Room owner: {session.teacherName}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{session.actual_start ? format(new Date(session.actual_start), 'MMM d, HH:mm') : '-'}</TableCell>
                          <TableCell className="text-sm">{session.actual_end ? format(new Date(session.actual_end), 'HH:mm') : '-'}</TableCell>
                          <TableCell>
                            <div className="space-y-1 w-24">
                              <span className="text-sm font-medium">{duration > 0 ? `${duration} min` : '-'}</span>
                              {duration > 0 && (
                                <Progress value={durationPct} className={cn("h-1.5", durationPct < 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500")} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                          {session.recording_link ? (
                              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 text-primary" onClick={() => window.open(session.recording_link, '_blank')}>
                                <Play className="h-3 w-3" /> Watch
                              </Button>
                            ) : session.status === 'completed' && session.recording_status === 'pending' ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                                ⏳ Processing
                              </Badge>
                            ) : session.status === 'completed' && session.recording_status === 'failed' ? (
                              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                                Recording failed
                              </Badge>
                            ) : session.status === 'completed' ? (
                              <span className="text-muted-foreground text-sm">No recording</span>
                            ) : session.status === 'live' ? (
                              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                                Recording...
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              session.status === 'live' && 'bg-destructive/10 text-destructive border-destructive/20 animate-pulse',
                              session.status === 'completed' && 'bg-muted text-muted-foreground border-border',
                              session.status === 'scheduled' && 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            )} variant="outline">
                              {session.status === 'live' ? '● Live' : session.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!liveSessions || liveSessions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No sessions yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Join Logs Section */}
        {activeSection === 'logs' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif">Join &amp; Leave Logs</CardTitle>
                <CardDescription>Real-time tracking of participant activity</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setExportLogsOpen(true)} disabled={logExportRows.length === 0} className="gap-2">
                <Download className="h-4 w-4" /> Download CSV
              </Button>
            </CardHeader>

            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {visibleAttendanceLogs.map((log: any) => {
                    const isLeave = log.action === 'leave' || (log.action !== 'join_intent' && (Boolean(log.leave_time) || log.zoom_event_type === 'meeting.participant_left'));
                    const isJoin = !isLeave && (log.action === 'join' || log.action === 'join_intent');
                    const durationMin = (log.join_time && log.leave_time)
                      ? Math.max(0, Math.round((new Date(log.leave_time).getTime() - new Date(log.join_time).getTime()) / 60000))
                      : (typeof log.total_duration_minutes === 'number' ? log.total_duration_minutes : null);
                    return (
                      <div key={log.id} className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                        isJoin ? "border-emerald-500/20 bg-emerald-500/5" : isLeave ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-card"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          isJoin ? "bg-emerald-500/10" : "bg-amber-500/10"
                        )}>
                          {isJoin
                            ? <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                            : <ArrowDownLeft className="h-4 w-4 text-amber-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{log.userName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            {log.role ? ` • ${log.role}` : ''}
                            {log.participant_email ? ` • ${log.participant_email}` : ''}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {log.join_time ? `Joined ${format(new Date(log.join_time), 'HH:mm:ss')}` : ''}
                            {log.leave_time ? ` → Left ${format(new Date(log.leave_time), 'HH:mm:ss')}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="outline" className={cn(
                            "text-[10px]",
                            isJoin ? "text-emerald-600 border-emerald-500/20" : "text-amber-600 border-amber-500/20"
                          )}>
                            {isJoin ? 'Joined' : isLeave ? 'Left' : log.action}
                          </Badge>
                          {durationMin !== null && durationMin > 0 && (
                            <p className="text-[11px] font-medium text-foreground mt-1">{durationMin} min</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {visibleAttendanceLogs.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">No join logs recorded yet.</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
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