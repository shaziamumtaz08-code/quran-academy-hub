import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  BookOpen, CalendarCheck, CreditCard, Award, AlertTriangle,
  Receipt, User, Search, LayoutDashboard, Users, Clock, CheckSquare
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import AvailableCoursesSection from '@/components/dashboard/AvailableCoursesSection';

export default function UnifiedDashboard() {
  const { user, profile, activeRole } = useAuth();
  const { switcherOptions, setActiveDivisionId } = useDivision();
  const navigate = useNavigate();
  const [activeDivision, setActiveDivision] = useState<string>('all');

  // ─── User context (divisions) ───
  const { data: userContexts = [] } = useQuery({
    queryKey: ['user-context-dashboard', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_context')
        .select('division_id, divisions:divisions!inner(id, name, model_type)')
        .eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ['user-roles-dashboard', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles')
        .select('role')
        .eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Build unique divisions with model_type
  const divisions = [...new Map(
    userContexts
      .filter(c => c.divisions)
      .map(c => [c.division_id, { ...(c.divisions as any), roles: userRoles.map(r => r.role) }])
  ).values()];

  // Also include all divisions from switcher for super_admin
  const isSuperAdmin = userRoles.some(r => r.role === 'super_admin');
  const { data: allDivisions = [] } = useQuery({
    queryKey: ['all-divisions-for-dash'],
    queryFn: async () => {
      const { data } = await supabase.from('divisions').select('id, name, model_type').eq('is_active', true);
      return data || [];
    },
    enabled: isSuperAdmin && divisions.length === 0,
  });

  const effectiveDivisions = divisions.length > 0 ? divisions : allDivisions.map(d => ({ ...d, roles: userRoles.map(r => r.role) }));

  const activeDivisionMeta = effectiveDivisions.find(d => d.id === activeDivision);
  const isOneToOne = activeDivisionMeta?.model_type === 'one_to_one';
  const isParent = userRoles.some(r => r.role === 'parent');

  // When division tab changes, also update the global DivisionContext
  const handleDivisionChange = (divId: string) => {
    setActiveDivision(divId);
    if (divId !== 'all') {
      setActiveDivisionId(divId);
    }
  };

  // ─── Stats: Active courses / students ───
  const { data: activeCourses = 0, isLoading: loadingCourses } = useQuery({
    queryKey: ['dash-active-courses', user?.id, activeDivision],
    queryFn: async () => {
      if (isOneToOne) {
        // For 1:1, count active student_teacher_assignments
        let query = supabase.from('student_teacher_assignments')
          .select('id', { count: 'exact', head: true })
          .or(`student_id.eq.${user!.id},teacher_id.eq.${user!.id}`)
          .eq('status', 'active');
        if (activeDivision !== 'all') query = query.eq('division_id', activeDivision);
        const { count } = await query;
        return count || 0;
      }
      let query = supabase.from('course_enrollments')
        .select('id, courses:courses!inner(division_id)', { count: 'exact', head: true })
        .eq('student_id', user!.id)
        .eq('status', 'active');
      if (activeDivision !== 'all') query = query.eq('courses.division_id', activeDivision);
      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // ─── Stats: Attendance ───
  const { data: attendancePct = 0, isLoading: loadingAtt } = useQuery({
    queryKey: ['dash-attendance', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('attendance')
        .select('status, division_id')
        .eq('student_id', user!.id);
      if (activeDivision !== 'all') query = query.eq('division_id', activeDivision);
      const { data } = await query;
      if (!data?.length) return 0;
      return Math.round(data.filter(a => a.status === 'present').length / data.length * 100);
    },
    enabled: !!user?.id,
  });

  // ─── Stats: Pending fees ───
  const { data: feeStats = { count: 0, total: 0 }, isLoading: loadingFees } = useQuery({
    queryKey: ['dash-pending-fees', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('fee_invoices')
        .select('amount, amount_paid, status, division_id')
        .eq('student_id', user!.id)
        .in('status', ['pending', 'overdue']);
      if (activeDivision !== 'all') query = query.eq('division_id', activeDivision);
      const { data } = await query;
      if (!data?.length) return { count: 0, total: 0 };
      return {
        count: data.length,
        total: data.reduce((sum, f) => sum + ((f.amount || 0) - (f.amount_paid || 0)), 0),
      };
    },
    enabled: !!user?.id,
  });

  const overdueCount = feeStats.count;

  // ─── Stats: Certificates ───
  const { data: certCount = 0, isLoading: loadingCerts } = useQuery({
    queryKey: ['dash-certificates', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('course_certificate_awards')
        .select('id, courses:courses!inner(division_id)', { count: 'exact', head: true })
        .eq('student_id', user!.id);
      if (activeDivision !== 'all') query = query.eq('courses.division_id', activeDivision);
      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // ─── My Enrollments (Group) ───
  const { data: myEnrollments = [], isLoading: loadingEnroll } = useQuery({
    queryKey: ['dash-enrollments', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('course_enrollments')
        .select('id, status, enrolled_at, courses:courses!inner(id, name, level, division_id, divisions:divisions(name))')
        .eq('student_id', user!.id)
        .order('enrolled_at', { ascending: false });
      if (activeDivision !== 'all') query = query.eq('courses.division_id', activeDivision);
      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // ─── My Students (1:1) ───
  const { data: myStudents = [] } = useQuery({
    queryKey: ['dash-my-students-1to1', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('student_teacher_assignments')
        .select('id, student_id, status, start_date, profiles:student_id(id, full_name, email), subjects:subject_id(name)')
        .eq('teacher_id', user!.id)
        .eq('status', 'active');
      if (activeDivision !== 'all') query = query.eq('division_id', activeDivision);
      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id && isOneToOne,
  });

  // ─── Teaching courses ───
  const { data: teachingCourses = [] } = useQuery({
    queryKey: ['dash-teaching', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('course_class_staff')
        .select('id, staff_role, class:course_classes!inner(course_id, courses:courses!inner(id, name, level, division_id, divisions:divisions(name)))')
        .eq('user_id', user!.id);
      if (activeDivision !== 'all') query = query.eq('class.courses.division_id', activeDivision);
      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // ─── Parent: My Children ───
  const { data: myChildren = [] } = useQuery({
    queryKey: ['dash-my-children', user?.id],
    queryFn: async () => {
      const { data: links } = await supabase.from('student_parent_links')
        .select('student_id')
        .eq('parent_id', user!.id);
      if (!links?.length) return [];

      const childIds = links.map(l => l.student_id);
      const { data: profiles } = await supabase.from('profiles')
        .select('id, full_name, email')
        .in('id', childIds);

      const children = [];
      for (const child of (profiles || [])) {
        const { data: enrollments } = await supabase.from('course_enrollments')
          .select('id, status, courses:courses!inner(id, name, level, division_id, divisions:divisions(name))')
          .eq('student_id', child.id)
          .eq('status', 'active');

        const { data: att } = await supabase.from('attendance')
          .select('status')
          .eq('student_id', child.id);
        const attPct = att?.length
          ? Math.round(att.filter(a => a.status === 'present').length / att.length * 100)
          : 0;

        const { data: fees } = await supabase.from('fee_invoices')
          .select('id')
          .eq('student_id', child.id)
          .in('status', ['pending', 'overdue']);

        children.push({
          ...child,
          enrollments: enrollments || [],
          attendancePct: attPct,
          pendingFees: fees?.length || 0,
        });
      }
      return children;
    },
    enabled: !!user?.id && isParent,
  });

  // ─── Recent Activity (division-filtered) ───
  const { data: activities = [] } = useQuery({
    queryKey: ['dash-activity', user?.id, activeDivision],
    queryFn: async () => {
      const items: { id: string; description: string; date: Date }[] = [];

      const enrollQuery = supabase.from('course_enrollments')
        .select('id, enrolled_at, courses:courses!inner(name, division_id)')
        .eq('student_id', user!.id)
        .order('enrolled_at', { ascending: false })
        .limit(5);

      const { data: recentEnroll } = activeDivision !== 'all'
        ? await enrollQuery.eq('courses.division_id', activeDivision)
        : await enrollQuery;

      recentEnroll?.forEach(e => {
        items.push({
          id: `enroll-${e.id}`,
          description: `Enrolled in ${(e.courses as any)?.name}`,
          date: new Date(e.enrolled_at),
        });
      });

      const attQuery = supabase.from('attendance')
        .select('id, class_date, status, division_id')
        .eq('student_id', user!.id)
        .order('class_date', { ascending: false })
        .limit(5);

      const { data: recentAtt } = activeDivision !== 'all'
        ? await attQuery.eq('division_id', activeDivision)
        : await attQuery;

      recentAtt?.forEach(a => {
        items.push({
          id: `att-${a.id}`,
          description: `${a.status === 'present' ? 'Attended' : 'Missed'} class`,
          date: new Date(a.class_date),
        });
      });

      return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
    },
    enabled: !!user?.id,
  });

  // ─── Upcoming classes / pending tasks ───
  const { data: upcomingItems = [] } = useQuery({
    queryKey: ['dash-upcoming', user?.id, activeDivision],
    queryFn: async () => {
      const items: { id: string; label: string; detail: string; type: 'class' | 'task' }[] = [];

      // Check schedules
      const today = format(new Date(), 'yyyy-MM-dd');
      const dayName = format(new Date(), 'EEEE').toLowerCase();

      const { data: schedules } = await supabase.from('schedules')
        .select('id, day_of_week, student_local_time, duration_minutes, assignment:student_teacher_assignments!inner(student_id, teacher_id, profiles:student_id(full_name))')
        .eq('is_active', true)
        .ilike('day_of_week', dayName)
        .limit(5);

      const filteredSchedules = (schedules || []).filter((s: any) =>
        s.assignment?.student_id === user!.id || s.assignment?.teacher_id === user!.id
      );

      filteredSchedules.forEach((s: any) => {
        items.push({
          id: s.id,
          label: `Class with ${(s.assignment?.profiles as any)?.full_name || 'Student'}`,
          detail: s.student_local_time || dayName,
          type: 'class',
        });
      });

      // Check pending tasks
      const { data: tasks } = await supabase.from('tickets')
        .select('id, subject, due_date')
        .eq('assignee_id', user!.id)
        .in('status', ['open', 'in_progress'])
        .order('due_date', { ascending: true })
        .limit(5);

      (tasks || []).forEach(t => {
        items.push({
          id: t.id,
          label: t.subject,
          detail: t.due_date ? format(new Date(t.due_date), 'MMM d') : 'No due date',
          type: 'task',
        });
      });

      return items.slice(0, 6);
    },
    enabled: !!user?.id,
  });

  // ─── Derived data ───
  const enrollmentsByDivision = new Map<string, typeof myEnrollments>();
  myEnrollments.forEach(e => {
    const divName = (e.courses as any)?.divisions?.name || 'Other';
    if (!enrollmentsByDivision.has(divName)) enrollmentsByDivision.set(divName, []);
    enrollmentsByDivision.get(divName)!.push(e);
  });

  const uniqueTeaching = new Map<string, any>();
  teachingCourses.forEach((t: any) => {
    const course = t.class?.courses;
    if (course && !uniqueTeaching.has(course.id)) {
      uniqueTeaching.set(course.id, { ...course, staffRole: t.staff_role });
    }
  });

  const statsLoading = loadingCourses || loadingAtt || loadingFees || loadingCerts;

  const statCards = [
    { icon: isOneToOne ? Users : BookOpen, label: isOneToOne ? 'Active students' : 'Active courses', value: activeCourses, color: 'text-blue-600' },
    { icon: CalendarCheck, label: 'Attendance', value: `${attendancePct}%`, color: 'text-emerald-600' },
    { icon: CreditCard, label: 'Pending fees', value: feeStats.count, color: 'text-amber-600' },
    { icon: Award, label: 'Certificates', value: certCount, color: 'text-violet-600' },
  ];

  const quickLinks = [
    { icon: Award, label: 'My certificates', path: '/student-reports' },
    { icon: Receipt, label: 'Fee history', path: '/payments' },
    { icon: User, label: 'My profile', path: '/organization-settings' },
    { icon: Search, label: 'Browse courses', path: '/courses-catalog' },
  ];

  // ─── Smart navigation ───
  const handleCourseClick = (courseId: string, context: 'enrolled' | 'teaching' | 'child') => {
    const isAdmin = userRoles.some(r => ['admin', 'super_admin'].includes(r.role));
    if (isAdmin) {
      navigate(`/courses/${courseId}`);
    } else if (context === 'teaching') {
      navigate(`/my-teaching/${courseId}`);
    } else {
      navigate(`/my-courses/${courseId}`);
    }
  };

  // ─── Role-aware section ordering ───
  type Section = 'stats' | 'alerts' | 'courses' | 'students1to1' | 'children' | 'available' | 'teaching' | 'quicklinks' | 'activity' | 'upcoming';

  const sectionOrder: Section[] = (() => {
    const base: Section[] = ['stats', 'alerts'];
    if (isOneToOne) {
      return [...base, 'students1to1', 'teaching', 'quicklinks', 'activity', 'upcoming'];
    }
    switch (activeRole) {
      case 'parent':
        return [...base, 'children', 'courses', 'available', 'teaching', 'quicklinks', 'activity', 'upcoming'];
      case 'teacher':
        return [...base, 'teaching', 'courses', 'available', 'children', 'quicklinks', 'activity', 'upcoming'];
      case 'admin':
      case 'super_admin':
        return [...base, 'courses', 'teaching', 'children', 'available', 'quicklinks', 'activity', 'upcoming'];
      default:
        return [...base, 'courses', 'available', 'children', 'teaching', 'quicklinks', 'activity', 'upcoming'];
    }
  })();

  // ─── Section renderers ───
  const renderStats = () => (
    <div key="stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map(s => (
        <Card key={s.label}>
          <CardContent className="p-4 flex items-center gap-3">
            {statsLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <>
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center bg-muted", s.color)}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderAlerts = () =>
    overdueCount > 0 ? (
      <Alert key="alerts" variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Overdue payments</AlertTitle>
        <AlertDescription>
          You have {overdueCount} overdue payment{overdueCount > 1 ? 's' : ''}.{' '}
          <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/payments')}>View details</Button>
        </AlertDescription>
      </Alert>
    ) : null;

  // 1:1 Students section
  const renderStudents1to1 = () => {
    if (!isOneToOne || myStudents.length === 0) return null;
    return (
      <div key="students1to1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            My Students
            <Badge variant="secondary" className="text-xs">{myStudents.length}</Badge>
          </h2>
          <Button variant="link" className="text-xs p-0 h-auto" onClick={() => navigate(`/students?division=${activeDivision}`)}>View all</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {myStudents.map((s: any) => {
            const studentProfile = s.profiles as any;
            const subject = s.subjects as any;
            return (
              <Card key={s.id} className="p-4 hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/students?id=${s.student_id}`)}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                    {studentProfile?.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{studentProfile?.full_name || 'Student'}</p>
                    <p className="text-xs text-muted-foreground">{subject?.name || 'No subject'}</p>
                  </div>
                  <Badge variant="default" className="text-[10px] shrink-0">{s.status}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCourses = () => {
    if (isOneToOne) return null; // Don't show courses in 1:1 mode
    if (myEnrollments.length === 0 && uniqueTeaching.size === 0 && activeRole !== 'teacher') return null;
    return (
      <div key="courses">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            My courses
            <Badge variant="secondary" className="text-xs">{myEnrollments.length}</Badge>
          </h2>
          <Button variant="link" className="text-xs p-0 h-auto" onClick={() => navigate('/courses-catalog')}>View all</Button>
        </div>

        {loadingEnroll ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : myEnrollments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No enrolled courses yet. Browse available courses to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {[...enrollmentsByDivision.entries()].map(([divName, enrollments]) => (
              <div key={divName}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{divName}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {enrollments.map(e => {
                    const course = e.courses as any;
                    return (
                      <Card key={e.id} className="p-4 hover:border-primary/30 transition-colors cursor-pointer"
                        onClick={() => handleCourseClick(course.id, 'enrolled')}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{course.name}</p>
                            <p className="text-xs text-muted-foreground">{course.divisions?.name}</p>
                          </div>
                          <Badge variant={e.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                            {e.status}
                          </Badge>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Enrolled</span>
                            <span>{new Date(e.enrolled_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTeaching = () => {
    if (uniqueTeaching.size === 0) return null;
    return (
      <div key="teaching">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            Teaching
            <Badge variant="secondary" className="text-xs">{uniqueTeaching.size}</Badge>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...uniqueTeaching.values()].map(course => (
            <Card key={course.id} className="p-4 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => handleCourseClick(course.id, 'teaching')}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{course.name}</p>
                  <p className="text-xs text-muted-foreground">{course.divisions?.name}</p>
                </div>
                <Badge className="bg-violet-100 text-violet-700 border-0 text-[10px]">Teaching</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderChildren = () => {
    if (!isParent || myChildren.length === 0) return null;
    return (
      <div key="children" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">My children</h2>
            <Badge variant="secondary">{myChildren.length}</Badge>
          </div>
          <Button variant="link" className="text-xs p-0 h-auto" onClick={() => navigate('/parent')}>
            Full parent portal →
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {myChildren.map(child => (
            <Card key={child.id} className="p-4 cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => navigate('/parent')}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {child.full_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium text-sm">{child.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {child.enrollments.length} course{child.enrollments.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 rounded-md bg-muted/50">
                  <p className="text-sm font-semibold">{child.attendancePct}%</p>
                  <p className="text-[10px] text-muted-foreground">Attendance</p>
                </div>
                <div className="text-center p-2 rounded-md bg-muted/50">
                  <p className="text-sm font-semibold">{child.enrollments.length}</p>
                  <p className="text-[10px] text-muted-foreground">Courses</p>
                </div>
                <div className={cn("text-center p-2 rounded-md",
                  child.pendingFees > 0 ? "bg-destructive/10" : "bg-muted/50")}>
                  <p className={cn("text-sm font-semibold", child.pendingFees > 0 && "text-destructive")}>
                    {child.pendingFees}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Pending fees</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderAvailable = () => {
    if (isOneToOne) return null;
    return <AvailableCoursesSection key="available" activeDivision={activeDivision} />;
  };

  const renderQuickLinks = () => (
    <div key="quicklinks">
      <Separator className="mb-6" />
      <h2 className="text-lg font-semibold text-foreground mb-3">Quick links</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickLinks.map(link => (
          <Card key={link.label}
            className="p-4 flex items-center gap-3 hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => navigate(link.path)}>
            <link.icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{link.label}</span>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderActivity = () => {
    if (activities.length === 0) return null;
    return (
      <div key="activity">
        <h2 className="text-lg font-semibold text-foreground mb-3">Recent activity</h2>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              {activities.map(a => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="h-2 w-2 rounded-full bg-primary/50 shrink-0" />
                  <p className="text-sm text-muted-foreground flex-1">{a.description}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(a.date)} ago
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderUpcoming = () => {
    if (upcomingItems.length === 0) return null;
    return (
      <div key="upcoming">
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Upcoming & Pending
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upcomingItems.map(item => (
            <Card key={item.id} className="p-4">
              <div className="flex items-center gap-3">
                {item.type === 'class' ? (
                  <CalendarCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <CheckSquare className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const sectionRenderers: Record<Section, () => React.ReactNode> = {
    stats: renderStats,
    alerts: renderAlerts,
    courses: renderCourses,
    students1to1: renderStudents1to1,
    children: renderChildren,
    available: renderAvailable,
    teaching: renderTeaching,
    quicklinks: renderQuickLinks,
    activity: renderActivity,
    upcoming: renderUpcoming,
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          Welcome, {profile?.full_name || 'User'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Your unified dashboard across all divisions</p>
      </div>

      {/* Division Toggle */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={activeDivision === 'all' ? 'default' : 'outline'}
            onClick={() => handleDivisionChange('all')}
            className="shrink-0"
          >
            All
          </Button>
          {effectiveDivisions.map(div => (
            <Button
              key={div.id}
              size="sm"
              variant={activeDivision === div.id ? 'default' : 'outline'}
              onClick={() => handleDivisionChange(div.id)}
              className="shrink-0 gap-1.5"
            >
              {div.name}
              {div.roles?.length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                  {div.roles[0]}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Role-ordered sections */}
      {sectionOrder.map(section => sectionRenderers[section]())}
    </div>
  );
}
