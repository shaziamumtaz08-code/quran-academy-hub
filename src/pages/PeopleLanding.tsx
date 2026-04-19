import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { GraduationCap, Users, UserCheck, UserPlus, AlertTriangle, Heart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

const Teachers = lazy(() => import('./Teachers'));
const Students = lazy(() => import('./Students'));
const UserManagement = lazy(() => import('./UserManagement'));
const LeadsPipeline = lazy(() => import('./LeadsPipeline'));
const Parents = lazy(() => import('./Parents'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function PeopleLanding() {
  const { activeDivision } = useDivision();
  const isOneToOne = activeDivision?.model_type === 'one_to_one';
  const navigate = useNavigate();

  const { data: dupCount } = useQuery({
    queryKey: ['duplicate-profile-count'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .not('email', 'is', null)
        .neq('email', '');
      if (!data?.length) return 0;
      const seen = new Map<string, number>();
      data.forEach(p => {
        const k = p.email!.toLowerCase();
        seen.set(k, (seen.get(k) || 0) + 1);
      });
      let count = 0;
      seen.forEach(v => { if (v > 1) count++; });
      return count;
    },
  });

  const divisionId = activeDivision?.id;
  const { data: counts, isLoading } = useQuery({
    queryKey: ['people-landing-counts', divisionId],
    enabled: !!divisionId,
    queryFn: async () => {
      // Collect user IDs that belong to this division via 1:1 assignments and group classes
      const teacherIds = new Set<string>();
      const studentIds = new Set<string>();

      // 1:1 assignments
      const { data: sta } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, teacher_id')
        .eq('status', 'active')
        .eq('division_id', divisionId!);
      (sta || []).forEach(a => {
        if (a.teacher_id) teacherIds.add(a.teacher_id);
        if (a.student_id) studentIds.add(a.student_id);
      });

      // Group: get courses in this division
      const { data: divCourses } = await supabase
        .from('courses')
        .select('id')
        .eq('division_id', divisionId!);
      const courseIds = (divCourses || []).map(c => c.id);

      if (courseIds.length > 0) {
        const { data: classes } = await supabase
          .from('course_classes')
          .select('id')
          .in('course_id', courseIds);
        const classIds = (classes || []).map(c => c.id);

        if (classIds.length > 0) {
          const [{ data: ccs }, { data: ccst }] = await Promise.all([
            supabase.from('course_class_students').select('student_id').in('class_id', classIds).eq('status', 'active'),
            supabase.from('course_class_staff').select('user_id, staff_role').in('class_id', classIds),
          ]);
          (ccs || []).forEach(r => r.student_id && studentIds.add(r.student_id));
          (ccst || []).forEach((r: any) => {
            if (r.user_id && (r.staff_role === 'teacher' || !r.staff_role)) teacherIds.add(r.user_id);
          });
        }
      }

      // Filter to actual role holders
      const allUserIds = Array.from(new Set([...teacherIds, ...studentIds]));
      let teacherCount = 0;
      let studentCount = 0;
      let usersCount = 0;
      if (allUserIds.length > 0) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', allUserIds);
        const teacherSet = new Set((roles || []).filter(r => r.role === 'teacher').map(r => r.user_id));
        const studentSet = new Set((roles || []).filter(r => r.role === 'student').map(r => r.user_id));
        teacherCount = [...teacherIds].filter(id => teacherSet.has(id)).length;
        studentCount = [...studentIds].filter(id => studentSet.has(id)).length;

        // All Users = unique non-archived profiles in this division
        const { count: profCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .in('id', allUserIds)
          .is('archived_at', null);
        usersCount = profCount || 0;
      }

      const { count: leadsCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('division_id', divisionId!)
        .neq('status', 'closed');

      // Parent count (global, not division-scoped)
      const { data: parentRoles } = await supabase
        .from('user_roles').select('user_id').eq('role', 'parent');
      const parentsCount = new Set((parentRoles || []).map(r => r.user_id)).size;

      return {
        teachers: teacherCount,
        students: studentCount,
        users: usersCount,
        leads: leadsCount || 0,
        parents: parentsCount,
      };
    },
  });

  const cards: LandingCard[] = [
    { id: 'teachers', title: 'Teachers', subtitle: 'Active teachers', count: counts?.teachers, countLoading: isLoading, icon: <Users className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'students', title: 'Students', subtitle: 'Enrolled students', count: counts?.students, countLoading: isLoading, icon: <GraduationCap className="h-5 w-5" />, color: 'bg-emerald-500' },
    { id: 'parents', title: 'Parents', subtitle: 'Login activation', count: counts?.parents, countLoading: isLoading, icon: <Heart className="h-5 w-5" />, color: 'bg-pink-500' },
    { id: 'users', title: 'All Users', subtitle: 'Total accounts', count: counts?.users, countLoading: isLoading, icon: <UserCheck className="h-5 w-5" />, color: 'bg-blue-500' },
    ...(isOneToOne ? [{ id: 'leads', title: 'Leads Pipeline', subtitle: 'Open leads', count: counts?.leads, countLoading: isLoading, icon: <UserPlus className="h-5 w-5" />, color: 'bg-amber-500' }] : []),
  ];

  const contentMap = useMemo(() => ({
    'teachers': <Suspense fallback={<Loading />}><Teachers /></Suspense>,
    'students': <Suspense fallback={<Loading />}><Students /></Suspense>,
    'parents': <Suspense fallback={<Loading />}><Parents /></Suspense>,
    'users': <Suspense fallback={<Loading />}><UserManagement /></Suspense>,
    'leads': <Suspense fallback={<Loading />}><LeadsPipeline /></Suspense>,
  }), []);

  return (
    <div>
      {!!dupCount && dupCount > 0 && (
        <div className="mx-4 md:mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">
              {dupCount} duplicate profile{dupCount > 1 ? ' groups' : ' group'} detected
            </p>
            <p className="text-xs text-muted-foreground">Profiles sharing the same email need to be merged</p>
          </div>
          <button
            onClick={() => navigate('/identity')}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 underline underline-offset-2"
          >
            Review
          </button>
        </div>
      )}
      <LandingPageShell
        title="People"
        subtitle="Manage teachers, students, users, and leads"
        cards={cards}
        contentMap={contentMap}
        defaultCard="teachers"
      />
    </div>
  );
}