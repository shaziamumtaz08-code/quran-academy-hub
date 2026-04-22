import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { TeacherDashboard } from '@/components/dashboard/TeacherDashboard';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { ParentDashboard } from '@/components/dashboard/ParentDashboard';
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard';
import { FeesAdminDashboard } from '@/components/dashboard/FeesAdminDashboard';
import { AdmissionsAdminDashboard } from '@/components/dashboard/AdmissionsAdminDashboard';
import { AcademicAdminDashboard } from '@/components/dashboard/AcademicAdminDashboard';
import { ExaminerDashboard } from '@/components/dashboard/ExaminerDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { HubPageShell } from '@/components/layout/HubPageShell';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { supabase } from '@/integrations/supabase/client';
import UnifiedDashboard from './UnifiedDashboard';

export default function Dashboard() {
  const { profile, isLoading, activeRole } = useAuth();
  const { activeDivision } = useDivision();

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <Skeleton className="mt-2 h-9 w-64" />
          <Skeleton className="mt-2 h-5 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <AlertCircle className="mb-4 h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-serif font-bold text-foreground">No Profile Found</h1>
        <p className="mt-2 text-muted-foreground">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  const displayRole = activeRole || profile.role;
  const isAdminShellRole = ['super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic'].includes(displayRole);
  const divisionId = activeDivision?.id;

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard-shell-kpis', displayRole, divisionId],
    enabled: isAdminShellRole,
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const month = format(new Date(), 'yyyy-MM');

      let assignmentsQuery = supabase
        .from('student_teacher_assignments')
        .select('student_id, teacher_id')
        .eq('status', 'active');
      let attendanceQuery = supabase
        .from('attendance')
        .select('status, class_date')
        .eq('class_date', today);
      let feesQuery = (supabase as any)
        .from('fee_invoices')
        .select('amount, amount_paid, status')
        .eq('billing_month', month);

      if (divisionId) {
        assignmentsQuery = assignmentsQuery.eq('division_id', divisionId);
        attendanceQuery = attendanceQuery.eq('division_id', divisionId);
        feesQuery = feesQuery.eq('division_id', divisionId);
      }

      const [assignmentsRes, attendanceRes, feesRes] = await Promise.all([
        assignmentsQuery,
        attendanceQuery,
        feesQuery,
      ]);

      const assignments = assignmentsRes.data || [];
      const attendanceRows = attendanceRes.data || [];
      const fees = feesRes.data || [];

      const totalStudents = new Set(assignments.map((row) => row.student_id)).size;
      const totalTeachers = new Set(assignments.map((row) => row.teacher_id)).size;
      const revenue = fees.reduce((sum: number, row: any) => sum + Number(row.amount_paid || 0), 0);
      const outstanding = fees.reduce((sum: number, row: any) => sum + Math.max(0, Number(row.amount || 0) - Number(row.amount_paid || 0)), 0);
      const presentCount = attendanceRows.filter((row) => row.status === 'present').length;
      const attendanceRate = attendanceRows.length > 0 ? Math.round((presentCount / attendanceRows.length) * 100) : 0;

      return {
        totalStudents,
        totalTeachers,
        revenue,
        outstanding,
        attendanceRate,
        classesToday: attendanceRows.length,
      };
    },
  });

  const renderAdminDashboard = () => {
    switch (displayRole) {
      case 'super_admin':
        return <SuperAdminDashboard />;
      case 'admin':
        return <AdminDashboard />;
      case 'admin_admissions':
        return <AdmissionsAdminDashboard />;
      case 'admin_fees':
        return <FeesAdminDashboard />;
      case 'admin_academic':
        return <AcademicAdminDashboard />;
      default:
        return null;
    }
  };

  if (isAdminShellRole) {
    return (
      <HubPageShell
        title="Dashboard"
        subtitle="Institution-wide snapshot with quick actions, alerts, and live operational context"
        kpis={[
          { label: 'Total Students', value: kpis?.totalStudents, loading: kpisLoading },
          { label: 'Total Teachers', value: kpis?.totalTeachers, loading: kpisLoading },
          { label: 'Revenue (month)', value: `₨${Number(kpis?.revenue || 0).toLocaleString()}`, tone: 'success', loading: kpisLoading },
          { label: 'Outstanding', value: `₨${Number(kpis?.outstanding || 0).toLocaleString()}`, tone: Number(kpis?.outstanding || 0) > 0 ? 'warning' : 'default', loading: kpisLoading },
          { label: `Today's Attendance %`, value: `${kpis?.attendanceRate ?? 0}%`, tone: 'success', loading: kpisLoading },
          { label: 'Classes Today', value: kpis?.classesToday, loading: kpisLoading },
        ]}
        content={{}}
        singleView={renderAdminDashboard()}
      />
    );
  }

  switch (displayRole) {
    case 'teacher':
      return <TeacherDashboard />;

    case 'student':
      return activeDivision?.model_type === 'group' ? <UnifiedDashboard /> : <StudentDashboard />;

    case 'parent':
      return <ParentDashboard />;

    case 'examiner':
      return <ExaminerDashboard />;

    default:
      return (
        <div className="space-y-8 animate-fade-in">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">
              Welcome, {profile.full_name}
            </h1>
            <p className="mt-1 text-muted-foreground">Your dashboard is being set up</p>
          </div>
          <div className="rounded-xl border border-accent/20 bg-accent/10 p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
              <div>
                <h3 className="font-medium text-foreground">Role Not Assigned</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your account doesn't have a role assigned yet. Please contact an administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
  }
}
