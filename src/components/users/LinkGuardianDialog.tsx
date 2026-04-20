import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, UserPlus, Search, Link2, Users } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
}

const RELATIONSHIPS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Uncle', 'Aunt', 'Sibling', 'Other'];

interface MatchedProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp_number: string | null;
}

interface SuccessInfo {
  parentId: string;
  fullName: string;
  email: string | null;
  linkedExisting: boolean;
}

export function LinkGuardianDialog({ open, onOpenChange, studentId, studentName }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Search step
  const [searchTerm, setSearchTerm] = useState('');

  // Create-new-profile fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [country, setCountry] = useState('Pakistan');
  const [relationship, setRelationship] = useState('Mother');

  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  const reset = () => {
    setSearchTerm('');
    setFullName('');
    setEmail('');
    setWhatsapp('');
    setCountry('Pakistan');
    setRelationship('Mother');
    setSuccess(null);
  };

  // ---- SEARCH existing profiles ----
  const { data: matches = [], isFetching: searching } = useQuery({
    queryKey: ['guardian-search', searchTerm],
    enabled: open && searchTerm.trim().length >= 2,
    queryFn: async () => {
      const term = searchTerm.trim();
      const like = `%${term}%`;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, whatsapp_number')
        .or(`full_name.ilike.${like},email.ilike.${like},whatsapp_number.ilike.${like}`)
        .neq('id', studentId)
        .limit(8);
      if (error) throw error;
      return (data || []) as MatchedProfile[];
    },
  });

  // ---- LINK existing profile ----
  const linkExistingMutation = useMutation({
    mutationFn: async (profile: MatchedProfile) => {
      // Ensure parent role
      await supabase
        .from('user_roles')
        .upsert({ user_id: profile.id, role: 'parent' as any }, { onConflict: 'user_id,role' as any });

      // Idempotent link
      const { data: existingLink } = await supabase
        .from('student_parent_links')
        .select('id')
        .eq('student_id', studentId)
        .eq('parent_id', profile.id)
        .maybeSingle();

      if (existingLink) {
        const { error } = await supabase
          .from('student_parent_links')
          .update({ relationship } as any)
          .eq('id', existingLink.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('student_parent_links')
          .insert({ student_id: studentId, parent_id: profile.id, relationship } as any);
        if (error) throw new Error(error.message);
      }

      await supabase.from('profiles').update({ guardian_type: 'parent' as any }).eq('id', studentId);

      return {
        parentId: profile.id,
        fullName: profile.full_name || 'Guardian',
        email: profile.email,
        linkedExisting: true,
      } as SuccessInfo;
    },
    onSuccess: (info) => {
      setSuccess(info);
      toast({ title: 'Guardian linked', description: `${info.fullName} is now linked to ${studentName}.` });
      qc.invalidateQueries({ queryKey: ['holistic-parent', studentId] });
      qc.invalidateQueries({ queryKey: ['holistic-profile', studentId] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
    onError: (e: any) => {
      toast({ title: 'Failed to link guardian', description: e?.message || 'Unknown error', variant: 'destructive' });
    },
  });

  // ---- CREATE NEW profile (no auth) + LINK ----
  const createAndLinkMutation = useMutation({
    mutationFn: async () => {
      if (!fullName.trim()) throw new Error('Full name is required.');
      if (!email.trim() && !whatsapp.trim()) throw new Error('Provide at least an email or WhatsApp number.');

      const cleanEmail = email.trim() ? email.toLowerCase().trim() : null;
      const cleanPhone = whatsapp.trim() || null;

      // Dedupe by email or phone
      let parentId: string | null = null;
      if (cleanEmail) {
        const { data } = await supabase.from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
        if (data) parentId = data.id;
      }
      if (!parentId && cleanPhone) {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('whatsapp_number', cleanPhone)
          .maybeSingle();
        if (data) parentId = data.id;
      }

      // Create plain profile (no auth) if no match
      if (!parentId) {
        const { data: created, error: createErr } = await supabase
          .from('profiles')
          .insert({
            full_name: fullName.trim(),
            email: cleanEmail,
            whatsapp_number: cleanPhone,
            country,
          } as any)
          .select('id')
          .single();
        if (createErr) throw new Error(createErr.message);
        parentId = created.id;
      } else {
        // Update with provided info if missing
        await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            ...(cleanPhone ? { whatsapp_number: cleanPhone } : {}),
            ...(country ? { country } : {}),
          } as any)
          .eq('id', parentId);
      }

      // Assign parent role
      await supabase
        .from('user_roles')
        .upsert({ user_id: parentId!, role: 'parent' as any }, { onConflict: 'user_id,role' as any });

      // Link (idempotent)
      const { data: existingLink } = await supabase
        .from('student_parent_links')
        .select('id')
        .eq('student_id', studentId)
        .eq('parent_id', parentId!)
        .maybeSingle();

      if (existingLink) {
        const { error } = await supabase
          .from('student_parent_links')
          .update({ relationship } as any)
          .eq('id', existingLink.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('student_parent_links')
          .insert({ student_id: studentId, parent_id: parentId!, relationship } as any);
        if (error) throw new Error(error.message);
      }

      await supabase.from('profiles').update({ guardian_type: 'parent' as any }).eq('id', studentId);

      return {
        parentId: parentId!,
        fullName: fullName.trim(),
        email: cleanEmail,
        linkedExisting: false,
      } as SuccessInfo;
    },
    onSuccess: (info) => {
      setSuccess(info);
      toast({
        title: 'Guardian profile created and linked',
        description: 'Activate login from the Parents page when ready.',
      });
      qc.invalidateQueries({ queryKey: ['holistic-parent', studentId] });
      qc.invalidateQueries({ queryKey: ['holistic-profile', studentId] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
    onError: (e: any) => {
      toast({ title: 'Failed to create guardian', description: e?.message || 'Unknown error', variant: 'destructive' });
    },
  });

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const busy = linkExistingMutation.isPending || createAndLinkMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Link Guardian
          </DialogTitle>
          <DialogDescription>
            Find an existing user or create a new guardian profile for{' '}
            <span className="font-medium">{studentName}</span>. Login can be activated later from the
            Parents page.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">
                  {success.linkedExisting ? 'Existing guardian linked' : 'Guardian profile created and linked'}
                </p>
                <Badge className="ml-auto bg-emerald-600 hover:bg-emerald-600 text-white">Linked</Badge>
              </div>
              <p className="text-sm">
                <span className="font-medium">{success.fullName}</span> is now a guardian of {studentName}.
              </p>
              {!success.linkedExisting && (
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  No login was created. Go to <span className="font-medium">Parents &amp; Guardians</span> page
                  → find this guardian → click <span className="font-medium">Activate Login</span> when ready.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            {/* SEARCH EXISTING */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" /> Search existing user (name, email, phone)
              </Label>
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type at least 2 characters…"
              />

              {searchTerm.trim().length >= 2 && (
                <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
                  {searching ? (
                    <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                    </div>
                  ) : matches.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground">
                      No matches. Create a new guardian profile below.
                    </div>
                  ) : (
                    matches.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 p-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{m.full_name || '(No name)'}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {m.email || '—'} · {m.whatsapp_number || '—'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 shrink-0"
                          disabled={busy}
                          onClick={() => linkExistingMutation.mutate(m)}
                        >
                          <Link2 className="h-3.5 w-3.5" /> Link
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* RELATIONSHIP (applies to both flows) */}
            <div className="space-y-1">
              <Label className="text-xs">Relationship to {studentName} *</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* CREATE NEW */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" /> Or create a new guardian profile
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Full Name *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Guardian full name" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guardian@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">WhatsApp</Label>
                  <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+92 300 0000000" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Country</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Pakistan" />
              </div>

              <p className="text-xs text-muted-foreground">
                Provide at least an email or WhatsApp number. No login is created at this step — activate it
                later from the <span className="font-medium">Parents &amp; Guardians</span> page.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              <Button
                onClick={() => createAndLinkMutation.mutate()}
                disabled={busy || !fullName.trim() || (!email.trim() && !whatsapp.trim())}
                className="gap-2"
              >
                {createAndLinkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create &amp; Link Guardian
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
