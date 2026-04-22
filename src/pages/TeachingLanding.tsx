import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { HubPageShell } from '@/components/layout/HubPageShell';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

const Attendance = lazy(() => import('./Attendance'));
const Assignments = lazy(() => import('./Assignments'));
const Schedules = lazy(() => import('./Schedules'));
const MonthlyPlanning = lazy(() => import('./MonthlyPlanning'));
const Subjects = lazy(() => import('./Subjects'));
const ZoomManagement = lazy(() => import('./ZoomManagement'));
const TeacherStudentsView = lazy(() => import('@/components/teacher/TeacherStudentsView'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function TeachingLanding() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const isOneToOne = activeDivision?.model_type === 'one_to_one';

  const { data: counts, isLoading } = useQuery({
    queryKey: ['teaching-landing-counts', divisionId],
    enabled: !!divisionId,
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const [liveRes, assignRes, attRes, planRes, subRes, todayRes] = await Promise.all([
        supabase.from('live_sessions').select('id', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('student_teacher_assignments').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('division_id', divisionId),
        (supabase as any).from('attendance').select('status').eq('division_id', divisionId).gte('class_date', weekStart).lte('class_date', weekEnd),
        supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('division_id', divisionId).eq('is_active', true),
        supabase.from('subjects').select('id', { count: 'exact', head: true }).eq('is_active', true),
        (supabase as any).from('attendance').select('id', { count: 'exact', head: true }).eq('division_id', divisionId).eq('class_date', today),
      ]);

      const attData = attRes.data || [];
      const presentCount = attData.filter((a: any) => a.status === 'present').length;
      const attRate = attData.length > 0 ? Math.round((presentCount / attData.length) * 100) : 0;

      return {
        live: liveRes.count || 0,
        assignments: assignRes.count || 0,
        schedules: planRes.count || 0,
        attRate,
        plans: todayRes.count || 0,
        subjects: subRes.count || 0,
        todayClasses: todayRes.count || 0,
      };
    },
  });

  const contentMap: Record<string, React.ReactNode> = useMemo(() => ({
    'live-classes': <Suspense fallback={<Loading />}><ZoomManagement /></Suspense>,
    'assignments': <Suspense fallback={<Loading />}><Assignments /></Suspense>,
    'schedules': <Suspense fallback={<Loading />}><Schedules /></Suspense>,
    'attendance': <Suspense fallback={<Loading />}><Attendance /></Suspense>,
    'planning': <Suspense fallback={<Loading />}><MonthlyPlanning /></Suspense>,
    'subjects': <Suspense fallback={<Loading />}><Subjects /></Suspense>,
    'one-to-one-assignments': <Suspense fallback={<Loading />}><TeacherStudentsView /></Suspense>,
  }), []);

  return (
    <HubPageShell
      title="Teaching"
      subtitle={isOneToOne ? 'Schedules, attendance, planning, and one-to-one operations' : 'Schedules, attendance, planning, and teaching operations'}
      kpis={[
        { label: 'Live Classes Now', value: counts?.live, loading: isLoading },
        { label: 'Active Assignments', value: counts?.assignments, loading: isLoading },
        { label: 'Weekly Slots', value: counts?.schedules, loading: isLoading },
        { label: 'Attendance % (this week)', value: `${counts?.attRate ?? 0}%`, tone: 'success', loading: isLoading },
        { label: 'Active Subjects', value: counts?.subjects, loading: isLoading },
      ]}
      tabs={[
        { label: 'Live Classes', value: 'live-classes' },
        { label: 'Assignments', value: 'assignments' },
        { label: 'Schedules', value: 'schedules' },
        { label: 'Attendance', value: 'attendance' },
        { label: 'Planning', value: 'planning' },
        { label: 'Subjects', value: 'subjects' },
        { label: '1-to-1 Assignments', value: 'one-to-one-assignments' },
      ]}
      defaultTab="live-classes"
      content={contentMap}
    />
  );
}
