import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Phone, Ticket, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CommThemeProvider, CommThemeToggle, useCommTheme,
  colorFromName, initialsFromName, formatCommTime,
} from '@/components/comm/CommThemeProvider';

interface FeatureCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  count?: React.ReactNode;
  cta: string;
  onClick: () => void;
  glow?: string;
}

function FeatureCard({ title, subtitle, icon, iconBg, iconColor, count, cta, onClick, glow }: FeatureCardProps) {
  const { palette } = useCommTheme();
  return (
    <button
      onClick={onClick}
      className="group relative text-left rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
      style={{
        backgroundColor: palette.panel,
        border: `1px solid ${palette.border}`,
        boxShadow: glow ? `0 0 0 1px ${glow}33, 0 8px 32px ${glow}1f` : undefined,
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        {count !== undefined && count !== null && count !== 0 && (
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: palette.accentSoft, color: palette.accent }}
          >
            {count}
          </span>
        )}
      </div>

      <div className="mt-5">
        <h3 className="text-lg font-bold" style={{ color: palette.text }}>{title}</h3>
        <p className="text-sm mt-1" style={{ color: palette.textMuted }}>{subtitle}</p>
      </div>

      <div
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold transition-transform group-hover:translate-x-1"
        style={{ color: palette.accent }}
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </div>
    </button>
  );
}

function RecentActivityStrip() {
  const { palette } = useCommTheme();
  const { user } = useAuth();

  const { data: recent = [], isLoading } = useQuery({
    queryKey: ['comm-recent-activity', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships } = await supabase
        .from('chat_members').select('group_id').eq('user_id', user.id);
      const groupIds = (memberships || []).map(m => m.group_id);
      if (!groupIds.length) return [];

      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('id, content, sender_id, group_id, created_at')
        .in('group_id', groupIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!msgs?.length) return [];
      const senderIds = [...new Set(msgs.map(m => m.sender_id))];
      const groupIdsSet = [...new Set(msgs.map(m => m.group_id))];
      const [{ data: profiles }, { data: groups }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', senderIds),
        supabase.from('chat_groups').select('id, name, is_dm').in('id', groupIdsSet),
      ]);
      const pmap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      const gmap = Object.fromEntries((groups || []).map(g => [g.id, g]));
      return msgs.map(m => ({
        ...m,
        senderName: pmap[m.sender_id] || 'Unknown',
        groupName: gmap[m.group_id]?.name || 'Chat',
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 20000,
  });

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: palette.panel, border: `1px solid ${palette.border}` }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: palette.textMuted }}>
          Recent Activity
        </h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: palette.textMuted }}>
          No recent messages yet
        </p>
      ) : (
        <div className="space-y-1">
          {recent.map((msg: any) => {
            const initials = initialsFromName(msg.senderName);
            const color = colorFromName(msg.senderName);
            const preview = (msg.content || '[attachment]').slice(0, 40) + (msg.content && msg.content.length > 40 ? '…' : '');
            return (
              <div
                key={msg.id}
                className="flex items-center gap-3 px-2 py-2 rounded-lg transition-colors hover:bg-white/5"
              >
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color: palette.text }}>
                      {msg.senderName}
                    </span>
                    <span className="text-[11px]" style={{ color: palette.textMuted }}>
                      in {msg.groupName}
                    </span>
                  </div>
                  <p className="text-xs truncate" style={{ color: palette.textMuted }}>{preview}</p>
                </div>
                <span className="text-[11px] shrink-0" style={{ color: palette.textMuted }}>
                  {formatCommTime(msg.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LandingInner() {
  const navigate = useNavigate();
  const { user, activeRole } = useAuth();
  const { palette } = useCommTheme();
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');

  const { data: counts, isLoading } = useQuery({
    queryKey: ['comm-landing-counts-v2', user?.id, isAdmin],
    queryFn: async () => {
      const [chatRes, waRes, ticketsRes] = await Promise.all([
        // unread chat: simple proxy = total messages user can see in last 24h
        supabase.from('chat_messages').select('id', { count: 'exact', head: true })
          .eq('is_deleted', false)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        isAdmin
          ? (supabase as any).from('whatsapp_contacts').select('unread_count')
          : Promise.resolve({ data: [] }),
        (supabase as any).from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);

      const waUnread = (waRes.data || []).reduce(
        (sum: number, c: any) => sum + (c.unread_count || 0), 0
      );

      return {
        chat: chatRes.count || 0,
        whatsapp: waUnread,
        tickets: ticketsRes.count || 0,
      };
    },
    refetchInterval: 20000,
  });

  return (
    <div className="space-y-8 animate-fade-in p-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: palette.text }}>
            Communications
          </h1>
          <p className="text-sm mt-1" style={{ color: palette.textMuted }}>
            One inbox for chat, WhatsApp, and team tickets
          </p>
        </div>
        <CommThemeToggle />
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard
          title="Academy Chat"
          subtitle="Groups & direct messages"
          icon={<MessageCircle className="h-6 w-6" />}
          iconBg={palette.accentSoft}
          iconColor={palette.accent}
          count={isLoading ? '…' : (counts?.chat || 0)}
          cta="Open Chat"
          glow={palette.accent}
          onClick={() => navigate('/chat')}
        />

        {isAdmin && (
          <FeatureCard
            title="WhatsApp"
            subtitle="Student & parent inbox"
            icon={<Phone className="h-6 w-6" />}
            iconBg="rgba(37,211,102,0.15)"
            iconColor="#25D366"
            count={isLoading ? '…' : (counts?.whatsapp || 0)}
            cta="Open WhatsApp"
            glow="#25D366"
            onClick={() => navigate('/whatsapp')}
          />
        )}

        <FeatureCard
          title="Work Hub"
          subtitle="Support & requests"
          icon={<Ticket className="h-6 w-6" />}
          iconBg="rgba(245,158,11,0.15)"
          iconColor="#f59e0b"
          count={isLoading ? '…' : (counts?.tickets || 0)}
          cta="Open Hub"
          glow="#f59e0b"
          onClick={() => navigate('/hub')}
        />
      </div>

      {/* Recent activity */}
      <RecentActivityStrip />
    </div>
  );
}

export default function CommunicationLanding() {
  return (
    <CommThemeProvider className="-m-4 sm:-m-6 p-4 sm:p-8 min-h-[calc(100vh-4rem)]">
      <LandingInner />
    </CommThemeProvider>
  );
}
