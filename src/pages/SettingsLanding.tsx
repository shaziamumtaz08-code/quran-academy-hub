import React, { Suspense, lazy, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

const OrganizationSettings = lazy(() => import('./OrganizationSettings'));
const Resources = lazy(() => import('./Resources'));
const SchemaExplorer = lazy(() => import('./SchemaExplorer'));
const FinanceSetup = lazy(() => import('./FinanceSetup'));
const ZoomManagement = lazy(() => import('./ZoomManagement'));
const IntegrityAudit = lazy(() => import('./IntegrityAudit'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

const views = [
  { label: 'System Control', value: 'system-control' },
  { label: 'Resources', value: 'resources' },
  { label: 'Schema Explorer', value: 'schema-explorer' },
  { label: 'Finance Setup', value: 'finance-setup' },
  { label: 'Teaching Config', value: 'teaching-config' },
  { label: 'Integrity Audit', value: 'integrity-audit' },
] as const;

export default function SettingsLanding() {
  const { isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('view');
  const activeView = views.some((item) => item.value === requested) ? requested! : null;

  const contentMap: Record<string, React.ReactNode> = useMemo(() => ({
    'system-control': <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
    resources: <Suspense fallback={<Loading />}><Resources /></Suspense>,
    'schema-explorer': isSuperAdmin ? <Suspense fallback={<Loading />}><SchemaExplorer /></Suspense> : <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Schema Explorer is available to super administrators only.</div>,
    'finance-setup': <Suspense fallback={<Loading />}><FinanceSetup /></Suspense>,
    'teaching-config': <Suspense fallback={<Loading />}><ZoomManagement /></Suspense>,
    'integrity-audit': <Suspense fallback={<Loading />}><IntegrityAudit /></Suspense>,
  }), [isSuperAdmin]);

  if (!activeView) return <Navigate to="/settings?view=organization" replace />;

  return (
    <div className="space-y-5 animate-fade-in">
      <header>
        <h1 className="text-2xl font-serif font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">System configuration, resources, finance controls, and integrity tools.</p>
      </header>
      <div className="min-h-[420px]">{contentMap[activeView]}</div>
    </div>
  );
}
