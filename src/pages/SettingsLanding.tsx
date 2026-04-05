import React, { Suspense, lazy, useMemo } from 'react';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { Settings, FolderOpen, Library } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const OrganizationSettings = lazy(() => import('./OrganizationSettings'));
const Resources = lazy(() => import('./Resources'));
const CourseAssetLibrary = lazy(() => import('./CourseAssetLibrary'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function SettingsLanding() {
  const cards: LandingCard[] = [
    { id: 'system', title: 'System Control', subtitle: 'Organization settings', count: '⚙️', countLoading: false, icon: <Settings className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'resources', title: 'Resources Manager', subtitle: 'Files & uploads', count: '📁', countLoading: false, icon: <FolderOpen className="h-5 w-5" />, color: 'bg-emerald-500' },
    { id: 'course-library', title: 'Course Library', subtitle: 'Assets & templates', count: '📚', countLoading: false, icon: <Library className="h-5 w-5" />, color: 'bg-violet-500' },
  ];

  const contentMap = useMemo(() => ({
    'system': <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
    'resources': <Suspense fallback={<Loading />}><Resources /></Suspense>,
    'course-library': <Suspense fallback={<Loading />}><CourseAssetLibrary /></Suspense>,
  }), []);

  return (
    <LandingPageShell
      title="Settings"
      subtitle="System configuration, resources, and course library"
      cards={cards}
      contentMap={contentMap}
      defaultCard="system"
    />
  );
}
