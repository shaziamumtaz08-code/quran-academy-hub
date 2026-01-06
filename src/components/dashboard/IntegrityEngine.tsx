import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  Clock, 
  Eye, 
  Timer, 
  ChevronRight,
  UserX,
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { Link } from 'react-router-dom';

interface IntegrityEngineProps {
  className?: string;
}

interface IntegrityIssue {
  type: 'serial_tardy' | 'ghosting' | 'time_thief';
  userId: string;
  userName: string;
  count?: number;
  details: string;
  severity: 'warning' | 'critical';
  sessionId?: string;
  date?: string;
}

export function IntegrityEngine({ className }: IntegrityEngineProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  // Fetch integrity issues
  const { data: issues, isLoading } = useQuery({
    queryKey: ['integrity-issues', format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const allIssues: IntegrityIssue[] = [];

      // 1. Serial Tardy: Users with >3 late entries this week
      const { data: lateLogs } = await supabase
        .from('zoom_attendance_logs')
        .select('user_id, session_id, join_time, timestamp')
        .eq('action', 'join_intent')
        .gte('timestamp', format(weekStart, 'yyyy-MM-dd'))
        .lte('timestamp', format(weekEnd, 'yyyy-MM-dd'));

      // Get session start times to calculate late entries
      if (lateLogs && lateLogs.length > 0) {
        const sessionIds = [...new Set(lateLogs.map(l => l.session_id))];
        const { data: sessions } = await supabase
          .from('live_sessions')
          .select('id, actual_start, scheduled_start')
          .in('id', sessionIds);

        const sessionMap = new Map(sessions?.map(s => [s.id, s]) || []);
        
        // Calculate late entries per user (>10 mins after start)
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

        // Get user names for those with >3 late entries
        const serialTardyUsers = Object.entries(lateCountByUser).filter(([, count]) => count > 3);
        if (serialTardyUsers.length > 0) {
          const userIds = serialTardyUsers.map(([id]) => id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          
          const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
          
          serialTardyUsers.forEach(([userId, count]) => {
            allIssues.push({
              type: 'serial_tardy',
              userId,
              userName: nameMap.get(userId) || 'Unknown',
              count,
              details: `${count} late entries (>10 min) this week`,
              severity: count > 5 ? 'critical' : 'warning',
            });
          });
        }
      }

      // 2. Ghosting: Manual "present" but no zoom log
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('id, student_id, class_date, class_time, status, student:profiles!attendance_student_id_fkey(full_name)')
        .eq('status', 'present')
        .gte('class_date', format(subDays(new Date(), 7), 'yyyy-MM-dd'));

      if (attendanceRecords && attendanceRecords.length > 0) {
        // Get all zoom logs for these dates
        const { data: zoomLogs } = await supabase
          .from('zoom_attendance_logs')
          .select('user_id, timestamp')
          .eq('action', 'join_intent')
          .gte('timestamp', format(subDays(new Date(), 7), 'yyyy-MM-dd'));

        const zoomLogsByUserDate = new Map<string, Set<string>>();
        zoomLogs?.forEach(log => {
          const dateKey = format(new Date(log.timestamp), 'yyyy-MM-dd');
          const key = `${log.user_id}_${dateKey}`;
          if (!zoomLogsByUserDate.has(key)) {
            zoomLogsByUserDate.set(key, new Set());
          }
          zoomLogsByUserDate.get(key)?.add(log.timestamp);
        });

        attendanceRecords.forEach(record => {
          const key = `${record.student_id}_${record.class_date}`;
          if (!zoomLogsByUserDate.has(key)) {
            allIssues.push({
              type: 'ghosting',
              userId: record.student_id,
              userName: record.student?.full_name || 'Unknown',
              details: `Marked present on ${format(new Date(record.class_date), 'MMM dd')} but no Zoom log`,
              severity: 'critical',
              date: record.class_date,
            });
          }
        });
      }

      // 3. Time Thieves: Sessions <80% of scheduled duration
      const { data: shortSessions } = await supabase
        .from('zoom_attendance_logs')
        .select('user_id, total_duration_minutes, session_id, timestamp')
        .eq('action', 'leave')
        .not('total_duration_minutes', 'is', null)
        .gte('timestamp', format(subDays(new Date(), 7), 'yyyy-MM-dd'));

      if (shortSessions && shortSessions.length > 0) {
        // Get schedule durations
        const { data: schedules } = await supabase
          .from('schedules')
          .select('assignment_id, duration_minutes, assignment:student_teacher_assignments!schedules_assignment_id_fkey(student_id)');

        const scheduleDurationMap = new Map<string, number>();
        schedules?.forEach(s => {
          if (s.assignment?.student_id) {
            scheduleDurationMap.set(s.assignment.student_id, s.duration_minutes);
          }
        });

        const userIds = [...new Set(shortSessions.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

        shortSessions.forEach(session => {
          const scheduledDuration = scheduleDurationMap.get(session.user_id) || 30;
          const actualDuration = session.total_duration_minutes || 0;
          const percentage = (actualDuration / scheduledDuration) * 100;

          if (percentage < 80 && actualDuration > 0) {
            allIssues.push({
              type: 'time_thief',
              userId: session.user_id,
              userName: nameMap.get(session.user_id) || 'Unknown',
              details: `Only ${actualDuration}/${scheduledDuration} mins (${Math.round(percentage)}%)`,
              severity: percentage < 50 ? 'critical' : 'warning',
              sessionId: session.session_id,
              date: format(new Date(session.timestamp), 'MMM dd'),
            });
          }
        });
      }

      return allIssues;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const getIssueIcon = (type: IntegrityIssue['type']) => {
    switch (type) {
      case 'serial_tardy':
        return Clock;
      case 'ghosting':
        return Eye;
      case 'time_thief':
        return Timer;
      default:
        return AlertTriangle;
    }
  };

  const getIssueColor = (type: IntegrityIssue['type'], severity: string) => {
    if (severity === 'critical') {
      return 'text-destructive bg-destructive/10 border-destructive/20';
    }
    switch (type) {
      case 'serial_tardy':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      case 'ghosting':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'time_thief':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getIssueLabel = (type: IntegrityIssue['type']) => {
    switch (type) {
      case 'serial_tardy':
        return 'Serial Tardy';
      case 'ghosting':
        return 'Ghosting';
      case 'time_thief':
        return 'Time Thief';
      default:
        return 'Issue';
    }
  };

  const criticalCount = issues?.filter(i => i.severity === 'critical').length || 0;
  const warningCount = issues?.filter(i => i.severity === 'warning').length || 0;

  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Integrity Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
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
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Integrity Engine
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <UserX className="h-3 w-3" />
                {criticalCount} Critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700">
                <TrendingDown className="h-3 w-3" />
                {warningCount} Warnings
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Detecting attendance anomalies this week
        </p>
      </CardHeader>
      <CardContent>
        {!issues || issues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">All Clear</p>
            <p className="text-sm mt-1">No integrity issues detected this week</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {issues.map((issue, idx) => {
                  const Icon = getIssueIcon(issue.type);
                  return (
                    <div
                      key={`${issue.type}-${issue.userId}-${idx}`}
                      className={cn(
                        "rounded-lg p-3 border transition-colors hover:shadow-sm",
                        getIssueColor(issue.type, issue.severity)
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {issue.userName}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[9px] px-1.5",
                                issue.severity === 'critical' ? 'border-destructive text-destructive' : ''
                              )}
                            >
                              {getIssueLabel(issue.type)}
                            </Badge>
                          </div>
                          <p className="text-xs mt-0.5 opacity-80">
                            {issue.details}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            
            <div className="mt-4 pt-3 border-t">
              <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                <Link to="/integrity-audit">
                  View Full Audit Report
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
