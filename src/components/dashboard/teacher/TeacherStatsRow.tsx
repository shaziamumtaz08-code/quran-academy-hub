import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export function TeacherStatsRow() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['teacher-stats-row', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const now = new Date();
      const startDate = format(startOfMonth(now), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(now), 'yyyy-MM-dd');

      const [attendanceRes, assignmentsRes] = await Promise.all([
        supabase
          .from('attendance')
          .select('status')
          .eq('teacher_id', user.id)
          .gte('class_date', startDate)
          .lte('class_date', endDate),
        supabase
          .from('student_teacher_assignments')
          .select('id')
          .eq('teacher_id', user.id)
          .eq('status', 'active'),
      ]);

      const attendance = attendanceRes.data || [];
      const present = attendance.filter(a => a.status === 'present').length;
      const attendanceRate = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;

      return {
        sessions: attendance.length,
        attendanceRate,
        students: assignmentsRes.data?.length || 0,
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
          { val: stats?.sessions ?? 0, label: 'Sessions', sub: 'This month', color: 'text-teal' },
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
