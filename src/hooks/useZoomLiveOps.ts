import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DEFAULT_ACADEMY_TZ, zonedDayName, zonedStartOfDay } from '@/hooks/useAcademyTimezone';

/**
 * Shared Zoom live-operations data layer.
 * Extracted from AdminLiveMonitor so the Zoom command centre and the
 * dashboard monitor read from exactly the same queries/cache keys.
 */

export interface SessionParticipant {
  userId: string;
  userName: string;
  isTeacher: boolean;
}

export function useZoomLicenses() {
  return useQuery({
    queryKey: ['zoom-licenses-monitor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_licenses')
        .select('id, zoom_email, status, last_used_at, meeting_link');
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
  });
}

export function useLiveSessionsMonitor() {
  return useQuery({
    queryKey: ['active-live-sessions-monitor'],
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from('live_sessions')
        .select(`
          id,
          teacher_id,
          student_id,
          actual_start,
          scheduled_start,
          status,
          group_id,
          schedule_id,
          assignment_id,
          zoom_meeting_uuid,
          session_source,
          stream_url,
          license:zoom_licenses(id, zoom_email, meeting_link)
        `)
        .eq('status', 'live')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!sessions || sessions.length === 0) return [];

      const teacherIds = sessions.map((s) => s.teacher_id);
      const studentIds = sessions.map((s: any) => s.student_id).filter(Boolean);
      const allProfileIds = [...new Set([...teacherIds, ...studentIds])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, meeting_link')
        .in('id', allProfileIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) || []);
      const teacherLinkMap = new Map(
        (profiles || []).map((p: any) => [p.id, p.meeting_link as string | null]),
      );

      const sessionIds = sessions.map((s) => s.id);
      const { data: attendanceLogs } = await supabase
        .from('zoom_attendance_logs')
        .select('session_id, user_id, action, leave_time, participant_name, role, zoom_event_type')
        .in('session_id', sessionIds)
        .in('zoom_event_type', ['meeting.participant_joined', 'meeting.started']);

      const activeParticipants =
        attendanceLogs?.filter((log) => log.action === 'join_intent' && !log.leave_time) || [];

      const participantsMap = new Map<string, SessionParticipant[]>();

      sessions.forEach((session: any) => {
        const participants: SessionParticipant[] = [];
        const studentId = session.student_id;

        activeParticipants
          .filter((log) => log.session_id === session.id)
          .forEach((log: any) => {
            const uid = log.user_id;
            const participantKey = uid || `${session.id}:${log.participant_name || 'zoom-participant'}`;
            if (!participants.some((p) => p.userId === participantKey)) {
              participants.push({
                userId: participantKey,
                userName: profileMap.get(uid) || log.participant_name || 'Participant',
                isTeacher: log.role === 'host' || uid === session.teacher_id,
              });
            }
          });

        participantsMap.set(session.id, participants);
      });

      return sessions.map((session: any) => ({
        ...session,
        teacherName: profileMap.get(session.teacher_id) || 'Unknown',
        studentName: session.student_id ? profileMap.get(session.student_id) || 'Student' : null,
        // A session started on a teacher's dedicated Zoom account has no pooled
        // licence, so fall back to the teacher's own personal meeting link.
        joinUrl:
          session.license?.meeting_link ||
          teacherLinkMap.get(session.teacher_id) ||
          session.stream_url ||
          null,
        participants: participantsMap.get(session.id) || [],
        activeCount: participantsMap.get(session.id)?.length || 0,
      }));
    },
    refetchInterval: 5000,
  });
}

export function useRecentJoinLogs() {
  return useQuery({
    queryKey: ['recent-join-logs-monitor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_attendance_logs')
        .select('id, user_id, action, timestamp, session_id, participant_name, participant_email, role, zoom_event_type')
        .eq('action', 'join_intent')
        .in('zoom_event_type', ['meeting.participant_joined', 'meeting.started'])
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map((l) => l.user_id).filter(Boolean))];
      const { data: users } = userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] as any[] };

      const userMap = new Map((users || []).map((u: any) => [u.id, u.full_name] as [string, string]));

      return data.map((log: any) => ({
        ...log,
        userName: log.user_id
          ? userMap.get(log.user_id) || log.participant_name || 'Unknown'
          : log.participant_name || 'Unknown',
      }));
    },
    refetchInterval: 5000,
  });
}

/** Force-end a live session: mark completed, release the license, save recording link. */
export function useEndSessionMutation(onDone?: (sessionId: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sessionId,
      licenseId,
      recordingLink,
    }: {
      sessionId: string;
      licenseId?: string | null;
      recordingLink?: string;
    }) => {
      const updateData: Record<string, any> = {
        status: 'completed',
        actual_end: new Date().toISOString(),
      };
      if (recordingLink && recordingLink.trim()) {
        updateData.recording_link = recordingLink.trim();
      }

      const { error: sessionError } = await supabase
        .from('live_sessions')
        .update(updateData)
        .eq('id', sessionId);
      if (sessionError) throw sessionError;

      if (licenseId) {
        const { error: licenseError } = await supabase
          .from('zoom_licenses')
          .update({ status: 'available' })
          .eq('id', licenseId);
        if (licenseError) throw licenseError;
      }
    },
    onSuccess: (_, variables) => {
      toast.success('Session ended and license released');
      onDone?.(variables.sessionId);
      queryClient.invalidateQueries({ queryKey: ['active-live-sessions-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['zoom-licenses-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['zoom-today-classes'] });
    },
    onError: (error) => {
      toast.error('Failed to end session: ' + (error as Error).message);
    },
  });
}

/** Keeps the monitor caches fresh on live_sessions / zoom_licenses changes. */
export function useZoomLiveRealtime(channelName = 'zoom-live-ops') {
  const queryClient = useQueryClient();
  React.useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['active-live-sessions-monitor'] });
        queryClient.invalidateQueries({ queryKey: ['zoom-today-sessions'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zoom_licenses' }, () => {
        queryClient.invalidateQueries({ queryKey: ['zoom-licenses-monitor'] });
        queryClient.invalidateQueries({ queryKey: ['active-live-sessions-monitor'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, channelName]);
}

export interface TodayClass {
  scheduleId: string;
  assignmentId: string;
  teacherId: string;
  teacherName: string;
  studentName: string;
  subjectName: string | null;
  startMinutes: number;
  durationMinutes: number;
  startLabel: string;
}

function timeToMinutes(time: string): number {
  const parts = (time || '00:00').split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Today's active scheduled slots (teacher-local times, same convention as DailySlotCalendar). */
export function useTodayScheduledClasses(divisionId?: string | null, timeZone?: string) {
  const tz = timeZone || DEFAULT_ACADEMY_TZ;
  const dayName = zonedDayName(tz);

  return useQuery({
    queryKey: ['zoom-today-classes', dayName, divisionId || 'all'],
    queryFn: async (): Promise<TodayClass[]> => {
      const dateIso = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
      const { data: schedules, error } = await (supabase as any)
        .rpc('get_effective_schedule_periods', { _on_date: dateIso });
      if (error) throw error;
      if (!schedules || schedules.length === 0) return [];

      const assignmentIds = [...new Set(schedules.map((s: any) => s.assignment_id).filter(Boolean))];
      if (assignmentIds.length === 0) return [];

      let assignQuery = (supabase as any)
        .from('student_teacher_assignments')
        .select('id, teacher_id, student_id, status, subject:subjects(name)')
        .in('id', assignmentIds)
        .eq('status', 'active');
      if (divisionId) assignQuery = assignQuery.eq('division_id', divisionId);

      const { data: assignments } = await assignQuery;
      const assignMap = new Map((assignments || []).map((a: any) => [a.id, a]));

      const profileIds = [
        ...new Set((assignments || []).flatMap((a: any) => [a.teacher_id, a.student_id]).filter(Boolean)),
      ] as string[];
      const { data: profiles } = profileIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
        : { data: [] as any[] };
      const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name] as [string, string]));

      return schedules
        .filter((s: any) => assignMap.has(s.assignment_id))
        .map((s: any) => {
          const a: any = assignMap.get(s.assignment_id);
          const startMinutes = timeToMinutes(s.teacher_local_time);
          return {
            scheduleId: s.schedule_id,
            assignmentId: s.assignment_id,
            teacherId: a.teacher_id,
            teacherName: nameMap.get(a.teacher_id) || 'Teacher',
            studentName: nameMap.get(a.student_id) || 'Student',
            subjectName: a.subject?.name ?? null,
            startMinutes,
            durationMinutes: s.duration_minutes || 30,
            startLabel: minutesToLabel(startMinutes),
          };
        })
        .sort((x, y) => x.startMinutes - y.startMinutes);
    },
    refetchInterval: 60000,
  });
}

/** All of today's sessions (any status) so we can resolve slot state. */
export function useTodaySessions(timeZone?: string) {
  const tz = timeZone || DEFAULT_ACADEMY_TZ;
  return useQuery({
    queryKey: ['zoom-today-sessions', tz],
    queryFn: async () => {
      const start = zonedStartOfDay(tz);
      const { data, error } = await (supabase as any)
        .from('live_sessions')
        .select('id, teacher_id, student_id, status, schedule_id, assignment_id, actual_start, actual_end, scheduled_start, created_at')
        .gte('created_at', start.toISOString());
      if (error) throw error;
      return (data || []) as any[];
    },
    refetchInterval: 15000,
  });
}
