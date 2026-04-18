import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { Settings, FolderOpen, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const OrganizationSettings = lazy(() => import('./OrganizationSettings'));
const Resources = lazy(() => import('./Resources'));
const AuthenticationSettings = lazy(() => import('./AuthenticationSettings'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function SettingsLanding() {
  const { isSuperAdmin } = useAuth();
  // Multi-auth panel is hidden by default. A super_admin can flip the
  // `auth_methods_panel_enabled` flag in app_settings to reveal it.
  const [authPanelEnabled, setAuthPanelEnabled] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'auth_methods_panel_enabled')
        .maybeSingle();
      const val = data?.setting_value;
      setAuthPanelEnabled(val === true || val === 'true');
    })();
  }, [isSuperAdmin]);

  const showAuthCard = isSuperAdmin && authPanelEnabled;

  const cards: LandingCard[] = useMemo(() => {
    const base: LandingCard[] = [
      { id: 'system', title: 'System Control', subtitle: 'Organization settings', count: '⚙️', countLoading: false, icon: <Settings className="h-5 w-5" />, color: 'bg-primary' },
      { id: 'resources', title: 'Resources Manager', subtitle: 'Files & uploads', count: '📁', countLoading: false, icon: <FolderOpen className="h-5 w-5" />, color: 'bg-emerald-500' },
    ];
    if (showAuthCard) {
      base.splice(1, 0, { id: 'auth', title: 'Authentication', subtitle: 'Login methods per org', count: '🔐', countLoading: false, icon: <ShieldCheck className="h-5 w-5" />, color: 'bg-indigo-500' });
    }
    return base;
  }, [showAuthCard]);

  const contentMap = useMemo(() => {
    const map: Record<string, React.ReactNode> = {
      'system': <Suspense fallback={<Loading />}><OrganizationSettings /></Suspense>,
      'resources': <Suspense fallback={<Loading />}><Resources /></Suspense>,
    };
    if (showAuthCard) {
      map['auth'] = <Suspense fallback={<Loading />}><AuthenticationSettings /></Suspense>;
    }
    return map;
  }, [showAuthCard]);

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
