import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Video, Clock, User, BookOpen, ChevronRight, RefreshCw } from 'lucide-react';
import { format, addDays, setHours, setMinutes, addMinutes, subMinutes, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

interface LiveClassQueueProps {
  className?: string;
}

const GRACE_PERIOD_MINUTES = 15;

type ClassStatus = 'waiting' | 'ready' | 'live';

interface QueuedClass {
  id: string;
  scheduleId: string;
  subjectName: string;
  teacherName: string;
  studentName: string;
  scheduledTime: string;
  scheduledDateTime: Date;
  status: ClassStatus;
  minutesUntil: number;
  teacherId: string;
  studentId: string;
  sessionId?: string;
}

export function LiveClassQueue({ className }: LiveClassQueueProps) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());

  // Update every second for live status
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh data every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['live-class-queue'] });
    }, 60000);
    return () => clearInterval(interval);
  }, [queryClient]);

  // Real-time subscription for live sessions
  useEffect(() => {
    const channel = supabase
      .channel('live-sessions-queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_sessions'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live-class-queue'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch next 5 scheduled classes
  const { data: queuedClasses, isLoading } = useQuery({
    queryKey: ['live-class-queue', format(now, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // Fetch schedules with assignments
      const { data: schedules, error } = await supabase
        .from('schedules')
        .select(`
          id,
          day_of_week,
          student_local_time,
          teacher_local_time,
          duration_minutes,
          assignment:student_teacher_assignments(
            id,
            teacher_id,
            student_id,
            subject:subjects(name),
            student:profiles!student_teacher_assignments_student_id_fkey(id, full_name),
            teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name)
          )
        `)
        .eq('is_active', true)
        .not('assignment_id', 'is', null)
        .eq('student_teacher_assignments.status', 'active');

      if (error) throw error;
      if (!schedules) return [];

      // Fetch live sessions (only truly live ones)
      const { data: liveSessions } = await supabase
        .from('live_sessions')
        .select('id, teacher_id, status')
        .eq('status', 'live');

      const liveTeacherIds = new Set(liveSessions?.map(s => s.teacher_id) || []);
      const liveSessionMap = new Map(liveSessions?.map(s => [s.teacher_id, s.id]) || []);

      // Use PKT (Asia/Karachi) as the reference timezone for schedule times
      const currentNow = new Date();
      const pktNowStr = currentNow.toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
      const pktNow = new Date(pktNowStr);
      const pktDayIndex = pktNow.getDay();

      // Filter to only today's day name
      const todayDayName = dayNames[pktDayIndex];

      // Process schedules — only today's classes
      const processedClasses = schedules
        .filter(s => {
          if (!s.assignment) return false;
          // Normalize day_of_week comparison (DB may store lowercase)
          const schedDay = s.day_of_week?.charAt(0).toUpperCase() + s.day_of_week?.slice(1).toLowerCase();
          return schedDay === todayDayName;
        })
        .map(schedule => {
          const assignment = schedule.assignment as any;
          const scheduleTime = schedule.teacher_local_time;
          if (!scheduleTime) return null;

          // Build scheduled datetime in PKT
          const [hours, minutes] = scheduleTime.split(':').map(Number);
          const pktDateStr = pktNow.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
          const scheduledDateTime = new Date(`${pktDateStr}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00+05:00`);

          const classEndTime = addMinutes(scheduledDateTime, schedule.duration_minutes + GRACE_PERIOD_MINUTES);
          
          // Skip classes that ended more than grace period ago
          if (currentNow > classEndTime) return null;

          // Only show classes within ±2 hours window (unless live)
          const minutesUntil = differenceInMinutes(scheduledDateTime, currentNow);
          const isTeacherLive = liveTeacherIds.has(assignment.teacher_id);
          
          if (!isTeacherLive && minutesUntil > 120) return null;

          // Calculate status
          const windowStart = subMinutes(scheduledDateTime, GRACE_PERIOD_MINUTES);
          const windowEnd = addMinutes(scheduledDateTime, schedule.duration_minutes + GRACE_PERIOD_MINUTES);

          let status: ClassStatus = 'waiting';
          if (isTeacherLive) {
            status = 'live';
          } else if (currentNow >= windowStart && currentNow <= windowEnd) {
            status = 'ready';
          }

          return {
            id: `${schedule.id}-${assignment.teacher_id}`,
            scheduleId: schedule.id,
            subjectName: assignment.subject?.name || 'Quran',
            teacherName: assignment.teacher?.full_name || 'Unknown',
            studentName: assignment.student?.full_name || 'Unknown',
            scheduledTime: scheduleTime,
            scheduledDateTime,
            status,
            minutesUntil,
            teacherId: assignment.teacher_id,
            studentId: assignment.student_id,
            sessionId: liveSessionMap.get(assignment.teacher_id),
          };
        })
        .filter((item) => item !== null)
        .sort((a: QueuedClass, b: QueuedClass) => {
          const statusOrder = { live: 0, ready: 1, waiting: 2 };
          if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
          }
          return a.scheduledDateTime.getTime() - b.scheduledDateTime.getTime();
        })
        .slice(0, 10);

      return processedClasses;
    },
    refetchInterval: 30000,
  });

  const getStatusBadge = (status: ClassStatus, minutesUntil: number) => {
    switch (status) {
      case 'live':
        return (
          <Badge className="bg-emerald-500 text-white animate-pulse gap-1">
            <div className="w-2 h-2 rounded-full bg-white" />
            LIVE
          </Badge>
        );
      case 'ready':
        return (
          <Badge className="bg-accent text-white animate-pulse-glow gap-1">
            <Video className="h-3 w-3" />
            READY
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {minutesUntil > 60 
              ? `${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`
              : `${minutesUntil}m`
            }
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif flex items-center gap-2">
            <Video className="h-5 w-5 text-accent" />
            Live Class Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3 bg-gradient-to-r from-[hsl(var(--navy))]/5 to-transparent">
        <CardTitle className="font-serif flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Video className="h-5 w-5 text-accent" />
            Live Class Queue
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['live-class-queue'] })}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link to="/zoom-management">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                View All
                <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {queuedClasses && queuedClasses.length > 0 ? (
          <div className="space-y-3">
            {queuedClasses.map((classItem) => (
              <div
                key={classItem.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border transition-all duration-300',
                  classItem.status === 'live' && 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
                  classItem.status === 'ready' && 'bg-accent/5 border-accent/30 ring-2 ring-accent/20 animate-pulse',
                  classItem.status === 'waiting' && 'bg-secondary/50 border-border'
                )}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    classItem.status === 'live' && 'bg-emerald-100 dark:bg-emerald-800',
                    classItem.status === 'ready' && 'bg-accent/10',
                    classItem.status === 'waiting' && 'bg-muted'
                  )}>
                    <BookOpen className={cn(
                      'h-5 w-5',
                      classItem.status === 'live' && 'text-emerald-600 dark:text-emerald-400',
                      classItem.status === 'ready' && 'text-accent',
                      classItem.status === 'waiting' && 'text-muted-foreground'
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {classItem.subjectName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="truncate">{classItem.teacherName}</span>
                      <span className="text-muted-foreground/50">→</span>
                      <span className="truncate">{classItem.studentName}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">
                      {format(classItem.scheduledDateTime, 'EEE')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {classItem.scheduledTime}
                    </p>
                  </div>
                  {getStatusBadge(classItem.status, classItem.minutesUntil)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No Upcoming Classes</p>
            <p className="text-xs">Schedule classes to see them here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
