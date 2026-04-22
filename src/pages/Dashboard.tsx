import { AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { TeacherDashboard } from '@/components/dashboard/TeacherDashboard';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { ParentDashboard } from '@/components/dashboard/ParentDashboard';
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard';
import { FeesAdminDashboard } from '@/components/dashboard/FeesAdminDashboard';
import { AdmissionsAdminDashboard } from '@/components/dashboard/AdmissionsAdminDashboard';
import { AcademicAdminDashboard } from '@/components/dashboard/AcademicAdminDashboard';
import { ExaminerDashboard } from '@/components/dashboard/ExaminerDashboard';
import { PageShell } from '@/components/layout/PageShell';
import UnifiedDashboard from './UnifiedDashboard';

export default function Dashboard() {
  const { profile, isLoading, activeRole } = useAuth();
  const { activeDivision } = useDivision();

  if (isLoading) {
    return (
      <PageShell title="Dashboard" description="Overview of academy operations and your current workload.">
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
      </PageShell>
    );
  }

  if (!profile) {
    return (
      <PageShell title="Dashboard" description="Overview of academy operations and your current workload.">
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <AlertCircle className="mb-4 h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-serif font-bold text-foreground">No Profile Found</h1>
        <p className="mt-2 text-muted-foreground">Please sign in to view your dashboard.</p>
      </div>
      </PageShell>
    );
  }

  const displayRole = activeRole || profile.role;

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
        <PageShell title="Dashboard" description="Overview of academy operations and your current workload.">
        <div className="space-y-8 animate-fade-in">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Welcome, {profile.full_name}</h1>
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
        </PageShell>
      );
  }
}
