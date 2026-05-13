import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ACCOUNT_TYPE_LABELS, OrgPaymentAccount, PaymentAccountType, PaymentAccountPurpose, maskAccountNumber } from './types';
import { AccountTypeBadge } from './AccountTypeBadge';

const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD'];

const empty: Partial<OrgPaymentAccount> = {
  account_type: 'bank_local',
  purpose: 'inward',
  currency: 'PKR',
  is_active: true,
  sort_order: 0,
};

export function OrgPaymentAccountsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<OrgPaymentAccount> | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['org-payment-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_payment_accounts')
        .select('*')
        .order('purpose')
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return data as OrgPaymentAccount[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (!editing.display_label?.trim() || !editing.account_title?.trim()) throw new Error('Display label and account title are required');
      const payload: any = {
        account_type: editing.account_type,
        purpose: editing.purpose || 'inward',
        account_title: editing.account_title.trim(),
        account_number: editing.account_number || null,
        iban: editing.iban || null,
        bank_name: editing.bank_name || null,
        bank_branch: editing.bank_branch || null,
        bank_swift: editing.bank_swift || null,
        currency: editing.currency || 'PKR',
        display_label: editing.display_label.trim(),
        sort_order: editing.sort_order || 0,
        is_active: editing.is_active !== false,
        notes: editing.notes || null,
      };
      if (editing.id) {
        const { error } = await supabase.from('organization_payment_accounts').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('organization_payment_accounts').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Account saved' });
      qc.invalidateQueries({ queryKey: ['org-payment-accounts'] });
      setEditing(null);
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('organization_payment_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Account removed' });
      qc.invalidateQueries({ queryKey: ['org-payment-accounts'] });
    },
  });

  const move = useMutation({
    mutationFn: async ({ acc, dir }: { acc: OrgPaymentAccount; dir: -1 | 1 }) => {
      const { error } = await supabase.from('organization_payment_accounts')
        .update({ sort_order: (acc.sort_order || 0) + dir })
        .eq('id', acc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-payment-accounts'] }),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const inward = accounts?.filter(a => a.purpose === 'inward' || a.purpose === 'both') || [];
  const outward = accounts?.filter(a => a.purpose === 'outward' || a.purpose === 'both') || [];

  const renderSection = (title: string, desc: string, list: OrgPaymentAccount[], purpose: PaymentAccountPurpose) => (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription className="text-xs">{desc}</CardDescription>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing({ ...empty, purpose })}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No accounts configured yet.</p>
        )}
        {list.map(acc => (
          <div key={acc.id} className={`rounded-md border p-3 ${!acc.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{acc.display_label}</span>
                  <AccountTypeBadge type={acc.account_type} />
                  <span className="text-xs font-mono text-muted-foreground">{acc.currency}</span>
                  {!acc.is_active && <span className="text-xs text-destructive">Inactive</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{acc.account_title}</p>
                {acc.account_number && <p className="text-xs font-mono text-muted-foreground">{maskAccountNumber(acc.account_number)}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move.mutate({ acc, dir: -1 })}><ArrowUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move.mutate({ acc, dir: 1 })}><ArrowDown className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(acc)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('Remove this account?')) remove.mutate(acc.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {renderSection(
        'Student Fee Collection Accounts',
        'Accounts students will pay INTO. These appear on every invoice as payment instructions, in the order shown.',
        inward,
        'inward'
      )}
      {renderSection(
        'Outward Payroll Accounts',
        'Source accounts the academy uses to pay teachers and vendors.',
        outward,
        'outward'
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Display Label *</Label>
                <Input value={editing.display_label || ''} onChange={(e) => setEditing(p => ({ ...p!, display_label: e.target.value }))} placeholder="e.g. PKR — Bank Transfer (Meezan)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={editing.account_type} onValueChange={(v) => setEditing(p => ({ ...p!, account_type: v as PaymentAccountType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={editing.currency} onValueChange={(v) => setEditing(p => ({ ...p!, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Purpose</Label>
                <Select value={editing.purpose} onValueChange={(v) => setEditing(p => ({ ...p!, purpose: v as PaymentAccountPurpose }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inward">Inward (collect from students)</SelectItem>
                    <SelectItem value="outward">Outward (pay teachers/vendors)</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Account Title *</Label>
                <Input value={editing.account_title || ''} onChange={(e) => setEditing(p => ({ ...p!, account_title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Account Number</Label>
                <Input value={editing.account_number || ''} onChange={(e) => setEditing(p => ({ ...p!, account_number: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Bank Name</Label>
                  <Input value={editing.bank_name || ''} onChange={(e) => setEditing(p => ({ ...p!, bank_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Input value={editing.bank_branch || ''} onChange={(e) => setEditing(p => ({ ...p!, bank_branch: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>IBAN</Label>
                  <Input value={editing.iban || ''} onChange={(e) => setEditing(p => ({ ...p!, iban: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>SWIFT / BIC</Label>
                  <Input value={editing.bank_swift || ''} onChange={(e) => setEditing(p => ({ ...p!, bank_swift: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={editing.notes || ''} onChange={(e) => setEditing(p => ({ ...p!, notes: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">Inactive accounts won't appear on new invoices.</p>
                </div>
                <Switch checked={editing.is_active !== false} onCheckedChange={(v) => setEditing(p => ({ ...p!, is_active: v }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
