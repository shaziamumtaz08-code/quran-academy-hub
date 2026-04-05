import React from 'react';
import { Button } from '@/components/ui/button';
import { Video, Loader2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInMinutes, format, setHours, setMinutes, addMinutes, subMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

interface JoinClassButtonProps {
  teacherId?: string;
  className?: string;
}

const GRACE_PERIOD_MINUTES = 15;

/**
 * Record student_join_time on today's attendance record.
 * If no record exists yet (teacher hasn't started), create one with status 'present'.
 */
async function recordStudentJoinTime(studentId: string, teacherId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date().toISOString();

  // Find today's attendance record for this student
  const { data: existing } = await supabase
    .from('attendance')
    .select('id, student_join_time')
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .eq('class_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Only update if student_join_time not already recorded (anti-spam)
    if (!(existing as any).student_join_time) {
      await supabase
        .from('attendance')
        .update({ student_join_time: now } as any)
        .eq('id', existing.id);
    }
  } else {
    // No attendance record yet — teacher may not have started. Create one.
    // Get assignment info for duration/division
    const { data: assignment } = await supabase
      .from('student_teacher_assignments')
      .select('id, duration_minutes, division_id, branch_id')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const currentTime = format(new Date(), 'HH:mm');

    await supabase
      .from('attendance')
      .insert({
        student_id: studentId,
        teacher_id: teacherId,
        class_date: today,
        class_time: currentTime,
        status: 'present',
        duration_minutes: assignment?.duration_minutes || 30,
        division_id: assignment?.division_id,
        branch_id: assignment?.branch_id,
        student_join_time: now,
      } as any);
  }
}

export function JoinClassButton({ teacherId, className }: JoinClassButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch student's schedule and check if within grace period
  const { data: scheduleStatus, isLoading } = useQuery({
    queryKey: ['student-schedule-status', user?.id, teacherId],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get teacher ID
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

      // Get only THIS student's assignments with THIS teacher
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id')
        .eq('student_id', user.id)
        .eq('teacher_id', targetTeacherId)
        .eq('status', 'active');

      const assignmentIds = (assignments || []).map(a => a.id);
      if (!assignmentIds.length) return { canJoin: false, reason: 'no_schedule', teacherId: targetTeacherId };

      // Get schedules only for these assignments
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

      // Check each schedule for grace period
      for (const schedule of studentSchedules) {
        const scheduleDayIndex = dayNames.indexOf(schedule.day_of_week);
        const todayIndex = now.getDay();

        if (scheduleDayIndex === todayIndex) {
          const [hours, minutes] = schedule.student_local_time.split(':').map(Number);
          const classStart = setMinutes(setHours(now, hours), minutes);
          const windowStart = subMinutes(classStart, GRACE_PERIOD_MINUTES);
          const classEnd = addMinutes(classStart, schedule.duration_minutes);
          const windowEnd = addMinutes(classEnd, GRACE_PERIOD_MINUTES);

          if (now >= windowStart && now <= windowEnd) {
            // Check for live session first
            const { data: liveSession } = await supabase
              .from('live_sessions')
              .select('id, license:zoom_licenses(meeting_link)')
              .eq('teacher_id', targetTeacherId)
              .eq('status', 'live')
              .maybeSingle();

            if (liveSession?.license) {
              return {
                canJoin: true,
                sessionId: liveSession.id,
                meetingLink: (liveSession.license as any).meeting_link,
                isLive: true,
                teacherId: targetTeacherId,
              };
            }

            // Get available license for autonomous join
            const { data: license } = await supabase
              .from('zoom_licenses')
              .select('id, meeting_link')
              .eq('status', 'available')
              .order('last_used_at', { ascending: true, nullsFirst: true })
              .limit(1)
              .maybeSingle();

            if (license) {
              return {
                canJoin: true,
                licenseId: license.id,
                meetingLink: license.meeting_link,
                isLive: false,
                teacherId: targetTeacherId,
                classStart,
              };
            }

            return { 
              canJoin: false, 
              reason: 'no_license', 
              teacherId: targetTeacherId,
              isWithinWindow: true 
            };
          }

          // Calculate time until window opens
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
    refetchInterval: 30000,
  });

  // Join mutation — now also records student_join_time
  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !scheduleStatus?.meetingLink) {
        throw new Error('Unable to join class');
      }

      // ✅ ATTENDANCE AUTOMATION: Record student join time
      if (scheduleStatus.teacherId) {
        await recordStudentJoinTime(user.id, scheduleStatus.teacherId);
      }

      // Create session if needed and log zoom attendance
      let sessionId = scheduleStatus.sessionId;

      if (!sessionId && scheduleStatus.teacherId) {
        const { data: newSession } = await supabase
          .from('live_sessions')
          .insert({
            teacher_id: scheduleStatus.teacherId,
            status: 'scheduled',
            scheduled_start: scheduleStatus.classStart?.toISOString() || new Date().toISOString(),
          })
          .select('id')
          .single();

        sessionId = newSession?.id;
      }

      if (sessionId) {
        await supabase.from('zoom_attendance_logs').insert({
          session_id: sessionId,
          user_id: user.id,
          action: 'join_intent',
        });
      }

      return scheduleStatus.meetingLink;
    },
    onSuccess: (meetingLink) => {
      toast({
        title: '✅ Joining Class',
        description: 'Attendance recorded. Opening Zoom meeting...',
      });
      window.open(meetingLink, '_blank');
      queryClient.invalidateQueries({ queryKey: ['zoom-attendance-logs'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
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

  // Can join - within grace period
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
        {scheduleStatus.isLive ? 'Join Live Class' : 'Join Class'}
      </Button>
    );
  }

  // Too early - show countdown
  if (scheduleStatus?.reason === 'too_early') {
    return (
      <Button disabled variant="outline" className={cn("gap-2", className)}>
        <Clock className="h-4 w-4" />
        Opens in {scheduleStatus.minutesUntil}m
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
      Class Not Available
    </Button>
  );
}