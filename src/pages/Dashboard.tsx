import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { TeacherDashboard } from '@/components/dashboard/TeacherDashboard';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { ParentDashboard } from '@/components/dashboard/ParentDashboard';

export default function Dashboard() {
  const { profile, isLoading } = useAuth();

  const renderDashboard = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      );
    }

    if (!profile?.role) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">Welcome to Al-Quran Time Academy</h2>
            <p className="text-muted-foreground">Your account is pending role assignment. Please contact an administrator.</p>
          </div>
        </div>
      );
    }

    switch (profile.role) {
      case 'super_admin':
        return <SuperAdminDashboard />;
      case 'admin':
      case 'admin_admissions':
      case 'admin_fees':
      case 'admin_academic':
        return <AdminDashboard />;
      case 'teacher':
      case 'examiner':
        return <TeacherDashboard />;
      case 'student':
        return <StudentDashboard />;
      case 'parent':
        return <ParentDashboard />;
      default:
        return (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md">
              <h2 className="text-xl font-serif font-bold text-foreground mb-2">Dashboard Loading...</h2>
              <p className="text-muted-foreground">Please wait while we set up your personalized dashboard.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
}
