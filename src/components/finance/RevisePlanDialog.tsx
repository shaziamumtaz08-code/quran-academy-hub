import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Sparkles, History } from 'lucide-react';
import { format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RevisePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: {
    id: string;
    student_id: string;
    base_package_id: string | null;
    session_duration: number;
    flat_discount: number;
    duration_surcharge: number;
    net_recurring_fee: number;
    currency: string;
    assignment_id?: string | null;
    branch_id?: string | null;
    division_id?: string | null;
    global_discount_id?: string | null;
    profiles?: { full_name: string } | null;
  };
}

export default function RevisePlanDialog({ open, onOpenChange, plan }: RevisePlanDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [effectiveFrom, setEffectiveFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newFee, setNewFee] = useState<string>(String(plan.net_recurring_fee));
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setEffectiveFrom(format(new Date(), 'yyyy-MM-dd'));
      setNewFee(String(plan.net_recurring_fee));
      setReason('');
    }
  }, [open, plan.net_recurring_fee]);

  // Preview impact
  const { data: preview } = useQuery({
    queryKey: ['preview-plan-revision', plan.student_id, effectiveFrom],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('preview_plan_revision', {
        _student_id: plan.student_id,
        _effective_from: effectiveFrom,
      });
      if (error) throw error;
      return data as { affected_month_invoice: any; future_pending_count: number };
    },
    enabled: open && !!effectiveFrom,
  });

  const isMidMonth = effectiveFrom && new Date(effectiveFrom + 'T00:00:00').getDate() !== 1;
  const feeChanged = Number(newFee) !== Number(plan.net_recurring_fee);

  const reviseMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc('revise_billing_plan', {
        _student_id: plan.student_id,
        _base_package_id: plan.base_package_id,
        _session_duration: plan.session_duration,
        _flat_discount: plan.flat_discount,
        _global_discount_id: plan.global_discount_id ?? null,
        _net_recurring_fee: Number(newFee),
        _currency: plan.currency,
        _effective_from: effectiveFrom,
        _change_reason: reason.trim(),
        _assignment_id: plan.assignment_id ?? null,
        _branch_id: plan.branch_id ?? null,
        _division_id: plan.division_id ?? null,
        _duration_surcharge: plan.duration_surcharge,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Plan revised',
        description: `New plan effective ${effectiveFrom}. ${data?.future_invoices_revised ?? 0} future invoice(s) reissued.`,
      });
      qc.invalidateQueries({ queryKey: ['billing-plans-list'] });
      qc.invalidateQueries({ queryKey: ['fee-invoices'] });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: 'Could not revise plan', description: e.message, variant: 'destructive' }),
  });

  const existingInvoice = preview?.affected_month_invoice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Revise Billing Plan
          </DialogTitle>
          <DialogDescription>
            {plan.profiles?.full_name && <span className="font-medium">{plan.profiles.full_name} — </span>}
            Inserts a new plan row. Old plan & invoices are archived for audit; paid invoices are never changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Current rate</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
                {Number(plan.net_recurring_fee).toLocaleString()} {plan.currency}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="newFee">New rate</Label>
              <Input
                id="newFee"
                type="number"
                step="0.01"
                value={newFee}
                onChange={(e) => setNewFee(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="effectiveFrom">Effective from</Label>
            <Input
              id="effectiveFrom"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
            {isMidMonth && (
              <p className="text-xs text-muted-foreground">
                Mid-month change — this month's invoice will be split:{' '}
                <span className="font-medium">old rate</span> before {effectiveFrom},{' '}
                <span className="font-medium">new rate</span> from {effectiveFrom}. Due date = {effectiveFrom}.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="reason">Reason for this revision <span className="text-destructive">*</span></Label>
            <p className="text-xs text-muted-foreground">Required — stored in the billing audit trail (min 4 characters).</p>
            <Textarea
              id="reason"
              placeholder="e.g. Promotion applied, duration changed, discount agreed…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Preview impact */}
          <Alert>
            <History className="h-4 w-4" />
            <AlertDescription className="space-y-1 text-xs">
              {existingInvoice ? (
                existingInvoice.status === 'paid' ? (
                  <div>
                    <Badge variant="secondary" className="mr-2">Paid</Badge>
                    This month's invoice is already paid — it will <strong>not</strong> change. The revision applies from the next billing cycle.
                  </div>
                ) : (
                  <div>
                    <Badge variant="outline" className="mr-2">{existingInvoice.status}</Badge>
                    This month's invoice will be archived and replaced with a Revised one.
                  </div>
                )
              ) : (
                <div>No invoice yet for the affected month — a new one will be created.</div>
              )}
              <div>
                Future pending invoices to be reissued:{' '}
                <strong>{preview?.future_pending_count ?? 0}</strong>
              </div>
            </AlertDescription>
          </Alert>

          {!feeChanged && (
            <Alert variant="default" className="border-amber-500/40">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                New rate is the same as the current rate — confirm this is intentional (e.g. effective-date correction).
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => reviseMutation.mutate()} disabled={reviseMutation.isPending || !newFee}>
            {reviseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm revision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
