import React from 'react';
import { Button } from '@/components/ui/button';
import { Video, Loader2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { differenceInMinutes, setHours, setMinutes, addMinutes, subMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

interface JoinClassButtonProps {
  teacherId?: string;
  className?: string;
}

const GRACE_BEFORE = 15; // minutes before class
const GRACE_AFTER = 60;  // minutes after class start

export function JoinClassButton({ teacherId, className }: JoinClassButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch student's schedule and find a Zoom link to join
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
        .select('id, assignment_id, day_of_week, student_local_time, duration_minutes')
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
          const windowStart = subMinutes(classStart, GRACE_BEFORE);
          const classEnd = addMinutes(classStart, schedule.duration_minutes);
          const windowEnd = addMinutes(classStart, GRACE_AFTER);

          if (now >= windowStart && now <= windowEnd) {
            // Check if teacher has a live session first
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
                  meetingLink,
                  sessionId: liveSession.id,
                  isLive: true,
                  teacherId: targetTeacherId,
                };
              }
            }

            // Reuse any already-linked LMS session for this class window
            const { data: existingSession } = await supabase
              .from('live_sessions')
              .select('id, license_id, status, scheduled_start, license:zoom_licenses(meeting_link)')
              .eq('teacher_id', targetTeacherId)
              .eq('assignment_id', schedule.assignment_id)
              .in('status', ['scheduled', 'live'])
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const existingLink = (existingSession?.license as any)?.meeting_link;
            if (existingSession && existingLink) {
              return {
                canJoin: true,
                meetingLink: existingLink,
                sessionId: existingSession.id,
                licenseId: existingSession.license_id,
                assignmentId: schedule.assignment_id,
                scheduleId: schedule.id,
                scheduledStart: existingSession.scheduled_start || classStart.toISOString(),
                isLive: existingSession.status === 'live',
                teacherId: targetTeacherId,
              };
            }

            // Teacher hasn't started yet — student can still join early
            // Find the teacher's last used room link (any status)
            const { data: lastSession } = await supabase
              .from('live_sessions')
              .select('license_id, license:zoom_licenses(id, meeting_link)')
              .eq('teacher_id', targetTeacherId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const lastLink = (lastSession?.license as any)?.meeting_link;
            if (lastLink) {
              return {
                canJoin: true,
                meetingLink: lastLink,
                licenseId: lastSession?.license_id,
                assignmentId: schedule.assignment_id,
                scheduleId: schedule.id,
                scheduledStart: classStart.toISOString(),
                isLive: false,
                teacherId: targetTeacherId,
              };
            }

            // No prior session — pick first room by priority (regardless of status)
            const { data: licenses } = await supabase
              .from('zoom_licenses')
              .select('id, meeting_link')
              .order('priority', { ascending: true })
              .order('created_at', { ascending: true })
              .limit(1);

            const fallbackLink = licenses?.[0]?.meeting_link;
            if (fallbackLink) {
              return {
                canJoin: true,
                meetingLink: fallbackLink,
                licenseId: licenses?.[0]?.id,
                assignmentId: schedule.assignment_id,
                scheduleId: schedule.id,
                scheduledStart: classStart.toISOString(),
                isLive: false,
                teacherId: targetTeacherId,
              };
            }

            return {
              canJoin: false,
              reason: 'no_license',
              teacherId: targetTeacherId,
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
    refetchInterval: 15000,
  });

  // Join mutation — only opens the meeting link, no DB writes
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !scheduleStatus?.meetingLink) {
        throw new Error('Unable to join class');
      }

      if (!scheduleStatus.sessionId && scheduleStatus.teacherId) {
        const { error } = await supabase
          .from('live_sessions')
          .insert({
            teacher_id: scheduleStatus.teacherId,
            student_id: user.id,
            assignment_id: scheduleStatus.assignmentId || null,
            schedule_id: scheduleStatus.scheduleId || null,
            license_id: scheduleStatus.licenseId || null,
            scheduled_start: scheduleStatus.scheduledStart || new Date().toISOString(),
            status: 'scheduled',
          } as any);

        if (error) {
          throw error;
        }
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

  // Can join - either teacher is live or within schedule window
  if (scheduleStatus?.canJoin) {
    return (
      <Button
        variant="default"
        className={cn(
          "gap-2",
          scheduleStatus.isLive
            ? "bg-accent hover:bg-accent/90 text-white animate-pulse-glow"
            : "bg-emerald-600 hover:bg-emerald-700 text-white",
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
        {scheduleStatus.isLive ? 'Join Live Class' : 'Join Class'}
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