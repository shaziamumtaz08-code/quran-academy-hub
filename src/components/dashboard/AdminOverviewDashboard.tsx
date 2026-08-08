import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  Users, GraduationCap, CalendarCheck, Wallet, AlertTriangle, TrendingUp,
  ClipboardList, UserPlus, BarChart3, Megaphone, ArrowRight, Video,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Skeleton } from '@/components/ui/skeleton';
import { PrayerBar } from '@/components/dashboard/teacher/PrayerBar';
import { IslamicDateCard } from '@/components/dashboard/teacher/IslamicDateCard';
import { AiInsightsWidget } from '@/components/dashboard/AiInsightsWidget';
import { GroupAcademyDashboard } from '@/components/dashboard/GroupAcademyDashboard';

import { isAbsentStatus, isPresentStatus, isLeaveStatus } from '@/lib/attendanceStatus';
import type { IslamicDateData } from '@/lib/islamicDate';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/* ---------- small presentational bits (match teacher/student dashboard styling) ---------- */

function SectionCard({
  title, icon, action, children,
}: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3.5 shadow-card">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-[13px] font-extrabold text-foreground flex items-center gap-1.5">
          {icon}
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

function KpiTile({
  label, value, sub, tone, icon, onClick,
}: {
  label: string; value: string | number; sub?: string;
  tone: 'teal' | 'sky' | 'gold' | 'primary' | 'destructive';
  icon: React.ReactNode; onClick?: () => void;
}) {
  const toneMap: Record<string, { text: string; bg: string; border: string }> = {
    teal: { text: 'text-teal', bg: 'bg-teal/10', border: 'border-teal/20' },
    sky: { text: 'text-sky', bg: 'bg-sky/10', border: 'border-sky/20' },
    gold: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' },
    primary: { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    destructive: { text: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' },
  };
  const t = toneMap[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-card border border-border rounded-xl p-3 text-left shadow-card transition-shadow ${onClick ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`w-8 h-8 rounded-lg ${t.bg} border ${t.border} flex items-center justify-center ${t.text} mb-2`}>
        {icon}
      </div>
      <p className={`text-2xl font-black leading-none ${t.text}`}>{value}</p>
      <p className="text-[11px] font-bold text-foreground mt-1">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </button>
  );
}

function MiniStat({ value, label, tone = 'text-foreground' }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className="text-center bg-secondary/50 rounded-lg py-2 px-1">
      <p className={`text-lg font-black leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

/* ---------------------------------- data ---------------------------------- */

function useAdminOverview() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const modelType = activeDivision?.model_type || null;
  const isOneToOne = modelType === 'one_to_one';

  return useQuery({
    queryKey: ['admin-overview-dashboard', divisionId, modelType],
    queryFn: async () => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      const billingMonth = format(now, 'yyyy-MM');
      const todayName = DAY_NAMES[now.getDay()];

      // Attendance for the current month (division scoped)
      let attQuery = supabase
        .from('attendance')
        .select('status, class_date, teacher_id, student_id')
        .gte('class_date', monthStart)
        .lte('class_date', monthEnd);
      if (divisionId) attQuery = attQuery.eq('division_id', divisionId);

      // Invoices for the current month (division scoped, live only)
      let feeQuery = supabase
        .from('fee_invoices')
        .select('amount, amount_paid, status, currency')
        .eq('billing_month', billingMonth)
        .is('voided_at', null)
        .eq('is_archived', false);
      if (divisionId) feeQuery = feeQuery.eq('division_id', divisionId);

      const [attendanceRes, feeRes] = await Promise.all([attQuery, feeQuery]);

      let studentIds = new Set<string>();
      let teacherIds = new Set<string>();
      let scheduledToday = 0;
      let activeAssignments = 0;

      if (isOneToOne) {
        let asgQuery = supabase
          .from('student_teacher_assignments')
          .select('id, student_id, teacher_id, student:profiles!student_teacher_assignments_student_id_fkey(archived_at)')
          .eq('status', 'active');
        if (divisionId) asgQuery = asgQuery.eq('division_id', divisionId);
        const { data: asgRows } = await asgQuery;

        const live = (asgRows || []).filter((r: any) => !r.student?.archived_at);
        activeAssignments = live.length;
        live.forEach((r: any) => {
          if (r.student_id) studentIds.add(r.student_id);
          if (r.teacher_id) teacherIds.add(r.teacher_id);
        });

        const ids = live.map((r: any) => r.id);
        if (ids.length) {
          const { data: sched } = await supabase
            .from('schedules')
            .select('id, assignment_id')
            .eq('is_active', true)
            .eq('day_of_week', todayName)
            .in('assignment_id', ids);
          scheduledToday = (sched || []).length;
        }
      } else {
        let courseQuery = supabase.from('courses').select('id, teacher_id');
        if (divisionId) courseQuery = courseQuery.eq('division_id', divisionId);

        let enrolQuery = supabase
          .from('course_enrollments')
          .select('student_id, course:courses!inner(division_id)')
          .eq('status', 'active');
        if (divisionId) enrolQuery = enrolQuery.eq('course.division_id', divisionId);

        let staffQuery = supabase
          .from('course_class_staff')
          .select('user_id, class:course_classes!inner(courses!inner(division_id))');
        if (divisionId) staffQuery = staffQuery.eq('class.courses.division_id', divisionId);

        const [courseRes, enrolRes, staffRes] = await Promise.all([courseQuery, enrolQuery, staffQuery]);
        (enrolRes.data || []).forEach((r: any) => r.student_id && studentIds.add(r.student_id));
        (courseRes.data || []).forEach((r: any) => r.teacher_id && teacherIds.add(r.teacher_id));
        (staffRes.data || []).forEach((r: any) => r.user_id && teacherIds.add(r.user_id));
        activeAssignments = (courseRes.data || []).length;
      }

      // Leads (1:1 pipeline only)
      let openLeads = 0;
      if (isOneToOne) {
        let leadQuery = supabase.from('leads').select('id', { count: 'exact', head: true })
          .not('status', 'in', '("enrolled","lost")');
        if (divisionId) leadQuery = leadQuery.eq('division_id', divisionId);
        const { count } = await leadQuery;
        openLeads = count || 0;
      }

      const attendance = attendanceRes.data || [];
      const todayAttendance = attendance.filter(a => a.class_date === today);
      const presentToday = todayAttendance.filter(a => isPresentStatus(a.status)).length;
      const absentToday = todayAttendance.filter(a => isAbsentStatus(a.status)).length;
      const leaveToday = todayAttendance.filter(a => isLeaveStatus(a.status)).length;

      const markedTeachers = new Set(todayAttendance.map(a => a.teacher_id));
      const unmarkedTeachers = [...teacherIds].filter(id => !markedTeachers.has(id));

      const monthMarked = attendance.length;
      const monthPresent = attendance.filter(a => isPresentStatus(a.status)).length;
      const attendanceRate = monthMarked > 0 ? Math.round((monthPresent / monthMarked) * 100) : 0;

      const fees = feeRes.data || [];
      const expected = fees.reduce((s, f) => s + Number(f.amount || 0), 0);
      const collected = fees.reduce((s, f) => s + Number(f.amount_paid || 0), 0);
      const outstanding = Math.max(expected - collected, 0);
      const overdueCount = fees.filter(f => f.status === 'overdue').length;
      const unpaidCount = fees.filter(f => Number(f.amount_paid || 0) < Number(f.amount || 0)).length;
      const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : 0;

      return {
        isOneToOne,
        students: studentIds.size,
        teachers: teacherIds.size,
        activeAssignments,
        scheduledToday,
        markedToday: todayAttendance.length,
        presentToday,
        absentToday,
        leaveToday,
        unmarkedTeacherCount: unmarkedTeachers.length,
        attendanceRate,
        expected,
        collected,
        outstanding,
        overdueCount,
        unpaidCount,
        collectionRate,
        openLeads,
      };
    },
  });
}

/* --------------------------------- component -------------------------------- */

export function AdminOverviewDashboard() {
  const { activeDivision } = useDivision();
  if (activeDivision?.model_type !== 'one_to_one') {
    return <GroupAcademyDashboard />;
  }
  return <OneToOneAdminDashboard />;
}

function OneToOneAdminDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { activeDivision, activeBranch } = useDivision();
  const [islamicDate, setIslamicDate] = useState<IslamicDateData | null>(null);
  const [timezone, setTimezone] = useState('Asia/Karachi');


  const firstName = profile?.full_name?.split(' ')[0] || 'Admin';
  const { data: stats, isLoading } = useAdminOverview();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['admin-unread-notifications', user?.id],
    enabled: !!user?.id,
    refetchInterval: 60000,
    queryFn: async () => {
      const { count } = await supabase
        .from('notification_queue')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user!.id)
        .eq('status', 'pending');
      return count || 0;
    },
  });

  const isOneToOne = activeDivision?.model_type === 'one_to_one';
  const contextLabel = [activeBranch?.name, activeDivision?.name].filter(Boolean).join(' — ');

  const quickLinks = isOneToOne
    ? [
        { icon: <ClipboardList className="h-4 w-4" />, label: 'Attendance', path: '/attendance' },
        { icon: <Users className="h-4 w-4" />, label: 'Assignments', path: '/assignments' },
        { icon: <UserPlus className="h-4 w-4" />, label: 'Leads', path: '/leads' },
        { icon: <Wallet className="h-4 w-4" />, label: 'Fees', path: '/payments' },
        { icon: <Video className="h-4 w-4" />, label: 'Zoom', path: '/zoom-management' },
        { icon: <BarChart3 className="h-4 w-4" />, label: 'Reports', path: '/reports' },
      ]
    : [
        { icon: <ClipboardList className="h-4 w-4" />, label: 'Attendance', path: '/attendance' },
        { icon: <GraduationCap className="h-4 w-4" />, label: 'Courses', path: '/courses' },
        { icon: <Users className="h-4 w-4" />, label: 'Students', path: '/students' },
        { icon: <Wallet className="h-4 w-4" />, label: 'Fees', path: '/payments' },
        { icon: <Megaphone className="h-4 w-4" />, label: 'Announcements', path: '/announcements' },
        { icon: <BarChart3 className="h-4 w-4" />, label: 'Reports', path: '/reports' },
      ];

  return (
    <div className="relative font-sans">
      <div className="p-3 md:p-4 pb-20 md:pb-6 space-y-2 max-w-[1100px] mx-auto">
        <PrayerBar
          firstName={firstName}
          islamicDate={islamicDate}
          timezone={timezone}
          unreadCount={unreadCount}
          onBellClick={() => navigate('/notifications')}
        />
        <IslamicDateCard hidden onIslamicDateLoaded={setIslamicDate} onTimezoneResolved={setTimezone} />

        {/* Division context ribbon */}
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-primary to-[hsl(var(--navy-light))] text-primary-foreground rounded-xl px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide font-extrabold opacity-75">Operating context</p>
            <p className="text-[13px] font-bold truncate">{contextLabel || 'All divisions'}</p>
          </div>
          <span className="text-[10px] font-bold bg-primary-foreground/15 rounded-full px-2.5 py-1 shrink-0">
            {isOneToOne ? '1:1 Mentorship' : 'Group Academy'}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <KpiTile
                tone="teal"
                icon={<GraduationCap className="h-4 w-4" />}
                label="Active students"
                value={stats?.students ?? 0}
                sub={isOneToOne ? `${stats?.activeAssignments ?? 0} active assignments` : 'Enrolled in courses'}
                onClick={() => navigate('/students')}
              />
              <KpiTile
                tone="sky"
                icon={<Users className="h-4 w-4" />}
                label="Active teachers"
                value={stats?.teachers ?? 0}
                sub={isOneToOne ? 'Teaching 1:1' : 'Assigned to classes'}
                onClick={() => navigate('/teachers')}
              />
              <KpiTile
                tone="gold"
                icon={<CalendarCheck className="h-4 w-4" />}
                label="Attendance"
                value={`${stats?.attendanceRate ?? 0}%`}
                sub={`${format(new Date(), 'MMMM')} · ${stats?.markedToday ?? 0} marked today`}
                onClick={() => navigate('/attendance')}
              />
              <KpiTile
                tone="primary"
                icon={<TrendingUp className="h-4 w-4" />}
                label="Collection"
                value={`${stats?.collectionRate ?? 0}%`}
                sub={`${(stats?.unpaidCount ?? 0)} invoices unpaid`}
                onClick={() => navigate('/payments')}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              {/* Today */}
              <div className="lg:col-span-2">
                <SectionCard
                  title="Today at a glance"
                  icon={<CalendarCheck className="h-4 w-4 text-teal" />}
                  action={
                    <button
                      onClick={() => navigate('/attendance')}
                      className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                    >
                      Attendance <ArrowRight className="h-3 w-3" />
                    </button>
                  }
                >
                  <div className={`grid ${isOneToOne ? 'grid-cols-5' : 'grid-cols-4'} gap-2`}>
                    {isOneToOne && <MiniStat value={stats?.scheduledToday ?? 0} label="Scheduled" tone="text-primary" />}
                    <MiniStat value={stats?.markedToday ?? 0} label="Marked" />
                    <MiniStat value={stats?.presentToday ?? 0} label="Present" tone="text-teal" />
                    <MiniStat value={stats?.absentToday ?? 0} label="Absent" tone="text-destructive" />
                    <MiniStat value={stats?.leaveToday ?? 0} label="Leave" tone="text-gold" />
                  </div>

                  {(stats?.unmarkedTeacherCount ?? 0) > 0 && (
                    <button
                      onClick={() => navigate('/attendance')}
                      className="mt-2.5 w-full flex items-center gap-2 rounded-lg border border-gold/25 bg-gold/10 px-3 py-2 text-left"
                    >
                      <AlertTriangle className="h-4 w-4 text-gold shrink-0" />
                      <span className="text-[12px] font-semibold text-foreground">
                        {stats?.unmarkedTeacherCount} teacher{(stats?.unmarkedTeacherCount ?? 0) > 1 ? 's' : ''} haven’t marked attendance today
                      </span>
                    </button>
                  )}

                  {isOneToOne && (stats?.scheduledToday ?? 0) > (stats?.markedToday ?? 0) && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {(stats?.scheduledToday ?? 0) - (stats?.markedToday ?? 0)} scheduled session(s) still awaiting attendance.
                    </p>
                  )}
                </SectionCard>
              </div>

              {/* Quick links */}
              <SectionCard title="Quick links">
                <div className="grid grid-cols-2 gap-2">
                  {quickLinks.map(l => (
                    <button
                      key={l.label}
                      onClick={() => navigate(l.path)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-2 text-[12px] font-semibold text-foreground hover:bg-secondary transition-colors"
                    >
                      <span className="text-primary">{l.icon}</span>
                      <span className="truncate">{l.label}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              {/* Fees */}
              <div className="lg:col-span-2">
                <SectionCard
                  title={`Fees — ${format(new Date(), 'MMMM yyyy')}`}
                  icon={<Wallet className="h-4 w-4 text-gold" />}
                  action={
                    <button
                      onClick={() => navigate('/payments')}
                      className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </button>
                  }
                >
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat value={(stats?.collected ?? 0).toLocaleString()} label="Collected" tone="text-teal" />
                    <MiniStat value={(stats?.expected ?? 0).toLocaleString()} label="Expected" />
                    <MiniStat value={(stats?.outstanding ?? 0).toLocaleString()} label="Outstanding" tone="text-destructive" />
                  </div>
                  <div className="mt-2.5 h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-teal transition-all"
                      style={{ width: `${Math.min(stats?.collectionRate ?? 0, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {stats?.collectionRate ?? 0}% collected
                    {(stats?.overdueCount ?? 0) > 0 && (
                      <span className="text-destructive font-semibold"> · {stats?.overdueCount} overdue</span>
                    )}
                  </p>
                </SectionCard>
              </div>

              {/* 1:1 pipeline / group snapshot */}
              <SectionCard
                title={isOneToOne ? 'Admissions pipeline' : 'Academy snapshot'}
                icon={<UserPlus className="h-4 w-4 text-sky" />}
                action={
                  <button
                    onClick={() => navigate(isOneToOne ? '/leads' : '/courses')}
                    className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline"
                  >
                    Open <ArrowRight className="h-3 w-3" />
                  </button>
                }
              >
                <div className="grid grid-cols-2 gap-2">
                  {isOneToOne ? (
                    <>
                      <MiniStat value={stats?.openLeads ?? 0} label="Open leads" tone="text-sky" />
                      <MiniStat value={stats?.activeAssignments ?? 0} label="Assignments" tone="text-teal" />
                    </>
                  ) : (
                    <>
                      <MiniStat value={stats?.activeAssignments ?? 0} label="Courses" tone="text-sky" />
                      <MiniStat value={stats?.students ?? 0} label="Enrolments" tone="text-teal" />
                    </>
                  )}
                </div>
              </SectionCard>
            </div>

            <AiInsightsWidget />
          </>
        )}
      </div>
    </div>
  );
}

export default AdminOverviewDashboard;
