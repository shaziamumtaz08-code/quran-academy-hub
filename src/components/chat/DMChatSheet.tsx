import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface DMChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string | null;
  recipientName: string;
}

export function DMChatSheet({ open, onOpenChange, groupId, recipientName }: DMChatSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['dm-sheet-messages', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data } = await supabase
        .from('chat_messages')
        .select('id, content, sender_id, created_at')
        .eq('group_id', groupId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(100);
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      if (!senderIds.length) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      return (data || []).map(m => ({ ...m, senderName: nameMap[m.sender_id] || 'User' }));
    },
    enabled: !!groupId && open,
    refetchInterval: open ? 5000 : false,
  });

  // Realtime
  useEffect(() => {
    if (!groupId || !open) return;
    const channel = supabase
      .channel(`dm-sheet-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['dm-sheet-messages', groupId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, open, queryClient]);

  // Auto-scroll
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!message.trim() || !groupId || !user?.id) return;
      const { error } = await supabase.from('chat_messages').insert({
        group_id: groupId,
        sender_id: user.id,
        content: message.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['dm-sheet-messages', groupId] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[400px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {recipientName.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{recipientName}</p>
              <p className="text-[10px] text-muted-foreground font-normal">Direct Message</p>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-1">
                <User className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No messages yet. Say hello!</p>
              </div>
            </div>
          ) : (
            messages.map((msg: any) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {!isMe && <p className="text-[10px] font-medium mb-0.5 opacity-70">{msg.senderName}</p>}
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
      </SheetContent>
    </Sheet>
  );
}
