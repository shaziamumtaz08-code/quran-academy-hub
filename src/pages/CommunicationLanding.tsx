import React, { Suspense, lazy, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ViewPillBar } from '@/components/layout/ViewPillBar';
import { InlineStatTiles } from '@/components/layout/InlineStatTiles';
import { Skeleton } from '@/components/ui/skeleton';
import { CommThemeProvider, colorFromName, formatCommTime, initialsFromName, useCommTheme } from '@/components/comm/CommThemeProvider';

const GroupChat = lazy(() => import('./GroupChat'));
const WhatsAppInbox = lazy(() => import('./WhatsAppInbox'));
const NotificationCenter = lazy(() => import('./NotificationCenter'));
const ZoomManagement = lazy(() => import('./ZoomManagement'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;
const views = [
  { label: 'Academy Chat', value: 'academy-chat' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Notifications', value: 'notifications' },
  { label: 'Zoom', value: 'zoom' },
] as const;

function RecentActivityStrip() {
  const { palette } = useCommTheme();
  const { user } = useAuth();

  const { data: recent = [], isLoading } = useQuery({
    queryKey: ['comm-recent-activity', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships } = await supabase.from('chat_members').select('group_id').eq('user_id', user.id);
      const groupIds = (memberships || []).map((membership) => membership.group_id);
      if (!groupIds.length) return [];
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('id, content, sender_id, group_id, created_at')
        .in('group_id', groupIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(3);
      if (!messages?.length) return [];
      const senderIds = [...new Set(messages.map((message) => message.sender_id))];
      const messageGroupIds = [...new Set(messages.map((message) => message.group_id))];
      const [{ data: profiles }, { data: groups }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', senderIds),
        supabase.from('chat_groups').select('id, name').in('id', messageGroupIds),
      ]);
      const profileMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile.full_name]));
      const groupMap = Object.fromEntries((groups || []).map((group) => [group.id, group.name]));
      return messages.map((message) => ({ ...message, senderName: profileMap[message.sender_id] || 'Unknown', groupName: groupMap[message.group_id] || 'Chat' }));
    },
    enabled: !!user?.id,
    refetchInterval: 20000,
  });

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: palette.panel, border: `1px solid ${palette.border}` }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: palette.textMuted }}>Recent Activity</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-12 rounded-lg" />)}</div>
      ) : recent.length === 0 ? (
        <p className="py-4 text-center text-sm" style={{ color: palette.textMuted }}>No recent messages yet</p>
      ) : (
        <div className="space-y-1">
          {recent.map((message: any) => {
            const initials = initialsFromName(message.senderName);
            const color = colorFromName(message.senderName);
            const preview = (message.content || '[attachment]').slice(0, 40) + (message.content && message.content.length > 40 ? '…' : '');
            return (
              <div key={message.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: color }}>{initials}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold" style={{ color: palette.text }}>{message.senderName}</span>
                    <span className="text-[11px]" style={{ color: palette.textMuted }}>in {message.groupName}</span>
                  </div>
                  <p className="truncate text-xs" style={{ color: palette.textMuted }}>{preview}</p>
                </div>
                <span className="shrink-0 text-[11px]" style={{ color: palette.textMuted }}>{formatCommTime(message.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CommunicationLandingInner() {
  const { user, activeRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('view');
  const activeView = views.some((item) => item.value === requested) ? requested! : 'academy-chat';
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');

  const { data: counts, isLoading } = useQuery({
    queryKey: ['comm-landing-counts-v3', user?.id, isAdmin],
    queryFn: async () => {
      const [chatRes, waRes, ticketsRes] = await Promise.all([
        supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        isAdmin ? (supabase as any).from('whatsapp_contacts').select('unread_count') : Promise.resolve({ data: [] }),
        (supabase as any).from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      const whatsappPending = (waRes.data || []).reduce((sum: number, row: any) => sum + (row.unread_count || 0), 0);
      return { chat: chatRes.count || 0, whatsapp: whatsappPending, tickets: ticketsRes.count || 0 };
    },
    refetchInterval: 20000,
  });

  const contentMap: Record<string, React.ReactNode> = useMemo(() => ({
    'academy-chat': <div className="space-y-4"><RecentActivityStrip /><Suspense fallback={<Loading />}><GroupChat /></Suspense></div>,
    whatsapp: <Suspense fallback={<Loading />}><WhatsAppInbox /></Suspense>,
    notifications: <Suspense fallback={<Loading />}><NotificationCenter /></Suspense>,
    zoom: <Suspense fallback={<Loading />}><ZoomManagement /></Suspense>,
  }), []);

  const setView = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <header>
        <h1 className="text-2xl font-serif font-bold text-foreground">Communication</h1>
        <p className="mt-1 text-sm text-muted-foreground">Chat, WhatsApp, notifications, and Zoom operations.</p>
      </header>

      <InlineStatTiles
        items={[
          { label: 'Unread Chats', value: counts?.chat, loading: isLoading },
          { label: 'WhatsApp Pending', value: counts?.whatsapp, loading: isLoading, tone: 'warning' },
          { label: 'Open Tickets', value: counts?.tickets, loading: isLoading, tone: 'danger' },
        ]}
      />

      <ViewPillBar items={[...views]} activeValue={activeView} onChange={setView} />
      <div className="min-h-[420px]">{contentMap[activeView]}</div>
    </div>
  );
}

export default function CommunicationLanding() {
  return <CommThemeProvider><CommunicationLandingInner /></CommThemeProvider>;
}
