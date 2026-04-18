import React, { Suspense, lazy, useMemo } from 'react';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { Settings, FolderOpen, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const OrganizationSettings = lazy(() => import('./OrganizationSettings'));
const Resources = lazy(() => import('./Resources'));
const AuthenticationSettings = lazy(() => import('./AuthenticationSettings'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function SettingsLanding() {
  const cards: LandingCard[] = [
    { id: 'system', title: 'System Control', subtitle: 'Organization settings', count: '⚙️', countLoading: false, icon: <Settings className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'auth', title: 'Authentication', subtitle: 'Login methods per org', count: '🔐', countLoading: false, icon: <ShieldCheck className="h-5 w-5" />, color: 'bg-indigo-500' },
    { id: 'resources', title: 'Resources Manager', subtitle: 'Files & uploads', count: '📁', countLoading: false, icon: <FolderOpen className="h-5 w-5" />, color: 'bg-emerald-500' },
  ];

  const contentMap = useMemo(() => ({
    'system': <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
    'auth': <Suspense fallback={<Loading />}><AuthenticationSettings /></Suspense>,
    'resources': <Suspense fallback={<Loading />}><Resources /></Suspense>,
  }), []);

  return (
    <LandingPageShell
      title="Settings"
      subtitle="System configuration and resources"
      cards={cards}
      contentMap={contentMap}
      defaultCard="system"
    />
  );
}
