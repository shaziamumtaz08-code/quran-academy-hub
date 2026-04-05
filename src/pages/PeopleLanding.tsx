import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { GraduationCap, Users, UserCheck, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const Teachers = lazy(() => import('./Teachers'));
const Students = lazy(() => import('./Students'));
const UserManagement = lazy(() => import('./UserManagement'));
const LeadsPipeline = lazy(() => import('./LeadsPipeline'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function PeopleLanding() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;

  const { data: counts, isLoading } = useQuery({
    queryKey: ['people-landing-counts', divisionId],
    queryFn: async () => {
      const [teachersRes, studentsRes, usersRes, leadsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }).neq('status', 'closed'),
      ]);
      return {
        teachers: teachersRes.count || 0,
        students: studentsRes.count || 0,
        users: usersRes.count || 0,
        leads: leadsRes.count || 0,
      };
    },
  });

  const cards: LandingCard[] = [
    { id: 'teachers', title: 'Teachers', subtitle: 'Active teachers', count: counts?.teachers, countLoading: isLoading, icon: <Users className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'students', title: 'Students', subtitle: 'Enrolled students', count: counts?.students, countLoading: isLoading, icon: <GraduationCap className="h-5 w-5" />, color: 'bg-emerald-500' },
    { id: 'users', title: 'All Users', subtitle: 'Total accounts', count: counts?.users, countLoading: isLoading, icon: <UserCheck className="h-5 w-5" />, color: 'bg-blue-500' },
    { id: 'leads', title: 'Leads Pipeline', subtitle: 'Open leads', count: counts?.leads, countLoading: isLoading, icon: <UserPlus className="h-5 w-5" />, color: 'bg-amber-500' },
  ];

  const contentMap = useMemo(() => ({
    'teachers': <Suspense fallback={<Loading />}><Teachers /></Suspense>,
    'students': <Suspense fallback={<Loading />}><Students /></Suspense>,
    'users': <Suspense fallback={<Loading />}><UserManagement /></Suspense>,
    'leads': <Suspense fallback={<Loading />}><LeadsPipeline /></Suspense>,
  }), []);

  return (
    <LandingPageShell
      title="People"
      subtitle="Manage teachers, students, users, and leads"
      cards={cards}
      contentMap={contentMap}
      defaultCard="teachers"
    />
  );
}
