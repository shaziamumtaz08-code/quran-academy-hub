import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, subDays } from 'date-fns';
import { Video, AlertTriangle, MessageSquare, ChevronRight, Flame, Clock, BookOpen, Calendar } from 'lucide-react';
import { JoinClassButton } from '@/components/zoom/JoinClassButton';
import { DashboardShell } from './shared/DashboardShell';

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
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
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

interface Enrollment {
  id: string;
  type: '1-on-1' | 'group' | 'recorded';
  courseName: string;
  teacherName: string;
  lastClassStatus: 'attended' | 'missed' | 'not_marked' | null;
  lastClassDate: string | null;
  attendanceRate: number;
  totalClasses: number;
  presentClasses: number;
  nextClass: { dayOfWeek: string; time: string; dateTime: Date; duration: number } | null;
}

interface Alert {
  type: 'urgent' | 'warning' | 'info';
  message: string;
  action?: string;
  actionPath?: string;
}

export function StudentDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['student-unified-dashboard', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .single();
      const studentTz = profileData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      // 1) 1-on-1 assignments
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, subject:subjects(name), teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name)')
        .eq('student_id', user.id)
        .eq('status', 'active');

      // 2) All schedules for assignments
      const assignmentIds = (assignments || []).map(a => a.id);
      let scheduleMap: Record<string, any[]> = {};
      if (assignmentIds.length) {
        const { data: schedules } = await supabase
          .from('schedules')
          .select('day_of_week, student_local_time, duration_minutes, assignment_id')
          .in('assignment_id', assignmentIds)
          .eq('is_active', true);
        (schedules || []).forEach(s => {
          if (!scheduleMap[s.assignment_id!]) scheduleMap[s.assignment_id!] = [];
          scheduleMap[s.assignment_id!].push(s);
        });
      }

      // 3) Attendance for this student
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status, class_date, course_id, teacher_id, lesson_covered, homework, surah_name, ayah_from')
        .eq('student_id', user.id)
        .order('class_date', { ascending: false });
      const allAtt = attendance || [];

      // 4) Group course enrollments
      const { data: courseEnrollments } = await supabase
        .from('course_enrollments')
        .select('id, course:courses(id, name, teacher_id, teacher:profiles!courses_teacher_id_fkey(full_name))')
        .eq('student_id', user.id)
        .eq('status', 'active');

      // 5) Fee status
      const { data: invoices } = await supabase
        .from('fee_invoices')
        .select('amount, currency, status, due_date')
        .eq('student_id', user.id)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(3);

      // 6) Notifications / messages
      const { data: notifications } = await supabase
        .from('notification_queue')
        .select('id, title, body, created_at, status')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      // Build unified enrollments
      const enrollments: Enrollment[] = [];

      // 1-on-1 enrollments
      (assignments || []).forEach((a: any) => {
        const teacherName = a.teacher?.full_name || 'Teacher';
        const subjectName = a.subject?.name || 'Quran';
        const scheds = scheduleMap[a.id] || [];

        // Attendance for this teacher
        const teacherAtt = allAtt.filter(att => att.teacher_id === a.teacher_id && !att.course_id);
        const present = teacherAtt.filter(att => att.status === 'present' || att.status === 'late').length;
        const lastAtt = teacherAtt[0];

        let lastClassStatus: Enrollment['lastClassStatus'] = null;
        if (lastAtt) {
          if (lastAtt.status === 'present' || lastAtt.status === 'late') lastClassStatus = 'attended';
          else if (lastAtt.status === 'absent' || lastAtt.status === 'student_absent') lastClassStatus = 'missed';
          else lastClassStatus = 'not_marked';
        }

        // Next class from schedules
        let nextClass: Enrollment['nextClass'] = null;
        if (scheds.length) {
          const upcoming = scheds.map(s => ({
            dayOfWeek: s.day_of_week ? s.day_of_week.charAt(0).toUpperCase() + s.day_of_week.slice(1).toLowerCase() : '',
            time: s.student_local_time || '00:00',
            duration: s.duration_minutes,
            dateTime: buildNextOccurrence(s.day_of_week, s.student_local_time || '00:00', s.duration_minutes, studentTz),
          })).sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
          nextClass = upcoming[0];
        }

        enrollments.push({
          id: a.id,
          type: '1-on-1',
          courseName: subjectName,
          teacherName,
          lastClassStatus,
          lastClassDate: lastAtt?.class_date || null,
          attendanceRate: teacherAtt.length > 0 ? Math.round((present / teacherAtt.length) * 100) : 0,
          totalClasses: teacherAtt.length,
          presentClasses: present,
          nextClass,
        });
      });

      // Group course enrollments
      (courseEnrollments || []).forEach((ce: any) => {
        const course = ce.course;
        if (!course) return;
        const courseAtt = allAtt.filter(att => att.course_id === course.id);
        const present = courseAtt.filter(att => att.status === 'present' || att.status === 'late').length;
        const lastAtt = courseAtt[0];

        let lastClassStatus: Enrollment['lastClassStatus'] = null;
        if (lastAtt) {
          if (lastAtt.status === 'present' || lastAtt.status === 'late') lastClassStatus = 'attended';
          else if (lastAtt.status === 'absent') lastClassStatus = 'missed';
          else lastClassStatus = 'not_marked';
        }

        enrollments.push({
          id: ce.id,
          type: 'group',
          courseName: course.name,
          teacherName: course.teacher?.full_name || 'Instructor',
          lastClassStatus,
          lastClassDate: lastAtt?.class_date || null,
          attendanceRate: courseAtt.length > 0 ? Math.round((present / courseAtt.length) * 100) : 0,
          totalClasses: courseAtt.length,
          presentClasses: present,
          nextClass: null, // Group classes use course schedules — not yet mapped
        });
      });

      // Sort enrollments: soonest next class first
      enrollments.sort((a, b) => {
        if (a.nextClass && b.nextClass) return a.nextClass.dateTime.getTime() - b.nextClass.dateTime.getTime();
        if (a.nextClass) return -1;
        if (b.nextClass) return 1;
        return 0;
      });

      // Global next class across all enrollments
      const globalNextClass = enrollments.find(e => e.nextClass)?.nextClass || null;
      const globalNextEnrollment = enrollments.find(e => e.nextClass) || null;

      // Build alerts
      const alerts: Alert[] = [];

      // Missed 2+ consecutive classes
      const recentAtt = allAtt.slice(0, 5);
      const consecutiveMissed = recentAtt.filter(a => a.status === 'absent' || a.status === 'student_absent');
      if (consecutiveMissed.length >= 2) {
        alerts.push({
          type: 'urgent',
          message: `You missed ${consecutiveMissed.length} recent classes. Stay consistent!`,
          action: 'View Lessons',
          actionPath: '/attendance',
        });
      }

      // Unmarked lessons
      const unmarked = recentAtt.filter(a => !a.lesson_covered && a.status === 'present');
      if (unmarked.length > 0) {
        alerts.push({
          type: 'warning',
          message: `${unmarked.length} class${unmarked.length > 1 ? 'es' : ''} with no lesson recorded`,
        });
      }

      // Pending fees
      const pendingFees = invoices || [];
      if (pendingFees.length > 0) {
        const total = pendingFees.reduce((s, i) => s + Number(i.amount), 0);
        const currency = pendingFees[0].currency || 'PKR';
        alerts.push({
          type: 'urgent',
          message: `Fee pending: ${currency} ${total.toLocaleString()}`,
          action: 'Pay Now',
          actionPath: '/payments',
        });
      }

      // Consistency streak
      const presentDates = allAtt
        .filter(a => a.status === 'present' || a.status === 'late')
        .map(a => a.class_date)
        .sort()
        .reverse();
      let streak = 0;
      if (presentDates.length) {
        streak = 1;
        for (let i = 1; i < presentDates.length; i++) {
          const diff = (new Date(presentDates[i - 1]).getTime() - new Date(presentDates[i]).getTime()) / 86400000;
          if (diff <= 3) streak++;
          else break;
        }
      }

      // Overall stats
      const totalPresent = allAtt.filter(a => a.status === 'present' || a.status === 'late').length;
      const overallRate = allAtt.length > 0 ? Math.round((totalPresent / allAtt.length) * 100) : 0;

      return {
        enrollments,
        globalNextClass,
        globalNextEnrollment,
        alerts,
        notifications: notifications || [],
        overallStats: {
          totalClasses: allAtt.length,
          attended: totalPresent,
          rate: overallRate,
          streak,
        },
        studentTz,
      };
    },
    enabled: !!user?.id,
  });

  const countdown = useCountdown(dashData?.globalNextClass?.dateTime || null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-12 bg-primary md:hidden" />
        <div className="p-4 space-y-3 max-w-[680px] mx-auto pt-16">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  const nc = dashData?.globalNextClass;
  const ncEnrollment = dashData?.globalNextEnrollment;

  // Format time
  let timeDisplay = '';
  let shortDay = '';
  if (nc) {
    const [hh, mm] = nc.time.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    timeDisplay = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
    shortDay = SHORT_DAYS[nc.dayOfWeek] || nc.dayOfWeek;
  }

  // Is class within 15 minutes?
  const minutesUntil = nc ? (nc.dateTime.getTime() - Date.now()) / 60000 : Infinity;
  const isJoinable = minutesUntil <= 15 && minutesUntil > -60;

  const stats = dashData?.overallStats;

  const leftContent = (
    <>
      {/* ═══ NEXT ACTION PANEL ═══ */}
      {nc && ncEnrollment ? (
        <div className="bg-gradient-to-br from-primary to-[hsl(var(--navy-light))] rounded-2xl px-4 py-3.5 text-primary-foreground shadow-card">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] opacity-70 font-extrabold tracking-widest uppercase">⏰ Next Class</p>
            {isJoinable ? (
              <JoinClassButton />
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                {countdown.days > 0 && <span className="bg-primary-foreground/15 rounded-md px-2 py-0.5 text-[11px] font-bold">{countdown.days}d</span>}
                <span className="bg-primary-foreground/15 rounded-md px-2 py-0.5 text-[11px] font-bold">{countdown.hours}h</span>
                <span className="bg-primary-foreground/15 rounded-md px-2 py-0.5 text-[11px] font-bold">{String(countdown.mins).padStart(2, '0')}m</span>
              </div>
            )}
          </div>
          <p className="text-base font-black truncate">{ncEnrollment.courseName}</p>
          <p className="text-[11px] text-primary-foreground/70 font-semibold mt-0.5">
            {ncEnrollment.teacherName} · {shortDay} · {timeDisplay}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border px-4 py-4">
          <p className="text-[10px] text-muted-foreground font-extrabold tracking-widest uppercase mb-1">⏰ Next Class</p>
          <p className="text-sm font-bold text-foreground">No class scheduled today</p>
          <p className="text-xs text-muted-foreground mt-0.5">Use this time to revise your last lesson 📖</p>
        </div>
      )}

      {/* ═══ ALERTS ═══ */}
      {dashData?.alerts && dashData.alerts.length > 0 && (
        <div className="space-y-2">
          {dashData.alerts.map((alert, i) => (
            <div
              key={i}
              className={`rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 border ${
                alert.type === 'urgent'
                  ? 'bg-destructive/8 border-destructive/20'
                  : alert.type === 'warning'
                  ? 'bg-gold/8 border-gold/20'
                  : 'bg-teal/8 border-teal/20'
              }`}
            >
              <AlertTriangle className={`h-4 w-4 shrink-0 ${
                alert.type === 'urgent' ? 'text-destructive' : alert.type === 'warning' ? 'text-gold' : 'text-teal'
              }`} />
              <p className="text-xs font-semibold text-foreground flex-1 min-w-0">{alert.message}</p>
              {alert.action && alert.actionPath && (
                <button
                  onClick={() => navigate(alert.actionPath!)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                    alert.type === 'urgent'
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-gold text-foreground'
                  }`}
                >
                  {alert.action}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ UNIFIED LEARNING — ALL ENROLLMENTS ═══ */}
      <div>
        <p className="text-[13px] font-extrabold text-foreground mb-2 flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-primary" /> My Enrollments
        </p>
        <div className="space-y-2">
          {(dashData?.enrollments || []).length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">No active enrollments yet</p>
            </div>
          ) : (
            (dashData!.enrollments).map((enrollment) => (
              <div
                key={enrollment.id}
                className="bg-card rounded-xl border border-border p-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                onClick={() => navigate('/attendance')}
              >
                {/* Type badge */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  enrollment.type === '1-on-1' ? 'bg-primary/10 text-primary' : 'bg-sky/10 text-sky'
                }`}>
                  {enrollment.type === '1-on-1' ? '1:1' : '👥'}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-bold text-foreground truncate">{enrollment.courseName}</p>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0 capitalize">
                      {enrollment.type}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{enrollment.teacherName}</p>
                </div>

                {/* Status + Attendance */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Last class status icon */}
                  {enrollment.lastClassStatus === 'attended' && (
                    <span className="w-6 h-6 rounded-full bg-teal/10 flex items-center justify-center text-[10px]" title="Last class: Attended">✅</span>
                  )}
                  {enrollment.lastClassStatus === 'missed' && (
                    <span className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center text-[10px]" title="Last class: Missed">❌</span>
                  )}
                  {enrollment.lastClassStatus === 'not_marked' && (
                    <span className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-[10px]" title="Last class: Not marked">⚠️</span>
                  )}

                  {/* Attendance rate */}
                  <span className={`text-xs font-black ${
                    enrollment.attendanceRate >= 80 ? 'text-teal' : enrollment.attendanceRate >= 50 ? 'text-gold' : 'text-destructive'
                  }`}>
                    {enrollment.attendanceRate}%
                  </span>

                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  const rightContent = (
    <>
      {/* ═══ PERFORMANCE SNAPSHOT ═══ */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-3 flex items-center gap-1.5">
          📊 Performance
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className={`text-2xl font-black ${(stats?.rate || 0) >= 80 ? 'text-teal' : (stats?.rate || 0) >= 50 ? 'text-gold' : 'text-destructive'}`}>
              {stats?.rate || 0}%
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Attendance</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-foreground">
              {stats?.attended || 0}<span className="text-sm text-muted-foreground font-medium">/{stats?.totalClasses || 0}</span>
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Classes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-foreground flex items-center justify-center gap-1">
              {stats?.streak || 0}
              {(stats?.streak || 0) >= 5 && <Flame className="h-4 w-4 text-gold" />}
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">Day Streak</p>
          </div>
        </div>
      </div>

      {/* ═══ MESSAGES ═══ */}
      <div className="bg-card rounded-2xl border border-border p-3.5 shadow-card">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-extrabold text-foreground flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-primary" /> Messages
          </p>
          <button
            onClick={() => navigate('/notifications')}
            className="text-[10px] text-primary font-bold hover:underline"
          >
            View All →
          </button>
        </div>
        {(dashData?.notifications || []).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">No new messages</p>
        ) : (
          <div className="space-y-2">
            {dashData!.notifications.map((n: any) => (
              <div key={n.id} className="flex items-start gap-2 p-2 rounded-lg bg-background border border-border">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.status === 'pending' ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-foreground truncate">{n.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{n.body}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{format(new Date(n.created_at), 'MMM dd, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ QUICK LINKS ═══ */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Calendar, label: 'My Schedule', path: '/schedules', color: 'text-primary bg-primary/10' },
          { icon: BookOpen, label: 'My Lessons', path: '/attendance', color: 'text-teal bg-teal/10' },
          { icon: Clock, label: 'My Progress', path: '/student-reports', color: 'text-sky bg-sky/10' },
          { icon: Video, label: 'Join Class', path: null, color: 'text-gold bg-gold/10', isJoin: true },
        ].map((link) => (
          <button
            key={link.label}
            onClick={() => link.path ? navigate(link.path) : undefined}
            className="bg-card rounded-xl border border-border p-3 flex items-center gap-2 hover:bg-secondary/30 transition-colors text-left"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${link.color}`}>
              <link.icon className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-foreground">{link.label}</span>
          </button>
        ))}
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
