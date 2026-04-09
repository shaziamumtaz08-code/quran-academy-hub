import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { UserPlus, UserMinus, Search } from 'lucide-react';

interface MembersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  isAdmin: boolean;
}

export function MembersPanel({ open, onOpenChange, groupId, isAdmin }: MembersPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [addMode, setAddMode] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['chat-members', groupId],
    queryFn: async () => {
      const { data: mems } = await supabase.from('chat_members').select('*').eq('group_id', groupId);
      if (!mems?.length) return [];
      const ids = mems.map(m => m.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
      return mems.map(m => ({ ...m, full_name: nameMap[m.user_id] || 'Unknown' }));
    },
    enabled: open && !!groupId,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['member-search', search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const memberIds = members.map((m: any) => m.user_id);
      const { data } = await supabase.from('profiles').select('id, full_name').is('archived_at', null).ilike('full_name', `%${search}%`).limit(10);
      return (data || []).filter(p => !memberIds.includes(p.id));
    },
    enabled: addMode && search.length >= 2,
  });

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('chat_members').insert({ group_id: groupId, user_id: userId, role: 'member' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-members', groupId] });
      toast({ title: 'Member added' });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('chat_members').delete().eq('group_id', groupId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-members', groupId] });
      toast({ title: 'Member removed' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Group Members ({members.length})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isAdmin && (
            <Button size="sm" variant="outline" className="w-full text-xs gap-1.5" onClick={() => setAddMode(!addMode)}>
              <UserPlus className="h-3.5 w-3.5" /> {addMode ? 'Done' : 'Add Members'}
            </Button>
          )}
          {addMode && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="text-xs h-8 pl-8" />
              </div>
              {searchResults.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6"><AvatarFallback className="text-[9px]">{(p.full_name || '?').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    <span className="text-xs">{p.full_name}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => addMember.mutate(p.id)}>Add</Button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {members.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between py-1.5 px-1">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                      {(m.full_name || '?').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-medium">{m.full_name}</p>
                    <Badge variant="secondary" className="text-[8px]">{m.role}</Badge>
                  </div>
                </div>
                {isAdmin && m.user_id !== user?.id && (
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => removeMember.mutate(m.user_id)}>
                    <UserMinus className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
