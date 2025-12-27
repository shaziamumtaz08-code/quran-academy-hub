import { useAuth } from "@/contexts/AuthContext";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { TeacherDashboard } from "@/components/dashboard/TeacherDashboard";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

export default function Dashboard() {
  const { profile, isLoading, activeRole } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-serif font-bold text-foreground">No Profile Found</h1>
        <p className="text-muted-foreground mt-2">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  // Use activeRole from context (which reacts to role switcher)
  const displayRole = activeRole || profile.role;

  // Route to role-specific dashboard based on ACTIVE role
  switch (displayRole) {
    case 'super_admin':
      return <SuperAdminDashboard />;
    
    case 'admin':
    case 'admin_admissions':
    case 'admin_fees':
    case 'admin_academic':
      return <AdminDashboard />;
    
    case 'teacher':
      return <TeacherDashboard />;
    
    case 'student':
      return <StudentDashboard />;
    
    case 'parent':
      return <ParentDashboard />;
    
    case 'examiner':
      return <AdminDashboard />;
    
    default:
      // Fallback for users without a role
      return (
        <div className="space-y-8 animate-fade-in">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">
              Welcome, {profile.full_name}
            </h1>
            <p className="text-muted-foreground mt-1">Your dashboard is being set up</p>
          </div>
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-foreground">Role Not Assigned</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your account doesn't have a role assigned yet. Please contact an administrator to get your role assigned.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
  }
}
