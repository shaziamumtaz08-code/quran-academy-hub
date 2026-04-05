import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, Calendar, CheckCircle, Star, TrendingUp, TrendingDown, Clock, AlertTriangle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInHours, startOfMonth, endOfMonth, parseISO } from 'date-fns';

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2025, i, 1);
  return { value: String(i + 1).padStart(2, '0'), label: format(d, 'MMMM') };
});

export default function KPI() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = React.useState(String(now.getFullYear()));
  const [selectedMonth, setSelectedMonth] = React.useState(String(now.getMonth() + 1).padStart(2, '0'));
  const { activeDivision } = useDivision();
  const activeDivisionId = activeDivision?.id;

  const monthKey = `${selectedYear}-${selectedMonth}`;

  // Fetch real teacher KPIs
  const { data, isLoading } = useQuery({
    queryKey: ['kpi-dashboard', monthKey, activeDivisionId],
    queryFn: async () => {
      const monthStart = `${monthKey}-01`;
      const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');

      // 1) Teachers with assignments in this division — only those with requires_planning=true
      let assignmentQuery = supabase
        .from('student_teacher_assignments')
        .select('teacher_id, student_id, id, requires_planning')
        .eq('status', 'active');
      if (activeDivisionId) assignmentQuery = assignmentQuery.eq('division_id', activeDivisionId);
      const { data: assignments } = await assignmentQuery;

      // Build teacher map — only count students that require planning for plan KPIs
      const teacherMap: Record<string, { studentIds: Set<string>; planningStudentIds: Set<string>; assignmentIds: string[] }> = {};
      (assignments || []).forEach(a => {
        if (!teacherMap[a.teacher_id]) teacherMap[a.teacher_id] = { studentIds: new Set(), planningStudentIds: new Set(), assignmentIds: [] };
        teacherMap[a.teacher_id].studentIds.add(a.student_id);
        if (a.requires_planning) teacherMap[a.teacher_id].planningStudentIds.add(a.student_id);
        teacherMap[a.teacher_id].assignmentIds.push(a.id);
      });

      const teacherIds = Object.keys(teacherMap);
      if (!teacherIds.length) return { teachers: [], planningKpis: { submitted: 0, total: 0, pending: 0, avgTat: 0, breached: 0, onTime: 0, late: 0 } };

      // 2) Teacher profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds);
      const profileMap: Record<string, string> = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p.full_name || 'Unknown'; });

      // 3) Attendance for the month
      const { data: attendance } = await supabase
        .from('attendance')
        .select('teacher_id, student_id, status, class_date')
        .in('teacher_id', teacherIds)
        .gte('class_date', monthStart)
        .lte('class_date', monthEnd);

      // 4) Monthly plans — read from student_monthly_plans (the real table)
      const { data: planData } = await supabase
        .from('student_monthly_plans')
        .select('id, teacher_id, student_id, month, status, created_at, approved_at, approved_by')
        .in('teacher_id', teacherIds)
        .eq('month', monthKey);
      const plans = planData || [];

      // Deadline: 3rd of the month
      const deadlineDate = new Date(Number(selectedYear), Number(selectedMonth) - 1, 3, 23, 59, 59);

      // Build teacher KPIs
      const teachers = teacherIds.map(tid => {
        const info = teacherMap[tid];
        const name = profileMap[tid] || 'Teacher';
        const teacherAtt = (attendance || []).filter(a => a.teacher_id === tid);
        const totalClasses = teacherAtt.length;
        const delivered = teacherAtt.filter(a => a.status === 'present' || a.status === 'late').length;
        const teacherAbsent = teacherAtt.filter(a => a.status === 'teacher_absent' || a.status === 'teacher_leave').length;
        const studentAbsent = teacherAtt.filter(a => a.status === 'student_absent' || a.status === 'absent').length;
        const attendanceRate = totalClasses > 0 ? Math.round((delivered / totalClasses) * 100) : 0;
        const deliveryRate = totalClasses > 0 ? Math.round(((totalClasses - teacherAbsent) / totalClasses) * 100) : 0;

        const teacherPlans = plans.filter((p: any) => p.teacher_id === tid);
        const expectedPlans = info.planningStudentIds.size; // Only count students with requires_planning
        const submittedPlans = teacherPlans.length;
        const approvedPlans = teacherPlans.filter((p: any) => p.status === 'approved').length;

        // Plan timing: on-time (submitted by 3rd) vs late
        const onTimePlans = teacherPlans.filter((p: any) => p.created_at && new Date(p.created_at) <= deadlineDate).length;
        const latePlans = teacherPlans.filter((p: any) => p.created_at && new Date(p.created_at) > deadlineDate).length;

        // Score: weighted (delivery 40%, attendance 30%, planning 30%)
        const planRate = expectedPlans > 0 ? submittedPlans / expectedPlans : 1; // If no planning required, full marks
        const score = Math.round(((deliveryRate / 100) * 40 + (attendanceRate / 100) * 30 + planRate * 30)) / 10;

        return {
          id: tid,
          name,
          studentsAssigned: info.studentIds.size,
          totalClasses,
          delivered,
          teacherAbsent,
          studentAbsent,
          attendanceRate,
          deliveryRate,
          submittedPlans,
          expectedPlans,
          approvedPlans,
          onTimePlans,
          latePlans,
          score: Math.min(5, Math.max(0, score)),
          trend: deliveryRate >= 95 ? 'up' as const : deliveryRate >= 80 ? 'stable' as const : 'down' as const,
        };
      }).sort((a, b) => b.score - a.score);

      // Planning KPIs (global)
      const totalExpected = Object.values(teacherMap).reduce((s, t) => s + t.planningStudentIds.size, 0);
      const totalSubmitted = plans.length;
      const totalPending = plans.filter((p: any) => p.status === 'pending').length;
      const totalOnTime = plans.filter((p: any) => p.created_at && new Date(p.created_at) <= deadlineDate).length;
      const totalLate = plans.filter((p: any) => p.created_at && new Date(p.created_at) > deadlineDate).length;

      // TAT: hours from created_at to approved_at
      const approvedWithTat = plans.filter((p: any) => p.approved_at && p.created_at);
      const avgTat = approvedWithTat.length > 0
        ? Math.round(approvedWithTat.reduce((s: number, p: any) => s + differenceInHours(new Date(p.approved_at), new Date(p.created_at)), 0) / approvedWithTat.length)
        : 0;
      const breached = approvedWithTat.filter((p: any) => differenceInHours(new Date(p.approved_at), new Date(p.created_at)) > 36).length
        + totalPending;

      return {
        teachers,
        planningKpis: { submitted: totalSubmitted, total: totalExpected, pending: totalPending, avgTat, breached, onTime: totalOnTime, late: totalLate },
      };
    },
  });

  const kpis = data?.planningKpis;
  const teachers = data?.teachers || [];
  const completionRate = kpis && kpis.total > 0 ? Math.round((kpis.submitted / kpis.total) * 100) : 0;

  const getScoreColor = (score: number) => {
    if (score >= 4.0) return 'text-teal';
    if (score >= 3.0) return 'text-gold';
    return 'text-destructive';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-teal" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <div className="w-4 h-0.5 bg-muted-foreground rounded" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">KPI & Planning</h1>
            <p className="text-muted-foreground mt-1">Teacher performance, planning submission & approval tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* Planning KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
              <div className="bg-primary text-primary-foreground rounded-xl p-4">
                <FileText className="h-5 w-5 mb-1 opacity-70" />
                <p className="text-2xl font-black">{kpis?.submitted || 0}<span className="text-sm font-medium opacity-70">/{kpis?.total || 0}</span></p>
                <p className="text-[11px] opacity-70 font-semibold">Plans Submitted</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <CheckCircle className="h-5 w-5 mb-1 text-teal" />
                <p className="text-2xl font-black text-foreground">{completionRate}%</p>
                <p className="text-[11px] text-muted-foreground font-semibold">Completion Rate</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <CheckCircle className="h-5 w-5 mb-1 text-emerald-500" />
                <p className="text-2xl font-black text-emerald-600">{kpis?.onTime || 0}</p>
                <p className="text-[11px] text-muted-foreground font-semibold">On-Time (by 3rd)</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <AlertTriangle className="h-5 w-5 mb-1 text-amber-500" />
                <p className="text-2xl font-black text-amber-600">{kpis?.late || 0}</p>
                <p className="text-[11px] text-muted-foreground font-semibold">Late Submissions</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <Clock className="h-5 w-5 mb-1 text-gold" />
                <p className="text-2xl font-black text-foreground">{kpis?.pending || 0}</p>
                <p className="text-[11px] text-muted-foreground font-semibold">Pending Approval</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <BarChart3 className="h-5 w-5 mb-1 text-primary" />
                <p className="text-2xl font-black text-foreground">{kpis?.avgTat || 0}h</p>
                <p className="text-[11px] text-muted-foreground font-semibold">Avg Approval TAT</p>
              </div>
              <div className={cn("rounded-xl p-4 border", (kpis?.breached || 0) > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-card border-border')}>
                <AlertTriangle className={cn("h-5 w-5 mb-1", (kpis?.breached || 0) > 0 ? 'text-destructive' : 'text-muted-foreground')} />
                <p className={cn("text-2xl font-black", (kpis?.breached || 0) > 0 ? 'text-destructive' : 'text-foreground')}>{kpis?.breached || 0}</p>
                <p className="text-[11px] text-muted-foreground font-semibold">TAT Breached (36h)</p>
              </div>
            </div>

            {/* Teacher Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {teachers.length === 0 ? (
                <div className="col-span-2 bg-card border border-border rounded-xl p-8 text-center">
                  <p className="text-muted-foreground">No teacher data for {monthKey}</p>
                </div>
              ) : teachers.map(t => (
                <div key={t.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-soft transition-shadow">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {t.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.studentsAssigned} students</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(t.trend)}
                      <p className={cn("text-xl font-black", getScoreColor(t.score))}>{t.score.toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-lg font-black text-foreground">{t.totalClasses}</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <div>
                        <p className="text-lg font-black text-primary">{t.delivered}</p>
                        <p className="text-[10px] text-muted-foreground">Delivered</p>
                      </div>
                      <div>
                        <p className="text-lg font-black text-destructive">{t.teacherAbsent}</p>
                        <p className="text-[10px] text-muted-foreground">T. Absent</p>
                      </div>
                      <div>
                        <p className={cn("text-lg font-black", t.attendanceRate >= 80 ? 'text-teal' : 'text-gold')}>{t.attendanceRate}%</p>
                        <p className="text-[10px] text-muted-foreground">Attendance</p>
                      </div>
                    </div>

                    {/* Planning row */}
                    <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground flex-1">Monthly Plans</span>
                      <Badge variant={t.submittedPlans >= t.expectedPlans ? 'default' : 'destructive'} className="text-[10px]">
                        {t.submittedPlans}/{t.expectedPlans} submitted
                      </Badge>
                      {t.approvedPlans > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{t.approvedPlans} approved</Badge>
                      )}
                    </div>

                    {/* Delivery bar */}
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] text-muted-foreground">Delivery Rate</span>
                        <span className="text-[11px] font-bold text-foreground">{t.deliveryRate}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${t.deliveryRate}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
