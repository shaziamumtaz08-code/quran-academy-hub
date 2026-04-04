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
import { format } from 'date-fns';
import { Plus, Send, Users, Hash, Paperclip, ArrowLeft, ClipboardList, ExternalLink } from 'lucide-react';

export default function GroupChat() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('project');
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user's groups
  const { data: groups = [] } = useQuery({
    queryKey: ['chat-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships } = await supabase
        .from('chat_members')
        .select('group_id')
        .eq('user_id', user.id);
      if (!memberships?.length) return [];
      const groupIds = memberships.map(m => m.group_id);
      const { data: groupsData } = await supabase
        .from('chat_groups')
        .select('*')
        .in('id', groupIds)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
      return groupsData || [];
    },
    enabled: !!user?.id,
  });

  // Fetch messages for active group
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
        .limit(100);
      // Enrich with names
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      return (data || []).map(m => ({ ...m, senderName: nameMap[m.sender_id] || 'Unknown' }));
    },
    enabled: !!activeGroupId,
  });

  // Realtime subscription for messages
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
      // Add creator as member
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
    mutationFn: async (content: string) => {
      if (!user?.id || !activeGroupId) return;
      const { error } = await supabase.from('chat_messages').insert({
        group_id: activeGroupId,
        sender_id: user.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeGroupId] });
    },
  });

  // Convert message to task
  const convertToTask = useMutation({
    mutationFn: async (msg: any) => {
      if (!user?.id) return;
      const { error } = await supabase.from('tasks').insert({
        title: msg.content.slice(0, 100),
        description: msg.content,
        created_by: user.id,
        assigned_to: msg.sender_id,
        priority: 'medium',
        status: 'open',
      });
      if (error) throw error;
      // Link message to task
      // Update chat message with linked_task_id could be done here
    },
    onSuccess: () => toast({ title: 'Task created from message' }),
  });

  const activeGroup = groups.find((g: any) => g.id === activeGroupId);

  const typeIcons: Record<string, string> = { project: '📋', issue: '🐛', salary: '💰', custom: '💬' };

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
              <p className="text-xs text-muted-foreground text-center py-6">No groups yet</p>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`flex-1 flex flex-col ${!activeGroupId ? 'hidden md:flex' : 'flex'}`}>
          {activeGroup ? (
            <>
              {/* Header */}
              <div className="h-12 border-b border-border flex items-center px-3 gap-2 bg-card">
                <button className="md:hidden" onClick={() => setActiveGroupId(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-sm">{typeIcons[activeGroup.type] || '💬'}</span>
                <p className="text-sm font-bold text-foreground">{activeGroup.name}</p>
                <Badge variant="secondary" className="text-[9px] capitalize">{activeGroup.type}</Badge>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map((msg: any) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                        isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted border border-border rounded-bl-md'
                      }`}>
                        {!isMe && <p className="text-[10px] font-bold opacity-70 mb-0.5">{msg.senderName}</p>}
                        <p className="text-sm">{msg.content}</p>
                        {msg.attachment_url && (
                          <a href={msg.attachment_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-[10px] underline mt-1">
                            <Paperclip className="h-3 w-3" /> Attachment
                          </a>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-[9px] ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {format(new Date(msg.created_at), 'h:mm a')}
                          </p>
                          {/* Convert to task */}
                          <button
                            onClick={() => convertToTask.mutate(msg)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Convert to task"
                          >
                            <ClipboardList className={`h-3 w-3 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border p-2 flex gap-2 bg-card">
                <Input
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && messageText.trim()) {
                      e.preventDefault();
                      sendMessage.mutate(messageText.trim());
                    }
                  }}
                />
                <Button
                  size="icon"
                  disabled={!messageText.trim() || sendMessage.isPending}
                  onClick={() => sendMessage.mutate(messageText.trim())}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Select a group to start chatting</p>
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
            <Button onClick={() => createGroup.mutate()} disabled={!newGroupName.trim()}>
              Create Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
