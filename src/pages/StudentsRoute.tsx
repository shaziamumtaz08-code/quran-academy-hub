import React, { lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import UserManagement from '@/pages/UserManagement';
import { Skeleton } from '@/components/ui/skeleton';

const TeacherStudentsView = lazy(() => import('@/components/teacher/TeacherStudentsView'));

/**
 * /students is shared by admins and teachers.
 * Admins (users.view) get the full student directory (UserManagement, locked to the student role).
 * Teachers/examiners without users.view get their own scoped roster instead of "Access Denied".
 */
export default function StudentsRoute() {
  const { hasPermission, isSuperAdmin } = useAuth();
  const canManageUsers = isSuperAdmin || hasPermission('users.view');

  if (canManageUsers) return <UserManagement lockedRole="student" />;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-6 md:px-12 md:py-10 lg:px-16">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">My Students</h1>
          <p className="text-muted-foreground">Students currently assigned to you in this division</p>
        </div>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <TeacherStudentsView />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
