import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Users, MessageCircle, Search, User } from 'lucide-react';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatEmptyState } from '@/components/chat/ChatEmptyState';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { MembersPanel } from '@/components/chat/MembersPanel';
import { AIAssistantDialog } from '@/components/chat/AIAssistantDialog';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import {
  CommThemeProvider, CommThemeToggle, useCommTheme,
  colorFromName, initialsFromName, formatCommTime,
} from '@/components/comm/CommThemeProvider';

function GroupChatInner() {
  const { user, activeRole } = useAuth();
  const isAdmin = (activeRole && ['super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic'].includes(activeRole)) || activeRole?.startsWith('admin_');
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { palette } = useCommTheme();

  const [activeGroupId, setActiveGroupId] = useState<string | null>(searchParams.get('group'));
  const initialGroupHandled = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('project');
  const [newChannelMode, setNewChannelMode] = useState<'group' | 'channel'>('group');
  const [membersOpen, setMembersOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [forwardMsg, setForwardMsg] = useState<any | null>(null);
  const [dmOpen, setDmOpen] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'groups' | 'dm'>(searchParams.get('filter') === 'dm' ? 'dm' : 'all');
  const [chatSearch, setChatSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ['chat-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships } = await supabase.from('chat_members').select('group_id').eq('user_id', user.id);
      if (!memberships?.length) return [];
      const groupIds = memberships.map(m => m.group_id);
      const { data } = await supabase.from('chat_groups').select('*, courses:courses(name)').in('id', groupIds).eq('is_active', true).order('updated_at', { ascending: false });

      const dmGroups = (data || []).filter(g => g.is_dm);
      if (dmGroups.length) {
        const dmGroupIds = dmGroups.map(g => g.id);
        const { data: dmMembers } = await supabase.from('chat_members').select('group_id, user_id').in('group_id', dmGroupIds);
        const otherUserIds = [...new Set((dmMembers || []).filter(m => m.user_id !== user.id).map(m => m.user_id))];
        if (otherUserIds.length) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', otherUserIds);
          const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
          const groupUserMap: Record<string, string> = {};
          (dmMembers || []).filter(m => m.user_id !== user.id).forEach(m => {
            groupUserMap[m.group_id] = nameMap[m.user_id] || 'User';
          });
          return (data || []).map(g => g.is_dm ? { ...g, dmUserName: groupUserMap[g.id] || 'Direct Message' } : g);
        }
      }
      return data || [];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    const urlGroup = searchParams.get('group');
    if (urlGroup && !initialGroupHandled.current && groups.length > 0) {
      setActiveGroupId(urlGroup);
      initialGroupHandled.current = true;
    }
  }, [groups, searchParams]);

  // Members
  const { data: members = [] } = useQuery({
    queryKey: ['chat-members', activeGroupId],
    queryFn: async () => {
      if (!activeGroupId) return [];
      const { data: mems } = await supabase.from('chat_members').select('*').eq('group_id', activeGroupId);
      if (!mems?.length) return [];
      const ids = mems.map(m => m.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      return mems.map(m => ({ ...m, full_name: nameMap[m.user_id] || 'Unknown' }));
    },
    enabled: !!activeGroupId,
  });

  const isGroupAdmin = members.some((m: any) => m.user_id === user?.id && m.role === 'admin');

  // Messages
  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', activeGroupId],
    queryFn: async () => {
      if (!activeGroupId) return [];
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('group_id', activeGroupId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(200);
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      if (!senderIds.length) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      return (data || []).map(m => ({ ...m, senderName: nameMap[m.sender_id] || 'Unknown' }));
    },
    enabled: !!activeGroupId,
  });

  // Last messages per group (preview + timestamp)
  const { data: lastMessages = {} } = useQuery({
    queryKey: ['chat-last-messages', user?.id, groups.length],
    queryFn: async () => {
      if (!groups.length) return {};
      const ids = groups.map((g: any) => g.id);
      const { data } = await supabase
        .from('chat_messages')
        .select('group_id, content, created_at')
        .in('group_id', ids)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(500);
      const out: Record<string, { content: string | null; created_at: string }> = {};
      (data || []).forEach(m => {
        if (!out[m.group_id]) out[m.group_id] = { content: m.content, created_at: m.created_at };
      });
      return out;
    },
    enabled: groups.length > 0,
  });

  // All users for DM
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-dm'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').is('archived_at', null).order('full_name').limit(200);
      return (data || []).filter((u: any) => u.id !== user?.id);
    },
    enabled: dmOpen,
  });

  // Realtime
  useEffect(() => {
    if (!activeGroupId) return;
    const channel = supabase
      .channel(`chat-${activeGroupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${activeGroupId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', activeGroupId] });
        queryClient.invalidateQueries({ queryKey: ['chat-last-messages'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeGroupId, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createGroup = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { data: group, error } = await (supabase as any)
        .from('chat_groups')
        .insert({ name: newGroupName, type: newGroupType, created_by: user.id, channel_mode: newChannelMode })
        .select()
        .single();
      if (error) throw error;
      await supabase.from('chat_members').insert({ group_id: group.id, user_id: user.id, role: 'admin' });
      return group;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['chat-groups'] });
      setCreateOpen(false);
      setNewGroupName('');
      setNewChannelMode('group');
      if (group) setActiveGroupId(group.id);
      toast({ title: newChannelMode === 'channel' ? 'Channel created' : 'Group created' });
    },
  });

  const startDM = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id) return;
      const { data: myMemberships } = await supabase.from('chat_members').select('group_id').eq('user_id', user.id);
      const myGroupIds = (myMemberships || []).map(m => m.group_id);

      if (myGroupIds.length) {
        const { data: dmGroups } = await supabase.from('chat_groups').select('id').eq('is_dm', true).in('id', myGroupIds);
        if (dmGroups?.length) {
          for (const dm of dmGroups) {
            const { data: members } = await supabase.from('chat_members').select('user_id').eq('group_id', dm.id);
            const memberIds = (members || []).map(m => m.user_id);
            if (memberIds.includes(targetUserId) && memberIds.length === 2) {
              return dm.id;
            }
          }
        }
      }

      const { data: newGroup, error } = await supabase.from('chat_groups').insert({
        name: 'DM', type: 'custom', created_by: user.id, is_dm: true,
      }).select().single();
      if (error) throw error;
      await supabase.from('chat_members').insert([
        { group_id: newGroup.id, user_id: user.id, role: 'admin' },
        { group_id: newGroup.id, user_id: targetUserId, role: 'member' },
      ]);
      return newGroup.id;
    },
    onSuccess: (groupId) => {
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: ['chat-groups'] });
        setActiveGroupId(groupId);
        setDmOpen(false);
        setDmSearch('');
      }
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ content, attachmentUrl }: { content: string; attachmentUrl?: string }) => {
      if (!user?.id || !activeGroupId) return;
      const { error } = await supabase.from('chat_messages').insert({
        group_id: activeGroupId, sender_id: user.id,
        content: content || null, attachment_url: attachmentUrl || null,
        reply_to: replyTo?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeGroupId] });
    },
  });

  const convertToTask = useMutation({
    mutationFn: async (msg: any) => {
      if (!user?.id) return;
      const { error } = await supabase.from('tasks').insert({
        title: (msg.content || 'Task from chat').slice(0, 100),
        description: msg.content || '',
        created_by: user.id, assigned_to: msg.sender_id,
        priority: 'medium', status: 'open',
        source_type: 'chat', source_id: msg.id,
      });
      if (error) throw error;
      await supabase.from('chat_messages').update({ linked_task_id: msg.id }).eq('id', msg.id);
    },
    onSuccess: () => toast({ title: 'Task created from message' }),
  });

  const activeGroup = groups.find((g: any) => g.id === activeGroupId);
  const msgMap = Object.fromEntries(messages.map((m: any) => [m.id, m]));

  const filteredGroups = useMemo(() => {
    let list = groups as any[];
    if (sidebarFilter === 'dm') list = list.filter(g => g.is_dm);
    else if (sidebarFilter === 'groups') list = list.filter(g => !g.is_dm);
    if (chatSearch.trim()) {
      const q = chatSearch.toLowerCase();
      list = list.filter(g => {
        const name = g.is_dm && g.dmUserName ? g.dmUserName : g.name;
        return name?.toLowerCase().includes(q);
      });
    }
    return list;
  }, [groups, sidebarFilter, chatSearch]);

  const filteredDmUsers = allUsers.filter((u: any) => u.full_name?.toLowerCase().includes(dmSearch.toLowerCase()));

  // Themed input control style for the search bar
  const inputStyle: React.CSSProperties = {
    backgroundColor: palette.panelAlt,
    color: palette.text,
    border: `1px solid ${palette.border}`,
  };

  return (
    <div className="h-[calc(100vh-64px)] flex" style={{ backgroundColor: palette.bg, color: palette.text }}>
      {/* SIDEBAR */}
      <div
        className={`w-full md:w-[280px] flex flex-col shrink-0 ${activeGroupId ? 'hidden md:flex' : 'flex'}`}
        style={{ backgroundColor: palette.panel, borderRight: `1px solid ${palette.border}` }}
      >
        {/* Header */}
        <div
          className="px-3 pt-3 pb-2 flex items-center justify-between gap-2"
          style={{ borderBottom: `1px solid ${palette.border}` }}
        >
          <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: palette.text }}>
            <Users className="h-4 w-4" style={{ color: palette.accent }} /> Messages
          </p>
          <div className="flex items-center gap-1">
            <CommThemeToggle />
            <button
              onClick={() => setDmOpen(true)}
              title="New DM"
              className="h-8 w-8 rounded-full flex items-center justify-center transition-colors"
              style={{ color: palette.textMuted }}
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            {isAdmin && (
              <button
                onClick={() => setCreateOpen(true)}
                title="New Group"
                className="h-8 w-8 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: palette.accent, color: palette.bubbleOutText }}
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="p-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: palette.textMuted }} />
            <input
              value={chatSearch}
              onChange={e => setChatSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-9 pr-3 py-2 rounded-full text-sm outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 px-3 pb-2">
          {(['all', 'groups', 'dm'] as const).map(f => {
            const active = sidebarFilter === f;
            return (
              <button
                key={f}
                onClick={() => setSidebarFilter(f)}
                className="text-[11px] px-3 py-1 rounded-full font-semibold capitalize transition-all"
                style={{
                  backgroundColor: active ? palette.accent : palette.panelAlt,
                  color: active ? palette.bubbleOutText : palette.textMuted,
                  border: `1px solid ${palette.border}`,
                }}
              >
                {f === 'dm' ? 'Direct' : f}
              </button>
            );
          })}
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {filteredGroups.map((g: any) => {
            const isActive = activeGroupId === g.id;
            const name = g.is_dm && g.dmUserName ? g.dmUserName : g.name;
            const initials = initialsFromName(name);
            const color = colorFromName(name);
            const last = lastMessages[g.id];
            const preview = last?.content
              ? last.content.slice(0, 40) + (last.content.length > 40 ? '…' : '')
              : g.is_dm ? 'Direct message' : (g.channel_mode === 'channel' ? '📢 Channel' : g.type);
            const ts = last?.created_at;

            return (
              <button
                key={g.id}
                onClick={() => setActiveGroupId(g.id)}
                className="w-full text-left rounded-xl p-2.5 transition-all duration-150 animate-fade-in"
                style={{
                  backgroundColor: isActive ? palette.accentSoft : 'transparent',
                  border: `1px solid ${isActive ? palette.accent + '55' : 'transparent'}`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {g.is_dm ? initials || <User className="h-4 w-4" /> : initials}
                    </div>
                    {g.is_dm && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
                        style={{ backgroundColor: '#10b981', borderColor: palette.panel }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: palette.text }}>{name}</p>
                      {ts && (
                        <span className="text-[10px] shrink-0" style={{ color: palette.textMuted }}>
                          {formatCommTime(ts)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: palette.textMuted }}>
                      {preview}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
          {filteredGroups.length === 0 && (
            <div className="text-center py-8 px-4 space-y-2">
              <MessageCircle className="h-8 w-8 mx-auto" style={{ color: palette.textMuted }} />
              <p className="text-xs" style={{ color: palette.textMuted }}>
                {chatSearch ? 'No matching chats' : 'No conversations yet'}
              </p>
              {!chatSearch && (
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setDmOpen(true)}>
                    <MessageCircle className="h-3 w-3 mr-1" /> New DM
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setCreateOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" /> New Group
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div
        className={`flex-1 flex flex-col ${!activeGroupId ? 'hidden md:flex' : 'flex'}`}
        style={{ backgroundColor: palette.bg }}
      >
        {activeGroup ? (
          <>
            <ChatHeader
              group={activeGroup}
              memberCount={members.length}
              onBack={() => setActiveGroupId(null)}
              onViewMembers={() => setMembersOpen(true)}
              onAI={() => setAiOpen(true)}
              onAttach={() => {}}
            />

            {messages.length === 0 ? (
              <ChatEmptyState
                group={activeGroup}
                members={members}
                onAddMembers={() => setMembersOpen(true)}
                onCreateTask={() => toast({ title: 'Use WorkHub to create tasks' })}
                onAskAI={() => setAiOpen(true)}
                onShareFile={() => {}}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-2 animate-fade-in">
                {messages.map((msg: any) => {
                  const replyContent = msg.reply_to ? msgMap[msg.reply_to]?.content : undefined;
                  return (
                    <ChatMessageBubble
                      key={msg.id}
                      msg={msg}
                      isMe={msg.sender_id === user?.id}
                      onConvertToTask={(m) => convertToTask.mutate(m)}
                      onReply={(m) => setReplyTo(m)}
                      onForward={(m) => setForwardMsg(m)}
                      replyToContent={replyContent}
                    />
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}

            {(activeGroup.channel_mode !== 'channel' || isGroupAdmin) ? (
              <ChatInput
                onSend={(content, attachmentUrl) => sendMessage.mutate({ content, attachmentUrl })}
                sending={sendMessage.isPending}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
              />
            ) : (
              <div className="p-3 text-center" style={{ borderTop: `1px solid ${palette.border}` }}>
                <p className="text-xs" style={{ color: palette.textMuted }}>📢 This is a channel — only admins can post</p>
              </div>
            )}
          </>
        ) : (
          // Polished empty state with pulse ring
          <div className="flex-1 flex items-center justify-center p-8 animate-fade-in">
            <div className="text-center space-y-4 max-w-sm">
              <div className="relative w-24 h-24 mx-auto">
                <div
                  className="absolute inset-0 rounded-full pulse"
                  style={{ backgroundColor: palette.accentSoft }}
                />
                <div
                  className="absolute inset-3 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: palette.accent, color: palette.bubbleOutText }}
                >
                  <MessageCircle className="h-8 w-8" />
                </div>
              </div>
              <h3 className="text-xl font-bold" style={{ color: palette.text }}>Select a conversation</h3>
              <p className="text-sm" style={{ color: palette.textMuted }}>
                Choose a chat from the left to start messaging, or create a new one.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <Button size="sm" variant="outline" onClick={() => setDmOpen(true)}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1" /> New DM
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> New Group
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Chat Group</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Group Name</Label>
              <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Hifz Team" />
            </div>
            <div>
              <Label>Mode</Label>
              <Select value={newChannelMode} onValueChange={(v) => setNewChannelMode(v as 'group' | 'channel')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">💬 Group — Everyone can post</SelectItem>
                  <SelectItem value="channel">📢 Channel — Admin posts only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newGroupType} onValueChange={setNewGroupType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">📋 Project</SelectItem>
                  <SelectItem value="issue">🐛 Issue</SelectItem>
                  <SelectItem value="salary">💰 Salary</SelectItem>
                  <SelectItem value="custom">💬 Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => createGroup.mutate()} disabled={!newGroupName.trim()}>
              {newChannelMode === 'channel' ? 'Create Channel' : 'Create Group'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dmOpen} onOpenChange={setDmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">New Direct Message</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={dmSearch}
              onChange={e => setDmSearch(e.target.value)}
              placeholder="Search users..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredDmUsers.map((u: any) => (
              <button
                key={u.id}
                onClick={() => startDM.mutate(u.id)}
                disabled={startDM.isPending}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-secondary text-xs flex items-center gap-2"
              >
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{u.full_name}</span>
              </button>
            ))}
            {filteredDmUsers.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">No users found</p>}
          </div>
        </DialogContent>
      </Dialog>

      <MembersPanel open={membersOpen} onOpenChange={setMembersOpen} groupId={activeGroupId || ''} isAdmin={isGroupAdmin} />
      <AIAssistantDialog open={aiOpen} onOpenChange={setAiOpen} messages={messages} />
      {forwardMsg && (
        <ForwardMessageDialog
          open={!!forwardMsg}
          onOpenChange={(v) => { if (!v) setForwardMsg(null); }}
          message={forwardMsg}
          currentGroupName={activeGroup?.name}
        />
      )}
    </div>
  );
}

export default function GroupChat() {
  return (
    <DashboardLayout>
      <CommThemeProvider>
        <GroupChatInner />
      </CommThemeProvider>
    </DashboardLayout>
  );
}
