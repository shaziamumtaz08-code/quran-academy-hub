import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { ViewPillBar } from '@/components/layout/ViewPillBar';
import { InlineStatTiles } from '@/components/layout/InlineStatTiles';
import { Skeleton } from '@/components/ui/skeleton';

const Teachers = lazy(() => import('./Teachers'));
const Students = lazy(() => import('./Students'));
const UserManagement = lazy(() => import('./UserManagement'));
const LeadsPipeline = lazy(() => import('./LeadsPipeline'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

const views = [
  { label: 'Students', value: 'students' },
  { label: 'Teachers', value: 'teachers' },
  { label: 'Staff', value: 'staff' },
  { label: 'Leads', value: 'leads' },
] as const;

export default function PeopleLanding() {
  const { activeDivision } = useDivision();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const divisionId = activeDivision?.id;
  const requested = searchParams.get('view');
  const activeView = views.some((item) => item.value === requested) ? requested! : 'students';

  const { data: dupCount } = useQuery({
    queryKey: ['duplicate-profile-count'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('email').not('email', 'is', null).neq('email', '');
      if (!data?.length) return 0;
      const seen = new Map<string, number>();
      data.forEach((profile) => {
        const key = profile.email!.toLowerCase();
        seen.set(key, (seen.get(key) || 0) + 1);
      });
      let count = 0;
      seen.forEach((value) => {
        if (value > 1) count += 1;
      });
      return count;
    },
  });

  const { data: counts, isLoading } = useQuery({
    queryKey: ['people-landing-counts', divisionId],
    enabled: !!divisionId,
    queryFn: async () => {
      const teacherIds = new Set<string>();
      const studentIds = new Set<string>();

      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, teacher_id')
        .eq('status', 'active')
        .eq('division_id', divisionId!);

      (assignments || []).forEach((assignment) => {
        if (assignment.teacher_id) teacherIds.add(assignment.teacher_id);
        if (assignment.student_id) studentIds.add(assignment.student_id);
      });

      const { data: courses } = await supabase.from('courses').select('id').eq('division_id', divisionId!);
      const courseIds = (courses || []).map((course) => course.id);

      if (courseIds.length > 0) {
        const { data: classes } = await supabase.from('course_classes').select('id').in('course_id', courseIds);
        const classIds = (classes || []).map((courseClass) => courseClass.id);

        if (classIds.length > 0) {
          const [{ data: classStudents }, { data: classStaff }] = await Promise.all([
            supabase.from('course_class_students').select('student_id').in('class_id', classIds).eq('status', 'active'),
            supabase.from('course_class_staff').select('user_id, staff_role').in('class_id', classIds),
          ]);

          (classStudents || []).forEach((row) => row.student_id && studentIds.add(row.student_id));
          (classStaff || []).forEach((row: any) => {
            if (row.user_id && (row.staff_role === 'teacher' || !row.staff_role)) teacherIds.add(row.user_id);
          });
        }
      }

      const allUserIds = Array.from(new Set([...teacherIds, ...studentIds]));
      let teacherCount = 0;
      let studentCount = 0;
      let usersCount = 0;

      if (allUserIds.length > 0) {
        const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', allUserIds);
        const teacherSet = new Set((roles || []).filter((row) => row.role === 'teacher').map((row) => row.user_id));
        const studentSet = new Set((roles || []).filter((row) => row.role === 'student').map((row) => row.user_id));
        teacherCount = [...teacherIds].filter((id) => teacherSet.has(id)).length;
        studentCount = [...studentIds].filter((id) => studentSet.has(id)).length;
        const { count: profilesCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).in('id', allUserIds).is('archived_at', null);
        usersCount = profilesCount || 0;
      }

      const { count: leadsCount } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('division_id', divisionId!).neq('status', 'closed');
      const { data: parentRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'parent');
      const parentsCount = new Set((parentRoles || []).map((row) => row.user_id)).size;

      return { teachers: teacherCount, students: studentCount, parents: parentsCount, users: usersCount, leads: leadsCount || 0 };
    },
  });

  const contentMap: Record<string, React.ReactNode> = useMemo(() => ({
    teachers: <Suspense fallback={<Loading />}><Teachers /></Suspense>,
    students: <Suspense fallback={<Loading />}><Students /></Suspense>,
    staff: <Suspense fallback={<Loading />}><UserManagement /></Suspense>,
    leads: <Suspense fallback={<Loading />}><LeadsPipeline /></Suspense>,
  }), []);

  const setView = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <header>
        <h1 className="text-2xl font-serif font-bold text-foreground">People</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage teachers, students, staff access, and leads.</p>
      </header>

      {!!dupCount && dupCount > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[hsl(var(--warning))]" />
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{dupCount} duplicate profile{dupCount > 1 ? ' groups' : ' group'} detected</p>
            <p className="text-xs text-muted-foreground">Profiles sharing the same email need to be merged.</p>
          </div>
          <button type="button" onClick={() => navigate('/identity')} className="text-xs font-bold text-foreground underline underline-offset-2">Review</button>
        </div>
      ) : null}

      <InlineStatTiles
        items={[
          { label: 'Total Teachers', value: counts?.teachers, loading: isLoading },
          { label: 'Total Students', value: counts?.students, loading: isLoading },
          { label: 'Parents', value: counts?.parents, loading: isLoading },
          { label: 'All Users', value: counts?.users, loading: isLoading },
          { label: 'Open Leads', value: counts?.leads, loading: isLoading, tone: 'warning' },
        ]}
      />

      <ViewPillBar items={[...views]} activeValue={activeView} onChange={setView} />

      <div className="min-h-[420px]">{contentMap[activeView]}</div>
    </div>
  );
}
