import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { MembersPanel } from '@/components/chat/MembersPanel';
import { AIAssistantDialog } from '@/components/chat/AIAssistantDialog';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import { CreateTicketDialog } from '@/components/hub/CreateTicketDialog';
import { CommThemeProvider, useCommTheme } from '@/components/comm/CommThemeProvider';

interface ClassChatTabProps {
  courseId: string;
  mode: 'student' | 'teacher';
}

function ClassChatTabInner({ courseId, mode }: ClassChatTabProps) {
  const { user, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const { palette } = useCommTheme();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [forwardMsg, setForwardMsg] = useState<any | null>(null);
  const [taskFromMsg, setTaskFromMsg] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdminRole = !!activeRole && (
    ['super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic', 'teacher', 'moderator', 'supervisor'].includes(activeRole)
    || activeRole.startsWith('admin_')
  );
  const canCreateTask = mode === 'teacher' || isAdminRole;

  // Fetch chat groups for this course
  const { data: chatGroups = [], isLoading } = useQuery({
    queryKey: ['class-chat-groups', courseId, user?.id, mode],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships } = await supabase
        .from('chat_members')
        .select('group_id')
        .eq('user_id', user.id);
      if (!memberships?.length) return [];
      const groupIds = memberships.map(m => m.group_id);
      const { data: groups } = await supabase
        .from('chat_groups')
        .select('id, name, course_id, class_id, channel_mode, type, is_dm')
        .eq('course_id', courseId)
        .in('id', groupIds)
        .not('class_id' as any, 'is', null);
      return groups || [];
    },
    enabled: !!courseId && !!user?.id,
  });

  useEffect(() => {
    if (chatGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(chatGroups[0].id);
    }
  }, [chatGroups, selectedGroupId]);

  // Members
  const { data: members = [] } = useQuery({
    queryKey: ['class-chat-members', selectedGroupId],
    queryFn: async () => {
      if (!selectedGroupId) return [];
      const { data: mems } = await supabase.from('chat_members').select('*').eq('group_id', selectedGroupId);
      if (!mems?.length) return [];
      const ids = mems.map(m => m.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      return mems.map(m => ({ ...m, full_name: nameMap[m.user_id] || 'Unknown' }));
    },
    enabled: !!selectedGroupId,
  });

  const isGroupAdmin = members.some((m: any) => m.user_id === user?.id && m.role === 'admin');

  // Messages
  const { data: messages = [] } = useQuery({
    queryKey: ['class-chat-messages', selectedGroupId],
    queryFn: async () => {
      if (!selectedGroupId) return [];
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('group_id', selectedGroupId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(200);
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      if (!senderIds.length) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      return (data || []).map(m => ({ ...m, senderName: nameMap[m.sender_id] || 'Unknown' }));
    },
    enabled: !!selectedGroupId,
  });

  // Realtime
  useEffect(() => {
    if (!selectedGroupId) return;
    const channel = supabase
      .channel(`class-chat-${selectedGroupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${selectedGroupId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['class-chat-messages', selectedGroupId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroupId, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async ({ content, attachmentUrl }: { content: string; attachmentUrl?: string }) => {
      if (!user?.id || !selectedGroupId) return;
      const { error } = await supabase.from('chat_messages').insert({
        group_id: selectedGroupId,
        sender_id: user.id,
        content: content || null,
        attachment_url: attachmentUrl || null,
        reply_to: replyTo?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ['class-chat-messages', selectedGroupId] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  const linkMessageToTicket = async (messageId: string, ticketId: string) => {
    await supabase.from('chat_messages').update({ linked_task_id: ticketId }).eq('id', messageId);
    queryClient.invalidateQueries({ queryKey: ['class-chat-messages', selectedGroupId] });
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (chatGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <MessageSquare className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No class chat available yet</p>
          <p className="text-xs text-muted-foreground mt-1">Chat groups are created when classes are set up</p>
        </CardContent>
      </Card>
    );
  }

  const activeGroup = chatGroups.find((g: any) => g.id === selectedGroupId);
  const msgMap = Object.fromEntries(messages.map((m: any) => [m.id, m]));

  return (
    <div className="space-y-3">
      {chatGroups.length > 1 && (
        <Select value={selectedGroupId || ''} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select class chat" />
          </SelectTrigger>
          <SelectContent>
            {chatGroups.map((g: any) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Card className="overflow-hidden" style={{ backgroundColor: palette.bg }}>
        <CardContent className="p-0 flex flex-col h-[520px]">
          {activeGroup && (
            <ChatHeader
              group={activeGroup}
              memberCount={members.length}
              onBack={() => {}}
              onViewMembers={() => setMembersOpen(true)}
              onAI={() => setAiOpen(true)}
              onAttach={() => {}}
            />
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg: any) => {
                const replyContent = msg.reply_to ? msgMap[msg.reply_to]?.content : undefined;
                return (
                  <ChatMessageBubble
                    key={msg.id}
                    msg={msg}
                    isMe={msg.sender_id === user?.id}
                    onConvertToTask={canCreateTask ? (m) => setTaskFromMsg(m) : undefined as any}
                    onReply={(m) => setReplyTo(m)}
                    onForward={(m) => setForwardMsg(m)}
                    replyToContent={replyContent}
                  />
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {(activeGroup?.channel_mode !== 'channel' || isGroupAdmin) ? (
            <ChatInput
              onSend={(content, attachmentUrl) => sendMessage.mutate({ content, attachmentUrl })}
              sending={sendMessage.isPending}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          ) : (
            <div className="p-3 text-center border-t">
              <p className="text-xs text-muted-foreground">📢 Channel — only admins can post</p>
            </div>
          )}
        </CardContent>
      </Card>

      <MembersPanel open={membersOpen} onOpenChange={setMembersOpen} groupId={selectedGroupId || ''} isAdmin={isGroupAdmin} />
      <AIAssistantDialog open={aiOpen} onOpenChange={setAiOpen} messages={messages} />
      {forwardMsg && (
        <ForwardMessageDialog
          open={!!forwardMsg}
          onOpenChange={(v) => { if (!v) setForwardMsg(null); }}
          message={forwardMsg}
          currentGroupName={activeGroup?.name}
        />
      )}
      {taskFromMsg && canCreateTask && (
        <CreateTicketDialog
          open={!!taskFromMsg}
          onOpenChange={(v) => { if (!v) setTaskFromMsg(null); }}
          defaultCategory="task"
          prefillSubject={(taskFromMsg.content || (taskFromMsg.attachment_url ? 'Voice / file from class chat' : 'Task from class chat')).slice(0, 100)}
          prefillDescription={[
            taskFromMsg.content || '',
            `\n\n— From class chat: ${activeGroup?.name || 'conversation'}`,
            taskFromMsg.senderName ? `\nSender: ${taskFromMsg.senderName}` : '',
            taskFromMsg.attachment_url ? `\nAttachment: ${taskFromMsg.attachment_url}` : '',
          ].join('').trim()}
          prefillAttachmentUrl={taskFromMsg.attachment_url || undefined}
          prefillAssigneeId={taskFromMsg.sender_id !== user?.id ? taskFromMsg.sender_id : undefined}
          sourceType="chat"
          sourceId={taskFromMsg.id}
          onLinkSource={(ticketId) => linkMessageToTicket(taskFromMsg.id, ticketId)}
        />
      )}
    </div>
  );
}

export function ClassChatTab(props: ClassChatTabProps) {
  return (
    <CommThemeProvider>
      <ClassChatTabInner {...props} />
    </CommThemeProvider>
  );
}
