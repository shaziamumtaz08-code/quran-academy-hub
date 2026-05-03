import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Navigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/contexts/AuthContext';
import { PageShell } from '@/components/layout/PageShell';
import { Skeleton } from '@/components/ui/skeleton';
import TeacherTeachingLanding from '@/components/teacher/TeacherTeachingLanding';

const Attendance = lazy(() => import('./Attendance'));
const Assignments = lazy(() => import('./Assignments'));
const Schedules = lazy(() => import('./Schedules'));
const MonthlyPlanning = lazy(() => import('./MonthlyPlanning'));
const Subjects = lazy(() => import('./Subjects'));
const ZoomManagement = lazy(() => import('./ZoomManagement'));
const TeacherStudentsView = lazy(() => import('@/components/teacher/TeacherStudentsView'));
const TeachingOS = lazy(() => import('./TeachingOS'));
const QuizEngine = lazy(() => import('./QuizEngine'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

const views = [
  { label: 'Assignments', value: 'assignments' },
  { label: 'Schedules', value: 'schedules' },
  { label: 'Attendance', value: 'attendance' },
  { label: 'Planning', value: 'planning' },
  { label: 'Subjects', value: 'subjects' },
  { label: '1-to-1', value: 'one-to-one' },
  { label: 'AI Teaching OS', value: 'teaching-os' },
  { label: 'Quiz Engine', value: 'quiz-engine' },
] as const;

export default function TeachingLanding() {
  const { activeDivision } = useDivision();
  const { activeRole } = useAuth();
  const [searchParams] = useSearchParams();
  const divisionId = activeDivision?.id;
  const requested = searchParams.get('view');
  const activeView = views.some((item) => item.value === requested) ? requested! : null;

  if (activeRole === 'teacher') {
    return (
      <PageShell title="Teaching" description="Your classes, schedule, and planning.">
        <TeacherTeachingLanding />
      </PageShell>
    );
  }

  useQuery({
    queryKey: ['teaching-landing-counts', divisionId],
    enabled: !!divisionId,
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const [liveRes, assignRes, attRes, scheduleRes] = await Promise.all([
        supabase.from('live_sessions').select('id', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('student_teacher_assignments').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('division_id', divisionId),
        (supabase as any).from('attendance').select('status').eq('division_id', divisionId).gte('class_date', weekStart).lte('class_date', weekEnd),
        supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('division_id', divisionId).eq('is_active', true),
      ]);

      const attData = attRes.data || [];
      const presentCount = attData.filter((a: any) => a.status === 'present').length;
      const attRate = attData.length > 0 ? Math.round((presentCount / attData.length) * 100) : 0;

      return {
        live: liveRes.count || 0,
        assignments: assignRes.count || 0,
        schedules: scheduleRes.count || 0,
        attRate,
        todayClasses: (await (supabase as any).from('attendance').select('id', { count: 'exact', head: true }).eq('division_id', divisionId).eq('class_date', today)).count || 0,
      };
    },
  });

  const contentMap: Record<string, React.ReactNode> = useMemo(() => ({
    'live-classes': <Suspense fallback={<Loading />}><ZoomManagement /></Suspense>,
    assignments: <Suspense fallback={<Loading />}><Assignments /></Suspense>,
    schedules: <Suspense fallback={<Loading />}><Schedules /></Suspense>,
    attendance: <Suspense fallback={<Loading />}><Attendance /></Suspense>,
    planning: <Suspense fallback={<Loading />}><MonthlyPlanning /></Suspense>,
    subjects: <Suspense fallback={<Loading />}><Subjects /></Suspense>,
    'one-to-one': <Suspense fallback={<Loading />}><TeacherStudentsView /></Suspense>,
    'teaching-os': <Suspense fallback={<Loading />}><TeachingOS /></Suspense>,
    'quiz-engine': <Suspense fallback={<Loading />}><QuizEngine /></Suspense>,
  }), []);

  if (!activeView) return <Navigate to="/teaching?view=assignments" replace />;

  return (
    <PageShell title="Teaching" description="Schedules, attendance, planning, and daily teaching workflows.">
      <div className="min-h-[420px] animate-fade-in">{contentMap[activeView]}</div>
    </PageShell>
  );
}
