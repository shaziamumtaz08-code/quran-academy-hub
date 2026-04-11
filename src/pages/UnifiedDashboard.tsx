import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  BookOpen, CalendarCheck, CreditCard, Award, AlertTriangle,
  Receipt, User, Search, LayoutDashboard, Users
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import AvailableCoursesSection from '@/components/dashboard/AvailableCoursesSection';

// ─── Promo Carousel ───
function PromoCarousel({ items, onApply }: { items: Array<{ type: string; id: string; title: string; subtitle: string; imageUrl?: string; courseId?: string }>; onApply: (id: string) => void }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (items.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [items.length]);

  const current = items[currentIdx];
  if (!current) return null;

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Badge className="bg-white/15 text-white text-xs mb-2 border-0">
              {current.type === 'promo' ? 'Featured' : 'Open for enrollment'}
            </Badge>
            <h3 className="text-lg md:text-xl font-bold text-white mb-1">{current.title}</h3>
            <p className="text-sm text-white/60 line-clamp-2">{current.subtitle}</p>
            {current.courseId && (
              <Button size="sm" className="mt-4 bg-white text-slate-900 hover:bg-white/90"
                onClick={() => onApply(current.courseId!)}>
                Learn More →
              </Button>
            )}
          </div>
          {current.imageUrl && (
            <img src={current.imageUrl} alt="" className="h-24 w-24 md:h-32 md:w-32 rounded-lg object-cover ml-4 hidden sm:block" />
          )}
        </div>

        {items.length > 1 && (
          <div className="flex gap-1.5 mt-4">
            {items.map((_, i) => (
              <button key={i}
                className={cn("h-1.5 rounded-full transition-all",
                  i === currentIdx ? "w-6 bg-white" : "w-1.5 bg-white/30"
                )}
                onClick={() => { setCurrentIdx(i); clearInterval(intervalRef.current); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function UnifiedDashboard() {
  const { user, profile, activeRole } = useAuth();
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

  const isParent = userRoles.some(r => r.role === 'parent');

  // ─── Stats: Active courses ───
  const { data: activeCourses = 0, isLoading: loadingCourses } = useQuery({
    queryKey: ['dash-active-courses', user?.id, activeDivision],
    queryFn: async () => {
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
        .select('status, courses:courses!inner(division_id)')
        .eq('student_id', user!.id);
      if (activeDivision !== 'all') query = query.eq('courses.division_id', activeDivision);
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
      let query = supabase.from('course_student_fees')
        .select('total_due, total_paid, status, courses:courses!inner(division_id)')
        .eq('student_id', user!.id)
        .in('status', ['pending', 'overdue']);
      if (activeDivision !== 'all') query = query.eq('courses.division_id', activeDivision);
      const { data } = await query;
      if (!data?.length) return { count: 0, total: 0 };
      return {
        count: data.length,
        total: data.reduce((sum, f) => sum + ((f.total_due || 0) - (f.total_paid || 0)), 0),
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

  // ─── My Enrollments ───
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

        const { data: fees } = await supabase.from('course_student_fees')
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

  // ─── Promotional Carousel ───
  const { data: promoItems = [] } = useQuery({
    queryKey: ['dash-promo-carousel'],
    queryFn: async () => {
      const { data: promos } = await supabase.from('promotional_posts')
        .select('id, content, attachment_url, course_id, courses:courses!inner(name, level)')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: available } = await supabase.from('courses')
        .select('id, name, level, description, hero_image_url, divisions:divisions(name)')
        .eq('status', 'published')
        .eq('website_enabled', true)
        .limit(5);

      const items: Array<{ type: string; id: string; title: string; subtitle: string; imageUrl?: string; courseId?: string }> = [];

      promos?.forEach(p => {
        items.push({
          type: 'promo',
          id: p.id,
          title: (p.courses as any)?.name || 'New Course',
          subtitle: p.content?.slice(0, 100) || '',
          imageUrl: p.attachment_url || undefined,
          courseId: p.course_id,
        });
      });

      available?.forEach(c => {
        if (!items.some(i => i.courseId === c.id)) {
          items.push({
            type: 'course',
            id: c.id,
            title: c.name,
            subtitle: c.description?.slice(0, 80) || `${c.level} · ${(c.divisions as any)?.name || ''}`,
            imageUrl: c.hero_image_url || undefined,
            courseId: c.id,
          });
        }
      });

      return items.slice(0, 6);
    },
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
  type Section = 'promo' | 'stats' | 'alerts' | 'courses' | 'children' | 'available' | 'teaching' | 'quicklinks' | 'activity';

  const sectionOrder: Section[] = (() => {
    const base: Section[] = ['promo', 'stats', 'alerts'];
    switch (activeRole) {
      case 'parent':
        return [...base, 'children', 'courses', 'available', 'teaching', 'quicklinks', 'activity'];
      case 'teacher':
        return [...base, 'teaching', 'courses', 'available', 'children', 'quicklinks', 'activity'];
      case 'admin':
      case 'super_admin':
        return [...base, 'courses', 'teaching', 'children', 'available', 'quicklinks', 'activity'];
      default:
        return [...base, 'courses', 'available', 'children', 'teaching', 'quicklinks', 'activity'];
    }
  })();

  // ─── Section renderers ───
  const renderPromo = () =>
    promoItems.length > 0 ? (
      <PromoCarousel key="promo" items={promoItems} onApply={(id) => navigate(`/my-courses/${id}`)} />
    ) : null;

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

  const renderCourses = () => {
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

              <div className="flex flex-wrap gap-1 mt-3">
                {child.enrollments.slice(0, 3).map((e: any) => (
                  <Badge key={e.id} variant="outline" className="text-xs font-normal">
                    {(e.courses as any)?.name}
                  </Badge>
                ))}
                {child.enrollments.length > 3 && (
                  <Badge variant="outline" className="text-xs font-normal">
                    +{child.enrollments.length - 3} more
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderAvailable = () => <AvailableCoursesSection key="available" activeDivision={activeDivision} />;

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

  const sectionRenderers: Record<Section, () => React.ReactNode> = {
    promo: renderPromo,
    stats: renderStats,
    alerts: renderAlerts,
    courses: renderCourses,
    children: renderChildren,
    available: renderAvailable,
    teaching: renderTeaching,
    quicklinks: renderQuickLinks,
    activity: renderActivity,
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

      {/* Role-ordered sections */}
      {sectionOrder.map(section => sectionRenderers[section]())}
    </div>
  );
}
