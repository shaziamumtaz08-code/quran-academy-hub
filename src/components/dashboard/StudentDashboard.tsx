import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Video } from 'lucide-react';
import { JoinClassButton } from '@/components/zoom/JoinClassButton';

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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS: Record<string, string> = {
  Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
};

function getNowInTimezone(tz: string) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const weekday = get('weekday');
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dayIndex: dayMap[weekday] ?? 0,
    hours: parseInt(get('hour'), 10),
    minutes: parseInt(get('minute'), 10),
    seconds: parseInt(get('second'), 10),
    absoluteMs: now.getTime(),
  };
}

function buildNextOccurrence(dayName: string, timeStr: string, durationMinutes: number, tz: string): Date {
  const tzNow = getNowInTimezone(tz);
  const targetDayIndex = DAY_NAMES.indexOf(dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase());
  if (targetDayIndex === -1) return new Date(tzNow.absoluteMs + 7 * 86400000);
  const [targetH, targetM] = (timeStr || '00:00').split(':').map(Number);
  let daysUntil = targetDayIndex - tzNow.dayIndex;
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0) {
    const nowMins = tzNow.hours * 60 + tzNow.minutes;
    const classEndMins = targetH * 60 + targetM + durationMinutes;
    if (nowMins >= classEndMins) daysUntil = 7;
  }
  const nowSecsOfDay = tzNow.hours * 3600 + tzNow.minutes * 60 + tzNow.seconds;
  const targetSecsOfDay = targetH * 3600 + targetM * 60;
  const totalSecsDiff = daysUntil * 86400 + (targetSecsOfDay - nowSecsOfDay);
  return new Date(tzNow.absoluteMs + totalSecsDiff * 1000);
}

function useCountdown(target: Date | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  useEffect(() => {
    if (!target) return;
    const calc = () => {
      const diff = Math.max(0, target.getTime() - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [target]);
  return timeLeft;
}

export function StudentDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const currentMonth = new Date();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['student-dashboard-v4', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Fetch student timezone
      const { data: profileData } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .single();
      const studentTz = profileData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      // 1) Find ALL active assignments
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, subject:subjects(name), teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name)')
        .eq('student_id', user.id)
        .eq('status', 'active');

      let teacherName: string | null = null;
      let subjectName: string | null = null;

      if (assignments?.length) {
        teacherName = (assignments[0] as any).teacher?.full_name || null;
        subjectName = (assignments[0] as any).subject?.name || null;
      }

      // 2) Fetch ALL schedules for all assignments
      const assignmentIds = (assignments || []).map(a => a.id);
      let nextClassData: { dayOfWeek: string; time: string; duration: number; dateTime: Date; teacherName: string; subject: string } | null = null;

      if (assignmentIds.length) {
        const { data: schedules } = await supabase
          .from('schedules')
          .select('day_of_week, student_local_time, duration_minutes, assignment_id')
          .in('assignment_id', assignmentIds)
          .eq('is_active', true);

        if (schedules?.length) {
          const assignmentMap = new Map((assignments || []).map(a => [a.id, a]));

          const upcoming = schedules.map(s => {
            const assignment = assignmentMap.get(s.assignment_id!);
            const normalizedDay = s.day_of_week ? s.day_of_week.charAt(0).toUpperCase() + s.day_of_week.slice(1).toLowerCase() : '';
            return {
              dayOfWeek: normalizedDay,
              time: s.student_local_time || '00:00',
              duration: s.duration_minutes,
              dateTime: buildNextOccurrence(s.day_of_week, s.student_local_time || '00:00', s.duration_minutes, studentTz),
              teacherName: (assignment as any)?.teacher?.full_name || 'Teacher',
              subject: (assignment as any)?.subject?.name || 'Quran',
            };
          }).sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

          nextClassData = upcoming[0] || null;
        }
      }

      // 3) Attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status, class_date, lesson_covered, homework, surah_name, ayah_from, ayah_to, raw_input_amount, lines_completed')
        .eq('student_id', user.id)
        .order('class_date', { ascending: false });

      const allAttendance = attendance || [];
      const present = allAttendance.filter(a => a.status === 'present').length;

      // 4) Monthly plan
      const { data: plans } = await supabase
        .from('student_monthly_plans')
        .select('*')
        .eq('student_id', user.id)
        .eq('month', format(currentMonth, 'MM'))
        .eq('year', format(currentMonth, 'yyyy'))
        .eq('status', 'approved')
        .limit(1);

      const activePlan = plans?.[0];

      const latestPresent = allAttendance.find(a => a.status === 'present');
      const currentPosition = latestPresent
        ? `${latestPresent.surah_name || 'N/A'}${latestPresent.ayah_from ? `, Ayah ${latestPresent.ayah_from}` : ''}${latestPresent.ayah_to ? `-${latestPresent.ayah_to}` : ''}`
        : null;
      const currentHomework = latestPresent?.homework || null;

      // Monthly progress
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);
      const monthlyAttendance = allAttendance.filter(a => {
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
        totalClasses: allAttendance.length,
        attended: present,
        attendanceRate: allAttendance.length > 0 ? Math.round((present / allAttendance.length) * 100) : 0,
        teacherName: nextClassData?.teacherName || teacherName,
        subject: nextClassData?.subject || subjectName || 'Quran',
        currentPosition,
        currentHomework,
        monthlyProgress,
        monthlyTarget,
        totalAchieved,
        markerLabel,
        nextClass: nextClassData,
        recentLessons: allAttendance.slice(0, 3).map(a => ({
          date: format(new Date(a.class_date), 'MMM dd'),
          lesson: a.lesson_covered || 'No lesson recorded',
          homework: a.homework || 'No homework',
          status: a.status,
        })),
      };
    },
    enabled: !!user?.id,
  });

  const countdown = useCountdown(stats?.nextClass?.dateTime || null);

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

  const hasTeacher = !!stats?.teacherName;
  const nc = stats?.nextClass;

  // Format time for display
  let timeDisplay = '';
  let shortDay = '';
  if (nc) {
    const [hh, mm] = nc.time.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    timeDisplay = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
    shortDay = SHORT_DAYS[nc.dayOfWeek] || nc.dayOfWeek;
  }

  const leftContent = (
    <>
      {/* Next Class Card with live countdown */}
      <div className="bg-gradient-to-br from-primary to-[hsl(var(--navy-light))] rounded-2xl px-3 py-2.5 text-primary-foreground shadow-card">
        <div className="flex items-center gap-2">
          <p className="text-[10px] opacity-80 font-extrabold tracking-wide uppercase flex items-center gap-1 shrink-0">
            <span>📚</span> Next Class
          </p>
          <p className="text-[15px] leading-tight font-extrabold truncate flex-1 min-w-0">
            {hasTeacher ? stats!.teacherName : <span className="opacity-60 font-semibold">Teacher will be assigned soon</span>}
          </p>
          <button
            onClick={() => navigate('/zoom-management')}
            className="bg-primary-foreground text-primary border-none rounded-lg px-2.5 py-1.5 font-extrabold text-xs cursor-pointer flex items-center gap-1 hover:opacity-90 transition-opacity shrink-0"
          >
            <Video className="h-3.5 w-3.5" />
            Join
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px] text-primary-foreground/75 font-semibold truncate">
            {stats?.subject} · {nc
              ? `${shortDay.toLowerCase()} · ${timeDisplay}`
              : <span className="opacity-60">No class scheduled yet</span>}
          </p>
          {nc && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="bg-primary-foreground/15 rounded-md px-2 py-0.5 text-[11px] font-bold">{countdown.days}d</span>
              <span className="bg-primary-foreground/15 rounded-md px-2 py-0.5 text-[11px] font-bold">{countdown.hours}h</span>
              <span className="bg-primary-foreground/15 rounded-md px-2 py-0.5 text-[11px] font-bold">{String(countdown.mins).padStart(2, '0')}m</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions — immediately after Next Class on mobile */}
      <div className="md:hidden">
        <QuickActionsGrid actions={quickActions} />
      </div>

      {/* Today's Lesson — Continue from */}
      <div className="bg-card rounded-2xl border border-border p-3.5 shadow-card">
        <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-1.5">📖 Today's Lesson</p>
        <p className="text-[15px] font-extrabold text-foreground">
          {stats?.currentPosition ? `Continue from: ${stats.currentPosition}` : <span className="text-muted-foreground font-semibold">No lessons recorded yet</span>}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1 truncate">
          📝 {stats?.currentHomework || 'No homework assigned'}
        </p>
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

      {/* Stats Row — mobile only */}
      <div className="md:hidden">
        <StatsRowCompact
          title={`📈 My Stats — ${format(new Date(), 'MMMM')}`}
          stats={[
            { value: stats?.totalClasses || 0, label: 'Total', sub: 'Classes', color: 'text-teal' },
            { value: stats?.attended || 0, label: 'Attended', sub: 'Present', color: 'text-sky' },
            { value: `${stats?.attendanceRate || 0}%`, label: 'Rate', sub: 'Attendance', color: 'text-gold' },
          ]}
        />
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
            {hasTeacher ? stats!.teacherName![0] : '?'}
          </div>
          <div>
            <p className="font-bold text-[15px] text-foreground">
              {hasTeacher ? stats!.teacherName : <span className="text-muted-foreground font-semibold">Teacher will be assigned soon</span>}
            </p>
            <p className="text-[11px] text-muted-foreground">{stats?.subject}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions — desktop only */}
      <div className="hidden md:block">
        <QuickActionsGrid actions={quickActions} />
      </div>

      {/* Stats Row — desktop only */}
      <div className="hidden md:block">
        <StatsRowCompact
          title={`📈 My Stats — ${format(new Date(), 'MMMM')}`}
          stats={[
            { value: stats?.totalClasses || 0, label: 'Total', sub: 'Classes', color: 'text-teal' },
            { value: stats?.attended || 0, label: 'Attended', sub: 'Present', color: 'text-sky' },
            { value: `${stats?.attendanceRate || 0}%`, label: 'Rate', sub: 'Attendance', color: 'text-gold' },
          ]}
        />
      </div>
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
