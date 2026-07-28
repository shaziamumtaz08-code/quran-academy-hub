import React from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
 *
 * Admins can additionally grant per-user module access (e.g. a student who
 * should reach the Quiz Engine) via permission overrides named `module.<id>`.
 */
export function RouteGuard({ moduleId, cap = 'view', children, redirectTo = '/dashboard' }: RouteGuardProps) {
  const { activeRole, isLoading, profile, user } = useAuth();

  const mod = ACCESS_MATRIX.find(m => m.id === moduleId);
  const matrixAllowed = mod?.roles[activeRole as AppRole]?.includes(cap) ?? false;

  const { data: overrideAllowed, isLoading: overrideLoading } = useQuery({
    queryKey: ['module-access', moduleId, user?.id],
    enabled: !!user?.id && !!activeRole && !matrixAllowed,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.rpc('has_module_access' as any, {
        _user_id: user!.id,
        _module_id: moduleId,
      });
      return data === true;
    },
  });

  if (isLoading || (profile && !activeRole) || (!matrixAllowed && activeRole && overrideLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!activeRole) return <Navigate to="/login" replace />;

  if (!matrixAllowed && !overrideAllowed) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

