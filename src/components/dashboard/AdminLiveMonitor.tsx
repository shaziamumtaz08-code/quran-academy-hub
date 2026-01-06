import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Users, Clock, Wifi, WifiOff, User, Activity } from 'lucide-react';
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AdminLiveMonitorProps {
  className?: string;
}

export function AdminLiveMonitor({ className }: AdminLiveMonitorProps) {
  const [now, setNow] = React.useState(new Date());

  // Update timer every second for live duration
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch all zoom licenses and their status
  const { data: licenses, isLoading: licensesLoading } = useQuery({
    queryKey: ['zoom-licenses-monitor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_licenses')
        .select('id, zoom_email, status, last_used_at, meeting_link');
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });

  // Fetch active live sessions with teacher info and student count
  const { data: liveSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['active-live-sessions-monitor'],
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from('live_sessions')
        .select(`
          id,
          teacher_id,
          actual_start,
          status,
          group_id,
          license:zoom_licenses(id, zoom_email, meeting_link)
        `)
        .eq('status', 'live');

      if (error) throw error;
      if (!sessions || sessions.length === 0) return [];

      // Get teacher names
      const teacherIds = sessions.map(s => s.teacher_id);
      const { data: teachers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds);

      const teacherMap = new Map(teachers?.map(t => [t.id, t.full_name]) || []);

      // Get student join counts for each session
      const sessionIds = sessions.map(s => s.id);
      const { data: attendanceLogs } = await supabase
        .from('zoom_attendance_logs')
        .select('session_id, user_id')
        .in('session_id', sessionIds)
        .eq('action', 'join_intent');

      // Count unique students per session
      const studentCounts = new Map<string, Set<string>>();
      attendanceLogs?.forEach(log => {
        if (!studentCounts.has(log.session_id)) {
          studentCounts.set(log.session_id, new Set());
        }
        studentCounts.get(log.session_id)?.add(log.user_id);
      });

      return sessions.map(session => ({
        ...session,
        teacherName: teacherMap.get(session.teacher_id) || 'Unknown',
        studentCount: studentCounts.get(session.id)?.size || 0,
      }));
    },
    refetchInterval: 5000,
  });

  // Fetch recent join logs with live updates
  const { data: recentJoins, isLoading: joinsLoading } = useQuery({
    queryKey: ['recent-join-logs-monitor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_attendance_logs')
        .select(`
          id,
          user_id,
          action,
          timestamp,
          session_id
        `)
        .eq('action', 'join_intent')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(l => l.user_id))];
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u.full_name]) || []);

      return data.map(log => ({
        ...log,
        userName: userMap.get(log.user_id) || 'Unknown',
        timeAgo: getTimeAgo(new Date(log.timestamp)),
      }));
    },
    refetchInterval: 5000,
  });

  const isLoading = licensesLoading || sessionsLoading || joinsLoading;
  const availableLicenses = licenses?.filter(l => l.status === 'available').length || 0;
  const busyLicenses = licenses?.filter(l => l.status === 'busy').length || 0;
  const totalLicenses = licenses?.length || 0;

  // Format duration
  const formatDuration = (startTime: string | null) => {
    if (!startTime) return '0:00';
    const start = new Date(startTime);
    const diffSec = differenceInSeconds(now, start);
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent animate-pulse" />
            Live Sessions Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3 bg-gradient-to-r from-[hsl(var(--navy))]/5 to-transparent">
        <CardTitle className="font-serif flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent" />
            Live Sessions Monitor
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <Wifi className="h-3 w-3" />
              {availableLicenses}/{totalLicenses} Free
            </Badge>
            {busyLicenses > 0 && (
              <Badge variant="secondary" className="gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                <WifiOff className="h-3 w-3" />
                {busyLicenses} Active
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {/* License Status Grid - Visual indicators */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {licenses?.map((license, idx) => (
            <div
              key={license.id}
              className={cn(
                'relative rounded-lg p-2 border text-center transition-all duration-300',
                license.status === 'available' 
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 ring-2 ring-red-400/50 animate-pulse'
              )}
            >
              <div className={cn(
                'w-3 h-3 rounded-full mx-auto mb-1',
                license.status === 'available' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
              )} />
              <p className="text-[10px] text-muted-foreground">Room {idx + 1}</p>
              <p className={cn(
                'text-[10px] font-semibold',
                license.status === 'available' ? 'text-emerald-600' : 'text-red-600'
              )}>
                {license.status === 'available' ? 'Ready' : 'Live'}
              </p>
            </div>
          ))}
        </div>

        {/* Active Sessions - Main Focus */}
        {liveSessions && liveSessions.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Active Classes ({liveSessions.length})
            </h4>
            <div className="grid gap-3">
              {liveSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between bg-gradient-to-r from-accent/5 to-transparent rounded-xl p-4 border border-accent/20"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                        <Video className="h-5 w-5 text-accent" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border-2 border-accent flex items-center justify-center">
                        <span className="text-[10px] font-bold text-accent">{session.studentCount}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{session.teacherName}</p>
                      <p className="text-xs text-muted-foreground">{(session.license as any)?.zoom_email?.split('@')[0]}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {session.studentCount} student{session.studentCount !== 1 ? 's' : ''} joined
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-accent">
                      <Clock className="h-4 w-4" />
                      <span className="text-lg font-mono font-bold">{formatDuration(session.actual_start)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Duration</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Join Logs - Scrollable */}
        {recentJoins && recentJoins.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Recent Student Joins
            </h4>
            <ScrollArea className="h-28">
              <div className="space-y-1 pr-4">
                {recentJoins.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-xs py-2 px-3 bg-secondary/40 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-primary">
                          {log.userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-foreground font-medium">{log.userName}</span>
                    </div>
                    <span className="text-muted-foreground">{log.timeAgo}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Empty State */}
        {(!liveSessions || liveSessions.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No Active Classes</p>
            <p className="text-xs">All Zoom rooms are available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function for time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return format(date, 'MMM d, HH:mm');
}
