import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Video, Clock, ChevronRight } from 'lucide-react';
import { differenceInSeconds, format, parse, addDays, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

interface SmartSessionRibbonProps {
  className?: string;
}

export function SmartSessionRibbon({ className }: SmartSessionRibbonProps) {
  const { user, activeRole } = useAuth();
  const isTeacher = activeRole === 'teacher';
  const isStudent = activeRole === 'student';

  // Fetch next scheduled class
  const { data: nextClass } = useQuery({
    queryKey: ['next-class', user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return null;

      const today = format(new Date(), 'yyyy-MM-dd');
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayDayName = dayNames[new Date().getDay()];

      let query = supabase
        .from('schedules')
        .select(`
          id,
          day_of_week,
          student_local_time,
          teacher_local_time,
          duration_minutes,
          assignment:student_teacher_assignments(
            student:profiles!student_teacher_assignments_student_id_fkey(id, full_name),
            teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name)
          )
        `)
        .eq('is_active', true);

      // Get schedule for today or upcoming days
      const { data: schedules, error } = await query;
      if (error || !schedules) return null;

      // Find next class based on role
      const now = new Date();
      const currentTime = format(now, 'HH:mm');

      // Sort schedules to find the next one
      const upcomingSchedules = schedules
        .filter(s => {
          const assignment = s.assignment as any;
          if (isTeacher) {
            return assignment?.teacher?.id === user.id;
          } else if (isStudent) {
            return assignment?.student?.id === user.id;
          }
          return true;
        })
        .map(s => {
          const assignment = s.assignment as any;
          const scheduleTime = isTeacher ? s.teacher_local_time : s.student_local_time;
          const scheduleDayIndex = dayNames.indexOf(s.day_of_week);
          const todayIndex = new Date().getDay();

          // Calculate days until this schedule
          let daysUntil = scheduleDayIndex - todayIndex;
          if (daysUntil < 0) daysUntil += 7;
          if (daysUntil === 0 && scheduleTime < currentTime) daysUntil = 7;

          const scheduleDate = addDays(now, daysUntil);
          const [hours, minutes] = scheduleTime.split(':').map(Number);
          const fullDateTime = setMinutes(setHours(scheduleDate, hours), minutes);

          return {
            ...s,
            personName: isTeacher ? assignment?.student?.full_name : assignment?.teacher?.full_name,
            scheduleDateTime: fullDateTime,
            daysUntil,
          };
        })
        .sort((a, b) => a.scheduleDateTime.getTime() - b.scheduleDateTime.getTime());

      return upcomingSchedules[0] || null;
    },
    enabled: !!user?.id && (isTeacher || isStudent),
    refetchInterval: 30000,
  });

  // Check for active live session
  const { data: liveSession } = useQuery({
    queryKey: ['live-session-check', user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return null;

      if (isTeacher) {
        const { data } = await supabase
          .from('live_sessions')
          .select('id, teacher_id, status, license:zoom_licenses(meeting_link)')
          .eq('teacher_id', user.id)
          .eq('status', 'live')
          .maybeSingle();
        return data;
      } else if (isStudent) {
        // Get teacher assignment first
        const { data: assignment } = await supabase
          .from('student_teacher_assignments')
          .select('teacher_id')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (!assignment) return null;

        const { data } = await supabase
          .from('live_sessions')
          .select('id, teacher_id, status, license:zoom_licenses(meeting_link)')
          .eq('teacher_id', assignment.teacher_id)
          .eq('status', 'live')
          .maybeSingle();
        return data;
      }
      return null;
    },
    enabled: !!user?.id && (isTeacher || isStudent),
    refetchInterval: 10000,
  });

  // Countdown timer
  const [countdown, setCountdown] = React.useState<string>('');

  React.useEffect(() => {
    if (!nextClass?.scheduleDateTime) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = differenceInSeconds(nextClass.scheduleDateTime, now);
      
      if (diff <= 0) {
        setCountdown('Starting soon');
        return;
      }

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setCountdown(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m`);
      } else {
        setCountdown(`${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextClass?.scheduleDateTime]);

  const handleJoinClass = () => {
    if (liveSession?.license?.meeting_link) {
      window.open(liveSession.license.meeting_link, '_blank');
    }
  };

  // If live session is active
  if (liveSession) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-xl cursor-pointer group',
          'bg-gradient-to-r from-accent via-accent to-cyan-light',
          'animate-pulse-glow',
          className
        )}
        onClick={handleJoinClass}
      >
        {/* Glowing effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-white/20 to-accent/0 animate-shimmer" />
        
        <div className="relative flex items-center justify-between gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Video className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
            <div>
              <p className="text-white/80 text-xs sm:text-sm font-medium">Class is LIVE</p>
              <p className="text-white text-lg sm:text-xl font-serif font-bold">
                JOIN NOW
              </p>
            </div>
          </div>
          <ChevronRight className="h-6 w-6 text-white group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    );
  }

  // If no next class
  if (!nextClass) {
    return (
      <div className={cn(
        'rounded-xl bg-secondary/50 border border-border p-4 sm:p-5',
        className
      )}>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted flex items-center justify-center">
            <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs sm:text-sm">No upcoming classes</p>
            <p className="text-foreground text-base sm:text-lg font-medium">Check your schedule</p>
          </div>
        </div>
      </div>
    );
  }

  // Default: Show countdown to next class
  return (
    <div className={cn(
      'rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 sm:p-5',
      className
    )}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Next class with <span className="text-foreground font-medium">{nextClass.personName}</span>
            </p>
            <p className="text-primary text-lg sm:text-xl font-serif font-bold">{countdown}</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted-foreground">{nextClass.day_of_week}</p>
          <p className="text-sm font-medium text-foreground">
            {isTeacher ? nextClass.teacher_local_time : nextClass.student_local_time}
          </p>
        </div>
      </div>
    </div>
  );
}
