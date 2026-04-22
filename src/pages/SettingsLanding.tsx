import React, { Suspense, lazy, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { HubPageShell } from '@/components/layout/HubPageShell';
import { Skeleton } from '@/components/ui/skeleton';

const OrganizationSettings = lazy(() => import('./OrganizationSettings'));
const Resources = lazy(() => import('./Resources'));
const SchemaExplorer = lazy(() => import('./SchemaExplorer'));
const FinanceSetup = lazy(() => import('./FinanceSetup'));
const ZoomManagement = lazy(() => import('./ZoomManagement'));
const IntegrityAudit = lazy(() => import('./IntegrityAudit'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function SettingsLanding() {
  const { isSuperAdmin } = useAuth();

  const contentMap: Record<string, React.ReactNode> = useMemo(() => ({
    'system-control': <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
    resources: <Suspense fallback={<Loading />}><Resources /></Suspense>,
    'schema-explorer': isSuperAdmin ? (
      <Suspense fallback={<Loading />}><SchemaExplorer /></Suspense>
    ) : (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Schema Explorer is available to super administrators only.
      </div>
    ),
    'finance-setup': <Suspense fallback={<Loading />}><FinanceSetup /></Suspense>,
    'teaching-config': <Suspense fallback={<Loading />}><ZoomManagement /></Suspense>,
    'integrity-audit': <Suspense fallback={<Loading />}><IntegrityAudit /></Suspense>,
  }), [isSuperAdmin]);

  return (
    <HubPageShell
      title="Settings"
      subtitle="System configuration, resources, finance controls, and integrity tools"
      tabs={[
        { label: 'System Control', value: 'system-control' },
        { label: 'Resources', value: 'resources' },
        { label: 'Schema Explorer', value: 'schema-explorer' },
        { label: 'Finance Setup', value: 'finance-setup' },
        { label: 'Teaching', value: 'teaching-config' },
        { label: 'Integrity Audit', value: 'integrity-audit' },
      ]}
      defaultTab="system-control"
      content={contentMap}
    />
  );
}
