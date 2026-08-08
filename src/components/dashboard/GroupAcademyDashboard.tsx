import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, formatDistanceToNow, differenceInCalendarDays } from 'date-fns';
import {
  Megaphone, Bell, Sparkles, Newspaper, ArrowRight, GraduationCap, Users, Wallet,
  CalendarCheck, Rocket, Inbox, Pin, Clock, BookOpen,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Skeleton } from '@/components/ui/skeleton';
import { PrayerBar } from '@/components/dashboard/teacher/PrayerBar';
import { IslamicDateCard } from '@/components/dashboard/teacher/IslamicDateCard';
import { AiInsightsWidget } from '@/components/dashboard/AiInsightsWidget';
import { isPresentStatus, isAbsentStatus, isLeaveStatus } from '@/lib/attendanceStatus';
import type { IslamicDateData } from '@/lib/islamicDate';

/* ------------------------------- primitives ------------------------------- */

function Panel({
  title, icon, action, children, className = '',
}: {
  title: string; icon?: React.ReactNode; action?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`bg-card border border-border rounded-2xl overflow-hidden shadow-card ${className}`}>
      <header className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border bg-secondary/40">
        <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-foreground flex items-center gap-1.5">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

function LinkAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">
      {label} <ArrowRight className="h-3 w-3" />
    </button>
  );
}

function RibbonStat({
  label, value, sub, icon, tone, onClick,
}: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode;
  tone: 'teal' | 'sky' | 'gold' | 'primary'; onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    teal: 'text-teal bg-teal/10 border-teal/20',
    sky: 'text-sky bg-sky/10 border-sky/20',
    gold: 'text-gold bg-gold/10 border-gold/20',
    primary: 'text-primary bg-primary/10 border-primary/20',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2.5 text-left w-full hover:bg-secondary/50 transition-colors"
    >
      <span className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center ${tones[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-black leading-none text-foreground">{value}</span>
        <span className="block text-[11px] font-bold text-foreground/80 mt-0.5 truncate">{label}</span>
        {sub && <span className="block text-[10px] text-muted-foreground truncate">{sub}</span>}
      </span>
    </button>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-[12px] text-muted-foreground py-3 text-center">{text}</p>;
}

/* --------------------------------- data ---------------------------------- */

function useGroupAcademyData() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;

  return useQuery({
    queryKey: ['group-academy-dashboard', divisionId],
    queryFn: async () => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      const billingMonth = format(now, 'yyyy-MM');

      let courseQuery = supabase
        .from('courses')
        .select('id, name, status, start_date, end_date, level, max_students, thumbnail_url, hero_image_url, teacher_id');
      if (divisionId) courseQuery = courseQuery.eq('division_id', divisionId);

      let enrolQuery = supabase
        .from('course_enrollments')
        .select('student_id, course_id, created_at, status, course:courses!inner(division_id, name)')
        .eq('status', 'active');
      if (divisionId) enrolQuery = enrolQuery.eq('course.division_id', divisionId);

      let attQuery = supabase
        .from('attendance')
        .select('status, class_date')
        .gte('class_date', monthStart)
        .lte('class_date', monthEnd);
      if (divisionId) attQuery = attQuery.eq('division_id', divisionId);

      let feeQuery = supabase
        .from('fee_invoices')
        .select('amount, amount_paid, status')
        .eq('billing_month', billingMonth)
        .is('voided_at', null)
        .eq('is_archived', false);
      if (divisionId) feeQuery = feeQuery.eq('division_id', divisionId);

      const [courseRes, enrolRes, attRes, feeRes] = await Promise.all([
        courseQuery, enrolQuery, attQuery, feeQuery,
      ]);

      const courses = courseRes.data || [];
      const enrolments = enrolRes.data || [];
      const attendance = attRes.data || [];
      const fees = feeRes.data || [];

      // spotlight: courses not yet started, or upcoming/draft
      const spotlight = courses
        .filter((c: any) => {
          const notStarted = c.start_date && c.start_date > today;
          const pipelineStatus = ['draft', 'upcoming', 'planned', 'enrolling'].includes(String(c.status || '').toLowerCase());
          return notStarted || pipelineStatus;
        })
        .sort((a: any, b: any) => String(a.start_date).localeCompare(String(b.start_date)))
        .slice(0, 4);

      const enrolByCourse = new Map<string, number>();
      enrolments.forEach((e: any) => enrolByCourse.set(e.course_id, (enrolByCourse.get(e.course_id) || 0) + 1));

      const runningCourses = courses.filter((c: any) => String(c.status).toLowerCase() === 'active').length;

      // teachers
      const teacherIds = new Set<string>();
      courses.forEach((c: any) => c.teacher_id && teacherIds.add(c.teacher_id));

      const todayAtt = attendance.filter(a => a.class_date === today);
      const monthMarked = attendance.length;
      const monthPresent = attendance.filter(a => isPresentStatus(a.status)).length;

      const expected = fees.reduce((s, f) => s + Number(f.amount || 0), 0);
      const collected = fees.reduce((s, f) => s + Number(f.amount_paid || 0), 0);

      // news feed: latest enrolments
      const recentEnrolments = [...enrolments]
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 5);
      const studentIds = [...new Set(recentEnrolments.map((e: any) => e.student_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (studentIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', studentIds);
        nameMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name]));
      }

      const { count: pendingApplications } = await supabase
        .from('registration_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      return {
        totalCourses: courses.length,
        runningCourses,
        spotlight: spotlight.map((c: any) => ({
          ...c,
          enrolled: enrolByCourse.get(c.id) || 0,
          daysToStart: c.start_date ? differenceInCalendarDays(new Date(c.start_date), now) : null,
        })),
        students: new Set(enrolments.map((e: any) => e.student_id)).size,
        teachers: teacherIds.size,
        attendanceRate: monthMarked ? Math.round((monthPresent / monthMarked) * 100) : 0,
        markedToday: todayAtt.length,
        presentToday: todayAtt.filter(a => isPresentStatus(a.status)).length,
        absentToday: todayAtt.filter(a => isAbsentStatus(a.status)).length,
        leaveToday: todayAtt.filter(a => isLeaveStatus(a.status)).length,
        expected,
        collected,
        outstanding: Math.max(expected - collected, 0),
        collectionRate: expected ? Math.round((collected / expected) * 100) : 0,
        overdueCount: fees.filter(f => f.status === 'overdue').length,
        news: recentEnrolments.map((e: any) => ({
          id: `${e.course_id}-${e.student_id}`,
          name: nameMap[e.student_id] || 'A student',
          course: e.course?.name || 'a course',
          at: e.created_at,
        })),
        pendingApplications: pendingApplications || 0,
      };
    },
  });
}

/* -------------------------------- component ------------------------------- */

export function GroupAcademyDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { activeDivision, activeBranch } = useDivision();
  const [islamicDate, setIslamicDate] = useState<IslamicDateData | null>(null);
  const [timezone, setTimezone] = useState('Asia/Karachi');

  const firstName = profile?.full_name?.split(' ')[0] || 'Admin';
  const { data: stats, isLoading } = useGroupAcademyData();

  const { data: notifications = [] } = useQuery({
    queryKey: ['group-academy-notifications', user?.id],
    enabled: !!user?.id,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_queue')
        .select('id, title, body, status, created_at')
        .eq('recipient_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const unreadCount = notifications.filter((n: any) => n.status === 'pending').length;

  const { data: announcements = [] } = useQuery({
    queryKey: ['group-academy-announcements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('announcements' as any)
        .select('id, title, body, is_pinned, published_at')
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(4);
      return (data || []) as any[];
    },
  });

  const contextLabel = [activeBranch?.name, activeDivision?.name].filter(Boolean).join(' — ');

  return (
    <div className="relative font-sans">
      <div className="p-3 md:p-4 pb-20 md:pb-6 space-y-2.5 max-w-[1180px] mx-auto">
        <PrayerBar
          firstName={firstName}
          islamicDate={islamicDate}
          timezone={timezone}
          unreadCount={unreadCount}
          onBellClick={() => navigate('/notifications')}
        />
        <IslamicDateCard hidden onIslamicDateLoaded={setIslamicDate} onTimezoneResolved={setTimezone} />

        {/* Masthead — magazine style, distinct from 1:1 ribbon */}
        <div className="rounded-2xl bg-gradient-to-br from-[hsl(var(--navy-light))] via-primary to-primary text-primary-foreground p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] font-extrabold opacity-70">Group Academy Desk</p>
              <h1 className="text-lg md:text-2xl font-black leading-tight truncate">
                {contextLabel || 'Group Academy'}
              </h1>
              <p className="text-[12px] opacity-80 mt-0.5">
                {format(new Date(), 'EEEE, d MMMM yyyy')} · cohort operations, admissions & broadcasts
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/announcements')}
                className="rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25 transition-colors px-3.5 py-2 text-[12px] font-bold flex items-center gap-1.5"
              >
                <Megaphone className="h-3.5 w-3.5" /> Broadcast
              </button>
              <button
                onClick={() => navigate('/courses')}
                className="rounded-full bg-primary-foreground text-primary px-3.5 py-2 text-[12px] font-bold flex items-center gap-1.5"
              >
                <Rocket className="h-3.5 w-3.5" /> Courses
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            {/* Stat ribbon (single strip, unlike 1:1 tile grid) */}
            <div className="bg-card border border-border rounded-2xl shadow-card grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border overflow-hidden">
              <RibbonStat
                tone="teal" icon={<GraduationCap className="h-4 w-4" />}
                label="Enrolled students" value={stats?.students ?? 0}
                sub={`${stats?.runningCourses ?? 0} running cohorts`}
                onClick={() => navigate('/students')}
              />
              <RibbonStat
                tone="sky" icon={<Users className="h-4 w-4" />}
                label="Instructors" value={stats?.teachers ?? 0}
                sub={`${stats?.totalCourses ?? 0} courses total`}
                onClick={() => navigate('/teachers')}
              />
              <RibbonStat
                tone="gold" icon={<CalendarCheck className="h-4 w-4" />}
                label="Attendance" value={`${stats?.attendanceRate ?? 0}%`}
                sub={`${stats?.markedToday ?? 0} marked · ${stats?.absentToday ?? 0} absent today`}
                onClick={() => navigate('/attendance')}
              />
              <RibbonStat
                tone="primary" icon={<Wallet className="h-4 w-4" />}
                label="Collection" value={`${stats?.collectionRate ?? 0}%`}
                sub={`${(stats?.outstanding ?? 0).toLocaleString()} outstanding`}
                onClick={() => navigate('/payments')}
              />
            </div>

            {/* Spotlight — courses in the pipeline */}
            <Panel
              title="Spotlight — courses in the pipeline"
              icon={<Sparkles className="h-4 w-4 text-gold" />}
              action={<LinkAction label="All courses" onClick={() => navigate('/courses')} />}
            >
              {(stats?.spotlight?.length ?? 0) === 0 ? (
                <EmptyLine text="No upcoming cohorts queued. Create the next course to fill the pipeline." />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                  {stats!.spotlight.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/courses/${c.id}`)}
                      className="text-left rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow bg-background"
                    >
                      <div className="h-20 bg-gradient-to-br from-gold/25 via-sky/20 to-teal/20 relative">
                        {(c.thumbnail_url || c.hero_image_url) && (
                          <img
                            src={c.thumbnail_url || c.hero_image_url}
                            alt={`${c.name} cover`}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        )}
                        <span className="absolute top-1.5 left-1.5 text-[9px] font-black uppercase tracking-wide bg-background/85 text-foreground rounded-full px-2 py-0.5">
                          {c.daysToStart != null && c.daysToStart >= 0 ? `Starts in ${c.daysToStart}d` : String(c.status)}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="text-[12.5px] font-bold text-foreground line-clamp-2 leading-snug">{c.name}</p>
                        <p className="text-[10.5px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {c.start_date ? format(new Date(c.start_date), 'd MMM yyyy') : 'Date TBC'}
                        </p>
                        <div className="mt-2">
                          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-teal"
                              style={{ width: `${Math.min(((c.enrolled || 0) / Math.max(c.max_students || 1, 1)) * 100, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {c.enrolled} / {c.max_students || '∞'} seats filled
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>

            {/* Newsroom: announcements + notifications */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              <Panel
                className="lg:col-span-2"
                title="Announcements"
                icon={<Megaphone className="h-4 w-4 text-primary" />}
                action={<LinkAction label="Post / manage" onClick={() => navigate('/announcements')} />}
              >
                {announcements.length === 0 ? (
                  <EmptyLine text="Nothing broadcast yet. Share a notice with the academy." />
                ) : (
                  <ul className="divide-y divide-border">
                    {announcements.map((a: any) => (
                      <li key={a.id}>
                        <button
                          onClick={() => navigate('/announcements')}
                          className="w-full text-left py-2.5 flex items-start gap-2.5 hover:bg-secondary/40 rounded-lg px-1.5 transition-colors"
                        >
                          <span className="mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            {a.is_pinned ? <Pin className="h-3.5 w-3.5" /> : <Newspaper className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-bold text-foreground truncate">{a.title}</span>
                            {a.body && <span className="block text-[11.5px] text-muted-foreground line-clamp-2">{a.body}</span>}
                            <span className="block text-[10px] text-muted-foreground mt-0.5">
                              {a.published_at ? formatDistanceToNow(new Date(a.published_at), { addSuffix: true }) : ''}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title={`Notifications${unreadCount ? ` · ${unreadCount} new` : ''}`}
                icon={<Bell className="h-4 w-4 text-gold" />}
                action={<LinkAction label="Inbox" onClick={() => navigate('/notifications')} />}
              >
                {notifications.length === 0 ? (
                  <EmptyLine text="You're all caught up." />
                ) : (
                  <ul className="space-y-1.5">
                    {notifications.map((n: any) => (
                      <li
                        key={n.id}
                        className={`rounded-lg border px-2.5 py-2 ${n.status === 'pending' ? 'border-gold/30 bg-gold/10' : 'border-border bg-secondary/40'}`}
                      >
                        <p className="text-[12px] font-bold text-foreground truncate">{n.title || 'Notification'}</p>
                        {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            {/* News desk + admissions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              <Panel
                className="lg:col-span-2"
                title="Academy news desk"
                icon={<Newspaper className="h-4 w-4 text-sky" />}
                action={<LinkAction label="Enrolments" onClick={() => navigate('/students')} />}
              >
                {(stats?.news?.length ?? 0) === 0 ? (
                  <EmptyLine text="No recent enrolment activity." />
                ) : (
                  <ul className="space-y-1.5">
                    {stats!.news.map((n: any) => (
                      <li key={n.id} className="flex items-center gap-2.5 rounded-lg bg-secondary/40 px-2.5 py-2">
                        <span className="h-7 w-7 shrink-0 rounded-full bg-teal/15 border border-teal/25 flex items-center justify-center text-teal">
                          <BookOpen className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold text-foreground truncate">
                            {n.name} joined {n.course}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {n.at ? formatDistanceToNow(new Date(n.at), { addSuffix: true }) : ''}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="Admissions desk"
                icon={<Inbox className="h-4 w-4 text-teal" />}
                action={<LinkAction label="Review" onClick={() => navigate("/people")} />}
              >
                <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center">
                  <p className="text-3xl font-black text-primary leading-none">{stats?.pendingApplications ?? 0}</p>
                  <p className="text-[11px] font-bold text-foreground mt-1">Applications awaiting review</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="text-center bg-secondary/40 rounded-lg py-2">
                    <p className="text-base font-black text-teal leading-none">{(stats?.collected ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Collected</p>
                  </div>
                  <div className="text-center bg-secondary/40 rounded-lg py-2">
                    <p className="text-base font-black text-destructive leading-none">{stats?.overdueCount ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Overdue invoices</p>
                  </div>
                </div>
              </Panel>
            </div>

            <AiInsightsWidget />
          </>
        )}
      </div>
    </div>
  );
}

export default GroupAcademyDashboard;
