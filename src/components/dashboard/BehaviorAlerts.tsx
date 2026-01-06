import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bell, 
  Clock, 
  AlertTriangle, 
  LogOut,
  Users,
  TrendingDown,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

interface BehaviorAlertsProps {
  className?: string;
}

interface BehaviorAlert {
  type: 'late_arrival' | 'discrepancy' | 'early_exit';
  userId: string;
  userName: string;
  count: number;
  details: string;
  severity: 'warning' | 'critical';
}

export function BehaviorAlerts({ className }: BehaviorAlertsProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['behavior-alerts', format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const allAlerts: BehaviorAlert[] = [];

      // 1. Repeated Late Arrival - Top 5 users with most late entries
      const { data: lateLogs } = await supabase
        .from('zoom_attendance_logs')
        .select('user_id, session_id, join_time, timestamp')
        .eq('action', 'join_intent')
        .gte('timestamp', format(weekStart, 'yyyy-MM-dd'))
        .lte('timestamp', format(weekEnd, 'yyyy-MM-dd'));

      if (lateLogs && lateLogs.length > 0) {
        const sessionIds = [...new Set(lateLogs.map(l => l.session_id))];
        const { data: sessions } = await supabase
          .from('live_sessions')
          .select('id, actual_start, scheduled_start')
          .in('id', sessionIds);

        const sessionMap = new Map(sessions?.map(s => [s.id, s]) || []);
        
        const lateCountByUser: Record<string, number> = {};
        lateLogs.forEach(log => {
          const session = sessionMap.get(log.session_id);
          if (session && log.join_time) {
            const sessionStart = new Date(session.actual_start || session.scheduled_start || log.timestamp);
            const joinTime = new Date(log.join_time);
            const lateMinutes = (joinTime.getTime() - sessionStart.getTime()) / 60000;
            if (lateMinutes > 10) {
              lateCountByUser[log.user_id] = (lateCountByUser[log.user_id] || 0) + 1;
            }
          }
        });

        // Get top 5 late users
        const topLateUsers = Object.entries(lateCountByUser)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        if (topLateUsers.length > 0) {
          const userIds = topLateUsers.map(([id]) => id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          
          const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
          
          topLateUsers.forEach(([userId, count]) => {
            if (count >= 2) { // Only show if 2+ late arrivals
              allAlerts.push({
                type: 'late_arrival',
                userId,
                userName: nameMap.get(userId) || 'Unknown',
                count,
                details: `${count} late arrival${count > 1 ? 's' : ''} this week`,
                severity: count >= 4 ? 'critical' : 'warning',
              });
            }
          });
        }
      }

      // 2. Manual vs Auto Discrepancies
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('id, student_id, class_date, class_time, status, student:profiles!attendance_student_id_fkey(full_name)')
        .eq('status', 'present')
        .gte('class_date', format(subDays(new Date(), 7), 'yyyy-MM-dd'));

      if (attendanceRecords && attendanceRecords.length > 0) {
        const { data: zoomLogs } = await supabase
          .from('zoom_attendance_logs')
          .select('user_id, timestamp, total_duration_minutes, action')
          .gte('timestamp', format(subDays(new Date(), 7), 'yyyy-MM-dd'));

        // Group zoom logs by user and date
        const zoomByUserDate = new Map<string, { hasLog: boolean; duration: number }>();
        zoomLogs?.forEach(log => {
          const dateKey = format(new Date(log.timestamp), 'yyyy-MM-dd');
          const key = `${log.user_id}_${dateKey}`;
          const existing = zoomByUserDate.get(key) || { hasLog: false, duration: 0 };
          existing.hasLog = true;
          if (log.action === 'leave' && log.total_duration_minutes) {
            existing.duration = Math.max(existing.duration, log.total_duration_minutes);
          }
          zoomByUserDate.set(key, existing);
        });

        // Count discrepancies per user
        const discrepancyByUser: Record<string, { count: number; name: string; zeroMins: number; lowMins: number }> = {};
        
        attendanceRecords.forEach(record => {
          const key = `${record.student_id}_${record.class_date}`;
          const zoomData = zoomByUserDate.get(key);
          
          // RED: Manual present but Zoom shows 0 minutes
          // AMBER: Manual present but Zoom shows <15 minutes
          if (!zoomData?.hasLog || zoomData.duration === 0) {
            if (!discrepancyByUser[record.student_id]) {
              discrepancyByUser[record.student_id] = { 
                count: 0, 
                name: record.student?.full_name || 'Unknown',
                zeroMins: 0,
                lowMins: 0
              };
            }
            discrepancyByUser[record.student_id].count++;
            discrepancyByUser[record.student_id].zeroMins++;
          } else if (zoomData.duration < 15) {
            if (!discrepancyByUser[record.student_id]) {
              discrepancyByUser[record.student_id] = { 
                count: 0, 
                name: record.student?.full_name || 'Unknown',
                zeroMins: 0,
                lowMins: 0
              };
            }
            discrepancyByUser[record.student_id].count++;
            discrepancyByUser[record.student_id].lowMins++;
          }
        });

        Object.entries(discrepancyByUser).forEach(([userId, data]) => {
          if (data.count > 0) {
            allAlerts.push({
              type: 'discrepancy',
              userId,
              userName: data.name,
              count: data.count,
              details: `${data.zeroMins > 0 ? `${data.zeroMins} no-show` : ''}${data.zeroMins > 0 && data.lowMins > 0 ? ', ' : ''}${data.lowMins > 0 ? `${data.lowMins} short sessions` : ''}`,
              severity: data.zeroMins >= 2 ? 'critical' : 'warning',
            });
          }
        });
      }

      // 3. Early Exit Patterns
      const { data: exitLogs } = await supabase
        .from('zoom_attendance_logs')
        .select('user_id, total_duration_minutes, session_id, timestamp')
        .eq('action', 'leave')
        .not('total_duration_minutes', 'is', null)
        .gte('timestamp', format(subDays(new Date(), 7), 'yyyy-MM-dd'));

      if (exitLogs && exitLogs.length > 0) {
        const { data: schedules } = await supabase
          .from('schedules')
          .select('assignment_id, duration_minutes, assignment:student_teacher_assignments!schedules_assignment_id_fkey(student_id)');

        const scheduleDurationMap = new Map<string, number>();
        schedules?.forEach(s => {
          if (s.assignment?.student_id) {
            scheduleDurationMap.set(s.assignment.student_id, s.duration_minutes);
          }
        });

        const earlyExitByUser: Record<string, number> = {};
        exitLogs.forEach(log => {
          const scheduledDuration = scheduleDurationMap.get(log.user_id) || 30;
          const actualDuration = log.total_duration_minutes || 0;
          // Early exit = left before 80% of scheduled time
          if (actualDuration > 0 && actualDuration < scheduledDuration * 0.8) {
            earlyExitByUser[log.user_id] = (earlyExitByUser[log.user_id] || 0) + 1;
          }
        });

        const topEarlyExiters = Object.entries(earlyExitByUser)
          .filter(([, count]) => count >= 2)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        if (topEarlyExiters.length > 0) {
          const userIds = topEarlyExiters.map(([id]) => id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);

          const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

          topEarlyExiters.forEach(([userId, count]) => {
            allAlerts.push({
              type: 'early_exit',
              userId,
              userName: nameMap.get(userId) || 'Unknown',
              count,
              details: `${count} early exit${count > 1 ? 's' : ''} (<80% session time)`,
              severity: count >= 3 ? 'critical' : 'warning',
            });
          });
        }
      }

      // Sort by severity then count
      return allAlerts.sort((a, b) => {
        if (a.severity !== b.severity) {
          return a.severity === 'critical' ? -1 : 1;
        }
        return b.count - a.count;
      });
    },
    refetchInterval: 60000,
  });

  const getAlertIcon = (type: BehaviorAlert['type']) => {
    switch (type) {
      case 'late_arrival':
        return Clock;
      case 'discrepancy':
        return Eye;
      case 'early_exit':
        return LogOut;
      default:
        return AlertTriangle;
    }
  };

  const getAlertColor = (type: BehaviorAlert['type'], severity: string) => {
    if (severity === 'critical') {
      return 'text-destructive bg-destructive/10 border-destructive/30';
    }
    switch (type) {
      case 'late_arrival':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      case 'discrepancy':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'early_exit':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getAlertLabel = (type: BehaviorAlert['type']) => {
    switch (type) {
      case 'late_arrival':
        return 'Late Arrival';
      case 'discrepancy':
        return 'Mismatch';
      case 'early_exit':
        return 'Early Exit';
      default:
        return 'Alert';
    }
  };

  const lateCount = alerts?.filter(a => a.type === 'late_arrival').length || 0;
  const discrepancyCount = alerts?.filter(a => a.type === 'discrepancy').length || 0;
  const earlyExitCount = alerts?.filter(a => a.type === 'early_exit').length || 0;

  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Behavior Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-serif flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Behavior Alerts
          </CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            {lateCount > 0 && (
              <Badge variant="outline" className="gap-1 text-[10px] text-amber-600 border-amber-300">
                <Clock className="h-3 w-3" />
                {lateCount}
              </Badge>
            )}
            {discrepancyCount > 0 && (
              <Badge variant="outline" className="gap-1 text-[10px] text-red-500 border-red-300">
                <Eye className="h-3 w-3" />
                {discrepancyCount}
              </Badge>
            )}
            {earlyExitCount > 0 && (
              <Badge variant="outline" className="gap-1 text-[10px] text-orange-600 border-orange-300">
                <LogOut className="h-3 w-3" />
                {earlyExitCount}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Weekly attendance behavior patterns
        </p>
      </CardHeader>
      <CardContent>
        {!alerts || alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="font-medium text-sm">No Alerts</p>
            <p className="text-xs mt-1">All attendance behavior looks normal</p>
          </div>
        ) : (
          <ScrollArea className="h-[220px] pr-3">
            <div className="space-y-2">
              {alerts.map((alert, idx) => {
                const Icon = getAlertIcon(alert.type);
                return (
                  <div
                    key={`${alert.type}-${alert.userId}-${idx}`}
                    className={cn(
                      "rounded-lg p-2.5 border transition-colors",
                      getAlertColor(alert.type, alert.severity)
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {alert.userName}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[9px] px-1.5 py-0",
                              alert.severity === 'critical' ? 'border-destructive text-destructive' : ''
                            )}
                          >
                            {getAlertLabel(alert.type)}
                          </Badge>
                        </div>
                        <p className="text-xs mt-0.5 opacity-80">
                          {alert.details}
                        </p>
                      </div>
                      <span className="text-lg font-bold opacity-60">{alert.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
