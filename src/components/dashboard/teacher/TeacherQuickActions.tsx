import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, eachDayOfInterval, isAfter } from 'date-fns';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Bypass cutoff: only count missing attendance from April 1, 2026 onwards
const BYPASS_CUTOFF = new Date('2026-04-01');

export function TeacherQuickActions() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: missedCount = 0 } = useQuery({
    queryKey: ['missed-attendance-count', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;

      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select(`id, student_id, schedules(day_of_week, is_active)`)
        .eq('teacher_id', user.id)
        .eq('status', 'active');

      if (!assignments?.length) return 0;

      const today = new Date();
      const startDate = BYPASS_CUTOFF > subDays(today, 30) ? BYPASS_CUTOFF : subDays(today, 30);
      if (isAfter(startDate, today)) return 0;

      const dateRange = eachDayOfInterval({ start: startDate, end: subDays(today, 1) });

      const studentIds = assignments.map(a => a.student_id).filter(Boolean);
      const fromDate = format(startDate, 'yyyy-MM-dd');
      const todayStr = format(today, 'yyyy-MM-dd');

      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('student_id, class_date')
        .eq('teacher_id', user.id)
        .in('student_id', studentIds)
        .gte('class_date', fromDate)
        .lt('class_date', todayStr);

      const attendedSet = new Set(
        (attendanceRecords || []).map(a => `${a.student_id}_${a.class_date}`)
      );

      let missed = 0;
      for (const assignment of assignments) {
        const schedules = (assignment.schedules as any[]) || [];
        const activeDays = schedules.filter((s: any) => s.is_active).map((s: any) => s.day_of_week);

        for (const date of dateRange) {
          const dayName = DAY_NAMES[date.getDay()];
          if (activeDays.includes(dayName)) {
            const key = `${assignment.student_id}_${format(date, 'yyyy-MM-dd')}`;
            if (!attendedSet.has(key)) missed++;
          }
        }
      }

      return missed;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const actions = [
    {
      icon: '✅',
      label: 'Mark Attendance',
      bg: 'bg-teal/10',
      textColor: 'text-teal',
      border: 'border-teal/15',
      onClick: () => navigate('/attendance?tab=1on1'),
    },
    {
      icon: '⚠️',
      label: `Missing${missedCount > 0 ? ` (${missedCount})` : ''}`,
      bg: missedCount > 0 ? 'bg-destructive/10' : 'bg-gold/10',
      textColor: missedCount > 0 ? 'text-destructive' : 'text-gold',
      border: missedCount > 0 ? 'border-destructive/15' : 'border-gold/15',
      onClick: () => navigate('/attendance?tab=1on1&filter=missing'),
    },
    {
      icon: '📖',
      label: 'Lesson Log',
      bg: 'bg-sky/10',
      textColor: 'text-sky',
      border: 'border-sky/15',
      onClick: () => navigate('/attendance?tab=1on1'),
    },
    {
      icon: '📊',
      label: 'Reports',
      bg: 'bg-gold/10',
      textColor: 'text-gold',
      border: 'border-gold/15',
      onClick: () => navigate('/student-reports'),
    },
    {
      icon: '🌐',
      label: 'My Network',
      bg: 'bg-primary/10',
      textColor: 'text-primary',
      border: 'border-primary/15',
      onClick: () => navigate(`/connections/teacher/${user?.id}`),
    },
  ];

  return (
    <div>
      <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-2.5">
        Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`${a.bg} ${a.textColor} border ${a.border} rounded-2xl p-3.5 flex items-center gap-2 cursor-pointer text-left font-bold text-sm hover:opacity-90 transition-opacity`}
          >
            <span className="text-xl">{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
