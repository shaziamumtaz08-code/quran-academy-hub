import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from 'lucide-react';

const DAYS_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

interface TeacherSchedulesViewProps {
  readOnly?: boolean;
  rangeFilter?: 'today' | 'this_week' | 'next_week';
}

export default function TeacherSchedulesView({ readOnly: _readOnly, rangeFilter }: TeacherSchedulesViewProps = {}) {
  const { user } = useAuth();
  const { activeDivision } = useDivision();
  const modelType = (activeDivision?.model_type as string) || null;

  // ───────── 1:1 BRANCH ─────────
  const oneToOneEnabled = !!user?.id && modelType !== 'group' && modelType !== 'recorded';
  const { data: schedules1to1 = [], isLoading: loading1to1 } = useQuery({
    queryKey: ['teacher-my-schedules', user?.id, activeDivision?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      let assignQuery = supabase
        .from('student_teacher_assignments')
        .select('id, student_id')
        .eq('teacher_id', user.id)
        .eq('status', 'active') as any;

      if (activeDivision?.id) {
        assignQuery = assignQuery.eq('division_id', activeDivision.id);
      }

      const { data: assignments, error: assignErr } = await assignQuery;
      if (assignErr) throw assignErr;
      if (!assignments || assignments.length === 0) return [];

      const assignmentIds = assignments.map((a: any) => a.id);
      const studentMap = Object.fromEntries(assignments.map((a: any) => [a.id, a.student_id]));

      const { data: schedData, error } = await (supabase as any)
        .from('schedules')
        .select('*')
        .in('assignment_id', assignmentIds)
        .eq('is_active', true);

      if (error) throw error;

      const studentIds = [...new Set(Object.values(studentMap))] as string[];
      const { data: profiles } = studentIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', studentIds)
        : { data: [] };

      const nameMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name]));

      return (schedData || []).map((s: any) => ({
        ...s,
        student_name: nameMap[studentMap[s.assignment_id]] || 'Unknown',
      }));
    },
    enabled: oneToOneEnabled,
  });

  // ───────── GROUP BRANCH ─────────
  const groupEnabled = !!user?.id && modelType === 'group';
  const { data: groupSchedules = [], isLoading: loadingGroup } = useQuery({
    queryKey: ['teacher-group-schedules', user?.id, activeDivision?.id, rangeFilter],
    queryFn: async () => {
      if (!user?.id) return [];

      // Classes the teacher staffs
      const { data: staff, error: staffErr } = await (supabase as any)
        .from('course_class_staff')
        .select('class_id, course_classes!inner(id, name, course_id, schedule_days, schedule_time, session_duration, courses!inner(name))')
        .eq('user_id', user.id);
      if (staffErr) throw staffErr;
      if (!staff || staff.length === 0) return [];

      // Try to derive upcoming live_sessions for this range; fall back to class meta only
      const classIds = staff.map((s: any) => s.class_id).filter(Boolean);
      let liveSessions: any[] = [];
      try {
        const { data: ls } = await (supabase as any)
          .from('live_sessions')
          .select('id, class_id, course_id, scheduled_start, scheduled_end, status')
          .in('class_id', classIds)
          .order('scheduled_start', { ascending: true })
          .limit(200);
        liveSessions = ls || [];
      } catch {
        liveSessions = [];
      }

      return staff.map((s: any) => {
        const cls = s.course_classes;
        const upcoming = liveSessions.filter((l) => l.class_id === s.class_id);
        return {
          id: s.class_id,
          class_name: cls?.name || 'Unnamed Class',
          course_name: cls?.courses?.name || '—',
          schedule_days: cls?.schedule_days || [],
          schedule_time: cls?.schedule_time || null,
          duration_minutes: cls?.session_duration || null,
          upcoming_count: upcoming.length,
        };
      });
    },
    enabled: groupEnabled,
  });

  const isLoading = loading1to1 || loadingGroup;

  if (isLoading) {
    return <div className="space-y-3 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  }

  // ───────── RECORDED EMPTY STATE ─────────
  if (modelType === 'recorded') {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-base font-medium">No live schedule</p>
        <p className="text-sm mt-1">Recorded courses don't have a live schedule.</p>
      </div>
    );
  }

  // ───────── GROUP RENDER ─────────
  if (modelType === 'group') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-lms-navy">My Class Schedule</h2>
            <p className="text-sm text-muted-foreground">Classes you teach</p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Calendar className="h-3 w-3" />
            {groupSchedules.length} classes
          </Badge>
        </div>

        {groupSchedules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No classes assigned</p>
            <p className="text-xs mt-1">You aren't currently staffed on any group classes.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Class</TableHead>
                  <TableHead className="text-xs">Course</TableHead>
                  <TableHead className="text-xs">Days</TableHead>
                  <TableHead className="text-xs">Time</TableHead>
                  <TableHead className="text-xs">Duration</TableHead>
                  <TableHead className="text-xs">Upcoming</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupSchedules.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-sm">{s.class_name}</TableCell>
                    <TableCell className="text-sm">{s.course_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(s.schedule_days) ? s.schedule_days : []).map((d: string) => (
                          <Badge key={d} variant="outline" className="text-[10px] px-1.5 py-0">
                            {DAYS_LABELS[d?.toLowerCase()] || d}
                          </Badge>
                        ))}
                        {(!s.schedule_days || s.schedule_days.length === 0) && '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{s.schedule_time || '—'}</TableCell>
                    <TableCell className="text-sm">{s.duration_minutes ? `${s.duration_minutes}m` : '—'}</TableCell>
                    <TableCell className="text-sm">{s.upcoming_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  // ───────── 1:1 RENDER (default) ─────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-lms-navy">My Schedules</h2>
          <p className="text-sm text-muted-foreground">Your active class schedule</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Calendar className="h-3 w-3" />
          {schedules1to1.length} slots
        </Badge>
      </div>

      {schedules1to1.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No active schedules</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Student</TableHead>
                <TableHead className="text-xs">Day</TableHead>
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Duration</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules1to1.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-sm">{s.student_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {DAYS_LABELS[s.day_of_week] || s.day_of_week}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{s.student_local_time || s.teacher_local_time || '—'}</TableCell>
                  <TableCell className="text-sm">{s.duration_minutes ? `${s.duration_minutes}m` : '—'}</TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Active</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
