import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useDivision } from '@/contexts/DivisionContext';

import { DashboardShell } from './shared/DashboardShell';
import { QuickActionsGrid } from './shared/QuickActionsGrid';
import { StatsRowCompact } from './shared/StatsRowCompact';

const ADMIN_TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'attendance', icon: '✅', label: 'Attendance', path: '/attendance' },
  { id: 'students', icon: '👩‍🎓', label: 'Students', path: '/students' },
  { id: 'fees', icon: '💰', label: 'Fees', path: '/payments' },
];

export function AdminDashboard() {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { activeDivision, activeBranch } = useDivision();
  const divisionId = activeDivision?.id;
  const isGroupStyleDivision = activeDivision?.model_type !== 'one_to_one';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard-v2', divisionId, activeDivision?.model_type],
    queryFn: async () => {
      let attendanceQuery = supabase.from('attendance').select('status, class_date, teacher_id, student_id');

      if (divisionId) attendanceQuery = attendanceQuery.eq('division_id', divisionId);

      const [attendanceRes, feeRes, oneToOneRes, courseRes, enrollmentRes, classStaffRes] = await Promise.all([
        attendanceQuery,
        (() => {
          const currentMonth = format(new Date(), 'yyyy-MM');
          let feeQuery = supabase.from('fee_invoices').select('amount, amount_paid, status').eq('billing_month', currentMonth);
          if (divisionId) feeQuery = feeQuery.eq('division_id', divisionId);
          return feeQuery;
        })(),
        isGroupStyleDivision
          ? Promise.resolve({ data: [] as Array<{ student_id: string | null; teacher_id: string | null }> })
          : (() => {
              let query = supabase
                .from('student_teacher_assignments')
                .select('student_id, teacher_id')
                .eq('status', 'active');
              if (divisionId) query = query.eq('division_id', divisionId);
              return query;
            })(),
        isGroupStyleDivision
          ? (() => {
              let query = supabase.from('courses').select('teacher_id, division_id');
              if (divisionId) query = query.eq('division_id', divisionId);
              return query;
            })()
          : Promise.resolve({ data: [] as Array<{ teacher_id: string | null; division_id: string | null }> }),
        isGroupStyleDivision
          ? (() => {
              let query = supabase
                .from('course_enrollments')
                .select('student_id, course:courses!inner(division_id)')
                .eq('status', 'active');
              if (divisionId) query = query.eq('course.division_id', divisionId);
              return query;
            })()
          : Promise.resolve({ data: [] as Array<{ student_id: string | null; course?: { division_id?: string | null } | null }> }),
        isGroupStyleDivision
          ? (() => {
              let query = supabase
                .from('course_class_staff')
                .select('user_id, class:course_classes!inner(courses!inner(division_id))');
              if (divisionId) query = query.eq('class.courses.division_id', divisionId);
              return query;
            })()
          : Promise.resolve({ data: [] as Array<{ user_id: string | null }> }),
      ]);

      const assignments = oneToOneRes.data || [];
      const courses = courseRes.data || [];
      const enrollments = enrollmentRes.data || [];
      const classStaff = classStaffRes.data || [];
      const allAttendance = attendanceRes.data || [];
      const todayAttendance = allAttendance.filter(a => a.class_date === today);
      const absentToday = todayAttendance.filter(a => a.status === 'absent');

      const studentIds = new Set<string>();
      const teacherIds = new Set<string>();

      if (isGroupStyleDivision) {
        enrollments.forEach((row: any) => {
          if (row.student_id) studentIds.add(row.student_id);
        });
        courses.forEach((course) => {
          if (course.teacher_id) teacherIds.add(course.teacher_id);
        });
        classStaff.forEach((row: any) => {
          if (row.user_id) teacherIds.add(row.user_id);
        });
      } else {
        assignments.forEach((assignment) => {
          if (assignment.student_id) studentIds.add(assignment.student_id);
          if (assignment.teacher_id) teacherIds.add(assignment.teacher_id);
        });
      }

      // Teachers who haven't marked today
      const teachersMarkedToday = new Set(todayAttendance.map(a => a.teacher_id));
      const unmarkedTeachers = [...teacherIds].filter(id => !teachersMarkedToday.has(id));
      const fees = feeRes.data || [];

      const totalExpected = (fees || []).reduce((s, f) => s + f.amount, 0);
      const totalCollected = (fees || []).reduce((s, f) => s + f.amount_paid, 0);
      const overdue = (fees || []).filter(f => f.status === 'overdue').length;

      return {
        students: studentIds.size,
        teachers: teacherIds.size,
        classesToday: todayAttendance.length,
        presentToday: todayAttendance.filter(a => a.status === 'present').length,
        absentToday: absentToday.length,
        unmarkedTeacherCount: unmarkedTeachers.length,
        totalExpected,
        totalCollected,
        overdueCount: overdue,
        attendanceRate: allAttendance.length > 0
          ? Math.round((allAttendance.filter(a => a.status === 'present').length / allAttendance.length) * 100)
          : 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-12 bg-primary md:hidden" />
        <div className="p-4 space-y-3 max-w-[680px] mx-auto pt-16">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  const quickActions = [
    { icon: '✅', label: 'Mark Attendance', bg: 'bg-teal/10', textColor: 'text-teal', border: 'border-teal/15', onClick: () => navigate('/attendance') },
    { icon: '👩‍🎓', label: 'Add Student', bg: 'bg-sky/10', textColor: 'text-sky', border: 'border-sky/15', onClick: () => navigate('/students') },
    { icon: '📢', label: 'Send Notice', bg: 'bg-gold/10', textColor: 'text-gold', border: 'border-gold/15', onClick: () => navigate('/hub') },
    { icon: '📊', label: 'View Reports', bg: 'bg-primary/10', textColor: 'text-primary', border: 'border-primary/15', onClick: () => navigate('/reports') },
  ];

  const contextLabel = activeBranch && activeDivision ? `${activeBranch.name} — ${activeDivision.name}` : '';

  const leftContent = (
    <>
      {/* Today's Overview */}
      <div className="bg-gradient-to-br from-primary to-[hsl(var(--navy-light))] rounded-2xl px-3 py-3 text-primary-foreground shadow-card">
        <p className="text-[10px] opacity-80 font-extrabold tracking-wide uppercase mb-2">📋 Today's Overview</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center bg-primary-foreground/10 rounded-xl py-2">
            <p className="text-xl font-black">{stats?.classesToday || 0}</p>
            <p className="text-[10px] opacity-70">Scheduled</p>
          </div>
          <div className="text-center bg-primary-foreground/10 rounded-xl py-2">
            <p className="text-xl font-black">{stats?.presentToday || 0}</p>
            <p className="text-[10px] opacity-70">Done</p>
          </div>
          <div className="text-center bg-primary-foreground/10 rounded-xl py-2">
            <p className="text-xl font-black text-destructive">{stats?.absentToday || 0}</p>
            <p className="text-[10px] opacity-70">Absent</p>
          </div>
        </div>
        {contextLabel && <p className="text-[10px] opacity-60 mt-2 truncate">{contextLabel}</p>}
      </div>

      {/* Pending Attendance */}
      {(stats?.unmarkedTeacherCount || 0) > 0 && (
        <div className="bg-card rounded-2xl border border-gold/20 p-3.5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-extrabold text-foreground">⚠️ Pending Attendance</p>
              <p className="text-[11px] text-muted-foreground">{stats?.unmarkedTeacherCount} teachers haven't marked today</p>
            </div>
            <button
              onClick={() => navigate('/attendance')}
              className="bg-gold/10 text-gold border border-gold/15 rounded-xl px-3 py-1.5 font-bold text-xs"
            >
              Remind
            </button>
          </div>
        </div>
      )}

      {/* Absenteeism Alert */}
      {(stats?.absentToday || 0) > 0 && (
        <div className="bg-card rounded-2xl border border-destructive/20 p-3.5 shadow-card">
          <p className="text-[13px] font-extrabold text-foreground">🚨 Absenteeism Today</p>
          <p className="text-[11px] text-muted-foreground">{stats?.absentToday} students absent</p>
          <button
            onClick={() => navigate('/attendance')}
            className="mt-2 bg-destructive/10 text-destructive border border-destructive/15 rounded-xl px-3 py-1.5 font-bold text-xs"
          >
            View & Notify Parents
          </button>
        </div>
      )}
    </>
  );

  const rightContent = (
    <>
      {/* Fee Status */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">💰 Fee Status — This Month</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-teal/10 rounded-xl py-2.5">
            <p className="text-lg font-black text-teal">{stats?.totalCollected?.toLocaleString() || 0}</p>
            <p className="text-[10px] text-muted-foreground">Collected</p>
          </div>
          <div className="text-center bg-secondary/50 rounded-xl py-2.5">
            <p className="text-lg font-black text-foreground">{stats?.totalExpected?.toLocaleString() || 0}</p>
            <p className="text-[10px] text-muted-foreground">Expected</p>
          </div>
        </div>
        {(stats?.overdueCount || 0) > 0 && (
          <p className="text-xs text-destructive font-bold mt-2">⚠ {stats?.overdueCount} overdue</p>
        )}
      </div>

      {/* Quick Actions */}
      <QuickActionsGrid actions={quickActions} />

      {/* Stats */}
      <StatsRowCompact
        title="📈 Overview"
        stats={[
          { value: stats?.students || 0, label: 'Students', sub: 'Active', color: 'text-teal' },
          { value: stats?.teachers || 0, label: 'Teachers', sub: 'Active', color: 'text-sky' },
          { value: `${stats?.attendanceRate || 0}%`, label: 'Attendance', sub: 'Overall', color: 'text-gold' },
        ]}
      />
    </>
  );

  return (
    <DashboardShell
      tabs={ADMIN_TABS}
      leftContent={leftContent}
      rightContent={rightContent}
      brandLabel="AQA"
    />
  );
}
