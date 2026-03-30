import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface PlanReminder {
  studentName: string;
  studentId: string;
}

export function PlanReminderBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const currentMonth = format(now, 'MMMM');
  const currentYear = format(now, 'yyyy');

  const { data: reminders } = useQuery({
    queryKey: ['plan-reminders', user?.id, currentMonth, currentYear],
    queryFn: async (): Promise<PlanReminder[]> => {
      if (!user?.id) return [];

      // Get all active student assignments
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, requires_planning, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name)')
        .eq('teacher_id', user.id)
        .eq('status', 'active');

      if (!assignments?.length) return [];

      // Only consider students where planning tracking is enabled
      const trackableAssignments = assignments.filter(a => (a as any).requires_planning !== false);
      const studentIds = trackableAssignments.map(a => (a.student as any)?.id).filter(Boolean);

      // Check which students have a plan for this month
      const { data: plans } = await supabase
        .from('student_monthly_plans')
        .select('student_id')
        .eq('teacher_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .in('student_id', studentIds);

      const filledIds = new Set((plans || []).map(p => p.student_id));

      return trackableAssignments
        .filter(a => {
          const sid = (a.student as any)?.id;
          return sid && !filledIds.has(sid);
        })
        .map(a => ({
          studentName: (a.student as any)?.full_name || 'Student',
          studentId: (a.student as any)?.id,
        }));
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (!reminders?.length) return null;

  return (
    <div className="bg-gradient-to-br from-gold-light/20 to-gold-light/10 border-[1.5px] border-gold-light rounded-xl p-3 flex items-start gap-2.5 mb-3.5">
      <span className="text-lg shrink-0">📋</span>
      <div className="flex-1">
        <p className="font-extrabold text-[13px] text-gold/90 mb-0.5">
          {currentMonth} Plan Not Submitted
        </p>
        {reminders.slice(0, 2).map((r, i) => (
          <p key={i} className="text-xs text-gold/70">
            • {r.studentName}'s monthly planning is pending
          </p>
        ))}
        {reminders.length > 2 && (
          <p className="text-xs font-semibold text-gold mt-0.5">
            +{reminders.length - 2} more
          </p>
        )}
        <button
          onClick={() => navigate('/planning')}
          className="mt-2 bg-gold text-primary-foreground border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-gold/90 transition-colors"
        >
          Fill Plan Now →
        </button>
      </div>
    </div>
  );
}
