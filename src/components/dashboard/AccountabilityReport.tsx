import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, LogOut, TrendingDown } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface AccountabilityReportProps {
  date?: Date;
  className?: string;
}

interface AccountabilityIssue {
  id: string;
  type: 'late_entry' | 'early_leave' | 'short_session';
  userName: string;
  userRole: 'teacher' | 'student';
  sessionId: string;
  details: string;
  timestamp: string;
  minutesAffected: number;
}

export function AccountabilityReport({ date = new Date(), className }: AccountabilityReportProps) {
  const { data: issues, isLoading } = useQuery({
    queryKey: ['accountability-report', format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dayStart = startOfDay(date).toISOString();
      const dayEnd = endOfDay(date).toISOString();

      // Fetch attendance logs for the day with join/leave times
      const { data: logs, error } = await supabase
        .from('zoom_attendance_logs')
        .select(`
          id,
          user_id,
          session_id,
          action,
          timestamp,
          join_time,
          leave_time,
          total_duration_minutes
        `)
        .gte('timestamp', dayStart)
        .lte('timestamp', dayEnd);

      if (error) throw error;
      if (!logs || logs.length === 0) return [];

      // Get session details
      const sessionIds = [...new Set(logs.map(l => l.session_id))];
      const { data: sessions } = await supabase
        .from('live_sessions')
        .select('id, teacher_id, actual_start, scheduled_start')
        .in('id', sessionIds);

      const sessionMap = new Map(sessions?.map(s => [s.id, s]) || []);

      // Get user details and roles
      const userIds = [...new Set(logs.map(l => l.user_id))];
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u.full_name]) || []);
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const accountabilityIssues: AccountabilityIssue[] = [];

      logs.forEach(log => {
        const session = sessionMap.get(log.session_id);
        const userName = userMap.get(log.user_id) || 'Unknown';
        const role = roleMap.get(log.user_id);
        const isTeacher = role === 'teacher' || (session && session.teacher_id === log.user_id);

        // Check for late entry (join > 10 minutes from session start)
        if (log.join_time && session?.actual_start) {
          const joinTime = new Date(log.join_time);
          const sessionStart = new Date(session.actual_start);
          const lateMinutes = Math.floor((joinTime.getTime() - sessionStart.getTime()) / 60000);

          if (lateMinutes > 10) {
            accountabilityIssues.push({
              id: `${log.id}-late`,
              type: 'late_entry',
              userName,
              userRole: isTeacher ? 'teacher' : 'student',
              sessionId: log.session_id,
              details: `Joined ${lateMinutes} minutes after class started`,
              timestamp: log.join_time,
              minutesAffected: lateMinutes,
            });
          }
        }

        // Check for short session / early leave
        if (log.total_duration_minutes !== null && log.total_duration_minutes < 25) {
          const expectedDuration = 30; // Default expected duration
          const earlyMinutes = expectedDuration - log.total_duration_minutes;

          if (earlyMinutes > 5) {
            accountabilityIssues.push({
              id: `${log.id}-early`,
              type: 'early_leave',
              userName,
              userRole: isTeacher ? 'teacher' : 'student',
              sessionId: log.session_id,
              details: `Left ${earlyMinutes} minutes early (stayed ${log.total_duration_minutes} mins)`,
              timestamp: log.leave_time || log.timestamp,
              minutesAffected: earlyMinutes,
            });
          }
        }
      });

      return accountabilityIssues.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const lateEntries = issues?.filter(i => i.type === 'late_entry') || [];
  const earlyLeaves = issues?.filter(i => i.type === 'early_leave') || [];
  const teacherIssues = issues?.filter(i => i.userRole === 'teacher') || [];

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Daily Accountability Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="font-serif flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Daily Accountability Report
          </span>
          <Badge variant="outline" className="text-xs">
            {format(date, 'MMM d, yyyy')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
            <Clock className="h-4 w-4 mx-auto text-amber-600 mb-1" />
            <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{lateEntries.length}</p>
            <p className="text-[10px] text-amber-600">Late Entries</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
            <LogOut className="h-4 w-4 mx-auto text-red-600 mb-1" />
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{earlyLeaves.length}</p>
            <p className="text-[10px] text-red-600">Early Leaves</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
            <TrendingDown className="h-4 w-4 mx-auto text-purple-600 mb-1" />
            <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{teacherIssues.length}</p>
            <p className="text-[10px] text-purple-600">Teacher Issues</p>
          </div>
        </div>

        {/* Issues List */}
        {issues && issues.length > 0 ? (
          <ScrollArea className="h-48">
            <div className="space-y-2 pr-4">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-start gap-3 p-3 bg-secondary/40 rounded-lg border border-border/50"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    issue.type === 'late_entry' 
                      ? 'bg-amber-100 dark:bg-amber-900/40' 
                      : 'bg-red-100 dark:bg-red-900/40'
                  }`}>
                    {issue.type === 'late_entry' ? (
                      <Clock className="h-4 w-4 text-amber-600" />
                    ) : (
                      <LogOut className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {issue.userName}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-[9px] px-1.5 py-0 ${
                          issue.userRole === 'teacher' 
                            ? 'border-purple-400 text-purple-600' 
                            : 'border-blue-400 text-blue-600'
                        }`}
                      >
                        {issue.userRole}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {issue.details}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {format(new Date(issue.timestamp), 'HH:mm')}
                    </p>
                  </div>
                  <Badge 
                    variant="secondary"
                    className={`text-[10px] shrink-0 ${
                      issue.minutesAffected > 15 
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' 
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    }`}
                  >
                    {issue.minutesAffected}m
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No accountability issues today</p>
            <p className="text-xs">All sessions running smoothly</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
