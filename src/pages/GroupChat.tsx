import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ConditionalDashboardLayout as DashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Users, Hash, User, MessageCircle, Search } from 'lucide-react';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatEmptyState } from '@/components/chat/ChatEmptyState';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { MembersPanel } from '@/components/chat/MembersPanel';
import { AIAssistantDialog } from '@/components/chat/AIAssistantDialog';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';

const typeIcons: Record<string, string> = { project: '📋', issue: '🐛', salary: '💰', custom: '💬', channel: '📢' };

export default function GroupChat() {
  const { user, activeRole } = useAuth();
  const isAdmin = activeRole && ['super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic'].includes(activeRole) || activeRole?.startsWith('admin_');
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
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
  const [sidebarFilter, setSidebarFilter] = useState('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ['chat-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships } = await supabase.from('chat_members').select('group_id').eq('user_id', user.id);
      if (!memberships?.length) return [];
      const groupIds = memberships.map(m => m.group_id);
      const { data } = await supabase.from('chat_groups').select('*').in('id', groupIds).eq('is_active', true).order('updated_at', { ascending: false });
      
      // For DM groups, fetch the other user's name
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
          return (data || []).map(g => g.is_dm ? { ...g, name: groupUserMap[g.id] || 'Direct Message' } : g);
        }
      }
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Handle URL ?group= param: auto-select when groups load
  useEffect(() => {
    const urlGroup = searchParams.get('group');
    if (urlGroup && !initialGroupHandled.current && groups.length > 0) {
      setActiveGroupId(urlGroup);
      initialGroupHandled.current = true;
    }
  }, [groups, searchParams]);

  // Fetch members for active group
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

  // Fetch messages
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
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeGroupId, queryClient]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create group
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

  // Start DM
  const startDM = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id) return;
      // Check existing DMs
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

      // Create new DM
      const { data: newGroup, error } = await supabase.from('chat_groups').insert({
        name: 'DM',
        type: 'custom',
        created_by: user.id,
        is_dm: true,
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

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ content, attachmentUrl }: { content: string; attachmentUrl?: string }) => {
      if (!user?.id || !activeGroupId) return;
      const { error } = await supabase.from('chat_messages').insert({
        group_id: activeGroupId,
        sender_id: user.id,
        content: content || null,
        attachment_url: attachmentUrl || null,
        reply_to: replyTo?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeGroupId] });
    },
  });

  // Convert to task
  const convertToTask = useMutation({
    mutationFn: async (msg: any) => {
      if (!user?.id) return;
      const { error } = await supabase.from('tasks').insert({
        title: (msg.content || 'Task from chat').slice(0, 100),
        description: msg.content || '',
        created_by: user.id,
        assigned_to: msg.sender_id,
        priority: 'medium',
        status: 'open',
        source_type: 'chat',
        source_id: msg.id,
      });
      if (error) throw error;
      await supabase.from('chat_messages').update({ linked_task_id: msg.id }).eq('id', msg.id);
    },
    onSuccess: () => toast({ title: 'Task created from message' }),
  });

  const activeGroup = groups.find((g: any) => g.id === activeGroupId);
  const msgMap = Object.fromEntries(messages.map((m: any) => [m.id, m]));

  const filteredGroups = sidebarFilter === 'all' ? groups
    : sidebarFilter === 'dm' ? groups.filter((g: any) => g.is_dm)
    : groups.filter((g: any) => !g.is_dm);

  const filteredDmUsers = allUsers.filter((u: any) => u.full_name?.toLowerCase().includes(dmSearch.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-64px)] flex">
        {/* Sidebar */}
        <div className={`w-full md:w-72 border-r border-border flex flex-col bg-card ${activeGroupId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> Messages
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setDmOpen(true)} title="New DM">
                <MessageCircle className="h-4 w-4" />
              </Button>
              {isAdmin && (
                <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)} title="New Group">
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex gap-1 px-3 py-2 border-b border-border">
            {(['all', 'groups', 'dm'] as const).map(f => (
              <button
                key={f}
                onClick={() => setSidebarFilter(f)}
                className={`text-[10px] px-2.5 py-1 rounded-full font-semibold capitalize transition-colors ${
                  sidebarFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'
                }`}
              >
                {f === 'dm' ? 'Direct' : f}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredGroups.map((g: any) => (
              <button
                key={g.id}
                onClick={() => setActiveGroupId(g.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-border hover:bg-secondary/50 transition-colors ${
                  activeGroupId === g.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
                    {g.is_dm ? '👤' : g.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-bold text-foreground truncate">{g.name}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground capitalize truncate">
                      {g.is_dm ? 'Direct message' : g.channel_mode === 'channel' ? '📢 Channel' : g.type}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {filteredGroups.length === 0 && (
              <div className="text-center py-8 px-4 space-y-2">
                <Hash className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">No conversations yet</p>
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
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`flex-1 flex flex-col ${!activeGroupId ? 'hidden md:flex' : 'flex'}`}>
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
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
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

              {/* ChatInput: hide for non-admins in channel mode */}
              {(activeGroup.channel_mode !== 'channel' || isGroupAdmin) ? (
                <ChatInput
                  onSend={(content, attachmentUrl) => sendMessage.mutate({ content, attachmentUrl })}
                  sending={sendMessage.isPending}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                />
              ) : (
                <div className="p-3 border-t border-border text-center">
                  <p className="text-xs text-muted-foreground">📢 This is a channel — only admins can post</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Users className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Select a conversation to start</p>
                <div className="flex gap-2 justify-center">
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
      </div>

      {/* Create group dialog */}
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

      {/* New DM dialog */}
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

      {/* Members panel */}
      <MembersPanel open={membersOpen} onOpenChange={setMembersOpen} groupId={activeGroupId || ''} isAdmin={isGroupAdmin} />

      {/* AI Assistant */}
      <AIAssistantDialog open={aiOpen} onOpenChange={setAiOpen} messages={messages} />

      {/* Forward message */}
      {forwardMsg && (
        <ForwardMessageDialog
          open={!!forwardMsg}
          onOpenChange={(v) => { if (!v) setForwardMsg(null); }}
          message={forwardMsg}
          currentGroupName={activeGroup?.name}
        />
      )}
    </DashboardLayout>
  );
}
