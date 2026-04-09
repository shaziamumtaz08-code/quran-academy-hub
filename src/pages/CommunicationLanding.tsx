import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { MessageSquare, Phone, Megaphone, Video, FolderOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const GroupChat = lazy(() => import('./GroupChat'));
const WhatsAppInbox = lazy(() => import('./WhatsAppInbox'));
const WorkHub = lazy(() => import('./WorkHub'));
const ZoomManagement = lazy(() => import('./ZoomManagement'));
const Resources = lazy(() => import('./Resources'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function CommunicationLanding() {
  const { user, activeRole } = useAuth();
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');

  const { data: counts, isLoading } = useQuery({
    queryKey: ['comm-landing-counts', user?.id],
    queryFn: async () => {
      const [ticketsRes, liveRes, totalRes] = await Promise.all([
        (supabase as any).from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        (supabase as any).from('live_sessions').select('id', { count: 'exact', head: true }).in('status', ['live', 'scheduled']),
        (supabase as any).from('zoom_licenses').select('id', { count: 'exact', head: true }),
      ]);

      return {
        tickets: ticketsRes.count || 0,
        zoomStatus: `${liveRes.count || 0}/${totalRes.count || 0}`,
      };
    },
    refetchInterval: 15000,
  });

  // Build cards based on role
  const cards: LandingCard[] = [
    { id: 'chat', title: 'Group Chat', subtitle: 'Messages & channels', count: '💬', countLoading: false, icon: <MessageSquare className="h-5 w-5" />, color: 'bg-primary' },
    // WhatsApp, Zoom, Resources — admin only
    ...(isAdmin ? [
      { id: 'whatsapp', title: 'WhatsApp', subtitle: 'Inbox & broadcasts', count: '📱', countLoading: false, icon: <Phone className="h-5 w-5" />, color: 'bg-emerald-500' },
    ] : []),
    { id: 'workhub', title: 'Work Hub', subtitle: 'Open tickets', count: counts?.tickets, countLoading: isLoading, icon: <Megaphone className="h-5 w-5" />, color: 'bg-amber-500' },
    ...(isAdmin ? [
      { id: 'zoom', title: 'Zoom Engine', subtitle: 'Room status', count: counts?.zoomStatus, countLoading: isLoading, icon: <Video className="h-5 w-5" />, color: 'bg-blue-500' },
      { id: 'resources', title: 'Resources', subtitle: 'Files & materials', count: '📂', countLoading: false, icon: <FolderOpen className="h-5 w-5" />, color: 'bg-violet-500' },
    ] : []),
  ];

  const contentMap = useMemo(() => ({
    'chat': <Suspense fallback={<Loading />}><GroupChat /></Suspense>,
    'whatsapp': <Suspense fallback={<Loading />}><WhatsAppInbox /></Suspense>,
    'workhub': <Suspense fallback={<Loading />}><WorkHub /></Suspense>,
    'zoom': <Suspense fallback={<Loading />}><ZoomManagement /></Suspense>,
    'resources': <Suspense fallback={<Loading />}><Resources /></Suspense>,
  }), []);

  return (
    <LandingPageShell
      title="Communication"
      subtitle="Chat, tickets, and collaboration"
      cards={cards}
      contentMap={contentMap}
      defaultCard="chat"
    />
  );
}
