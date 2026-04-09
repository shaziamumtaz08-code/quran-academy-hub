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

export default function TeacherSchedulesView() {
  const { user } = useAuth();
  const { activeDivision } = useDivision();

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['teacher-my-schedules', user?.id, activeDivision?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get assignment IDs for this teacher
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

      // Fetch student names
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
    enabled: !!user?.id,
  });

  if (isLoading) {
    return <div className="space-y-3 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-lms-navy">My Schedules</h2>
          <p className="text-sm text-muted-foreground">Your active class schedule</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Calendar className="h-3 w-3" />
          {schedules.length} slots
        </Badge>
      </div>

      {schedules.length === 0 ? (
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
              {schedules.map((s: any) => (
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
