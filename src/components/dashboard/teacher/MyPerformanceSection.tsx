import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarCheck, TrendingUp, Target, Users, Wallet, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface Metric {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  trend?: number | null; // percent vs last month
  accent: string;
}

function monthRange(d: Date) {
  return {
    start: format(startOfMonth(d), 'yyyy-MM-dd'),
    end: format(endOfMonth(d), 'yyyy-MM-dd'),
    monthStr: format(d, 'yyyy-MM'),
  };
}

export function MyPerformanceSection() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-performance', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const tid = user!.id;
      const now = new Date();
      const cur = monthRange(now);
      const prev = monthRange(subMonths(now, 1));

      const [
        attCur, attPrev,
        assignCur,
        plansCur, plansPrev,
        allAssigns,
        salaryCur, salaryPrev,
      ] = await Promise.all([
        supabase.from('attendance').select('status', { count: 'exact' }).eq('teacher_id', tid).gte('class_date', cur.start).lte('class_date', cur.end),
        supabase.from('attendance').select('status', { count: 'exact' }).eq('teacher_id', tid).gte('class_date', prev.start).lte('class_date', prev.end),
        supabase.from('student_teacher_assignments').select('id, student_id, status').eq('teacher_id', tid),
        (supabase as any).from('monthly_plans').select('id', { count: 'exact', head: true }).eq('teacher_id', tid).eq('plan_month', cur.start),
        (supabase as any).from('monthly_plans').select('id', { count: 'exact', head: true }).eq('teacher_id', tid).eq('plan_month', prev.start),
        supabase.from('student_teacher_assignments').select('student_id, status'),
        (supabase as any).from('salary_payouts').select('net_salary').eq('teacher_id', tid).eq('salary_month', cur.monthStr).maybeSingle(),
        (supabase as any).from('salary_payouts').select('net_salary').eq('teacher_id', tid).eq('salary_month', prev.monthStr).maybeSingle(),
      ]);

      const allTeacherAssigns = (assignCur.data || []);
      const activeAssigns = allTeacherAssigns.filter((a: any) => a.status === 'active');

      const countByStatus = (rows: any[] | null, statuses: string[]) =>
        (rows || []).filter(r => statuses.includes(r.status)).length;

      const heldCur = countByStatus(attCur.data as any, ['present', 'late', 'short']);
      const totalCur = (attCur.data as any[] || []).length;
      const heldPrev = countByStatus(attPrev.data as any, ['present', 'late', 'short']);
      const totalPrev = (attPrev.data as any[] || []).length;

      const attRateCur = totalCur > 0 ? (heldCur / totalCur) * 100 : 0;
      const attRatePrev = totalPrev > 0 ? (heldPrev / totalPrev) * 100 : 0;

      const planCur = (plansCur as any).count || 0;
      const planPrev = (plansPrev as any).count || 0;
      const planRate = activeAssigns.length > 0 ? (planCur / activeAssigns.length) * 100 : 0;

      // Retention
      const teacherAllStudents = new Set(allTeacherAssigns.map((a: any) => a.student_id));
      const teacherActiveStudents = new Set(activeAssigns.map((a: any) => a.student_id));
      const retention = teacherAllStudents.size > 0 ? (teacherActiveStudents.size / teacherAllStudents.size) * 100 : 0;

      const missedCur = countByStatus(attCur.data as any, ['teacher_absent', 'teacher_leave']);
      const missedPrev = countByStatus(attPrev.data as any, ['teacher_absent', 'teacher_leave']);

      const earnCur = Number((salaryCur as any)?.data?.net_salary || 0);
      const earnPrev = Number((salaryPrev as any)?.data?.net_salary || 0);

      // Student progress: ratio of present/short/late vs all attendance for this teacher this month
      const progressScore = totalCur > 0 ? (heldCur / totalCur) * 100 : 0;
      const progressPrev = totalPrev > 0 ? (heldPrev / totalPrev) * 100 : 0;

      const trend = (cur: number, prev: number) => prev === 0 ? null : ((cur - prev) / prev) * 100;

      return {
        attendanceRate: attRateCur,
        attendanceTrend: trend(attRateCur, attRatePrev),
        progressScore,
        progressTrend: trend(progressScore, progressPrev),
        planCompletion: planRate,
        planCompletionLabel: `${planCur} / ${activeAssigns.length}`,
        planTrend: trend(planCur, planPrev),
        retention,
        retentionLabel: `${teacherActiveStudents.size} / ${teacherAllStudents.size}`,
        earnings: earnCur,
        earningsTrend: trend(earnCur, earnPrev),
        missed: missedCur,
        missedTrend: trend(missedCur, missedPrev),
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  const metrics: Metric[] = [
    { icon: CalendarCheck, label: 'My Attendance Rate', value: `${data.attendanceRate.toFixed(0)}%`, hint: 'Classes held this month', trend: data.attendanceTrend, accent: 'text-lms-accent bg-lms-accent/10' },
    { icon: TrendingUp, label: 'Student Progress', value: `${data.progressScore.toFixed(0)}%`, hint: 'Avg progress this month', trend: data.progressTrend, accent: 'text-emerald-600 bg-emerald-100' },
    { icon: Target, label: 'Plan Completion', value: `${data.planCompletion.toFixed(0)}%`, hint: data.planCompletionLabel + ' plans created', trend: data.planTrend, accent: 'text-violet-600 bg-violet-100' },
    { icon: Users, label: 'Student Retention', value: `${data.retention.toFixed(0)}%`, hint: data.retentionLabel + ' active', trend: null, accent: 'text-sky-600 bg-sky-100' },
    { icon: Wallet, label: 'This Month Earning', value: data.earnings ? `PKR ${data.earnings.toLocaleString()}` : '—', hint: 'Net salary', trend: data.earningsTrend, accent: 'text-lms-navy bg-lms-navy/10' },
    { icon: AlertTriangle, label: 'Missed Classes', value: String(data.missed), hint: 'Teacher absent / leave', trend: data.missedTrend, accent: 'text-rose-600 bg-rose-100' },
  ];

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-extrabold text-foreground">📊 My Performance</p>
        <span className="text-[10px] text-muted-foreground">{format(new Date(), 'MMMM yyyy')}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {metrics.map((m) => {
          const TrendIcon = m.trend == null ? Minus : m.trend > 0 ? ArrowUp : m.trend < 0 ? ArrowDown : Minus;
          const trendColor =
            m.trend == null ? 'text-muted-foreground' :
            (m.label === 'Missed Classes' ? (m.trend > 0 ? 'text-rose-600' : 'text-emerald-600') :
              (m.trend > 0 ? 'text-emerald-600' : m.trend < 0 ? 'text-rose-600' : 'text-muted-foreground'));
          return (
            <Card key={m.label} className="border-border">
              <CardContent className="p-3 flex items-start gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${m.accent}`}>
                  <m.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-lg font-bold text-foreground truncate">{m.value}</p>
                    {m.trend != null && (
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${trendColor}`}>
                        <TrendIcon className="h-3 w-3" />
                        {Math.abs(m.trend).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-foreground/80 truncate">{m.label}</p>
                  {m.hint && <p className="text-[10px] text-muted-foreground truncate">{m.hint}</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
