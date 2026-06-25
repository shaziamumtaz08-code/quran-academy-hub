import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

export function TeacherStatsRow() {
  const { user } = useAuth();
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;

  const { data: stats, isLoading } = useQuery({
    queryKey: ['teacher-stats-row', user?.id, divisionId],
    queryFn: async () => {
      if (!user?.id) return null;

      const now = new Date();
      const monthStart = startOfMonth(now);
      const today = now;
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(endOfMonth(now), 'yyyy-MM-dd');
      const todayStr = format(today, 'yyyy-MM-dd');

      let attQuery = supabase
          .from('attendance')
          .select('status')
          .eq('teacher_id', user.id)
          .gte('class_date', startDate)
          .lte('class_date', endDate);
      if (divisionId) attQuery = attQuery.or(`division_id.eq.${divisionId},division_id.is.null`);

      let assignQuery = supabase
          .from('student_teacher_assignments')
          .select(`id, schedules(day_of_week, is_active)`)
          .eq('teacher_id', user.id)
          .eq('status', 'active');
      if (divisionId) assignQuery = assignQuery.or(`division_id.eq.${divisionId},division_id.is.null`);

      const [attendanceRes, assignmentsRes] = await Promise.all([attQuery, assignQuery]);

      const attendance = attendanceRes.data || [];
      const present = attendance.filter(a => a.status === 'present').length;
      const attendanceRate = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;

      // Count scheduled sessions from month start to today
      const assignments = assignmentsRes.data || [];
      const daysInRange = eachDayOfInterval({ start: monthStart, end: today });
      let totalScheduled = 0;

      for (const assignment of assignments) {
        const schedules = (assignment.schedules as any[]) || [];
        const activeDayNums = schedules
          .filter((s: any) => s.is_active)
          .map((s: any) => DAY_MAP[s.day_of_week] ?? -1);

        for (const day of daysInRange) {
          if (activeDayNums.includes(getDay(day))) {
            totalScheduled++;
          }
        }
      }

      return {
        sessions: totalScheduled,
        attendanceRate,
        students: assignments.length,
      };
    },
    enabled: !!user?.id,
  });

  const monthName = format(new Date(), 'MMMM');

  if (isLoading) return <Skeleton className="h-28 rounded-2xl" />;

  const rows = [
    [
      { val: stats?.sessions ?? 0, label: 'Sessions scheduled', color: 'text-teal' },
      { val: `${stats?.attendanceRate ?? 0}%`, label: 'Avg attendance', color: 'text-sky' },
      { val: stats?.students ?? 0, label: 'Active students', color: 'text-gold' },
    ],
    [
      { val: `${stats?.attendanceRate ?? 0}%`, label: 'My attendance rate', color: 'text-teal' },
      { val: '—', label: 'Student progress', color: 'text-sky' },
      { val: '—', label: 'Retention', color: 'text-gold' },
    ],
  ];

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-card h-full flex flex-col">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[12px] font-semibold text-muted-foreground">My stats — {monthName}</p>
        <span className="text-[11px] text-primary">View all →</span>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            {row.map((s) => (
              <div key={s.label} className="text-center bg-secondary/50 rounded-lg py-2 px-1">
                <p className={`text-lg font-semibold ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 text-center bg-secondary/50 rounded-lg py-2 px-1">
            <p className="text-lg font-semibold text-muted-foreground">—</p>
            <p className="text-[10px] text-muted-foreground">This month earning (net)</p>
          </div>
          <div className="text-center bg-secondary/50 rounded-lg py-2 px-1">
            <p className="text-lg font-semibold text-destructive">0</p>
            <p className="text-[10px] text-muted-foreground">Missed classes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
