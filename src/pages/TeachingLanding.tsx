import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { Video, UserCheck, Calendar, ClipboardCheck, Target, BookOpen, Users, GraduationCap } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams, useNavigate } from 'react-router-dom';

const Attendance = lazy(() => import('./Attendance'));
const Assignments = lazy(() => import('./Assignments'));
const Schedules = lazy(() => import('./Schedules'));
const MonthlyPlanning = lazy(() => import('./MonthlyPlanning'));
const Subjects = lazy(() => import('./Subjects'));
const ZoomManagement = lazy(() => import('./ZoomManagement'));
const Courses = lazy(() => import('./Courses'));
const TeacherStudentsView = lazy(() => import('@/components/teacher/TeacherStudentsView'));
const TeacherSchedulesView = lazy(() => import('@/components/teacher/TeacherSchedulesView'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function TeachingLanding() {
  const { user, activeRole } = useAuth();
  const { activeDivision } = useDivision();
  const navigate = useNavigate();
  const divisionId = activeDivision?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const isTeacher = activeRole === 'teacher';
  const isOneToOne = activeDivision?.model_type === 'one_to_one';

  const section = searchParams.get('section') || (isOneToOne ? (isTeacher ? 'assignments' : 'live-classes') : 'courses');

  // 1-to-1 counts
  const { data: counts, isLoading } = useQuery({
    queryKey: ['teaching-landing-counts', divisionId, user?.id, isTeacher],
    enabled: isOneToOne !== false, // run for 1-to-1 or when division not loaded yet
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      let assignQuery = supabase.from('student_teacher_assignments').select('id', { count: 'exact', head: true }).eq('status', 'active') as any;
      let attQuery = (supabase as any).from('attendance').select('status').gte('class_date', weekStart).lte('class_date', weekEnd);
      let planQuery = supabase.from('student_monthly_plans').select('id', { count: 'exact', head: true }).eq('month', format(new Date(), 'yyyy-MM')) as any;

      if (isTeacher && user?.id) {
        assignQuery = assignQuery.eq('teacher_id', user.id);
        attQuery = attQuery.eq('teacher_id', user.id);
        planQuery = planQuery.eq('teacher_id', user.id);
      }

      let schedCount = 0;
      if (isTeacher && user?.id) {
        const { data: myAssignments } = await (supabase as any)
          .from('student_teacher_assignments')
          .select('id')
          .eq('teacher_id', user.id)
          .eq('status', 'active');
        const assignmentIds = (myAssignments || []).map((a: any) => a.id);
        if (assignmentIds.length > 0) {
          const { count } = await (supabase as any)
            .from('schedules')
            .select('id', { count: 'exact', head: true })
            .in('assignment_id', assignmentIds)
            .eq('is_active', true);
          schedCount = count || 0;
        }
      } else {
        const { count } = await (supabase as any)
          .from('schedules')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true);
        schedCount = count || 0;
      }

      const [liveRes, assignRes, attRes, planRes, subRes, courseRes] = await Promise.all([
        supabase.from('live_sessions').select('id', { count: 'exact', head: true }).eq('status', 'live'),
        assignQuery,
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
        schedules: schedCount,
        attRate,
        plans: planRes.count || 0,
        subjects: subRes.count || 0,
        courses: courseRes.count || 0,
      };
    },
  });

  // Group Academy counts
  const { data: groupCounts, isLoading: groupLoading } = useQuery({
    queryKey: ['teaching-group-counts', divisionId],
    enabled: !isOneToOne && !!divisionId,
    queryFn: async () => {
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const [coursesRes, enrolledRes, attRes] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true })
          .eq('division_id', divisionId!).eq('status', 'active'),
        supabase.from('course_enrollments').select('id, courses!inner(division_id)', { count: 'exact', head: true })
          .eq('courses.division_id', divisionId!).eq('status', 'active'),
        (supabase as any).from('attendance').select('status')
          .eq('division_id', divisionId).gte('class_date', weekStart).lte('class_date', weekEnd),
      ]);

      const attData = attRes.data || [];
      const presentCount = attData.filter((a: any) => a.status === 'present').length;
      const attPct = attData.length > 0 ? Math.round((presentCount / attData.length) * 100) : 0;

      return {
        courses: coursesRes.count || 0,
        enrolled: enrolledRes.count || 0,
        attPct,
      };
    },
  });

  // Group Academy recent courses
  const { data: recentCourses = [] } = useQuery({
    queryKey: ['teaching-recent-courses', divisionId],
    enabled: !isOneToOne && !!divisionId,
    queryFn: async () => {
      const { data } = await supabase.from('courses')
        .select('id, name, level, subject')
        .eq('division_id', divisionId!)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(6);
      return data || [];
    },
  });

  const oneToOneCards: LandingCard[] = [
    ...(!isTeacher ? [{ id: 'live-classes', title: 'Live Classes', subtitle: 'Currently active', count: counts?.live, countLoading: isLoading, icon: <Video className="h-5 w-5" />, color: 'bg-destructive' }] : []),
    { id: 'assignments', title: isTeacher ? 'My Students' : 'Assignments', subtitle: 'Active assignments', count: counts?.assignments, countLoading: isLoading, icon: <UserCheck className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'schedules', title: isTeacher ? 'My Schedules' : 'Schedules', subtitle: 'Weekly slots', count: counts?.schedules, countLoading: isLoading, icon: <Calendar className="h-5 w-5" />, color: 'bg-blue-500' },
    { id: 'attendance', title: 'Attendance', subtitle: 'This week rate', count: counts?.attRate !== undefined ? `${counts.attRate}%` : undefined, countLoading: isLoading, icon: <ClipboardCheck className="h-5 w-5" />, color: 'bg-emerald-500' },
    { id: 'planning', title: 'Planning', subtitle: 'This month', count: counts?.plans, countLoading: isLoading, icon: <Target className="h-5 w-5" />, color: 'bg-amber-500' },
    ...(!isTeacher ? [{ id: 'subjects', title: 'Subjects', subtitle: 'Active subjects', count: counts?.subjects, countLoading: isLoading, icon: <BookOpen className="h-5 w-5" />, color: 'bg-violet-500' }] : []),
  ];

  const groupCards: LandingCard[] = [
    { id: 'courses', title: 'Courses', subtitle: 'In this division', count: groupCounts?.courses, countLoading: groupLoading, icon: <BookOpen className="h-5 w-5" />, color: 'bg-teal-500' },
    { id: 'enrolled', title: 'Enrolled', subtitle: 'Active students', count: groupCounts?.enrolled, countLoading: groupLoading, icon: <Users className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'attendance', title: 'Attendance', subtitle: 'This week', count: groupCounts?.attPct !== undefined ? `${groupCounts.attPct}%` : undefined, countLoading: groupLoading, icon: <ClipboardCheck className="h-5 w-5" />, color: 'bg-emerald-500' },
    { id: 'teaching-os', title: 'Teaching OS', subtitle: 'Open planner', count: '→', countLoading: false, icon: <GraduationCap className="h-5 w-5" />, color: 'bg-violet-500', onClick: () => navigate('/teaching-os') },
  ];

  const allCards = isOneToOne ? oneToOneCards : groupCards;

  const contentMap: Record<string, React.ReactNode> = useMemo(() => ({
    'live-classes': <Suspense fallback={<Loading />}><ZoomManagement /></Suspense>,
    'courses': <Suspense fallback={<Loading />}><Courses /></Suspense>,
    'enrolled': <Suspense fallback={<Loading />}><Courses /></Suspense>,
    'assignments': isTeacher
      ? <Suspense fallback={<Loading />}><TeacherStudentsView /></Suspense>
      : <Suspense fallback={<Loading />}><Assignments /></Suspense>,
    'schedules': isTeacher
      ? <Suspense fallback={<Loading />}><TeacherSchedulesView /></Suspense>
      : <Suspense fallback={<Loading />}><Schedules /></Suspense>,
    'attendance': <Suspense fallback={<Loading />}><Attendance /></Suspense>,
    'planning': <Suspense fallback={<Loading />}><MonthlyPlanning /></Suspense>,
    'subjects': <Suspense fallback={<Loading />}><Subjects /></Suspense>,
    'teaching-os': null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isTeacher]);

  return (
    <LandingPageShell
      title={isOneToOne ? 'Teaching' : 'Group Academy'}
      subtitle={isOneToOne
        ? (isTeacher ? "Your classes, students, and academic progress" : "Manage classes, assignments, schedules, and academic progress")
        : "Manage courses, enrollments, and group teaching"
      }
      cards={allCards}
      contentMap={contentMap}
      defaultCard={section}
    />
  );
}
