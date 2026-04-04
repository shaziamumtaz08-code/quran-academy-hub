import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Users, Hash } from 'lucide-react';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatEmptyState } from '@/components/chat/ChatEmptyState';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { MembersPanel } from '@/components/chat/MembersPanel';
import { AIAssistantDialog } from '@/components/chat/AIAssistantDialog';

const typeIcons: Record<string, string> = { project: '📋', issue: '🐛', salary: '💰', custom: '💬' };

export default function GroupChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('project');
  const [membersOpen, setMembersOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ['chat-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships } = await supabase.from('chat_members').select('group_id').eq('user_id', user.id);
      if (!memberships?.length) return [];
      const groupIds = memberships.map(m => m.group_id);
      const { data } = await supabase.from('chat_groups').select('*').in('id', groupIds).eq('is_active', true).order('updated_at', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

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

  // Check if current user is admin of active group
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
      const { data: group, error } = await supabase
        .from('chat_groups')
        .insert({ name: newGroupName, type: newGroupType, created_by: user.id })
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
      if (group) setActiveGroupId(group.id);
      toast({ title: 'Group created' });
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
      });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: 'Task created from message' }),
  });

  const activeGroup = groups.find((g: any) => g.id === activeGroupId);

  // Build reply map for quick lookup
  const msgMap = Object.fromEntries(messages.map((m: any) => [m.id, m]));

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-64px)] flex">
        {/* Sidebar */}
        <div className={`w-full md:w-72 border-r border-border flex flex-col bg-card ${activeGroupId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> Groups
            </p>
            <Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {groups.map((g: any) => (
              <button
                key={g.id}
                onClick={() => setActiveGroupId(g.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-border hover:bg-secondary/50 transition-colors ${
                  activeGroupId === g.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{typeIcons[g.type] || '💬'}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-foreground truncate">{g.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{g.type}</p>
                  </div>
                </div>
              </button>
            ))}
            {groups.length === 0 && (
              <div className="text-center py-8 px-4 space-y-2">
                <Hash className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">No groups yet</p>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Create Group
                </Button>
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
                onAttach={() => {/* handled in ChatInput */}}
              />

              {messages.length === 0 ? (
                <ChatEmptyState
                  group={activeGroup}
                  members={members}
                  onAddMembers={() => setMembersOpen(true)}
                  onCreateTask={() => toast({ title: 'Use WorkHub to create tasks' })}
                  onAskAI={() => setAiOpen(true)}
                  onShareFile={() => {/* focus input */}}
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
                        replyToContent={replyContent}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}

              <ChatInput
                onSend={(content, attachmentUrl) => sendMessage.mutate({ content, attachmentUrl })}
                sending={sendMessage.isPending}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Users className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Select a group to start chatting</p>
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> New Group
                </Button>
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
            <Button onClick={() => createGroup.mutate()} disabled={!newGroupName.trim()}>Create Group</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members panel */}
      <MembersPanel open={membersOpen} onOpenChange={setMembersOpen} groupId={activeGroupId || ''} isAdmin={isGroupAdmin} />

      {/* AI Assistant */}
      <AIAssistantDialog open={aiOpen} onOpenChange={setAiOpen} messages={messages} />
    </DashboardLayout>
  );
}
