import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Copy, Loader2, Trash2, UserPlus } from 'lucide-react';

interface Props {
  quizBankId: string | null;
  quizName?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function QuizCollaboratorsDialog({ quizBankId, quizName, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'viewer' | 'editor'>('viewer');

  const { data: collaborators = [], isLoading } = useQuery({
    queryKey: ['quiz-collaborators', quizBankId],
    enabled: !!quizBankId && open,
    queryFn: async () => {
      const { data, error } = await (supabase.from('quiz_collaborators') as any)
        .select('*')
        .eq('quiz_bank_id', quizBankId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const userIds = (data || []).map((c: any) => c.user_id).filter(Boolean);
      let profiles: any[] = [];
      if (userIds.length) {
        const { data: p } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
        profiles = p || [];
      }
      return (data || []).map((c: any) => ({
        ...c,
        profile: profiles.find((p) => p.id === c.user_id) || null,
      }));
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const clean = email.trim().toLowerCase();
      if (!clean) throw new Error('Enter an email address');
      // Link to an existing user when one matches, otherwise keep it as an email invite.
      const { data: existing } = await supabase.from('profiles').select('id').ilike('email', clean).maybeSingle();
      const { data: me } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from('quiz_collaborators') as any)
        .insert({
          quiz_bank_id: quizBankId,
          user_id: existing?.id ?? null,
          invite_email: clean,
          permission,
          invited_by: me.user?.id ?? null,
        })
        .select('invite_token')
        .single();
      if (error) throw error;
      return data.invite_token as string;
    },
    onSuccess: (token) => {
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['quiz-collaborators', quizBankId] });
      const link = `${window.location.origin}/quiz-invite/${token}`;
      navigator.clipboard?.writeText(link).catch(() => {});
      toast({ title: 'Invite created', description: 'Invite link copied to clipboard.' });
    },
    onError: (e: any) => toast({ title: 'Could not invite', description: e.message, variant: 'destructive' }),
  });

  const updatePermission = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await (supabase.from('quiz_collaborators') as any).update({ permission: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-collaborators', quizBankId] }),
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('quiz_collaborators') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-collaborators', quizBankId] }),
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const copyLink = (token: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/quiz-invite/${token}`);
    toast({ title: 'Invite link copied' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{quizName || 'Quiz'}”</DialogTitle>
          <DialogDescription>
            Invite people to view or edit this quiz. Anyone without an account gets an invite link they can accept after signing in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Invite by email</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Select value={permission} onValueChange={(v) => setPermission(v as 'viewer' | 'editor')}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => invite.mutate()} disabled={invite.isPending}>
              {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : collaborators.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No collaborators yet.</p>
          ) : (
            collaborators.map((c: any) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{c.profile?.full_name || c.invite_email || 'Invited user'}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.profile?.email || c.invite_email}</p>
                </div>
                <Badge variant={c.accepted_at ? 'default' : 'secondary'} className="text-xs">
                  {c.accepted_at ? 'Active' : 'Pending'}
                </Badge>
                <Select value={c.permission} onValueChange={(v) => updatePermission.mutate({ id: c.id, value: v })}>
                  <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => copyLink(c.invite_token)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => remove.mutate(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
