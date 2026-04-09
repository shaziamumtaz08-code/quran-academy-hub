import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { Video, UserCheck, Calendar, ClipboardCheck, Target, BookOpen } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'react-router-dom';

const Attendance = lazy(() => import('./Attendance'));
const Assignments = lazy(() => import('./Assignments'));
const Schedules = lazy(() => import('./Schedules'));
const MonthlyPlanning = lazy(() => import('./MonthlyPlanning'));
const Subjects = lazy(() => import('./Subjects'));
const ZoomManagement = lazy(() => import('./ZoomManagement'));
const Courses = lazy(() => import('./Courses'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function TeachingLanding() {
  const { user, activeRole } = useAuth();
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const isTeacher = activeRole === 'teacher';
  const section = searchParams.get('section') || (isTeacher ? 'assignments' : 'live-classes');

  const { data: counts, isLoading } = useQuery({
    queryKey: ['teaching-landing-counts', divisionId],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      let assignQuery = supabase.from('student_teacher_assignments').select('id', { count: 'exact', head: true }).eq('status', 'active');
      let schedQuery = supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('is_active', true);
      let attQuery = (supabase as any).from('attendance').select('status').gte('class_date', weekStart).lte('class_date', weekEnd);
      let planQuery = supabase.from('student_monthly_plans').select('id', { count: 'exact', head: true }).eq('month', format(new Date(), 'yyyy-MM'));

      // Filter by teacher_id for teacher role
      if (isTeacher && user?.id) {
        assignQuery = assignQuery.eq('teacher_id', user.id);
        schedQuery = schedQuery.eq('teacher_id', user.id);
        attQuery = attQuery.eq('teacher_id', user.id);
        planQuery = planQuery.eq('teacher_id', user.id);
      }

      const [liveRes, assignRes, schedRes, attRes, planRes, subRes, courseRes] = await Promise.all([
        supabase.from('live_sessions').select('id', { count: 'exact', head: true }).eq('status', 'live'),
        assignQuery,
        schedQuery,
        attQuery,
        planQuery,
        supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      const attData = attRes.data || [];
      const presentCount = attData.filter((a: any) => a.status === 'present').length;
      const attRate = attData.length > 0 ? Math.round((presentCount / attData.length) * 100) : 0;

      return {
        live: liveRes.count || 0,
        assignments: assignRes.count || 0,
        schedules: schedRes.count || 0,
        attRate,
        plans: planRes.count || 0,
        subjects: subRes.count || 0,
        courses: courseRes.count || 0,
      };
    },
  });
  const isOneToOne = activeDivision?.model_type === 'one_to_one';
  const allCards: LandingCard[] = [
    // Admin-only cards hidden from teachers
    ...(!isTeacher ? [{ id: 'live-classes', title: 'Live Classes', subtitle: 'Currently active', count: counts?.live, countLoading: isLoading, icon: <Video className="h-5 w-5" />, color: 'bg-destructive' }] : []),
    ...(!isOneToOne && !isTeacher ? [{ id: 'courses', title: 'Courses', subtitle: 'Group & batch', count: counts?.courses, countLoading: isLoading, icon: <BookOpen className="h-5 w-5" />, color: 'bg-teal-500' }] : []),
    { id: 'assignments', title: isTeacher ? 'My Students' : 'Assignments', subtitle: 'Active assignments', count: counts?.assignments, countLoading: isLoading, icon: <UserCheck className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'schedules', title: isTeacher ? 'My Schedules' : 'Schedules', subtitle: 'Weekly slots', count: counts?.schedules, countLoading: isLoading, icon: <Calendar className="h-5 w-5" />, color: 'bg-blue-500' },
    { id: 'attendance', title: 'Attendance', subtitle: 'This week rate', count: counts?.attRate !== undefined ? `${counts.attRate}%` : undefined, countLoading: isLoading, icon: <ClipboardCheck className="h-5 w-5" />, color: 'bg-emerald-500' },
    { id: 'planning', title: 'Planning', subtitle: 'This month', count: counts?.plans, countLoading: isLoading, icon: <Target className="h-5 w-5" />, color: 'bg-amber-500' },
    ...(!isTeacher ? [{ id: 'subjects', title: 'Subjects', subtitle: 'Active subjects', count: counts?.subjects, countLoading: isLoading, icon: <BookOpen className="h-5 w-5" />, color: 'bg-violet-500' }] : []),
  ];
  const cards = allCards;

  const contentMap: Record<string, React.ReactNode> = useMemo(() => ({
    'live-classes': <Suspense fallback={<Loading />}><ZoomManagement /></Suspense>,
    'courses': <Suspense fallback={<Loading />}><Courses /></Suspense>,
    'assignments': <Suspense fallback={<Loading />}><Assignments /></Suspense>,
    'schedules': <Suspense fallback={<Loading />}><Schedules /></Suspense>,
    'attendance': <Suspense fallback={<Loading />}><Attendance /></Suspense>,
    'planning': <Suspense fallback={<Loading />}><MonthlyPlanning /></Suspense>,
    'subjects': <Suspense fallback={<Loading />}><Subjects /></Suspense>,
  }), []);

  return (
    <LandingPageShell
      title="Teaching"
      subtitle="Manage classes, assignments, schedules, and academic progress"
      cards={cards}
      contentMap={contentMap}
      defaultCard={section}
    />
  );
}
