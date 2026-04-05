import React from 'react';
import { useIsInsideDashboard, DashboardLayout } from '@/components/layout/DashboardLayout';

/**
 * Conditionally wraps children in DashboardLayout.
 * If already inside a DashboardLayout (e.g. embedded in a landing page), renders children directly.
 */
export function ConditionalDashboardLayout({ children }: { children: React.ReactNode }) {
  const isInside = useIsInsideDashboard();
  if (isInside) return <>{children}</>;
  return <DashboardLayout>{children}</DashboardLayout>;
}
