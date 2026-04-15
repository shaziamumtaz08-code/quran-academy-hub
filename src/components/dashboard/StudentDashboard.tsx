import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { format, isToday, isBefore, addDays, isPast } from 'date-fns';
import {
  BookOpen, Clock, Calendar, CalendarOff, Bell, MessagesSquare, FolderOpen,
  ChevronRight, Flame, AlertTriangle, MessageSquare, Pin, Megaphone,
  Video, ExternalLink, FileText, ClipboardList, Radio,
} from 'lucide-react';
import { StudentAttendanceSection } from './StudentAttendanceSection';
import { AiInsightsWidget } from './AiInsightsWidget';
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
    dayName: DAY_NAMES[dayMap[weekday] ?? 0],
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

function formatTime12(time: string) {
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

// ─── Course card gradient fallback ───
const GRADIENTS = [
  'from-primary/80 to-primary/40',
  'from-teal/80 to-teal/40',
  'from-sky/80 to-sky/40',
  'from-gold/80 to-gold/40',
  'from-purple-500/80 to-purple-400/40',
  'from-emerald-500/80 to-emerald-400/40',
];

export function StudentDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  // ═══ MAIN DATA FETCH ═══
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['student-dashboard-v2', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .single();
      const studentTz = profileData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzNow = getNowInTimezone(studentTz);
      const todayName = tzNow.dayName;

      // ── Group course enrollments ──
      const { data: courseEnrollments } = await supabase
        .from('course_enrollments')
        .select('id, course_id, course:courses(id, name, description)')
        .eq('student_id', user.id)
        .eq('status', 'active');

      const courseIds = (courseEnrollments || []).map((ce: any) => ce.course_id).filter(Boolean);

      // ── Student's class memberships ──
      let classStudentRows: any[] = [];
      if (courseIds.length) {
        const { data } = await supabase
          .from('course_class_students')
          .select('class_id, student_id')
          .eq('student_id', user.id);
        classStudentRows = data || [];
      }
      const myClassIds = classStudentRows.map(r => r.class_id);

      // ── Classes for those courses ──
      let allClasses: any[] = [];
      if (myClassIds.length) {
        const { data } = await supabase
          .from('course_classes')
          .select('id, course_id, name, schedule_days, schedule_time, session_duration, timezone, meeting_link, status')
          .in('id', myClassIds)
          .eq('status', 'active');
        allClasses = data || [];
      }

      // ── Staff for classes (teachers) ──
      let classStaffMap: Record<string, string> = {};
      if (myClassIds.length) {
        const { data: staff } = await supabase
          .from('course_class_staff')
          .select('class_id, user_id, staff_role, profile:profiles!course_class_staff_user_id_fkey(full_name)')
          .in('class_id', myClassIds)
          .eq('staff_role', 'teacher');
        (staff || []).forEach((s: any) => {
          classStaffMap[s.class_id] = s.profile?.full_name || 'Teacher';
        });
      }

      // ── Pending assignments (across courses, due within 7 days) ──
      let pendingAssignments: any[] = [];
      if (courseIds.length) {
        const { data: allAssignments } = await supabase
          .from('course_assignments')
          .select('id, title, course_id, due_date, course:courses(name)')
          .in('course_id', courseIds)
          .eq('status', 'active')
          .gte('due_date', new Date(Date.now() - 86400000 * 7).toISOString())
          .order('due_date', { ascending: true });

        // Filter out already submitted
        const { data: submissions } = await supabase
          .from('course_assignment_submissions')
          .select('assignment_id')
          .eq('student_id', user.id);
        const submittedIds = new Set((submissions || []).map(s => s.assignment_id));

        pendingAssignments = (allAssignments || []).filter(a => !submittedIds.has(a.id));
      }

      // ── Course notifications (for unread count) ──
      let courseNotifCounts: Record<string, number> = {};
      if (courseIds.length) {
        const { data: notifs } = await supabase
          .from('course_notifications')
          .select('id, course_id, created_at')
          .in('course_id', courseIds)
          .order('created_at', { ascending: false })
          .limit(200);
        (notifs || []).forEach((n: any) => {
          const key = `seen_announcements_${n.course_id}`;
          const lastSeen = localStorage.getItem(key);
          if (!lastSeen || new Date(n.created_at) > new Date(lastSeen)) {
            courseNotifCounts[n.course_id] = (courseNotifCounts[n.course_id] || 0) + 1;
          }
        });
      }

      // ── Build course cards ──
      const courseCards = (courseEnrollments || []).map((ce: any, idx: number) => {
        const course = ce.course;
        if (!course) return null;
        const courseClasses = allClasses.filter(c => c.course_id === course.id);

        // Next class calculation
        let nextClassInfo: { className: string; time: string; dateTime: Date; duration: number; meetingLink: string | null; dayOfWeek: string } | null = null;
        let isLive = false;
        let minutesUntilStart = Infinity;

        courseClasses.forEach(cls => {
          const tz = cls.timezone || studentTz;
          const days: string[] = cls.schedule_days || [];
          days.forEach(day => {
            const dt = buildNextOccurrence(day, cls.schedule_time || '00:00', cls.session_duration || 30, tz);
            const minsUntil = (dt.getTime() - Date.now()) / 60000;
            if (!nextClassInfo || dt < nextClassInfo.dateTime) {
              nextClassInfo = {
                className: cls.name,
                time: cls.schedule_time || '00:00',
                dateTime: dt,
                duration: cls.session_duration || 30,
                meetingLink: cls.meeting_link,
                dayOfWeek: day,
              };
              minutesUntilStart = minsUntil;
            }
            // Check if currently live
            if (minsUntil <= 0 && minsUntil > -(cls.session_duration || 30)) {
              isLive = true;
            }
          });
        });

        const isSoon = minutesUntilStart <= 15 && minutesUntilStart > 0;

        // Pending assignments for this course
        const coursePendingCount = pendingAssignments.filter(a => a.course_id === course.id).length;
        const unreadAnnouncements = courseNotifCounts[course.id] || 0;

        return {
          id: course.id,
          name: course.name,
          coverImage: course.cover_image_url,
          description: course.description,
          gradient: GRADIENTS[idx % GRADIENTS.length],
          nextClass: nextClassInfo,
          isLive,
          isSoon,
          pendingAssignments: coursePendingCount,
          unreadAnnouncements,
        };
      }).filter(Boolean);

      // ── Today's schedule (all classes today) ──
      const todaySchedule: Array<{
        time: string; courseName: string; className: string; teacherName: string;
        duration: number; meetingLink: string | null; courseId: string;
      }> = [];

      allClasses.forEach(cls => {
        const days: string[] = (cls.schedule_days || []).map((d: string) => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());
        if (days.includes(todayName)) {
        const courseName = '';
        const courseObj = (courseEnrollments || []).find((ce: any) => ce.course_id === cls.course_id)?.course as any;
        const resolvedCourseName = courseObj?.name || 'Course';
          todaySchedule.push({
            time: cls.schedule_time || '00:00',
            courseName,
            className: cls.name,
            teacherName: classStaffMap[cls.id] || 'Teacher',
            duration: cls.session_duration || 30,
            meetingLink: cls.meeting_link,
            courseId: cls.course_id,
          });
        }
      });
      todaySchedule.sort((a, b) => a.time.localeCompare(b.time));

      // ── 1-on-1 assignments (existing logic, kept for alerts/stats) ──
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, subject:subjects(name), teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name)')
        .eq('student_id', user.id)
        .eq('status', 'active');

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

        // Add 1-on-1 to today schedule
        (assignments || []).forEach((a: any) => {
          const scheds = scheduleMap[a.id] || [];
          scheds.forEach(s => {
            const dayFormatted = s.day_of_week ? s.day_of_week.charAt(0).toUpperCase() + s.day_of_week.slice(1).toLowerCase() : '';
            if (dayFormatted === todayName) {
              todaySchedule.push({
                time: s.student_local_time || '00:00',
                courseName: a.subject?.name || 'Quran',
                className: '1-on-1',
                teacherName: a.teacher?.full_name || 'Teacher',
                duration: s.duration_minutes || 30,
                meetingLink: null,
                courseId: '',
              });
            }
          });
        });
        todaySchedule.sort((a, b) => a.time.localeCompare(b.time));
      }

      // ── Attendance stats ──
      const { data: attendance } = await supabase
        .from('attendance')
        .select('status, class_date, course_id, teacher_id')
        .eq('student_id', user.id)
        .order('class_date', { ascending: false });
      const allAtt = attendance || [];
      const totalPresent = allAtt.filter(a => a.status === 'present' || a.status === 'late').length;
      const overallRate = allAtt.length > 0 ? Math.round((totalPresent / allAtt.length) * 100) : 0;

      // Streak
      const presentDates = allAtt
        .filter(a => a.status === 'present' || a.status === 'late')
        .map(a => a.class_date).sort().reverse();
      let streak = 0;
      if (presentDates.length) {
        streak = 1;
        for (let i = 1; i < presentDates.length; i++) {
          const diff = (new Date(presentDates[i - 1]).getTime() - new Date(presentDates[i]).getTime()) / 86400000;
          if (diff <= 3) streak++; else break;
        }
      }

      // ── Alerts ──
      const alerts: Array<{ type: 'urgent' | 'warning' | 'info'; message: string; action?: string; actionPath?: string }> = [];
      const recentAtt = allAtt.slice(0, 5);
      const consecutiveMissed = recentAtt.filter(a => a.status === 'absent' || a.status === 'student_absent');
      if (consecutiveMissed.length >= 2) {
        alerts.push({ type: 'urgent', message: `You missed ${consecutiveMissed.length} recent classes. Stay consistent!`, action: 'View Lessons', actionPath: '/attendance' });
      }
      const { data: invoices } = await supabase
        .from('fee_invoices')
        .select('amount, currency, status')
        .eq('student_id', user.id)
        .in('status', ['pending', 'overdue'])
        .limit(3);
      if ((invoices || []).length > 0) {
        const total = (invoices || []).reduce((s, i) => s + Number(i.amount), 0);
        const currency = invoices![0].currency || 'PKR';
        alerts.push({ type: 'urgent', message: `Fee pending: ${currency} ${total.toLocaleString()}`, action: 'Pay Now', actionPath: '/payments' });
      }

      // ── Notifications (priority inbox) ──
      const { data: notifications } = await supabase
        .from('notification_queue')
        .select('id, title, body, created_at, status, channel')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const inboxItems = (notifications || []).map((n: any) => {
        const isPinned = n.channel === 'pinned' || (n.title || '').toLowerCase().includes('important');
        const isAnnouncement = n.channel === 'announcement' || (n.title || '').toLowerCase().includes('announcement');
        return {
          id: n.id,
          type: isPinned ? 'pinned' : isAnnouncement ? 'announcement' : n.channel === 'system' ? 'system' : 'teacher',
          title: n.title || 'Notification',
          body: n.body || '',
          timestamp: n.created_at,
          isUnread: n.status === 'pending',
        };
      });
      inboxItems.sort((a: any, b: any) => {
        if (a.type === 'pinned' && b.type !== 'pinned') return -1;
        if (b.type === 'pinned' && a.type !== 'pinned') return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Global next class across 1-on-1
      let globalNextClass: { dayOfWeek: string; time: string; dateTime: Date; duration: number } | null = null;
      let globalNextEnrollmentName = '';
      let globalNextTeacherId: string | undefined;
      (assignments || []).forEach((a: any) => {
        const scheds = scheduleMap[a.id] || [];
        scheds.forEach(s => {
          const dt = buildNextOccurrence(s.day_of_week, s.student_local_time || '00:00', s.duration_minutes, studentTz);
          if (!globalNextClass || dt < globalNextClass.dateTime) {
            globalNextClass = { dayOfWeek: s.day_of_week, time: s.student_local_time || '00:00', dateTime: dt, duration: s.duration_minutes };
            globalNextEnrollmentName = a.subject?.name || 'Quran';
            globalNextTeacherId = a.teacher_id;
          }
        });
      });
      // Also check group courses
      courseCards.forEach((cc: any) => {
        if (cc?.nextClass) {
          if (!globalNextClass || cc.nextClass.dateTime < globalNextClass.dateTime) {
            globalNextClass = cc.nextClass;
            globalNextEnrollmentName = cc.name;
            globalNextTeacherId = undefined;
          }
        }
      });

      return {
        courseCards,
        todaySchedule,
        pendingAssignments,
        alerts,
        priorityInbox: inboxItems.slice(0, 3),
        unreadCount: inboxItems.filter((i: any) => i.isUnread).length,
        overallStats: { totalClasses: allAtt.length, attended: totalPresent, rate: overallRate, streak },
        globalNextClass,
        globalNextEnrollmentName,
        globalNextTeacherId,
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
        <div className="p-4 space-y-4 max-w-5xl mx-auto pt-16">
          <Skeleton className="h-20 rounded-2xl" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-72 rounded-xl shrink-0" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Skeleton className="h-40 rounded-xl md:col-span-3" />
            <Skeleton className="h-40 rounded-xl md:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  const nc = dashData?.globalNextClass;
  const ncName = dashData?.globalNextEnrollmentName;
  const ncTeacherId = dashData?.globalNextTeacherId;
  const stats = dashData?.overallStats;

  let timeDisplay = '';
  let shortDay = '';
  if (nc) {
    timeDisplay = formatTime12(nc.time);
    shortDay = SHORT_DAYS[nc.dayOfWeek?.charAt(0).toUpperCase() + nc.dayOfWeek?.slice(1).toLowerCase()] || nc.dayOfWeek;
  }
  const minutesUntil = nc ? (nc.dateTime.getTime() - Date.now()) / 60000 : Infinity;
  const isJoinable = minutesUntil <= 30 && minutesUntil > -90;

  const renderJoinArea = () => {
    if (isJoinable) {
      return <JoinClassButton teacherId={ncTeacherId} />;
    }
    return (
      <div className="flex items-center gap-1 shrink-0">
        {countdown.days > 0 && <span className="bg-primary-foreground/15 rounded-md px-2 py-0.5 text-[11px] font-bold">{countdown.days}d</span>}
        <span className="bg-primary-foreground/15 rounded-md px-2 py-0.5 text-[11px] font-bold">{countdown.hours}h</span>
        <span className="bg-primary-foreground/15 rounded-md px-2 py-0.5 text-[11px] font-bold">{String(countdown.mins).padStart(2, '0')}m</span>
      </div>
    );
  };

  const leftContent = (
    <>
      {/* ═══ NEXT CLASS PANEL ═══ */}
      {nc && ncName ? (
        <div className="bg-gradient-to-br from-primary to-[hsl(var(--navy-light))] rounded-2xl px-4 py-3.5 text-primary-foreground shadow-card">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] opacity-70 font-extrabold tracking-widest uppercase">⏰ Next Class</p>
            {renderJoinArea()}
          </div>
          <p className="text-base font-black truncate">{ncName}</p>
          <p className="text-[11px] text-primary-foreground/70 font-semibold mt-0.5">
            {shortDay} · {timeDisplay}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border px-4 py-4">
          <p className="text-[10px] text-muted-foreground font-extrabold tracking-widest uppercase mb-1">⏰ Next Class</p>
          <p className="text-sm font-bold text-foreground">No class scheduled</p>
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
                alert.type === 'urgent' ? 'bg-destructive/8 border-destructive/20'
                  : alert.type === 'warning' ? 'bg-gold/8 border-gold/20'
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
                    alert.type === 'urgent' ? 'bg-destructive text-destructive-foreground' : 'bg-gold text-foreground'
                  }`}
                >
                  {alert.action}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ SECTION 1: MY COURSES ═══ */}
      <div>
        <p className="text-[13px] font-extrabold text-foreground mb-2 flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-primary" /> My Courses
        </p>

        {(dashData?.courseCards || []).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No courses enrolled yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible scrollbar-hide">
            {dashData!.courseCards.map((course: any) => (
              <Card
                key={course.id}
                className="min-w-[260px] md:min-w-0 shrink-0 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Cover image or gradient */}
                <div className={`h-24 relative ${!course.coverImage ? `bg-gradient-to-br ${course.gradient}` : ''}`}>
                  {course.coverImage ? (
                    <img src={course.coverImage} alt={course.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-3xl font-black text-white/80">{course.name.charAt(0)}</span>
                    </div>
                  )}
                  {/* Live / Soon badges */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {course.isLive && (
                      <Badge className="bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0 h-5 gap-1">
                        <Radio className="h-3 w-3 animate-pulse" /> Live Now
                      </Badge>
                    )}
                    {course.isSoon && !course.isLive && (
                      <Badge className="bg-gold text-foreground text-[9px] px-1.5 py-0 h-5">
                        ⏰ In 15 min
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-bold text-foreground truncate">{course.name}</p>

                  {/* Next class info */}
                  {course.nextClass && (
                    <p className="text-[11px] text-muted-foreground">
                      Next: {SHORT_DAYS[course.nextClass.dayOfWeek?.charAt(0).toUpperCase() + course.nextClass.dayOfWeek?.slice(1).toLowerCase()] || course.nextClass.dayOfWeek} · {formatTime12(course.nextClass.time)}
                    </p>
                  )}

                  {/* Counters */}
                  <div className="flex gap-2">
                    {course.pendingAssignments > 0 && (
                      <Badge variant="outline" className="text-[9px] gap-1 h-5">
                        <ClipboardList className="h-3 w-3" /> {course.pendingAssignments} due
                      </Badge>
                    )}
                    {course.unreadAnnouncements > 0 && (
                      <Badge variant="outline" className="text-[9px] gap-1 h-5">
                        <Bell className="h-3 w-3" /> {course.unreadAnnouncements} new
                      </Badge>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 text-[11px] h-7"
                      onClick={() => navigate(`/my-courses/${course.id}`)}
                    >
                      Continue Learning
                    </Button>
                    {(course.isLive || course.isSoon) && course.nextClass?.meetingLink && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[11px] h-7 gap-1"
                        onClick={() => window.open(course.nextClass.meetingLink, '_blank')}
                      >
                        <Video className="h-3 w-3" /> Join
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ═══ SECTION 2 & 3: TODAY'S SCHEDULE + PENDING ACTIONS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Today's Schedule (left 60%) */}
        <div className="md:col-span-3">
          <p className="text-[13px] font-extrabold text-foreground mb-2 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" /> Today's Schedule
          </p>
          <Card>
            <CardContent className="p-0">
              {(dashData?.todaySchedule || []).length === 0 ? (
                <div className="py-8 text-center">
                  <CalendarOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No classes today</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enjoy your free time! 🎉</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {dashData!.todaySchedule.map((cls: any, idx: number) => {
                    const [hh, mm] = (cls.time || '00:00').split(':').map(Number);
                    const nowMins = getNowInTimezone(dashData?.studentTz || 'UTC').hours * 60 + getNowInTimezone(dashData?.studentTz || 'UTC').minutes;
                    const classMins = hh * 60 + mm;
                    const isNow = nowMins >= classMins && nowMins < classMins + cls.duration;

                    return (
                      <div key={idx} className={`flex items-center gap-3 px-3.5 py-3 ${isNow ? 'bg-primary/5' : ''}`}>
                        <div className="text-center shrink-0 w-14">
                          <p className="text-sm font-bold text-foreground">{formatTime12(cls.time)}</p>
                          <p className="text-[10px] text-muted-foreground">{cls.duration}m</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-foreground truncate">{cls.courseName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{cls.className} · {cls.teacherName}</p>
                        </div>
                        {isNow && <Badge className="bg-destructive text-destructive-foreground text-[9px] h-5 shrink-0">LIVE</Badge>}
                        {cls.meetingLink && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[10px] h-7 shrink-0"
                            onClick={() => window.open(cls.meetingLink, '_blank')}
                          >
                            Join
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Actions (right 40%) */}
        <div className="md:col-span-2">
          <p className="text-[13px] font-extrabold text-foreground mb-2 flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-primary" /> Pending Actions
          </p>
          <Card>
            <CardContent className="p-0">
              {(dashData?.pendingAssignments || []).length === 0 ? (
                <div className="py-8 text-center">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No pending assignments 🎯</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {dashData!.pendingAssignments.slice(0, 6).map((asn: any) => {
                    const due = asn.due_date ? new Date(asn.due_date) : null;
                    const isOverdue = due && isPast(due);
                    const isDueToday = due && isToday(due);
                    const dueDateColor = isOverdue ? 'text-destructive' : isDueToday ? 'text-gold' : 'text-muted-foreground';

                    return (
                      <div
                        key={asn.id}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-secondary/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/my-courses/${asn.course_id}?tab=assignments`)}
                      >
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-foreground truncate">{asn.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{(asn.course as any)?.name || 'Course'}</p>
                        </div>
                        {due && (
                          <p className={`text-[10px] font-semibold shrink-0 ${dueDateColor}`}>
                            {isOverdue ? 'Overdue' : isDueToday ? 'Today' : format(due, 'MMM dd')}
                          </p>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═══ RECENT LESSONS ═══ */}
      <StudentAttendanceSection />

      {/* ═══ AI INSIGHTS ═══ */}
      <AiInsightsWidget />
    </>
  );

  const rightContent = (
    <>
      {/* ═══ PRIORITY INBOX ═══ */}
      <div className="bg-card rounded-2xl border border-border p-3.5 shadow-card">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-extrabold text-foreground flex items-center gap-1.5">
            <Bell className="h-4 w-4 text-primary" /> Priority Inbox
          </p>
          <div className="flex items-center gap-2">
            {(dashData?.unreadCount || 0) > 0 && (
              <Badge className="bg-destructive text-destructive-foreground text-[9px] h-5 px-1.5">{dashData?.unreadCount} new</Badge>
            )}
            <button onClick={() => navigate('/notifications')} className="text-[10px] text-primary font-bold hover:underline">
              View All →
            </button>
          </div>
        </div>
        {(dashData?.priorityInbox || []).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">No new messages</p>
        ) : (
          <div className="space-y-2">
            {dashData!.priorityInbox.map((item: any) => {
              const typeConfig = {
                pinned: { icon: Pin, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Pinned' },
                announcement: { icon: Megaphone, color: 'text-primary', bg: 'bg-primary/10', label: 'Announcement' },
                teacher: { icon: MessageSquare, color: 'text-teal', bg: 'bg-teal/10', label: 'Teacher' },
                system: { icon: Bell, color: 'text-gold', bg: 'bg-gold/10', label: 'System' },
              }[item.type] || { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted/10', label: 'Alert' };
              const TypeIcon = typeConfig.icon;
              return (
                <div key={item.id} className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${item.isUnread ? 'bg-primary/5 border-primary/20' : 'bg-background border-border'}`}>
                  <div className={`w-7 h-7 rounded-lg ${typeConfig.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <TypeIcon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] font-bold text-foreground truncate">{item.title}</p>
                      {item.type === 'pinned' && <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3.5">PINNED</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{item.body}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{format(new Date(item.timestamp), 'MMM dd, h:mm a')}</p>
                  </div>
                  {item.isUnread && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

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

      {/* ═══ QUICK LINKS ═══ */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Calendar, label: 'My Schedule', path: '/schedules', color: 'text-primary bg-primary/10' },
          { icon: BookOpen, label: 'My Lessons', path: '/attendance', color: 'text-teal bg-teal/10' },
          { icon: Clock, label: 'My Progress', path: '/student-reports', color: 'text-sky bg-sky/10' },
          { icon: CalendarOff, label: 'Request Leave', path: '/work-hub?category=leave_request', color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' },
          { icon: MessagesSquare, label: 'Group Chat', path: '/chat', color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' },
          { icon: FolderOpen, label: 'Resources', path: '/resources?tab=assigned', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
        ].map((link) => (
          <button
            key={link.label}
            onClick={() => navigate(link.path)}
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
