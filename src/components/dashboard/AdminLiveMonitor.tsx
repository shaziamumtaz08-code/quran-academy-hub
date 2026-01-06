import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Users, Clock, Wifi, WifiOff } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminLiveMonitorProps {
  className?: string;
}

export function AdminLiveMonitor({ className }: AdminLiveMonitorProps) {
  // Fetch all zoom licenses and their status
  const { data: licenses, isLoading: licensesLoading } = useQuery({
    queryKey: ['zoom-licenses-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_licenses')
        .select('id, zoom_email, status, last_used_at, meeting_link');
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Fetch active live sessions with teacher and student info
  const { data: liveSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['active-live-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select(`
          id,
          teacher_id,
          actual_start,
          status,
          license:zoom_licenses(id, zoom_email)
        `)
        .eq('status', 'live');

      if (error) throw error;

      // Get teacher names
      if (!data || data.length === 0) return [];

      const teacherIds = data.map(s => s.teacher_id);
      const { data: teachers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds);

      const teacherMap = new Map(teachers?.map(t => [t.id, t.full_name]) || []);

      return data.map(session => ({
        ...session,
        teacherName: teacherMap.get(session.teacher_id) || 'Unknown',
        duration: session.actual_start 
          ? differenceInMinutes(new Date(), new Date(session.actual_start))
          : 0,
      }));
    },
    refetchInterval: 10000,
  });

  // Fetch recent join logs
  const { data: recentJoins, isLoading: joinsLoading } = useQuery({
    queryKey: ['recent-join-logs'],
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
        .limit(10);

      if (error) throw error;

      if (!data || data.length === 0) return [];

      const userIds = data.map(l => l.user_id);
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u.full_name]) || []);

      return data.map(log => ({
        ...log,
        userName: userMap.get(log.user_id) || 'Unknown',
      }));
    },
    refetchInterval: 10000,
  });

  const isLoading = licensesLoading || sessionsLoading || joinsLoading;
  const availableLicenses = licenses?.filter(l => l.status === 'available').length || 0;
  const busyLicenses = licenses?.filter(l => l.status === 'busy').length || 0;

  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Video className="h-5 w-5 text-accent" />
            Live Sessions Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Video className="h-5 w-5 text-accent" />
            Live Sessions Monitor
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Wifi className="h-3 w-3 text-emerald-500" />
              {availableLicenses} Available
            </Badge>
            <Badge variant="outline" className="gap-1">
              <WifiOff className="h-3 w-3 text-red-500" />
              {busyLicenses} Busy
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* License Status Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {licenses?.map((license) => (
            <div
              key={license.id}
              className={cn(
                'rounded-lg p-3 border text-center transition-colors',
                license.status === 'available' 
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              )}
            >
              <div className={cn(
                'w-3 h-3 rounded-full mx-auto mb-1',
                license.status === 'available' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              )} />
              <p className="text-xs text-muted-foreground truncate">{license.zoom_email?.split('@')[0]}</p>
              <p className={cn(
                'text-xs font-medium',
                license.status === 'available' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              )}>
                {license.status === 'available' ? 'Ready' : 'In Use'}
              </p>
            </div>
          ))}
        </div>

        {/* Active Sessions */}
        {liveSessions && liveSessions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active Classes ({liveSessions.length})
            </h4>
            <div className="space-y-2">
              {liveSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between bg-secondary/50 rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{session.teacherName}</p>
                      <p className="text-xs text-muted-foreground">{(session.license as any)?.zoom_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{session.duration} min</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Join Logs */}
        {recentJoins && recentJoins.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Recent Joins</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {recentJoins.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-xs py-1.5 px-2 bg-secondary/30 rounded"
                >
                  <span className="text-foreground">{log.userName}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(log.timestamp), 'HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!liveSessions || liveSessions.length === 0) && (
          <div className="text-center py-6 text-muted-foreground">
            <Video className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No active live sessions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
