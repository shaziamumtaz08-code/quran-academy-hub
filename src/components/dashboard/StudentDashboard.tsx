import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Video } from 'lucide-react';

import { DashboardShell } from './shared/DashboardShell';
import { QuickActionsGrid } from './shared/QuickActionsGrid';
import { StatsRowCompact } from './shared/StatsRowCompact';
import { ProgressRing } from '@/components/progress/ProgressRing';

const STUDENT_TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'lessons', icon: '📖', label: 'Lessons', path: '/attendance' },
  { id: 'progress', icon: '📊', label: 'Progress', path: '/student-reports' },
  { id: 'schedule', icon: '📅', label: 'Schedule', path: '/schedules' },
];

export function StudentDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const currentMonth = new Date();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['student-dashboard-v2', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Fetch attendance
      const attendanceRes = await supabase.from('attendance')
        .select('status, class_date, lesson_covered, homework, surah_name, ayah_from, ayah_to, raw_input_amount, lines_completed, teacher_id')
        .eq('student_id', user.id)
        .order('class_date', { ascending: false });

      // Fetch teacher assignment
      const assignmentRes = await supabase.from('student_teacher_assignments')
        .select('teacher_id, subject:subjects(name)')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .limit(1);

      let teacherId: string | null = null;
      let subjectName: string | null = 'Quran';

      if (assignmentRes.data?.[0]) {
        teacherId = assignmentRes.data[0].teacher_id;
        subjectName = (assignmentRes.data[0] as any).subject?.name || 'Quran';
      } else {
        const enrollmentRes = await supabase.from('enrollments')
          .select('teacher_id, subject:subjects(name)')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .limit(1);
        if (enrollmentRes.data?.[0]) {
          teacherId = enrollmentRes.data[0].teacher_id;
          subjectName = (enrollmentRes.data[0] as any).subject?.name || 'Quran';
        }
      }

      // Fetch monthly plan
      const planRes = await supabase.from('student_monthly_plans')
        .select('*')
        .eq('student_id', user.id)
        .eq('month', format(currentMonth, 'MM'))
        .eq('year', format(currentMonth, 'yyyy'))
        .eq('status', 'approved')
        .limit(1);

      // Fetch teacher profile
      let teacher: { id: string; full_name: string } | null = null;
      if (teacherId) {
        const { data: teacherData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', teacherId)
          .maybeSingle();
        teacher = teacherData || null;
      }

      // Fetch next class schedule
      let nextClass: { dayOfWeek: string; time: string; duration: number } | null = null;
      if (assignmentRes.data?.[0]) {
        const { data: schedules } = await supabase
          .from('schedules')
          .select('day_of_week, teacher_local_time, duration_minutes, assignment_id')
          .eq('assignment_id', assignmentRes.data[0].teacher_id ? undefined : '')
          .eq('is_active', true);
        // Get schedule from assignment
        const assignmentId = assignmentRes.data[0].teacher_id;
        const { data: assignmentSchedules } = await supabase
          .from('student_teacher_assignments')
          .select('id')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .limit(1);
        
        if (assignmentSchedules?.[0]) {
          const { data: scheds } = await supabase
            .from('schedules')
            .select('day_of_week, teacher_local_time, duration_minutes')
            .eq('assignment_id', assignmentSchedules[0].id)
            .eq('is_active', true)
            .limit(1);
          if (scheds?.[0]) {
            nextClass = {
              dayOfWeek: scheds[0].day_of_week,
              time: scheds[0].teacher_local_time || '00:00',
              duration: scheds[0].duration_minutes,
            };
          }
        }
      }

      const attendance = attendanceRes.data || [];
      const activePlan = planRes.data?.[0];
      const present = attendance.filter(a => a.status === 'present').length;

      const latestPresent = attendance.find(a => a.status === 'present');
      const currentPosition = latestPresent
        ? `${latestPresent.surah_name || 'N/A'}${latestPresent.ayah_from ? `, Ayah ${latestPresent.ayah_from}` : ''}${latestPresent.ayah_to ? `-${latestPresent.ayah_to}` : ''}`
        : 'No lessons recorded';
      const currentHomework = latestPresent?.homework || 'No homework assigned';

      // Monthly progress
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);
      const monthlyAttendance = attendance.filter(a => {
        const date = new Date(a.class_date);
        return date >= startDate && date <= endDate && a.status === 'present';
      });
      const totalAchieved = monthlyAttendance.reduce((sum, a) => {
        return sum + (Number(a.raw_input_amount) || Number(a.lines_completed) || 0);
      }, 0);
      const monthlyTarget = activePlan?.monthly_target || 30;
      const monthlyProgress = Math.min(100, Math.round((totalAchieved / monthlyTarget) * 100));
      const markerLabel = activePlan?.primary_marker === 'rukus' ? 'Rukus' : activePlan?.primary_marker === 'pages' ? 'Pages' : 'Lines';

      return {
        totalClasses: attendance.length,
        attended: present,
        attendanceRate: attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0,
        teacherName: teacher?.full_name || 'Not assigned',
        subject: subjectName,
        currentPosition,
        currentHomework,
        monthlyProgress,
        monthlyTarget,
        totalAchieved,
        markerLabel,
        nextClass,
        recentLessons: attendance.slice(0, 3).map(a => ({
          date: format(new Date(a.class_date), 'MMM dd'),
          lesson: a.lesson_covered || 'No lesson recorded',
          homework: a.homework || 'No homework',
          status: a.status,
        })),
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-12 bg-primary md:hidden" />
        <div className="p-4 space-y-3 max-w-[680px] mx-auto pt-16">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  const quickActions = [
    { icon: '🎥', label: 'Join Class', bg: 'bg-primary', textColor: 'text-primary-foreground', border: 'border-transparent', onClick: () => navigate('/zoom-management') },
    { icon: '📖', label: 'My Lessons', bg: 'bg-teal/10', textColor: 'text-teal', border: 'border-teal/15', onClick: () => navigate('/attendance') },
    { icon: '📊', label: 'My Progress', bg: 'bg-sky/10', textColor: 'text-sky', border: 'border-sky/15', onClick: () => navigate('/student-reports') },
    { icon: '📅', label: 'Schedule', bg: 'bg-gold/10', textColor: 'text-gold', border: 'border-gold/15', onClick: () => navigate('/schedules') },
  ];

  const leftContent = (
    <>
      {/* Next Class Card */}
      <div className="bg-gradient-to-br from-primary to-[hsl(var(--navy-light))] rounded-2xl px-3 py-2.5 text-primary-foreground shadow-card">
        <div className="flex items-center gap-2">
          <p className="text-[10px] opacity-80 font-extrabold tracking-wide uppercase flex items-center gap-1 shrink-0">
            <span>📚</span> Next Class
          </p>
          <p className="text-[15px] leading-tight font-extrabold truncate flex-1 min-w-0">
            {stats?.teacherName || 'Not assigned'}
          </p>
          <button
            onClick={() => navigate('/zoom-management')}
            className="bg-primary-foreground text-primary border-none rounded-lg px-2.5 py-1.5 font-extrabold text-xs cursor-pointer flex items-center gap-1 hover:opacity-90 transition-opacity shrink-0"
          >
            <Video className="h-3.5 w-3.5" />
            Join
          </button>
        </div>
        <p className="text-[11px] text-primary-foreground/75 font-semibold truncate mt-1.5">
          {stats?.subject} · {stats?.nextClass ? `${stats.nextClass.dayOfWeek} · ${stats.nextClass.time}` : 'No schedule set'}
        </p>
      </div>

      {/* Today's Lesson — Continue from */}
      <div className="bg-card rounded-2xl border border-border p-3.5 shadow-card">
        <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-1.5">📖 Today's Lesson</p>
        <p className="text-[15px] font-extrabold text-foreground">Continue from: {stats?.currentPosition}</p>
        <p className="text-[11px] text-muted-foreground mt-1 truncate">📝 {stats?.currentHomework}</p>
      </div>

      {/* Recent Lessons (last 3) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-extrabold text-foreground">📋 Recent Lessons</p>
          <button
            onClick={() => navigate('/attendance')}
            className="text-[11px] text-teal font-bold bg-transparent border-none cursor-pointer hover:underline"
          >
            All Lessons →
          </button>
        </div>
        {(!stats?.recentLessons?.length) ? (
          <div className="bg-card rounded-xl border border-border p-4 text-center text-muted-foreground">
            <p className="text-xs">No lessons recorded yet</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
            {stats.recentLessons.map((lesson, idx) => (
              <div key={idx} className="px-3 py-2.5 flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${lesson.status === 'present' ? 'bg-teal/10 text-teal' : 'bg-destructive/10 text-destructive'}`}>
                  {lesson.status === 'present' ? '✅' : '❌'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13px] text-foreground truncate">{lesson.lesson}</p>
                  <p className="text-[11px] text-muted-foreground truncate">📝 {lesson.homework}</p>
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">{lesson.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  const rightContent = (
    <>
      {/* Monthly Goal Ring */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-3">🎯 Monthly Goal</p>
        <div className="flex items-center gap-4">
          <ProgressRing percentage={stats?.monthlyProgress || 0} size={80} />
          <div>
            <p className="text-2xl font-black text-foreground">{stats?.monthlyProgress || 0}%</p>
            <p className="text-[11px] text-muted-foreground">
              {stats?.totalAchieved || 0} / {stats?.monthlyTarget || 30} {stats?.markerLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Attendance Badge */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">📊 Attendance</p>
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-black ${(stats?.attendanceRate || 0) >= 85 ? 'text-teal' : (stats?.attendanceRate || 0) >= 60 ? 'text-gold' : 'text-destructive'}`}>
            {stats?.attendanceRate || 0}%
          </span>
          <div>
            <p className="text-xs text-muted-foreground">{stats?.attended || 0} of {stats?.totalClasses || 0} classes</p>
          </div>
        </div>
      </div>

      {/* My Teacher Card */}
      <div className="bg-card rounded-2xl border border-border p-3.5 shadow-card">
        <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-2">👨‍🏫 My Teacher</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {(stats?.teacherName || 'N')[0]}
          </div>
          <div>
            <p className="font-bold text-[15px] text-foreground">{stats?.teacherName}</p>
            <p className="text-[11px] text-muted-foreground">{stats?.subject}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActionsGrid actions={quickActions} />

      {/* Stats Row */}
      <StatsRowCompact
        title={`📈 My Stats — ${format(new Date(), 'MMMM')}`}
        stats={[
          { value: stats?.totalClasses || 0, label: 'Total', sub: 'Classes', color: 'text-teal' },
          { value: stats?.attended || 0, label: 'Attended', sub: 'Present', color: 'text-sky' },
          { value: `${stats?.attendanceRate || 0}%`, label: 'Rate', sub: 'Attendance', color: 'text-gold' },
        ]}
      />
    </>
  );

  return (
    <DashboardShell
      tabs={STUDENT_TABS}
      leftContent={leftContent}
      rightContent={rightContent}
      brandLabel="AQA"
    />
  );
}
