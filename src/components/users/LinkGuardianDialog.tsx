import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Copy, UserPlus, Search, Link2, Mail } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
}

const RELATIONSHIPS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Uncle', 'Aunt', 'Sibling', 'Other'];
const LOGIN_URL = 'lms.alqurantimeacademy.com';

interface SuccessInfo {
  parentId: string;
  email: string;
  fullName: string;
  tempPassword?: string;
  linkedExisting: boolean;
  inviteSent: boolean;
}

/**
 * Generates a strong, unique password that will not be flagged by Supabase's
 * breach-detection check (HIBP). Format example: "a3f9b2c1Aqt#5847".
 */
function generateTempPassword(): string {
  const random8 = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const tail4 = Date.now().toString().slice(-4);
  return `${random8}Aqt#${tail4}`;
}

export function LinkGuardianDialog({ open, onOpenChange, studentId, studentName }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [relationship, setRelationship] = useState('Mother');
  const [existingMatch, setExistingMatch] = useState<{ id: string; full_name: string; email: string } | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  const reset = () => {
    setFullName('');
    setEmail('');
    setWhatsapp('');
    setRelationship('Mother');
    setExistingMatch(null);
    setSuccess(null);
  };

  const checkExistingMutation = useMutation({
    mutationFn: async (searchEmail: string) => {
      const e = searchEmail.toLowerCase().trim();
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', e)
        .limit(1);
      return (data && data[0]) || null;
    },
  });

  const onCheckEmail = async () => {
    if (!email) return;
    const match = await checkExistingMutation.mutateAsync(email);
    setExistingMatch(match);
    if (match) {
      toast({ title: 'Existing profile found', description: `${match.full_name} — will be linked instead of creating a new account.` });
    } else {
      toast({ title: 'No existing user', description: 'A new guardian account will be created.' });
    }
  };

  /**
   * Best-effort invite: tries the transactional email function if it exists.
   * Returns true on success, false otherwise — never throws.
   */
  const sendInviteEmail = async (
    recipientEmail: string,
    recipientName: string,
    tempPassword: string,
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'guardian-account-invite',
          recipientEmail,
          idempotencyKey: `guardian-invite-${recipientEmail}-${Date.now()}`,
          templateData: {
            name: recipientName,
            email: recipientEmail,
            tempPassword,
            loginUrl: LOGIN_URL,
          },
          // Inline fallback fields some sender implementations accept:
          subject: 'Your AQT Academy Account',
          body:
            `Login at ${LOGIN_URL}\n` +
            `Email: ${recipientEmail}\n` +
            `Temp password: ${tempPassword}\n` +
            `Please change password on first login.`,
        },
      });
      if (error) {
        console.warn('[guardian-invite] send-transactional-email failed:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[guardian-invite] send-transactional-email threw:', e);
      return false;
    }
  };

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!fullName.trim() || !email.trim() || !whatsapp.trim()) {
        throw new Error('Full name, email and WhatsApp are required.');
      }
      const cleanEmail = email.toLowerCase().trim();
      const tempPassword = generateTempPassword();

      // 1) If a profile with this email exists, link it instead of creating
      const { data: existing } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', cleanEmail)
        .limit(1);

      let parentId: string | null = null;
      let linkedExisting = false;
      let returnedTempPassword: string | undefined;

      if (existing && existing[0]) {
        parentId = existing[0].id;
        linkedExisting = true;

        // Ensure the existing profile has the parent role
        await supabase.from('user_roles').upsert(
          { user_id: parentId, role: 'parent' as any },
          { onConflict: 'user_id,role' as any },
        );
      } else {
        // 2) Create a new guardian account via the secure admin edge function.
        //    Surface the EXACT Supabase error if anything goes wrong.
        let createResp: { data: any; error: any };
        try {
          createResp = await supabase.functions.invoke('admin-create-user', {
            body: {
              email: cleanEmail,
              full_name: fullName.trim(),
              fullName: fullName.trim(), // legacy alias
              role: 'parent',
              password: tempPassword,
              phone: whatsapp.trim(),
              whatsapp: whatsapp.trim(),
              country: 'Pakistan',
              send_invite: true,
            },
          });
        } catch (invokeErr: any) {
          throw new Error(
            invokeErr?.message ||
              'Edge function admin-create-user could not be reached. Check your network and try again.',
          );
        }

        const { data, error } = createResp;
        if (error) {
          // Try to read the JSON error body the edge function returned
          let serverMessage: string | undefined;
          try {
            const ctx: any = (error as any).context;
            if (ctx?.body) {
              const text = typeof ctx.body === 'string' ? ctx.body : await ctx.text?.();
              if (text) {
                try {
                  const parsed = JSON.parse(text);
                  serverMessage = parsed?.error || parsed?.message;
                } catch {
                  serverMessage = text;
                }
              }
            }
          } catch {
            /* ignore */
          }
          throw new Error(serverMessage || error.message || 'Failed to create guardian account');
        }
        if ((data as any)?.error) throw new Error((data as any).error);
        parentId = (data as any)?.userId;
        returnedTempPassword = (data as any)?.tempPassword || tempPassword;
        if (!parentId) throw new Error('Guardian account created but no ID returned');

        // Make sure WhatsApp is stored on the profile (edge fn does not always set it)
        await supabase.from('profiles').update({ whatsapp_number: whatsapp.trim() }).eq('id', parentId);
      }

      // 3) Link student → guardian (idempotent)
      const { data: existingLink } = await supabase
        .from('student_parent_links')
        .select('id')
        .eq('student_id', studentId)
        .eq('parent_id', parentId!)
        .maybeSingle();

      if (existingLink) {
        const { error: updErr } = await supabase
          .from('student_parent_links')
          .update({ relationship } as any)
          .eq('id', existingLink.id);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { error: linkErr } = await supabase
          .from('student_parent_links')
          .insert({ student_id: studentId, parent_id: parentId!, relationship } as any);
        if (linkErr) throw new Error(linkErr.message);
      }

      // 4) Mark the student profile as having a parent guardian
      await supabase.from('profiles').update({ guardian_type: 'parent' as any }).eq('id', studentId);

      // 5) Best-effort invite email (only when a new account was created)
      let inviteSent = false;
      if (!linkedExisting) {
        inviteSent = await sendInviteEmail(cleanEmail, fullName.trim(), returnedTempPassword || tempPassword);
      }

      return {
        parentId: parentId!,
        email: cleanEmail,
        fullName: fullName.trim(),
        tempPassword: linkedExisting ? undefined : returnedTempPassword,
        linkedExisting,
        inviteSent,
      } as SuccessInfo;
    },
    onSuccess: (info) => {
      setSuccess(info);
      toast({
        title: info.linkedExisting ? 'Guardian linked' : 'Guardian created and linked',
        description: !info.linkedExisting && !info.inviteSent
          ? 'Account is ready. Email delivery is not configured — share the temp credentials manually.'
          : undefined,
      });
      qc.invalidateQueries({ queryKey: ['holistic-parent', studentId] });
      qc.invalidateQueries({ queryKey: ['holistic-profile', studentId] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
    onError: (e: any) => {
      console.error('[LinkGuardianDialog] mutation failed:', e);
      toast({
        title: 'Failed to create guardian account',
        description: e?.message || 'Unknown error from server.',
        variant: 'destructive',
      });
    },
  });

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied' });
  };

  const copyCredentials = () => {
    if (!success) return;
    const text =
      `Login at ${LOGIN_URL}\n` +
      `Email: ${success.email}\n` +
      (success.tempPassword ? `Temp password: ${success.tempPassword}\n` : '') +
      `Please change password on first login.`;
    navigator.clipboard.writeText(text);
    toast({ title: 'Credentials copied' });
  };

  const openMailto = () => {
    if (!success || !success.tempPassword) return;
    const subject = encodeURIComponent('Your AQT Academy Account');
    const body = encodeURIComponent(
      `Login at ${LOGIN_URL}\n` +
        `Email: ${success.email}\n` +
        `Temp password: ${success.tempPassword}\n` +
        `Please change password on first login.`,
    );
    window.open(`mailto:${success.email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Create / Link Guardian
          </DialogTitle>
          <DialogDescription>
            Add a guardian account for <span className="font-medium">{studentName}</span>. If the email already exists,
            we'll link that profile instead of creating a duplicate.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">
                  {success.linkedExisting ? 'Existing guardian linked' : 'Guardian account created'}
                </p>
                <Badge className="ml-auto bg-emerald-600 hover:bg-emerald-600 text-white">Guardian Linked</Badge>
              </div>
              <p className="text-sm">
                <span className="font-medium">{success.fullName}</span> is now linked as guardian for {studentName}.
              </p>
              {!success.linkedExisting && (
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  {success.inviteSent
                    ? 'An invite email has been queued for delivery.'
                    : 'Email delivery is not configured — use the buttons below to share credentials.'}
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{success.email}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(success.email)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {success.tempPassword && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Temp password</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{success.tempPassword}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(success.tempPassword!)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              {success.tempPassword && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={copyCredentials} className="gap-1">
                    <Copy className="h-3.5 w-3.5" /> Copy credentials
                  </Button>
                  <Button size="sm" variant="outline" onClick={openMailto} className="gap-1">
                    <Mail className="h-3.5 w-3.5" /> Email guardian
                  </Button>
                </div>
              )}
              {success.tempPassword && (
                <p className="text-xs text-muted-foreground pt-1">
                  Share these credentials with the guardian. They will be asked to change the password on first login.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Guardian Full Name *</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Mother / Father full name" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Guardian Email *</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setExistingMatch(null);
                  }}
                  placeholder="guardian@example.com"
                />
                <Button type="button" variant="outline" size="icon" onClick={onCheckEmail} disabled={!email}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              {existingMatch && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1 pt-1">
                  <Link2 className="h-3.5 w-3.5" /> Will link existing profile: {existingMatch.full_name}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Guardian WhatsApp *</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+92 300 0000000" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Relationship to student *</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {!existingMatch && email && (
              <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                A strong unique temp password will be generated automatically and shown after creation.
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={linkMutation.isPending}>Cancel</Button>
              <Button onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending} className="gap-2">
                {linkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {existingMatch ? 'Link Existing Guardian' : 'Create Guardian Account'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
