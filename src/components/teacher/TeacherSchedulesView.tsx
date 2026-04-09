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
      let query = supabase
        .from('schedules')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('is_active', true);

      if (activeDivision?.id) {
        query = query.eq('division_id', activeDivision.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch student names
      const studentIds = [...new Set((data || []).map(s => s.student_id))];
      const { data: profiles } = studentIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', studentIds)
        : { data: [] };

      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));

      return (data || []).map(s => ({
        ...s,
        student_name: nameMap[s.student_id] || 'Unknown',
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
          <p className="text-sm text-lms-text-3">Your active class schedule</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Calendar className="h-3 w-3" />
          {schedules.length} slots
        </Badge>
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-12 text-lms-text-3">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No active schedules</p>
        </div>
      ) : (
        <div className="rounded-lg border border-lms-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-lms-surface">
                <TableHead className="text-xs">Student</TableHead>
                <TableHead className="text-xs">Days</TableHead>
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Duration</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-sm">{s.student_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(s.days_of_week || []).map((d: string) => (
                        <Badge key={d} variant="outline" className="text-[9px] px-1.5 py-0">
                          {DAYS_LABELS[d] || d}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{s.start_time || '—'}</TableCell>
                  <TableCell className="text-sm">{s.duration_minutes ? `${s.duration_minutes}m` : '—'}</TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Active</Badge>
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
