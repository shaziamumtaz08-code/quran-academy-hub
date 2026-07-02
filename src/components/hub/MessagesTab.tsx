import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, MessageSquare, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DMChatSheet } from '@/components/chat/DMChatSheet';
import { CreateTicketDialog } from '@/components/hub/CreateTicketDialog';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'students' | 'teachers' | 'admin' | 'unread';

interface Thread {
  group_id: string;
  other_user_id: string | null;
  other_user_name: string;
  other_user_role: string | null;
  last_message: string;
  last_message_at: string | null;
  last_sender_id: string | null;
}

const ROLE_RING: Record<string, string> = {
  teacher: 'ring-2 ring-teal/60',
  student: 'ring-2 ring-gold/60',
  parent: 'ring-2 ring-accent/60',
  admin: 'ring-2 ring-muted-foreground/40',
};

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function MessagesTab() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [active, setActive] = useState<{ groupId: string; name: string; recipientId: string | null } | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['workhub-dm-threads', user?.id],
    queryFn: async (): Promise<Thread[]> => {
      if (!user?.id) return [];
      const { data: myMems } = await supabase.from('chat_members').select('group_id').eq('user_id', user.id);
      const gIds = (myMems || []).map(m => m.group_id);
      if (!gIds.length) return [];

      const { data: groups } = await supabase
        .from('chat_groups')
        .select('id, is_dm, updated_at, is_active')
        .in('id', gIds)
        .eq('is_dm', true)
        .eq('is_active', true);
      const dmIds = (groups || []).map(g => g.id);
      if (!dmIds.length) return [];

      // find other participants
      const { data: allMembers } = await supabase
        .from('chat_members')
        .select('group_id, user_id')
        .in('group_id', dmIds);
      const otherByGroup: Record<string, string> = {};
      (allMembers || []).forEach(m => {
        if (m.user_id !== user.id) otherByGroup[m.group_id] = m.user_id;
      });

      const otherIds = [...new Set(Object.values(otherByGroup))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', otherIds);
      // fetch primary role from user_roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', otherIds);
      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r: any) => { if (!roleMap[r.user_id]) roleMap[r.user_id] = r.role; });
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, { ...p, primary_role: roleMap[p.id] || null }]));

      // last message per group
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('group_id, content, created_at, sender_id')
        .in('group_id', dmIds)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(500);
      const lastByGroup: Record<string, any> = {};
      (msgs || []).forEach(m => { if (!lastByGroup[m.group_id]) lastByGroup[m.group_id] = m; });

      return dmIds.map(id => {
        const otherId = otherByGroup[id] || null;
        const p: any = otherId ? profileMap[otherId] : null;
        const last = lastByGroup[id];
        return {
          group_id: id,
          other_user_id: otherId,
          other_user_name: p?.full_name || 'Direct Message',
          other_user_role: p?.primary_role || null,
          last_message: last?.content || 'No messages yet',
          last_message_at: last?.created_at || null,
          last_sender_id: last?.sender_id || null,
        };
      }).sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || ''));
    },
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const filtered = useMemo(() => {
    return threads.filter(t => {
      if (filter === 'students' && t.other_user_role !== 'student') return false;
      if (filter === 'teachers' && t.other_user_role !== 'teacher') return false;
      if (filter === 'admin' && !(t.other_user_role || '').includes('admin')) return false;
      if (search && !t.other_user_name.toLowerCase().includes(search.toLowerCase()) &&
          !t.last_message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [threads, filter, search]);

  const activeThread = threads.find(t => t.group_id === active?.groupId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 min-h-[500px]">
      {/* Thread list */}
      <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search people or messages" className="pl-9 h-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
          {(['all', 'students', 'teachers', 'admin', 'unread'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize border transition-colors',
                filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto">
          {isLoading && <p className="text-xs text-muted-foreground p-3 text-center">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No conversations yet</p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/communication?view=academy-chat">Start a chat</Link>
              </Button>
            </div>
          )}
          {filtered.map(t => {
            const ring = ROLE_RING[t.other_user_role || ''] || '';
            const isActive = active?.groupId === t.group_id;
            return (
              <button
                key={t.group_id}
                onClick={() => setActive({ groupId: t.group_id, name: t.other_user_name, recipientId: t.other_user_id })}
                className={cn(
                  'w-full text-left flex items-start gap-3 rounded-xl p-2.5 transition-colors',
                  isActive ? 'bg-primary/10' : 'hover:bg-muted/50',
                )}
              >
                <Avatar className={cn('h-10 w-10', ring)}>
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {initials(t.other_user_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{t.other_user_name}</p>
                    {t.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {t.other_user_role && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 capitalize">{t.other_user_role}</Badge>
                    )}
                    <p className="text-xs text-muted-foreground truncate flex-1">{t.last_message}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation panel (desktop) */}
      <div className="hidden lg:flex rounded-2xl border border-border bg-card overflow-hidden flex-col">
        {!activeThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">Select a conversation</p>
            <p className="text-sm text-muted-foreground mt-1">Choose someone from the left to start messaging.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b p-3">
              <div className="flex items-center gap-3">
                <Avatar className={cn('h-9 w-9', ROLE_RING[activeThread.other_user_role || ''] || '')}>
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(activeThread.other_user_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{activeThread.other_user_name}</p>
                  {activeThread.other_user_role && (
                    <p className="text-[10px] text-muted-foreground capitalize">{activeThread.other_user_role}</p>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setConvertOpen(true)}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Convert to Ticket
              </Button>
            </div>
            {/* Reuse DM sheet contents inline via iframe of sheet? Simpler: open sheet */}
            <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
              <div>
                <p>Open full conversation view.</p>
                <Button className="mt-3" onClick={() => setActive({ ...active! })}>Open Chat</Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Chat sheet — used for both desktop open button and mobile row tap */}
      <DMChatSheet
        open={!!active}
        onOpenChange={(v) => { if (!v) setActive(null); }}
        groupId={active?.groupId ?? null}
        recipientName={active?.name ?? ''}
      />

      {/* Convert to ticket */}
      <CreateTicketDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
      />
    </div>
  );
}
