import React from 'react';
import { Button } from '@/components/ui/button';
import { Video, Loader2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInMinutes, setHours, setMinutes, addMinutes, subMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

interface JoinClassButtonProps {
  teacherId?: string;
  className?: string;
}

const GRACE_PERIOD_MINUTES = 30;

export function JoinClassButton({ teacherId, className }: JoinClassButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch student's schedule and check if within grace period
  const { data: scheduleStatus, isLoading } = useQuery({
    queryKey: ['student-schedule-status', user?.id, teacherId],
    queryFn: async () => {
      if (!user?.id) return null;

      let targetTeacherId = teacherId;
      if (!targetTeacherId) {
        const { data: assignment } = await supabase
          .from('student_teacher_assignments')
          .select('teacher_id')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        targetTeacherId = assignment?.teacher_id;
      }

      if (!targetTeacherId) return { canJoin: false, reason: 'no_assignment' };

      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id')
        .eq('student_id', user.id)
        .eq('teacher_id', targetTeacherId)
        .eq('status', 'active');

      const assignmentIds = (assignments || []).map(a => a.id);
      if (!assignmentIds.length) return { canJoin: false, reason: 'no_schedule', teacherId: targetTeacherId };

      const { data: schedules } = await supabase
        .from('schedules')
        .select('id, day_of_week, student_local_time, duration_minutes')
        .in('assignment_id', assignmentIds)
        .eq('is_active', true);

      if (!schedules || schedules.length === 0) {
        return { canJoin: false, reason: 'no_schedule', teacherId: targetTeacherId };
      }

      const now = new Date();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      for (const schedule of schedules) {
        const normalizedDay = schedule.day_of_week
          ? schedule.day_of_week.charAt(0).toUpperCase() + schedule.day_of_week.slice(1).toLowerCase()
          : '';
        const scheduleDayIndex = dayNames.indexOf(normalizedDay);
        const todayIndex = now.getDay();

        if (scheduleDayIndex === todayIndex) {
          const [hours, minutes] = schedule.student_local_time.split(':').map(Number);
          const classStart = setMinutes(setHours(now, hours), minutes);
          const windowStart = subMinutes(classStart, GRACE_PERIOD_MINUTES);
          const classEnd = addMinutes(classStart, schedule.duration_minutes);
          const windowEnd = addMinutes(classEnd, GRACE_PERIOD_MINUTES);

          if (now >= windowStart && now <= windowEnd) {
            // Only allow join if teacher has a live session
            const { data: liveSession } = await supabase
              .from('live_sessions')
              .select('id, license_id, license:zoom_licenses(meeting_link)')
              .eq('teacher_id', targetTeacherId)
              .eq('status', 'live')
              .maybeSingle();

            if (liveSession) {
              const meetingLink = (liveSession.license as any)?.meeting_link;
              if (meetingLink) {
                return {
                  canJoin: true,
                  sessionId: liveSession.id,
                  meetingLink,
                  isLive: true,
                  teacherId: targetTeacherId,
                };
              }
            }

            // Teacher hasn't started yet — show waiting state
            return {
              canJoin: false,
              reason: 'waiting_for_teacher',
              teacherId: targetTeacherId,
              isWithinWindow: true,
              classTime: schedule.student_local_time,
            };
          }

          if (now < windowStart) {
            const minutesUntil = differenceInMinutes(windowStart, now);
            return { 
              canJoin: false, 
              reason: 'too_early', 
              minutesUntil,
              teacherId: targetTeacherId,
              classTime: schedule.student_local_time 
            };
          }
        }
      }

      return { canJoin: false, reason: 'no_class_today', teacherId: targetTeacherId };
    },
    enabled: !!user?.id,
    refetchInterval: 15000, // Check more frequently for teacher start
  });

  // Join mutation — only opens the meeting link, no DB writes
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !scheduleStatus?.meetingLink) {
        throw new Error('Unable to join class');
      }
      return scheduleStatus.meetingLink;
    },
    onSuccess: (meetingLink) => {
      toast({
        title: '✅ Joining Class',
        description: 'Opening Zoom meeting...',
      });
      window.open(meetingLink, '_blank');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Join',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <Button disabled className={cn("gap-2", className)} variant="outline">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking...
      </Button>
    );
  }

  // Can join - teacher is live
  if (scheduleStatus?.canJoin) {
    return (
      <Button
        variant="default"
        className={cn(
          "gap-2 bg-accent hover:bg-accent/90 text-white animate-pulse-glow",
          className
        )}
        onClick={() => joinMutation.mutate()}
        disabled={joinMutation.isPending}
      >
        {joinMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Video className="h-4 w-4" />
        )}
        Join Live Class
      </Button>
    );
  }

  // Waiting for teacher to start
  if (scheduleStatus?.reason === 'waiting_for_teacher') {
    return (
      <Button disabled variant="outline" className={cn("gap-2 text-amber-600 border-amber-300", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Waiting for Teacher...
      </Button>
    );
  }

  // Too early - show countdown
  if (scheduleStatus?.reason === 'too_early') {
    return (
      <Button disabled variant="outline" className={cn("gap-2", className)}>
        <Clock className="h-4 w-4" />
        {scheduleStatus.minutesUntil <= 60
          ? `Join in ${scheduleStatus.minutesUntil}m`
          : `Class at ${scheduleStatus.classTime}`}
      </Button>
    );
  }

  // No license available
  if (scheduleStatus?.reason === 'no_license') {
    return (
      <Button disabled variant="outline" className={cn("gap-2 text-amber-600", className)}>
        <Video className="h-4 w-4" />
        All Rooms Busy
      </Button>
    );
  }

  // Default - not in window
  return (
    <Button disabled variant="outline" className={cn("gap-2 opacity-60", className)}>
      <Video className="h-4 w-4" />
      No Class Now
    </Button>
  );
}