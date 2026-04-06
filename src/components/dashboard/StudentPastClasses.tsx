import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Clock, Calendar, Play, Loader2, ChevronDown } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StudentPastClassesProps {
  studentId: string;
  className?: string;
}

export function StudentPastClasses({ studentId, className }: StudentPastClassesProps) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['student-past-classes', studentId],
    queryFn: async () => {
      const { data: assignment } = await supabase
        .from('student_teacher_assignments')
        .select('teacher_id')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .limit(1);

      if (!assignment?.[0]?.teacher_id) return [];

      const { data: liveSessions, error } = await supabase
        .from('live_sessions')
        .select('id, actual_start, actual_end, recording_link, recording_status, recording_password, teacher_id')
        .eq('teacher_id', assignment[0].teacher_id)
        .eq('status', 'completed')
        .not('actual_start', 'is', null)
        .order('actual_start', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!liveSessions || liveSessions.length === 0) return [];

      const { data: teacher } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', assignment[0].teacher_id)
        .maybeSingle();

      const sessionIds = liveSessions.map(s => s.id);
      
      // Fetch attendance logs
      const { data: attendanceLogs } = await supabase
        .from('zoom_attendance_logs')
        .select('session_id, join_time, leave_time, total_duration_minutes')
        .eq('user_id', studentId)
        .in('session_id', sessionIds);

      const attendanceMap = new Map(attendanceLogs?.map(log => [log.session_id, log]) || []);

      // Fetch recordings from session_recordings table
      const { data: recordings } = await (supabase as any)
        .from('session_recordings')
        .select('session_id, recording_type, play_url, download_url, password, file_type, file_size_mb')
        .in('session_id', sessionIds)
        .eq('status', 'available');

      const recordingsMap = new Map<string, any[]>();
      (recordings || []).forEach((rec: any) => {
        const existing = recordingsMap.get(rec.session_id) || [];
        existing.push(rec);
        recordingsMap.set(rec.session_id, existing);
      });

      return liveSessions.map(session => {
        const attendance = attendanceMap.get(session.id);
        const duration = session.actual_start && session.actual_end
          ? differenceInMinutes(new Date(session.actual_end), new Date(session.actual_start))
          : 0;
        const sessionRecordings = recordingsMap.get(session.id) || [];

        return {
          id: session.id,
          date: session.actual_start,
          teacherName: teacher?.full_name || 'Teacher',
          duration,
          recordingLink: session.recording_link,
          recordingStatus: (session as any).recording_status || 'pending',
          recordingPassword: (session as any).recording_password,
          recordings: sessionRecordings,
          attended: !!attendance,
          attendedDuration: attendance?.total_duration_minutes || 0,
        };
      });
    },
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Video className="h-4 w-4" />
            Past Classes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const openRecording = (url: string, password?: string) => {
    const fullUrl = password ? `${url}?pwd=${encodeURIComponent(password)}` : url;
    window.open(fullUrl, '_blank');
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-base flex items-center gap-2">
          <Video className="h-4 w-4" />
          Past Classes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sessions && sessions.length > 0 ? (
          <ScrollArea className="h-64">
            <div className="space-y-2 pr-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg border border-border/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {format(new Date(session.date), 'EEEE, MMM d')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(session.date), 'h:mm a')}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {session.duration} min
                        </span>
                        {session.attended && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                              Attended ({Math.round(session.attendedDuration)}m)
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {session.recordingStatus === 'ready' && session.recordings.length > 1 ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                            <Play className="h-3 w-3" />
                            Recording
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {session.recordings.map((rec: any, idx: number) => (
                            <DropdownMenuItem
                              key={idx}
                              onClick={() => openRecording(rec.play_url || rec.download_url, rec.password)}
                            >
                              <Play className="h-3 w-3 mr-2" />
                              {rec.recording_type?.replace(/_/g, ' ') || rec.file_type}
                              {rec.file_size_mb && <span className="ml-auto text-muted-foreground text-xs">{rec.file_size_mb} MB</span>}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : session.recordingStatus === 'ready' && session.recordingLink ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => openRecording(session.recordingLink!, session.recordingPassword)}
                      >
                        <Play className="h-3 w-3" />
                        Recording
                      </Button>
                    ) : session.recordingStatus === 'pending' ? (
                      <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-200">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Processing
                      </Badge>
                    ) : session.recordingStatus === 'failed' ? (
                      <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">
                        No Recording
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Video className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No past classes yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}