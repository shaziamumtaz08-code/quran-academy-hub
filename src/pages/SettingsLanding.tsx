import React, { Suspense, lazy, useMemo } from 'react';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { Settings, FolderOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const OrganizationSettings = lazy(() => import('./OrganizationSettings'));
const Resources = lazy(() => import('./Resources'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function SettingsLanding() {
  const cards: LandingCard[] = [
    { id: 'system', title: 'System Control', subtitle: 'Organization settings', count: '⚙️', countLoading: false, icon: <Settings className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'resources', title: 'Resources Manager', subtitle: 'Files & uploads', count: '📁', countLoading: false, icon: <FolderOpen className="h-5 w-5" />, color: 'bg-emerald-500' },
  ];

  const contentMap = useMemo(() => ({
    'system': <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
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
