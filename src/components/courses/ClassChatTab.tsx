import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Send, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ClassChatTabProps {
  courseId: string;
  mode: 'student' | 'teacher';
}

export function ClassChatTab({ courseId, mode }: ClassChatTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat groups for this course
  const { data: chatGroups = [], isLoading } = useQuery({
    queryKey: ['class-chat-groups', courseId, user?.id, mode],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get groups user is a member of
      const { data: memberships } = await supabase
        .from('chat_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (!memberships?.length) return [];

      const groupIds = memberships.map(m => m.group_id);
      const { data: groups } = await supabase
        .from('chat_groups')
        .select('id, name, course_id, class_id, channel_mode')
        .eq('course_id', courseId)
        .in('id', groupIds)
        .not('class_id' as any, 'is', null);

      return groups || [];
    },
    enabled: !!courseId && !!user?.id,
  });

  // Auto-select first group
  useEffect(() => {
    if (chatGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(chatGroups[0].id);
    }
  }, [chatGroups, selectedGroupId]);

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ['class-chat-messages', selectedGroupId],
    queryFn: async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, content, sender_id, created_at')
        .eq('group_id', selectedGroupId!)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(100);
      return data || [];
    },
    enabled: !!selectedGroupId,
    refetchInterval: 5000,
  });

  // Fetch sender profiles
  const senderIds = [...new Set(messages.map(m => m.sender_id))];
  const { data: senderProfiles = [] } = useQuery({
    queryKey: ['chat-sender-profiles', senderIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
      return data || [];
    },
    enabled: senderIds.length > 0,
  });
  const profileMap = new Map(senderProfiles.map(p => [p.id, p.full_name]));

  // Send message
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!message.trim() || !selectedGroupId || !user?.id) return;
      const { error } = await supabase.from('chat_messages').insert({
        group_id: selectedGroupId,
        sender_id: user.id,
        content: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['class-chat-messages', selectedGroupId] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  return (
    <div className="space-y-3">
      {/* Class selector for teachers with multiple classes */}
      {mode === 'teacher' && chatGroups.length > 1 && (
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

      {/* Chat container */}
      <Card>
        <CardContent className="p-0">
          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === user?.id;
                const senderName = profileMap.get(msg.sender_id) || 'User';
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {!isMe && <p className="text-[10px] font-medium mb-0.5 opacity-70">{senderName}</p>}
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-[10px] mt-0.5 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t flex gap-2">
            <Input
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage.mutate()}
            />
            <Button size="icon" onClick={() => sendMessage.mutate()} disabled={!message.trim() || sendMessage.isPending}>
              {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
