import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Forward, Users, User, ClipboardList, Search } from 'lucide-react';

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  message: any;
  currentGroupName?: string;
}

export function ForwardMessageDialog({ open, onOpenChange, message, currentGroupName }: ForwardMessageDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('groups');

  // Fetch groups user belongs to
  const { data: groups = [] } = useQuery({
    queryKey: ['forward-groups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships } = await supabase.from('chat_members').select('group_id').eq('user_id', user.id);
      if (!memberships?.length) return [];
      const ids = memberships.map(m => m.group_id);
      const { data } = await supabase.from('chat_groups').select('*').in('id', ids).eq('is_active', true);
      return data || [];
    },
    enabled: !!user?.id && open,
  });

  // Fetch all users for DM forwarding
  const { data: users = [] } = useQuery({
    queryKey: ['forward-users'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').order('full_name').limit(200);
      return (data || []).filter((u: any) => u.id !== user?.id);
    },
    enabled: open,
  });

  // Forward to group
  const forwardToGroup = useMutation({
    mutationFn: async (groupId: string) => {
      if (!user?.id) return;
      const { error } = await supabase.from('chat_messages').insert({
        group_id: groupId,
        sender_id: user.id,
        content: message.content,
        attachment_url: message.attachment_url || null,
        is_forwarded: true,
        forwarded_from: message.senderName || 'Unknown',
        forwarded_source_group: currentGroupName || '',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Message forwarded' });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });

  // Forward to user as DM
  const forwardToUser = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id) return;
      // Find or create DM group
      const { data: existingDMs } = await supabase
        .from('chat_groups')
        .select('id')
        .eq('is_dm', true)
        .in('id', (await supabase.from('chat_members').select('group_id').eq('user_id', user.id)).data?.map(m => m.group_id) || []);

      let dmGroupId: string | null = null;

      if (existingDMs?.length) {
        for (const dm of existingDMs) {
          const { data: members } = await supabase.from('chat_members').select('user_id').eq('group_id', dm.id);
          const memberIds = (members || []).map(m => m.user_id);
          if (memberIds.includes(targetUserId) && memberIds.length === 2) {
            dmGroupId = dm.id;
            break;
          }
        }
      }

      if (!dmGroupId) {
        const targetProfile = users.find((u: any) => u.id === targetUserId);
        const { data: newGroup, error: gErr } = await supabase.from('chat_groups').insert({
          name: `DM`,
          type: 'custom',
          created_by: user.id,
          is_dm: true,
        }).select().single();
        if (gErr) throw gErr;
        dmGroupId = newGroup.id;
        await supabase.from('chat_members').insert([
          { group_id: dmGroupId, user_id: user.id, role: 'admin' },
          { group_id: dmGroupId, user_id: targetUserId, role: 'member' },
        ]);
      }

      const { error } = await supabase.from('chat_messages').insert({
        group_id: dmGroupId,
        sender_id: user.id,
        content: message.content,
        attachment_url: message.attachment_url || null,
        is_forwarded: true,
        forwarded_from: message.senderName || 'Unknown',
        forwarded_source_group: currentGroupName || '',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Message forwarded to user' });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['chat-groups'] });
    },
  });

  // Forward to WorkHub as task
  const forwardToWorkHub = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const title = (message.content || 'Forwarded message').slice(0, 100);
      const { error } = await supabase.from('tasks').insert({
        title,
        description: `[Forwarded from ${currentGroupName || 'chat'}]\n\nOriginal sender: ${message.senderName}\n\n${message.content || ''}`,
        created_by: user.id,
        assigned_to: user.id,
        priority: 'medium',
        status: 'open',
        source_type: 'chat',
        source_id: message.id,
      });
      if (error) throw error;
      // Mark message with linked task indicator
      await supabase.from('chat_messages').update({ linked_task_id: message.id }).eq('id', message.id);
    },
    onSuccess: () => {
      toast({ title: 'Task created in WorkHub' });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['workhub-tasks'] });
    },
  });

  const filteredGroups = groups.filter((g: any) => g.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = users.filter((u: any) => u.full_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Forward className="h-4 w-4" /> Forward Message
          </DialogTitle>
        </DialogHeader>

        {/* Message preview */}
        <div className="rounded-lg bg-muted/50 border px-3 py-2 text-xs text-muted-foreground line-clamp-3">
          <span className="font-bold text-foreground">{message?.senderName}:</span> {message?.content || '📎 Attachment'}
        </div>

        {/* WorkHub button */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-xs h-9"
          onClick={() => forwardToWorkHub.mutate()}
          disabled={forwardToWorkHub.isPending}
        >
          <ClipboardList className="h-4 w-4 text-primary" />
          Forward to WorkHub as Task
        </Button>

        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-8 h-8 text-xs"
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full h-8">
            <TabsTrigger value="groups" className="text-xs gap-1 flex-1">
              <Users className="h-3 w-3" /> Groups
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs gap-1 flex-1">
              <User className="h-3 w-3" /> Users
            </TabsTrigger>
          </TabsList>
          <TabsContent value="groups" className="max-h-48 overflow-y-auto mt-2 space-y-1">
            {filteredGroups.map((g: any) => (
              <button
                key={g.id}
                onClick={() => forwardToGroup.mutate(g.id)}
                disabled={forwardToGroup.isPending}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-secondary text-xs flex items-center gap-2"
              >
                <span>{g.is_dm ? '👤' : '👥'}</span>
                <span className="font-medium truncate">{g.name}</span>
                {g.is_dm && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">DM</Badge>}
              </button>
            ))}
            {filteredGroups.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">No groups found</p>}
          </TabsContent>
          <TabsContent value="users" className="max-h-48 overflow-y-auto mt-2 space-y-1">
            {filteredUsers.map((u: any) => (
              <button
                key={u.id}
                onClick={() => forwardToUser.mutate(u.id)}
                disabled={forwardToUser.isPending}
                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-secondary text-xs flex items-center gap-2"
              >
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{u.full_name}</span>
              </button>
            ))}
            {filteredUsers.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-4">No users found</p>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
