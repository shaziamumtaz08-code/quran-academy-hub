import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, isPast, isToday } from 'date-fns';
import {
  Bell,
  BookOpen,
  CalendarDays,
  CalendarOff,
  ChevronRight,
  ClipboardList,
  Compass,
  FileText,
  Megaphone,
  Newspaper,
  Pin,
  Radio,
  Sparkles,
  Video,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UnifiedHeaderBanner } from '@/components/dashboard/shared/UnifiedHeaderBanner';
import CourseThumbnailCard from '@/components/courses/CourseThumbnailCard';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime12(time: string) {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function minutesUntil(time: string) {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const now = new Date();
  return hour * 60 + minute - (now.getHours() * 60 + now.getMinutes());
}

function isClassLive(time: string, duration: number) {
  const diff = minutesUntil(time);
  return diff <= 0 && diff > -duration;
}

export function GroupStudentDashboard() {
  const { user, profile } = useAuth();
  const { activeDivision } = useDivision();
  const navigate = useNavigate();
  const studentId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['group-student-dashboard', studentId, activeDivision?.id],
    enabled: Boolean(studentId && activeDivision?.id),
    queryFn: async () => {
      if (!studentId || !activeDivision?.id) return null;

      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('id, course_id, status, course:courses!inner(id, name, description, division_id, level, thumbnail_url, hero_image_url, seo_slug, max_students, subject:subjects!courses_subject_id_fkey(name), teacher:profiles!courses_teacher_id_fkey(full_name))')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .eq('course.division_id', activeDivision.id);

      const activeEnrollments = (enrollments || []).filter((row: any) => row.course?.division_id === activeDivision.id);
      const courseIds = activeEnrollments.map((row: any) => row.course_id).filter(Boolean);

      const { data: memberships } = await supabase
        .from('course_class_students')
        .select('class_id')
        .eq('student_id', studentId)
        .eq('status', 'active');
      const classIds = (memberships || []).map((row: any) => row.class_id).filter(Boolean);

      const [classesResult, assignmentsResult, submissionsResult, notificationsResult] = await Promise.all([
        classIds.length
          ? supabase
              .from('course_classes')
              .select('id, course_id, name, schedule_days, schedule_time, session_duration, timezone, meeting_link, status')
              .in('id', classIds)
              .in('course_id', courseIds)
              .eq('status', 'active')
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? supabase
              .from('course_assignments')
              .select('id, title, course_id, due_date, course:courses(name)')
              .in('course_id', courseIds)
              .eq('status', 'active')
              .order('due_date', { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('course_assignment_submissions')
          .select('assignment_id')
          .eq('student_id', studentId),
        courseIds.length
          ? supabase
              .from('course_notifications')
              .select('id, course_id, title, body, created_at')
              .in('course_id', courseIds)
              .order('created_at', { ascending: false })
              .limit(6)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const classes = classesResult.data || [];
      const submitted = new Set((submissionsResult.data || []).map((row: any) => row.assignment_id));
      const pendingAssignments = (assignmentsResult.data || []).filter((row: any) => !submitted.has(row.id));
      const notifications = notificationsResult.data || [];
      const today = DAY_NAMES[new Date().getDay()];
      const todaySchedule = classes
        .filter((row: any) => (row.schedule_days || []).some((day: string) => day.toLowerCase() === today.toLowerCase()))
        .sort((a: any, b: any) => String(a.schedule_time).localeCompare(String(b.schedule_time)));

      const courseCards = activeEnrollments.map((enrollment: any) => {
        const course = enrollment.course;
        const courseClasses = classes.filter((row: any) => row.course_id === course.id);
        const nextClass = courseClasses.find((row: any) =>
          (row.schedule_days || []).some((day: string) => day.toLowerCase() === today.toLowerCase()),
        ) || courseClasses[0];
        return {
          ...course,
          nextClass,
          pendingCount: pendingAssignments.filter((row: any) => row.course_id === course.id).length,
          announcementCount: notifications.filter((row: any) => row.course_id === course.id).length,
        };
      });

      return { courseCards, todaySchedule, pendingAssignments, notifications, courseIds };
    },
  });

  const { data: news = [] } = useQuery({
    queryKey: ['group-student-news'],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('announcements' as any)
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(4);
      return (rows || []) as any[];
    },
  });

  const enrolledIds = data?.courseIds || [];
  const { data: catalog = [] } = useQuery({
    queryKey: ['group-student-catalog', activeDivision?.id, enrolledIds.join(',')],
    enabled: Boolean(activeDivision?.id),
    queryFn: async () => {
      const columns = 'id, name, level, seo_slug, thumbnail_url, hero_image_url, max_students, pricing, status, website_enabled, subject:subjects!courses_subject_id_fkey(name), teacher:profiles!courses_teacher_id_fkey(full_name)';
      const { data: featured } = await supabase
        .from('courses')
        .select(columns)
        .eq('website_enabled', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(12);

      let rows = (featured || []).filter((row: any) => !enrolledIds.includes(row.id));

      if (rows.length === 0) {
        const { data: fallback } = await supabase
          .from('courses')
          .select(columns)
          .eq('status', 'active')
          .eq('division_id', activeDivision!.id)
          .order('created_at', { ascending: false })
          .limit(12);
        rows = (fallback || []).filter((row: any) => !enrolledIds.includes(row.id));
      }

      return rows.slice(0, 4);
    },
  });

  const { data: recordings = [] } = useQuery({
    queryKey: ['group-student-recordings', studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('live_sessions')
        .select('id, actual_start, scheduled_start, recording_link, course_id')
        .eq('student_id', studentId!)
        .not('recording_link', 'is', null)
        .order('actual_start', { ascending: false, nullsFirst: false })
        .limit(4);
      return (rows || []) as any[];
    },
  });

  const courseNames = useMemo(() => {
    return new Map((data?.courseCards || []).map((course: any) => [course.id, course.name]));
  }, [data?.courseCards]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-64" />)}
        </div>
      </div>
    );
  }

  const courses = data?.courseCards || [];
  const schedule = data?.todaySchedule || [];
  const pending = data?.pendingAssignments || [];
  const announcements = data?.notifications || [];

  const liveClass = schedule.find((item: any) => isClassLive(item.schedule_time, item.session_duration || 45));
  const upcomingClass = schedule.find((item: any) => minutesUntil(item.schedule_time) > 0);
  const focusClass = liveClass || upcomingClass;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-6">
      <UnifiedHeaderBanner />

      {/* Hero + join bar */}
      <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground">
        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide opacity-80">Group Academy</p>
            <h1 className="font-serif text-3xl font-bold md:text-4xl">
              Assalamu Alaikum, {profile?.full_name?.split(' ')[0] || 'Student'}
            </h1>
            <p className="text-sm opacity-90 md:text-base">
              {courses.length} active course{courses.length === 1 ? '' : 's'} · {schedule.length} class{schedule.length === 1 ? '' : 'es'} today · {pending.length} task{pending.length === 1 ? '' : 's'} pending
            </p>
          </div>

          <div className="w-full rounded-xl bg-background/95 p-4 text-foreground shadow-lg md:w-80">
            {focusClass ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {liveClass ? 'Happening now' : 'Next class'}
                  </p>
                  {liveClass && <Badge variant="destructive" className="gap-1"><Radio className="h-3 w-3" /> Live</Badge>}
                </div>
                <p className="truncate font-serif text-lg font-bold">{courseNames.get(focusClass.course_id) || focusClass.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTime12(focusClass.schedule_time)} · {focusClass.session_duration || 45} min
                </p>
                <Button
                  className="w-full"
                  disabled={!focusClass.meeting_link}
                  onClick={() => focusClass.meeting_link && window.open(focusClass.meeting_link, '_blank', 'noopener')}
                >
                  <Video className="mr-2 h-4 w-4" /> {liveClass ? 'Join now' : 'Join when live'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2 text-center">
                <CalendarOff className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="font-semibold">No more classes today</p>
                <p className="text-sm text-muted-foreground">Enjoy your lessons and revision.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Enrolled courses */}
      <section aria-labelledby="courses-heading">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 id="courses-heading" className="flex items-center gap-2 font-serif text-2xl font-bold text-foreground">
              <BookOpen className="h-5 w-5 text-primary" /> My enrolled courses
            </h2>
            <p className="text-sm text-muted-foreground">Open a course for lessons, discussion and class material.</p>
          </div>
          <Badge variant="secondary">{courses.length} active</Badge>
        </div>

        {courses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-semibold text-foreground">No active course yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Your enrolled Group Academy course will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course: any) => (
              <CourseThumbnailCard
                key={course.id}
                course={{
                  id: course.id,
                  name: course.name,
                  thumbnail_url: course.thumbnail_url,
                  hero_image_url: course.hero_image_url,
                  subject_name: course.subject?.name,
                  teacher_name: course.teacher?.full_name || 'Instructor',
                  level: course.level,
                  schedule: course.nextClass?.schedule_time ? formatTime12(course.nextClass.schedule_time) : null,
                  duration: course.nextClass?.session_duration ? `${course.nextClass.session_duration} min` : null,
                  max_seats: course.max_students,
                  status: 'open',
                  seo_slug: course.seo_slug,
                }}
                ctaLabel="Continue learning"
                onClick={() => navigate(`/my-courses/${course.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Schedule + pending work */}
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="schedule-heading">
          <h2 id="schedule-heading" className="mb-3 flex items-center gap-2 font-serif text-xl font-bold text-foreground">
            <CalendarDays className="h-5 w-5 text-primary" /> Today’s classes
          </h2>
          <Card>
            <CardContent className="p-0">
              {schedule.length === 0 ? (
                <div className="py-12 text-center">
                  <CalendarOff className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
                  <p className="font-semibold text-foreground">No classes today</p>
                  <p className="text-sm text-muted-foreground">Your next class remains available inside its course.</p>
                </div>
              ) : schedule.map((classItem: any) => {
                const live = isClassLive(classItem.schedule_time, classItem.session_duration || 45);
                return (
                  <div key={classItem.id} className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0">
                    <div className="w-20 shrink-0">
                      <p className="font-bold text-foreground">{formatTime12(classItem.schedule_time)}</p>
                      <p className="text-xs text-muted-foreground">{classItem.session_duration || 45} min</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{courseNames.get(classItem.course_id) || 'Class'}</p>
                      <p className="truncate text-sm text-muted-foreground">{classItem.name}</p>
                    </div>
                    {live && <Badge variant="destructive">Live</Badge>}
                    {classItem.meeting_link && (
                      <Button size="sm" variant={live ? 'default' : 'outline'} onClick={() => window.open(classItem.meeting_link, '_blank', 'noopener')}>
                        Join
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        <section className="lg:col-span-2" aria-labelledby="actions-heading">
          <h2 id="actions-heading" className="mb-3 flex items-center gap-2 font-serif text-xl font-bold text-foreground">
            <ClipboardList className="h-5 w-5 text-primary" /> Assignments due
          </h2>
          <Card>
            <CardContent className="p-0">
              {pending.length === 0 ? (
                <div className="py-12 text-center">
                  <ClipboardList className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
                  <p className="font-semibold text-foreground">You’re all caught up</p>
                  <p className="text-sm text-muted-foreground">New assignments will appear here.</p>
                </div>
              ) : pending.slice(0, 6).map((assignment: any) => {
                const due = assignment.due_date ? new Date(assignment.due_date) : null;
                return (
                  <button
                    key={assignment.id}
                    type="button"
                    className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted/50"
                    onClick={() => navigate(`/my-courses/${assignment.course_id}?tab=assignments`)}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-foreground">{assignment.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{assignment.course?.name || 'Course'}</span>
                    </span>
                    {due && (
                      <span className={isPast(due) && !isToday(due) ? 'text-xs font-semibold text-destructive' : 'text-xs font-semibold text-muted-foreground'}>
                        {isToday(due) ? 'Today' : format(due, 'd MMM')}
                      </span>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Class recordings */}
      <section aria-labelledby="recordings-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="recordings-heading" className="flex items-center gap-2 font-serif text-2xl font-bold text-foreground">
              <PlayCircle className="h-5 w-5 text-primary" /> Class recordings
            </h2>
            <p className="text-sm text-muted-foreground">Catch up on classes you missed.</p>
          </div>
          <Button variant="outline" className="shrink-0" onClick={() => navigate('/recordings')}>
            View all
          </Button>
        </div>
        {recordings.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <PlayCircle className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
              <p className="font-semibold text-foreground">No recordings yet</p>
              <p className="text-sm text-muted-foreground">Recordings appear here once a class is published.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recordings.map((rec: any) => (
              <Card key={rec.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <div className="flex h-24 items-center justify-center bg-gradient-to-br from-primary/15 to-accent/15">
                  <PlayCircle className="h-9 w-9 text-primary" />
                </div>
                <CardContent className="space-y-2 p-4">
                  <p className="truncate font-semibold text-foreground">
                    {courseNames.get(rec.course_id) || 'Class recording'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(rec.actual_start || rec.scheduled_start), 'd MMM yyyy')}
                  </p>
                  <Button size="sm" className="w-full" onClick={() => window.open(rec.recording_link, '_blank', 'noopener')}>
                    Watch
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Spotlight / browse courses */}
      {(

        <section aria-labelledby="spotlight-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="spotlight-heading" className="flex items-center gap-2 font-serif text-2xl font-bold text-foreground">
                <Sparkles className="h-5 w-5 text-accent" /> Spotlight — courses to explore
              </h2>
              <p className="text-sm text-muted-foreground">New and upcoming programmes at the academy.</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/courses')} className="shrink-0">
              <Compass className="mr-2 h-4 w-4" /> Browse all
            </Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {catalog.map((course: any) => (
              <CourseThumbnailCard
                key={course.id}
                course={{
                  id: course.id,
                  name: course.name,
                  thumbnail_url: course.thumbnail_url,
                  hero_image_url: course.hero_image_url,
                  subject_name: course.subject?.name,
                  teacher_name: course.teacher?.full_name || 'Instructor',
                  level: course.level,
                  max_seats: course.max_students,
                  status: 'open',
                  pricing: course.pricing as any,
                  seo_slug: course.seo_slug,
                }}
                ctaLabel="View course"
                onClick={() => navigate(`/course/${course.seo_slug || course.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* News + announcements */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="news-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="news-heading" className="flex items-center gap-2 font-serif text-xl font-bold text-foreground">
              <Newspaper className="h-5 w-5 text-primary" /> Academy news
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/announcements')}>
              All news <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {news.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No academy news yet.</CardContent></Card>
            ) : news.map((item: any) => (
              <Card key={item.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex gap-3 p-4">
                  <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{item.title || 'Academy update'}</p>
                      {item.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-accent" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body || item.content}</p>
                    {item.published_at && (
                      <p className="mt-2 text-xs text-muted-foreground">{format(new Date(item.published_at), 'd MMM yyyy')}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="announcements-heading">
          <h2 id="announcements-heading" className="mb-3 flex items-center gap-2 font-serif text-xl font-bold text-foreground">
            <Bell className="h-5 w-5 text-accent" /> Class notifications
          </h2>
          <div className="space-y-3">
            {announcements.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No new class notifications.</CardContent></Card>
            ) : announcements.map((announcement: any) => (
              <Card key={announcement.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex gap-3 p-4">
                  <Bell className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{announcement.title || 'Course update'}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{announcement.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {courseNames.get(announcement.course_id) || 'Course'} · {format(new Date(announcement.created_at), 'd MMM yyyy')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
