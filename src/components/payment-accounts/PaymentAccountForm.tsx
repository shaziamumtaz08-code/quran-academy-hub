import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ACCOUNT_TYPE_LABELS, PaymentAccountType, ProfilePaymentAccount } from './types';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profileId: string;
  account?: ProfilePaymentAccount | null;
}

const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD'];

const FIELDS_BY_TYPE: Record<PaymentAccountType, { number?: 'account' | 'mobile' | 'email' | 'wallet'; bank?: boolean; iban?: boolean; swift?: boolean }> = {
  bank_local:         { number: 'account', bank: true, iban: true },
  bank_international: { number: 'account', bank: true, iban: true, swift: true },
  easypaisa:          { number: 'mobile' },
  jazzcash:           { number: 'mobile' },
  sadapay:            { number: 'mobile' },
  nayapay:            { number: 'mobile' },
  wise:               { number: 'email', iban: true },
  payoneer:           { number: 'email' },
  crypto:             { number: 'wallet' },
  other:              { number: 'account' },
};

export function PaymentAccountForm({ open, onOpenChange, profileId, account }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<ProfilePaymentAccount>>({
    account_type: 'bank_local',
    currency: 'PKR',
    is_primary: false,
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      setForm(account ? { ...account } : { account_type: 'bank_local', currency: 'PKR', is_primary: false, is_active: true });
    }
  }, [open, account]);

  const cfg = FIELDS_BY_TYPE[form.account_type as PaymentAccountType] || FIELDS_BY_TYPE.other;
  const numberLabel = cfg.number === 'mobile' ? 'Mobile Number' : cfg.number === 'email' ? 'Account Email' : cfg.number === 'wallet' ? 'Wallet Address' : 'Account Number';

  const save = useMutation({
    mutationFn: async () => {
      if (!form.account_title?.trim()) throw new Error('Account title is required');
      const payload: any = {
        profile_id: profileId,
        account_type: form.account_type,
        account_title: form.account_title.trim(),
        account_number: form.account_number || null,
        iban: form.iban || null,
        bank_name: form.bank_name || null,
        bank_branch: form.bank_branch || null,
        bank_swift: form.bank_swift || null,
        currency: form.currency || 'PKR',
        is_primary: !!form.is_primary,
        is_active: form.is_active !== false,
        notes: form.notes || null,
      };
      if (account?.id) {
        const { error } = await supabase.from('profile_payment_accounts').update(payload).eq('id', account.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('profile_payment_accounts').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: account ? 'Account updated' : 'Account added' });
      qc.invalidateQueries({ queryKey: ['payment-accounts', profileId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Payment Account' : 'Add Payment Account'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.account_type} onValueChange={(v) => setForm(p => ({ ...p, account_type: v as PaymentAccountType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm(p => ({ ...p, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Account Title <span className="text-destructive">*</span></Label>
            <Input value={form.account_title || ''} onChange={(e) => setForm(p => ({ ...p, account_title: e.target.value }))} placeholder="Name on account" />
          </div>

          <div className="space-y-1.5">
            <Label>{numberLabel}</Label>
            <Input value={form.account_number || ''} onChange={(e) => setForm(p => ({ ...p, account_number: e.target.value }))} placeholder={cfg.number === 'mobile' ? '03xx-xxxxxxx' : ''} />
          </div>

          {cfg.bank && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input value={form.bank_name || ''} onChange={(e) => setForm(p => ({ ...p, bank_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Input value={form.bank_branch || ''} onChange={(e) => setForm(p => ({ ...p, bank_branch: e.target.value }))} />
              </div>
            </div>
          )}

          {cfg.iban && (
            <div className="space-y-1.5">
              <Label>IBAN</Label>
              <Input value={form.iban || ''} onChange={(e) => setForm(p => ({ ...p, iban: e.target.value }))} placeholder="PKxx XXXX..." />
            </div>
          )}

          {cfg.swift && (
            <div className="space-y-1.5">
              <Label>SWIFT / BIC</Label>
              <Input value={form.bank_swift || ''} onChange={(e) => setForm(p => ({ ...p, bank_swift: e.target.value }))} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes || ''} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Set as primary for {form.currency}</p>
              <p className="text-xs text-muted-foreground">One primary account per currency.</p>
            </div>
            <Switch checked={!!form.is_primary} onCheckedChange={(v) => setForm(p => ({ ...p, is_primary: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
