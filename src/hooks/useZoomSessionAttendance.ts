import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Punctuality = 'on_time' | 'late' | 'left_early' | 'no_show';

export interface ZoomParticipantRow {
  session_id: string;
  teacher_id: string | null;
  student_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  scheduled_minutes: number | null;
  actual_start: string | null;
  actual_end: string | null;
  session_status: string | null;
  zoom_account_id: string | null;
  participant_name: string | null;
  participant_email: string | null;
  zoom_role: string | null;
  join_time: string | null;
  leave_time: string | null;
  duration_minutes: number | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  punctuality: Punctuality | null;
  zoom_meeting_id: string | null;
}

export interface ZoomSessionReport {
  sessionId: string;
  teacherId: string | null;
  teacherName: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduledMinutes: number | null;
  actualStart: string | null;
  actualEnd: string | null;
  status: string | null;
  zoomAccountId: string | null;
  zoomAccountLabel: string;
  participants: ZoomParticipantRow[];
}

/**
 * Zoom S2S webhook telemetry (participant joined/left, meeting started/ended)
 * rolled up per class session: join, leave, duration and punctuality against
 * the scheduled window. Reference data only — attendance is still marked by hand.
 */
export function useZoomSessionAttendance(days = 7, zoomAccountId?: string | null) {
  return useQuery({
    queryKey: ['zoom-session-attendance', days, zoomAccountId ?? 'all'],
    refetchInterval: 60_000,
    queryFn: async (): Promise<ZoomSessionReport[]> => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      let q = (supabase as any)
        .from('zoom_session_attendance_report')
        .select('*')
        .gte('scheduled_start', since)
        .order('scheduled_start', { ascending: false });
      if (zoomAccountId) q = q.eq('zoom_account_id', zoomAccountId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = ((data || []) as ZoomParticipantRow[]).filter((r) => r.join_time || r.session_status);

      const teacherIds = [...new Set(rows.map((r) => r.teacher_id).filter(Boolean))] as string[];
      const accountIds = [...new Set(rows.map((r) => r.zoom_account_id).filter(Boolean))] as string[];

      const [profilesRes, accountsRes] = await Promise.all([
        teacherIds.length
          ? supabase.from('profiles').select('id, full_name').in('id', teacherIds)
          : Promise.resolve({ data: [] as any[] }),
        accountIds.length
          ? (supabase as any)
              .from('zoom_accounts')
              .select('id, zoom_account_email, display_label')
              .in('id', accountIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const teacherName = new Map<string, string>(
        ((profilesRes as any).data || []).map((p: any) => [p.id, p.full_name || 'Teacher']),
      );
      const accountLabel = new Map<string, string>(
        ((accountsRes as any).data || []).map((a: any) => [a.id, a.display_label || a.zoom_account_email || 'Zoom account']),
      );

      const bySession = new Map<string, ZoomSessionReport>();
      for (const r of rows) {
        let s = bySession.get(r.session_id);
        if (!s) {
          s = {
            sessionId: r.session_id,
            teacherId: r.teacher_id,
            teacherName: (r.teacher_id && teacherName.get(r.teacher_id)) || 'Unassigned',
            scheduledStart: r.scheduled_start,
            scheduledEnd: r.scheduled_end,
            scheduledMinutes: r.scheduled_minutes,
            actualStart: r.actual_start,
            actualEnd: r.actual_end,
            status: r.session_status,
            zoomAccountId: r.zoom_account_id,
            zoomAccountLabel: (r.zoom_account_id && accountLabel.get(r.zoom_account_id)) || '—',
            participants: [],
          };
          bySession.set(r.session_id, s);
        }
        if (r.participant_name || r.participant_email) s.participants.push(r);
      }

      return [...bySession.values()].map((s) => ({
        ...s,
        participants: s.participants.sort((a, b) => (a.join_time || '').localeCompare(b.join_time || '')),
      }));
    },
  });
}
