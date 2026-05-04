import React, { Suspense, lazy, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageShell } from '@/components/layout/PageShell';
import { Skeleton } from '@/components/ui/skeleton';

const OrganizationSettings = lazy(() => import('./OrganizationSettings'));
const Resources = lazy(() => import('./Resources'));
const SchemaExplorer = lazy(() => import('./SchemaExplorer'));
const FinanceSetup = lazy(() => import('./FinanceSetup'));
const ZoomManagement = lazy(() => import('./ZoomManagement'));
const IntegrityAudit = lazy(() => import('./IntegrityAudit'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

const views = [
  'organization',
  'branches',
  'divisions',
  'holidays',
  'payouts-config',
  'classroom',
  'schema',
  'finance-setup',
  'teaching-config',
  'integrity',
] as const;

export default function SettingsLanding() {
  const { isSuperAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('view');
  // Legacy redirect: Resources Manager moved to top-level /resources
  if (requested === 'resources') return <Navigate to="/resources" replace />;
  const activeView = views.includes((requested || '') as (typeof views)[number]) ? requested! : null;

  const contentMap: Record<string, React.ReactNode> = useMemo(() => ({
    organization: <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
    branches: <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
    divisions: <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
    holidays: <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
    'payouts-config': <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
    classroom: <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
    schema: isSuperAdmin ? <Suspense fallback={<Loading />}><SchemaExplorer /></Suspense> : <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Schema Explorer is available to super administrators only.</div>,
    'finance-setup': <Suspense fallback={<Loading />}><FinanceSetup /></Suspense>,
    'teaching-config': <Suspense fallback={<Loading />}><ZoomManagement /></Suspense>,
    integrity: <Suspense fallback={<Loading />}><IntegrityAudit /></Suspense>,
  }), [isSuperAdmin]);

  if (!activeView) return <Navigate to="/settings?view=organization" replace />;

  return (
    <PageShell title="Settings" description="System configuration, resources, finance controls, and integrity tools.">
      <div className="min-h-[420px] animate-fade-in">{contentMap[activeView]}</div>
    </PageShell>
  );
}
