import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ACCESS_MATRIX, AppRole, Capability } from '@/lib/accessMatrix';

interface RouteGuardProps {
  moduleId: string;
  cap?: Capability;
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Unified route guard driven by ACCESS_MATRIX.
 * Replaces AdminRoute, TeacherRoute, AdminOrTeacherRoute, AdminOrExaminerRoute, TeacherOnlyRoute.
 *
 * Wrap inside <ProtectedRoute>, which still handles authentication.
 * <DivisionModelGuard> remains separate for division model_type branching.
 */
export function RouteGuard({ moduleId, cap = 'view', children, redirectTo = '/dashboard' }: RouteGuardProps) {
  const { activeRole, isLoading, profile } = useAuth();

  if (isLoading || (profile && !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!activeRole) return <Navigate to="/login" replace />;

  const mod = ACCESS_MATRIX.find(m => m.id === moduleId);
  const allowed = mod?.roles[activeRole as AppRole]?.includes(cap) ?? false;

  if (!allowed) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
