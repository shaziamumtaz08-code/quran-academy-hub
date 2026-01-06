import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Video, Clock, ChevronRight, Timer } from 'lucide-react';
import { differenceInSeconds, differenceInMinutes, format, addDays, setHours, setMinutes, addMinutes, subMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SmartSessionRibbonProps {
  className?: string;
}

const GRACE_PERIOD_MINUTES = 15;

export function SmartSessionRibbon({ className }: SmartSessionRibbonProps) {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isTeacher = activeRole === 'teacher';
  const isStudent = activeRole === 'student';

  // Fetch next scheduled class with assignment details
  const { data: nextClass, isLoading: classLoading } = useQuery({
    queryKey: ['next-class-ribbon', user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return null;

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentTime = format(new Date(), 'HH:mm');

      let query = supabase
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
        .eq('is_active', true);

      const { data: schedules, error } = await query;
      if (error || !schedules) return null;

      const now = new Date();

      // Process and sort schedules
      const upcomingSchedules = schedules
        .filter(s => {
          const assignment = s.assignment as any;
          if (isTeacher) {
            return assignment?.teacher?.id === user.id;
          } else if (isStudent) {
            return assignment?.student?.id === user.id;
          }
          return false;
        })
        .map(s => {
          const assignment = s.assignment as any;
          const scheduleTime = isTeacher ? s.teacher_local_time : s.student_local_time;
          const scheduleDayIndex = dayNames.indexOf(s.day_of_week);
          const todayIndex = now.getDay();

          // Calculate days until this schedule
          let daysUntil = scheduleDayIndex - todayIndex;
          if (daysUntil < 0) daysUntil += 7;
          
          // Check if today's class has already ended (past grace period)
          if (daysUntil === 0) {
            const [hours, minutes] = scheduleTime.split(':').map(Number);
            const classEndTime = addMinutes(setMinutes(setHours(now, hours), minutes), s.duration_minutes + GRACE_PERIOD_MINUTES);
            if (now > classEndTime) {
              daysUntil = 7; // Next week
            }
          }

          const scheduleDate = addDays(now, daysUntil);
          const [hours, minutes] = scheduleTime.split(':').map(Number);
          const fullDateTime = setMinutes(setHours(scheduleDate, hours), minutes);

          // Calculate grace period windows
          const windowStart = subMinutes(fullDateTime, GRACE_PERIOD_MINUTES);
          const classEnd = addMinutes(fullDateTime, s.duration_minutes);
          const windowEnd = addMinutes(classEnd, GRACE_PERIOD_MINUTES);

          const isWithinGracePeriod = now >= windowStart && now <= windowEnd;
          const isClassTime = now >= fullDateTime && now <= classEnd;
          const minutesUntilClass = differenceInMinutes(fullDateTime, now);
          const minutesSinceStart = differenceInMinutes(now, fullDateTime);

          return {
            ...s,
            assignment,
            personName: isTeacher ? assignment?.student?.full_name : assignment?.teacher?.full_name,
            subjectName: assignment?.subject?.name || 'Quran',
            teacherId: assignment?.teacher_id,
            scheduleDateTime: fullDateTime,
            windowStart,
            windowEnd,
            classEnd,
            isWithinGracePeriod,
            isClassTime,
            minutesUntilClass,
            minutesSinceStart,
            daysUntil,
          };
        })
        .sort((a, b) => {
          // Prioritize classes within grace period
          if (a.isWithinGracePeriod && !b.isWithinGracePeriod) return -1;
          if (!a.isWithinGracePeriod && b.isWithinGracePeriod) return 1;
          return a.scheduleDateTime.getTime() - b.scheduleDateTime.getTime();
        });

      return upcomingSchedules[0] || null;
    },
    enabled: !!user?.id && (isTeacher || isStudent),
    refetchInterval: 30000,
  });

  // Fetch teacher's assigned Zoom license for autonomous access
  const { data: zoomLink } = useQuery({
    queryKey: ['zoom-link-autonomous', nextClass?.teacherId],
    queryFn: async () => {
      if (!nextClass?.teacherId || !nextClass.isWithinGracePeriod) return null;

      // For students: Get any available license for the teacher
      // First check if teacher has an active session
      const { data: liveSession } = await supabase
        .from('live_sessions')
        .select('id, license:zoom_licenses(meeting_link)')
        .eq('teacher_id', nextClass.teacherId)
        .eq('status', 'live')
        .maybeSingle();

      if (liveSession?.license) {
        return { 
          meetingLink: (liveSession.license as any).meeting_link,
          sessionId: liveSession.id,
          isLive: true 
        };
      }

      // If no live session, get an available license for autonomous join
      const { data: license } = await supabase
        .from('zoom_licenses')
        .select('id, meeting_link')
        .eq('status', 'available')
        .order('last_used_at', { ascending: true, nullsFirst: true })
        .limit(1)
        .maybeSingle();

      return license ? { 
        meetingLink: license.meeting_link, 
        licenseId: license.id,
        isLive: false 
      } : null;
    },
    enabled: !!nextClass?.teacherId && nextClass.isWithinGracePeriod,
    refetchInterval: 10000,
  });

  // Join class mutation with auto-logging
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !zoomLink?.meetingLink) throw new Error('No meeting link available');

      // Create or get session for logging
      let sessionId = zoomLink.sessionId;

      if (!sessionId && nextClass?.teacherId) {
        // Create a scheduled session for tracking if none exists
        const { data: newSession, error: sessionError } = await supabase
          .from('live_sessions')
          .insert({
            teacher_id: nextClass.teacherId,
            status: 'scheduled',
            scheduled_start: nextClass.scheduleDateTime.toISOString(),
          })
          .select('id')
          .single();

        if (!sessionError && newSession) {
          sessionId = newSession.id;
        }
      }

      // Log attendance
      if (sessionId) {
        await supabase.from('zoom_attendance_logs').insert({
          session_id: sessionId,
          user_id: user.id,
          action: 'join_intent',
        });
      }

      return zoomLink.meetingLink;
    },
    onSuccess: (meetingLink) => {
      toast({
        title: 'Joining Class',
        description: 'Opening Zoom meeting...',
      });
      window.open(meetingLink, '_blank');
      queryClient.invalidateQueries({ queryKey: ['zoom-attendance-logs'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Join',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Countdown timer state
  const [countdown, setCountdown] = React.useState<string>('');
  const [reverseTimer, setReverseTimer] = React.useState<string>('');

  React.useEffect(() => {
    if (!nextClass?.scheduleDateTime) return;

    const updateTimers = () => {
      const now = new Date();
      
      // Countdown to class start
      const diffToStart = differenceInSeconds(nextClass.scheduleDateTime, now);
      if (diffToStart > 0) {
        const hours = Math.floor(diffToStart / 3600);
        const minutes = Math.floor((diffToStart % 3600) / 60);
        const seconds = diffToStart % 60;

        if (hours > 24) {
          const days = Math.floor(hours / 24);
          setCountdown(`${days}d ${hours % 24}h`);
        } else if (hours > 0) {
          setCountdown(`${hours}h ${minutes}m`);
        } else if (minutes > 0) {
          setCountdown(`${minutes}m ${seconds}s`);
        } else {
          setCountdown(`${seconds}s`);
        }
      } else {
        setCountdown('Now');
      }

      // Reverse timer (time since class started or until window closes)
      if (nextClass.isClassTime) {
        const elapsed = differenceInSeconds(now, nextClass.scheduleDateTime);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        setReverseTimer(`${mins}:${secs.toString().padStart(2, '0')}`);
      } else if (now >= nextClass.classEnd && now <= nextClass.windowEnd) {
        const remaining = differenceInSeconds(nextClass.windowEnd, now);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        setReverseTimer(`${mins}:${secs.toString().padStart(2, '0')} left`);
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [nextClass]);

  // Loading state
  if (classLoading) {
    return (
      <div className={cn(
        'rounded-xl bg-secondary/50 border border-border p-4 animate-pulse',
        className
      )}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 bg-muted rounded" />
            <div className="h-5 w-32 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  // STATE: Within Grace Period - JOIN NOW
  if (nextClass?.isWithinGracePeriod && zoomLink) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-xl cursor-pointer group',
          'bg-gradient-to-r from-[hsl(var(--navy))] via-[hsl(var(--accent))] to-[hsl(var(--cyan-light))]',
          'animate-pulse-glow shadow-lg shadow-accent/30',
          className
        )}
        onClick={() => joinMutation.mutate()}
      >
        {/* Animated glow overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        
        <div className="relative flex items-center justify-between gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Video className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
            </div>
            <div>
              <p className="text-white/90 text-xs sm:text-sm font-medium">
                {nextClass.subjectName} with {nextClass.personName}
              </p>
              <p className="text-white text-xl sm:text-2xl font-serif font-bold tracking-wide">
                JOIN LIVE NOW
              </p>
              {nextClass.isClassTime && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Timer className="h-3 w-3 text-white/80" />
                  <span className="text-white/80 text-xs font-mono">{reverseTimer} elapsed</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!nextClass.isClassTime && (
              <span className="text-white/80 text-sm font-medium hidden sm:block">
                {nextClass.minutesUntilClass > 0 
                  ? `Starts in ${countdown}` 
                  : `Grace: ${reverseTimer}`
                }
              </span>
            )}
            <ChevronRight className="h-7 w-7 text-white group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    );
  }

  // STATE: No upcoming class
  if (!nextClass) {
    return (
      <div className={cn(
        'rounded-xl bg-gradient-to-r from-secondary/80 to-secondary/40 border border-border p-4 sm:p-5',
        className
      )}>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs sm:text-sm">No upcoming classes</p>
            <p className="text-foreground text-base sm:text-lg font-medium">Check your schedule</p>
          </div>
        </div>
      </div>
    );
  }

  // STATE: Default - Countdown to next class
  return (
    <div className={cn(
      'rounded-xl bg-gradient-to-r from-[hsl(var(--navy))]/10 via-primary/5 to-transparent border border-[hsl(var(--navy))]/20 p-4 sm:p-5',
      className
    )}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 rounded-full bg-[hsl(var(--navy))]/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-[hsl(var(--navy))]" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Next: <span className="text-foreground font-medium">{nextClass.subjectName}</span> with{' '}
              <span className="text-foreground font-medium">{nextClass.personName}</span>
            </p>
            <p className="text-[hsl(var(--accent))] text-xl sm:text-2xl font-serif font-bold">{countdown}</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted-foreground">{nextClass.day_of_week}</p>
          <p className="text-sm font-medium text-foreground">
            {isTeacher ? nextClass.teacher_local_time : nextClass.student_local_time}
          </p>
          {nextClass.minutesUntilClass <= GRACE_PERIOD_MINUTES && nextClass.minutesUntilClass > 0 && (
            <p className="text-xs text-accent mt-1">Opens in {nextClass.minutesUntilClass}m</p>
          )}
        </div>
      </div>
    </div>
  );
}
