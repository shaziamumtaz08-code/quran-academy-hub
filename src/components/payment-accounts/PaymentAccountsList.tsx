import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Plus, Pencil, Star, Power, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ACCOUNT_TYPE_LABELS, maskAccountNumber, ProfilePaymentAccount } from './types';
import { AccountTypeBadge } from './AccountTypeBadge';
import { PaymentAccountForm } from './PaymentAccountForm';
import { PaymentAccountHistoryList } from './PaymentAccountHistoryList';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Props {
  profileId: string;
  readOnly?: boolean;
}

export function PaymentAccountsList({ profileId, readOnly }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProfilePaymentAccount | null>(null);
  const [deactivateAcc, setDeactivateAcc] = useState<ProfilePaymentAccount | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['payment-accounts', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_payment_accounts')
        .select('*')
        .eq('profile_id', profileId)
        .order('is_active', { ascending: false })
        .order('is_primary', { ascending: false })
        .order('created_at');
      if (error) throw error;
      return data as ProfilePaymentAccount[];
    },
  });

  const setPrimary = useMutation({
    mutationFn: async (acc: ProfilePaymentAccount) => {
      const { error } = await supabase.from('profile_payment_accounts').update({ is_primary: true }).eq('id', acc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Primary account updated' });
      qc.invalidateQueries({ queryKey: ['payment-accounts', profileId] });
    },
  });

  const deactivate = useMutation({
    mutationFn: async () => {
      if (!deactivateAcc) return;
      const { error } = await supabase
        .from('profile_payment_accounts')
        .update({ is_active: false, is_primary: false, notes: deactivateReason ? `[Deactivated: ${deactivateReason}] ${deactivateAcc.notes || ''}` : deactivateAcc.notes })
        .eq('id', deactivateAcc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Account deactivated' });
      qc.invalidateQueries({ queryKey: ['payment-accounts', profileId] });
      setDeactivateAcc(null);
      setDeactivateReason('');
    },
  });

  const activeAccounts = accounts?.filter(a => a.is_active) || [];
  const inactiveAccounts = accounts?.filter(a => !a.is_active) || [];

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <Tabs defaultValue="accounts" className="w-full">
      <div className="flex items-center justify-between mb-3">
        <TabsList>
          <TabsTrigger value="accounts">Accounts ({activeAccounts.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        {!readOnly && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Account
          </Button>
        )}
      </div>

      <TabsContent value="accounts" className="space-y-3">
        {activeAccounts.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">No payment accounts yet</p>
            <p className="text-xs text-muted-foreground">Add a bank, EasyPaisa, JazzCash, Wise or other account to receive payments.</p>
          </div>
        )}

        {activeAccounts.map(acc => (
          <Card key={acc.id} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <AccountTypeBadge type={acc.account_type} />
                  {acc.is_primary && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <Star className="h-3 w-3 fill-current" /> Primary
                    </span>
                  )}
                  <span className="text-xs font-mono text-muted-foreground">{acc.currency}</span>
                </div>
                <p className="font-medium text-sm mt-1.5">{acc.account_title}</p>
                <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                  {acc.account_number && <p>Account: <span className="font-mono">{maskAccountNumber(acc.account_number)}</span></p>}
                  {acc.iban && <p>IBAN: <span className="font-mono">{maskAccountNumber(acc.iban)}</span></p>}
                  {acc.bank_name && <p>{acc.bank_name}{acc.bank_branch ? ` — ${acc.bank_branch}` : ''}</p>}
                </div>
              </div>
              {!readOnly && (
                <div className="flex flex-col gap-1">
                  {!acc.is_primary && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPrimary.mutate(acc)}>
                      <Star className="h-3 w-3 mr-1" /> Set primary
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setEditing(acc); setDialogOpen(true); }}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setDeactivateAcc(acc)}>
                    <Power className="h-3 w-3 mr-1" /> Deactivate
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}

        {inactiveAccounts.length > 0 && (
          <div className="pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Inactive ({inactiveAccounts.length})</p>
            <div className="space-y-2">
              {inactiveAccounts.map(acc => (
                <div key={acc.id} className="rounded-md border bg-muted/30 px-3 py-2 text-xs flex items-center justify-between opacity-70">
                  <div className="flex items-center gap-2">
                    <AccountTypeBadge type={acc.account_type} />
                    <span>{acc.account_title}</span>
                    <span className="text-muted-foreground">· {acc.currency}</span>
                  </div>
                  <span className="text-muted-foreground">{ACCOUNT_TYPE_LABELS[acc.account_type]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="history">
        <PaymentAccountHistoryList profileId={profileId} />
      </TabsContent>

      <PaymentAccountForm open={dialogOpen} onOpenChange={setDialogOpen} profileId={profileId} account={editing} />

      <Dialog open={!!deactivateAcc} onOpenChange={(o) => !o && setDeactivateAcc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This account will be marked inactive but kept on file for historical reference. It will no longer appear on new invoices or payouts.
            </p>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Textarea rows={2} value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)} placeholder="e.g. Account closed, switched bank" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateAcc(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deactivate.mutate()} disabled={deactivate.isPending}>
              {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
