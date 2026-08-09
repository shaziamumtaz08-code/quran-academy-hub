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
  FileText,
  Radio,
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime12(time: string) {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function isClassLive(time: string, duration: number) {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = hour * 60 + minute;
  return currentMinutes >= startMinutes && currentMinutes < startMinutes + duration;
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
        .select('id, course_id, status, course:courses!inner(id, name, description, division_id)')
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

      return { courseCards, todaySchedule, pendingAssignments, notifications };
    },
  });

  const courseNames = useMemo(() => {
    return new Map((data?.courseCards || []).map((course: any) => [course.id, course.name]));
  }, [data?.courseCards]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-8 w-52" />
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <UnifiedHeaderBanner />

      <header className="space-y-1">
        <p className="text-sm font-semibold text-accent">Group Academy</p>
        <h1 className="font-serif text-3xl font-bold text-foreground">
          Assalamu Alaikum, {profile?.full_name?.split(' ')[0] || 'Student'}
        </h1>
        <p className="text-base text-muted-foreground">Your classes, learning and updates in one place.</p>
      </header>

      <section aria-labelledby="courses-heading">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 id="courses-heading" className="font-serif text-2xl font-bold text-foreground">Continue learning</h2>
            <p className="text-sm text-muted-foreground">Open a course to access its lessons, discussion and class material.</p>
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course: any, index: number) => {
              const duration = course.nextClass?.session_duration || 45;
              const live = course.nextClass?.schedule_time
                ? isClassLive(course.nextClass.schedule_time, duration)
                : false;
              return (
                <Card key={course.id} className="overflow-hidden border-border transition-shadow hover:shadow-md">
                  <div className={index % 2 === 0 ? 'bg-primary px-5 py-6 text-primary-foreground' : 'bg-accent px-5 py-6 text-accent-foreground'}>
                    <div className="mb-8 flex items-start justify-between gap-3">
                      <BookOpen className="h-6 w-6" />
                      {live && <Badge variant="destructive" className="gap-1"><Radio className="h-3 w-3" /> Live now</Badge>}
                    </div>
                    <h3 className="font-serif text-xl font-bold">{course.name}</h3>
                  </div>
                  <CardContent className="space-y-4 p-5">
                    <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                      {course.description || 'Continue your lessons and class activities.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {course.nextClass?.schedule_time && (
                        <Badge variant="outline">
                          <CalendarDays className="mr-1 h-3.5 w-3.5" /> {formatTime12(course.nextClass.schedule_time)}
                        </Badge>
                      )}
                      {course.pendingCount > 0 && <Badge variant="outline">{course.pendingCount} due</Badge>}
                      {course.announcementCount > 0 && <Badge variant="outline">{course.announcementCount} updates</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => navigate(`/my-courses/${course.id}`)}>
                        Open course <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                      {live && course.nextClass?.meeting_link && (
                        <Button variant="outline" size="icon" aria-label="Join live class" onClick={() => window.open(course.nextClass.meeting_link, '_blank', 'noopener')}>
                          <Video className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

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
            <ClipboardList className="h-5 w-5 text-primary" /> Pending work
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

      <section aria-labelledby="announcements-heading">
        <h2 id="announcements-heading" className="mb-3 flex items-center gap-2 font-serif text-xl font-bold text-foreground">
          <Bell className="h-5 w-5 text-primary" /> Class announcements
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {announcements.length === 0 ? (
            <Card className="md:col-span-2"><CardContent className="py-8 text-center text-sm text-muted-foreground">No new announcements.</CardContent></Card>
          ) : announcements.map((announcement: any) => (
            <Card key={announcement.id}>
              <CardContent className="flex gap-3 p-4">
                <Bell className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{announcement.title || 'Course update'}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{announcement.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{format(new Date(announcement.created_at), 'd MMM yyyy')}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}