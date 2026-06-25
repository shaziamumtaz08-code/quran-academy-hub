import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, startOfYear } from 'date-fns';

const LEAVE_ALLOWANCE: Record<string, number> = {
  casual: 3,
  sick: 5,
  annual: 10,
};

const LEAVE_LABEL: Record<string, string> = {
  casual: 'Casual leave',
  sick: 'Sick leave',
  annual: 'Annual leave',
};

export function SalaryLeaveCard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['teacher-salary-leave-card', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const monthStr = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd');

      const [payoutRes, plansRes, assignRes, leavesRes] = await Promise.all([
        (supabase as any).from('salary_payouts')
          .select('net_salary, base_salary')
          .eq('teacher_id', user!.id)
          .eq('salary_month', monthStr)
          .maybeSingle(),
        supabase.from('student_monthly_plans')
          .select('id')
          .eq('teacher_id', user!.id)
          .gte('month', monthStr),
        supabase.from('student_teacher_assignments')
          .select('id')
          .eq('teacher_id', user!.id)
          .eq('status', 'active'),
        supabase.from('leave_events')
          .select('leave_type, status')
          .eq('teacher_id', user!.id)
          .gte('start_date', yearStart),
      ]);

      const usedByType: Record<string, number> = {};
      (leavesRes.data || []).forEach((l: any) => {
        if (l.status === 'approved' || l.status === 'pending') {
          usedByType[l.leave_type] = (usedByType[l.leave_type] || 0) + 1;
        }
      });

      return {
        netSalary: payoutRes.data?.net_salary ?? null,
        plansFilled: plansRes.data?.length ?? 0,
        plansTotal: assignRes.data?.length ?? 0,
        usedByType,
      };
    },
  });

  const netSalary = data?.netSalary;
  const plansFilled = data?.plansFilled ?? 0;
  const plansTotal = data?.plansTotal ?? 0;
  const incomplete = plansFilled < plansTotal;

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-card">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[12px] font-semibold text-muted-foreground">Salary & leave</p>
        <button
          onClick={() => navigate('/salary')}
          className="text-[11px] text-primary hover:underline"
        >
          Details →
        </button>
      </div>

      {/* Dark salary banner */}
      <div
        className="rounded-xl p-3 mb-2.5"
        style={{ background: 'linear-gradient(135deg, #0f2a3a, #1a3d4f)' }}
      >
        <p className="text-[20px] font-semibold" style={{ color: '#7ecfc4' }}>
          {netSalary != null ? `${Number(netSalary).toLocaleString()} PKR` : '— PKR'}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: '#a8d8e0' }}>
          Net salary this month
        </p>
        <div
          className="flex justify-between text-[11px] mt-1.5 pt-1.5 border-t"
          style={{ borderColor: '#1e4a5e', color: '#a8d8e0' }}
        >
          <span>Plan completion</span>
          <span style={{ color: incomplete ? '#ef9a9a' : '#7ecfc4' }}>
            {plansFilled} / {plansTotal} plans
          </span>
        </div>
      </div>

      {/* Leave rows */}
      {['casual', 'sick', 'annual'].map((type, i) => {
        const used = data?.usedByType[type] || 0;
        const remaining = Math.max(0, LEAVE_ALLOWANCE[type] - used);
        return (
          <div
            key={type}
            className={`flex items-center justify-between py-1.5 text-[12px] ${
              i < 2 ? 'border-b border-border' : ''
            }`}
          >
            <span className="text-muted-foreground">{LEAVE_LABEL[type]}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{remaining} remaining</span>
              <button
                onClick={() => navigate('/work-hub?tab=leave')}
                className="border border-border rounded-md px-2 py-0.5 text-[11px] text-primary hover:bg-secondary"
              >
                Request →
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
