import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  BookOpen, CalendarCheck, CreditCard, Award, AlertTriangle,
  Receipt, User, Search, LayoutDashboard
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import AvailableCoursesSection from '@/components/dashboard/AvailableCoursesSection';

export default function UnifiedDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeDivision, setActiveDivision] = useState<string>('all');

  // ─── User context (divisions) ───
  const { data: userContexts = [] } = useQuery({
    queryKey: ['user-context-dashboard', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_context')
        .select('division_id, divisions:divisions!inner(id, name)')
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

  const divisions = [...new Map(
    userContexts
      .filter(c => c.divisions)
      .map(c => [c.division_id, { ...(c.divisions as any), roles: userRoles.map(r => r.role) }])
  ).values()];

  // ─── Stats: Active courses ───
  const { data: activeCourses = 0, isLoading: loadingCourses } = useQuery({
    queryKey: ['dash-active-courses', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('course_enrollments')
        .select('id, courses:courses!inner(division_id)', { count: 'exact', head: true })
        .eq('student_id', user!.id)
        .eq('status', 'active');
      if (activeDivision !== 'all') {
        query = query.eq('courses.division_id', activeDivision);
      }
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
        .select('status, courses:courses!inner(division_id)')
        .eq('student_id', user!.id);
      if (activeDivision !== 'all') {
        query = query.eq('courses.division_id', activeDivision);
      }
      const { data } = await query;
      if (!data?.length) return 0;
      const present = data.filter(a => a.status === 'present').length;
      return Math.round((present / data.length) * 100);
    },
    enabled: !!user?.id,
  });

  // ─── Stats: Pending fees ───
  const { data: feeStats = { count: 0, total: 0 }, isLoading: loadingFees } = useQuery({
    queryKey: ['dash-pending-fees', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('course_student_fees')
        .select('total_due, total_paid, status, courses:courses!inner(division_id)')
        .eq('student_id', user!.id)
        .in('status', ['pending', 'overdue']);
      if (activeDivision !== 'all') {
        query = query.eq('courses.division_id', activeDivision);
      }
      const { data } = await query;
      if (!data?.length) return { count: 0, total: 0 };
      return {
        count: data.length,
        total: data.reduce((sum, f) => sum + ((f.total_due || 0) - (f.total_paid || 0)), 0),
      };
    },
    enabled: !!user?.id,
  });

  const overdueCount = feeStats.count; // simplified

  // ─── Stats: Certificates ───
  const { data: certCount = 0, isLoading: loadingCerts } = useQuery({
    queryKey: ['dash-certificates', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('course_certificate_awards')
        .select('id, courses:courses!inner(division_id)', { count: 'exact', head: true })
        .eq('student_id', user!.id);
      if (activeDivision !== 'all') {
        query = query.eq('courses.division_id', activeDivision);
      }
      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // ─── My Enrollments ───
  const { data: myEnrollments = [], isLoading: loadingEnroll } = useQuery({
    queryKey: ['dash-enrollments', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('course_enrollments')
        .select('id, status, enrolled_at, courses:courses!inner(id, name, level, division_id, divisions:divisions(name))')
        .eq('student_id', user!.id)
        .order('enrolled_at', { ascending: false });
      if (activeDivision !== 'all') {
        query = query.eq('courses.division_id', activeDivision);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // ─── Teaching courses ───
  const { data: teachingCourses = [] } = useQuery({
    queryKey: ['dash-teaching', user?.id, activeDivision],
    queryFn: async () => {
      let query = supabase.from('course_class_staff')
        .select('id, staff_role, class:course_classes!inner(course_id, courses:courses!inner(id, name, level, division_id, divisions:divisions(name)))')
        .eq('user_id', user!.id);
      if (activeDivision !== 'all') {
        query = query.eq('class.courses.division_id', activeDivision);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // ─── Recent Activity ───
  const { data: activities = [] } = useQuery({
    queryKey: ['dash-activity', user?.id],
    queryFn: async () => {
      const items: { id: string; description: string; date: Date }[] = [];

      const { data: recentEnroll } = await supabase.from('course_enrollments')
        .select('id, enrolled_at, courses:courses!inner(name)')
        .eq('student_id', user!.id)
        .order('enrolled_at', { ascending: false })
        .limit(5);

      recentEnroll?.forEach(e => {
        items.push({
          id: `enroll-${e.id}`,
          description: `Enrolled in ${(e.courses as any)?.name}`,
          date: new Date(e.enrolled_at),
        });
      });

      const { data: recentAtt } = await supabase.from('attendance')
        .select('id, class_date, status, courses:courses!inner(name)')
        .eq('student_id', user!.id)
        .order('class_date', { ascending: false })
        .limit(5);

      recentAtt?.forEach(a => {
        items.push({
          id: `att-${a.id}`,
          description: `${a.status === 'present' ? 'Attended' : 'Missed'} ${(a.courses as any)?.name}`,
          date: new Date(a.class_date),
        });
      });

      return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
    },
    enabled: !!user?.id,
  });

  // ─── Group enrollments by division ───
  const enrollmentsByDivision = new Map<string, typeof myEnrollments>();
  myEnrollments.forEach(e => {
    const divName = (e.courses as any)?.divisions?.name || 'Other';
    if (!enrollmentsByDivision.has(divName)) enrollmentsByDivision.set(divName, []);
    enrollmentsByDivision.get(divName)!.push(e);
  });

  // Deduplicate teaching courses
  const uniqueTeaching = new Map<string, any>();
  teachingCourses.forEach((t: any) => {
    const course = t.class?.courses;
    if (course && !uniqueTeaching.has(course.id)) {
      uniqueTeaching.set(course.id, { ...course, staffRole: t.staff_role });
    }
  });

  const statsLoading = loadingCourses || loadingAtt || loadingFees || loadingCerts;

  const statCards = [
    { icon: BookOpen, label: 'Active courses', value: activeCourses, color: 'text-blue-600' },
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
            onClick={() => setActiveDivision('all')}
            className="shrink-0"
          >
            All
          </Button>
          {divisions.map(div => (
            <Button
              key={div.id}
              size="sm"
              variant={activeDivision === div.id ? 'default' : 'outline'}
              onClick={() => setActiveDivision(div.id)}
              className="shrink-0 gap-1.5"
            >
              {div.name}
              {div.roles.length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0">
                  {div.roles[0]}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Alerts */}
      {overdueCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue payments</AlertTitle>
          <AlertDescription>
            You have {overdueCount} overdue payment{overdueCount > 1 ? 's' : ''}.{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/payments')}>View details</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* My Courses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            My courses
            <Badge variant="secondary" className="text-xs">{myEnrollments.length + uniqueTeaching.size}</Badge>
          </h2>
          <Button variant="link" className="text-xs p-0 h-auto" onClick={() => navigate('/courses-catalog')}>View all</Button>
        </div>

        {loadingEnroll ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : myEnrollments.length === 0 && uniqueTeaching.size === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No courses yet. Browse available courses to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Teaching courses */}
            {uniqueTeaching.size > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Teaching</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[...uniqueTeaching.values()].map(course => (
                    <Card key={course.id} className="p-4 hover:border-primary/30 transition-colors cursor-pointer"
                      onClick={() => {
                        const isAdmin = userRoles.some(r => ['admin', 'super_admin'].includes(r.role));
                        navigate(isAdmin ? `/courses/${course.id}` : `/my-teaching/${course.id}`);
                      }}>
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
            )}

            {/* Enrolled courses grouped by division */}
            {[...enrollmentsByDivision.entries()].map(([divName, enrollments]) => (
              <div key={divName}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{divName}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {enrollments.map(e => {
                    const course = e.courses as any;
                    return (
                      <Card key={e.id} className="p-4 hover:border-primary/30 transition-colors cursor-pointer"
                        onClick={() => {
                          const isAdmin = userRoles.some(r => ['admin', 'super_admin'].includes(r.role));
                          navigate(isAdmin ? `/courses/${course.id}` : `/my-courses/${course.id}`);
                        }}>
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

      {/* Available Courses */}
      <AvailableCoursesSection activeDivision={activeDivision} />

      <Separator />

      {/* Quick Links */}
      <div>
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

      {/* Recent Activity */}
      {activities.length > 0 && (
        <div>
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
      )}
    </div>
  );
}
