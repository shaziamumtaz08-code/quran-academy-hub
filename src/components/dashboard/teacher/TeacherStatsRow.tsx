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

  const { data: stats, isLoading } = useQuery({
    queryKey: ['teacher-stats-row', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const now = new Date();
      const monthStart = startOfMonth(now);
      const today = now;
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(endOfMonth(now), 'yyyy-MM-dd');
      const todayStr = format(today, 'yyyy-MM-dd');

      const [attendanceRes, assignmentsRes] = await Promise.all([
        supabase
          .from('attendance')
          .select('status')
          .eq('teacher_id', user.id)
          .gte('class_date', startDate)
          .lte('class_date', endDate),
        supabase
          .from('student_teacher_assignments')
          .select(`
            id,
            schedules(day_of_week, is_active)
          `)
          .eq('teacher_id', user.id)
          .eq('status', 'active'),
      ]);

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

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-card">
      <p className="font-extrabold text-[15px] text-foreground mb-3">📈 My Stats — {monthName}</p>
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { val: stats?.sessions ?? 0, label: 'Sessions', sub: 'Scheduled', color: 'text-teal' },
          { val: `${stats?.attendanceRate ?? 0}%`, label: 'Attendance', sub: 'Avg. across students', color: 'text-sky' },
          { val: stats?.students ?? 0, label: 'Students', sub: 'Active', color: 'text-gold' },
        ].map((s) => (
          <div key={s.label} className="text-center bg-secondary/50 rounded-xl py-2.5 px-1.5">
            <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
            <p className="text-xs font-bold text-foreground">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
