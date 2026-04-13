import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { GraduationCap, Users, UserCheck, UserPlus, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

const Teachers = lazy(() => import('./Teachers'));
const Students = lazy(() => import('./Students'));
const UserManagement = lazy(() => import('./UserManagement'));
const LeadsPipeline = lazy(() => import('./LeadsPipeline'));

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

  const { data: counts, isLoading } = useQuery({
    queryKey: ['people-landing-counts'],
    queryFn: async () => {
      const [teacherRoles, studentRoles, allProfiles, openLeads] = await Promise.all([
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).is('archived_at', null),
        supabase.from('leads').select('id', { count: 'exact', head: true }).neq('status', 'closed'),
      ]);
      return {
        teachers: teacherRoles.count || 0,
        students: studentRoles.count || 0,
        users: allProfiles.count || 0,
        leads: openLeads.count || 0,
      };
    },
  });

  const cards: LandingCard[] = [
    { id: 'teachers', title: 'Teachers', subtitle: 'Active teachers', count: counts?.teachers, countLoading: isLoading, icon: <Users className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'students', title: 'Students', subtitle: 'Enrolled students', count: counts?.students, countLoading: isLoading, icon: <GraduationCap className="h-5 w-5" />, color: 'bg-emerald-500' },
    { id: 'users', title: 'All Users', subtitle: 'Total accounts', count: counts?.users, countLoading: isLoading, icon: <UserCheck className="h-5 w-5" />, color: 'bg-blue-500' },
    ...(isOneToOne ? [{ id: 'leads', title: 'Leads Pipeline', subtitle: 'Open leads', count: counts?.leads, countLoading: isLoading, icon: <UserPlus className="h-5 w-5" />, color: 'bg-amber-500' }] : []),
  ];

  const contentMap = useMemo(() => ({
    'teachers': <Suspense fallback={<Loading />}><Teachers /></Suspense>,
    'students': <Suspense fallback={<Loading />}><Students /></Suspense>,
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
            onClick={() => navigate('/identity-resolution')}
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