import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertTriangle, CalendarCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { trackActivity } from '@/lib/activityLogger';
import { computeCloseOut, monthKeyOf } from '@/lib/billingCloseOut';

interface Props {
  plan: any | null;
  onOpenChange: (open: boolean) => void;
}

export default function CloseBillingPlanDialog({ plan, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const assignmentEnd: string | null =
    plan?.assignment?.effective_to_date || plan?.assignment?.status_effective_date || null;

  const [closeDate, setCloseDate] = useState<string>(
    (plan?.billing_close_date || assignmentEnd || new Date().toISOString().slice(0, 10)).slice(0, 10)
  );
  const [reason, setReason] = useState('');
  const [creditKind, setCreditKind] = useState<'credit' | 'refund'>('credit');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['close-out-invoices', plan?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_invoices')
        .select('id, billing_month, amount, amount_paid, status, voided_at')
        .eq('plan_id', plan!.id)
        .is('voided_at', null)
        .order('billing_month');
      if (error) throw error;
      return data || [];
    },
    enabled: !!plan?.id,
  });

  const preview = useMemo(() => {
    if (!plan) return null;
    const monthKey = monthKeyOf(closeDate);
    const finalInv = invoices.find((i: any) => i.billing_month === monthKey);
    const paidAfter = invoices
      .filter((i: any) => i.billing_month > monthKey)
      .reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0);
    const futureUnpaid = invoices.filter(
      (i: any) => i.billing_month > monthKey && Number(i.amount_paid || 0) === 0 && i.status === 'pending'
    );
    const result = computeCloseOut({
      monthlyFee: Number(plan.net_recurring_fee),
      effectiveFrom: (plan.effective_from || plan.created_at).slice(0, 10),
      closeDate,
      paidFinalMonth: Number(finalInv?.amount_paid || 0),
      paidAfterClose: paidAfter,
    });
    return { ...result, finalInv, futureUnpaid };
  }, [plan, closeDate, invoices]);

  const dateDiffers = !!assignmentEnd && assignmentEnd.slice(0, 10) !== closeDate;
  const reasonMissing = dateDiffers && reason.trim().length < 5;

  const closeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('close_billing_plan', {
        _plan_id: plan.id,
        _close_date: closeDate,
        _reason: reason.trim() || null,
        _credit_kind: creditKind,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['billing-plans-list'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-credits'] });
      trackActivity({
        action: 'billing_plan_closed',
        entityType: 'billing_plan',
        entityId: plan.id,
        details: { close_date: closeDate, reason, result: data },
      });
      toast({
        title: 'Billing closed',
        description: Number(data?.credit_amount || 0) > 0
          ? `A ${creditKind} of ${plan.currency} ${Number(data.credit_amount).toLocaleString()} is pending confirmation.`
          : 'Final month settled and future invoices cancelled.',
      });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: 'Could not close billing', description: e.message, variant: 'destructive' }),
  });

  if (!plan) return null;
  const cur = plan.currency || 'PKR';

  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" /> Review &amp; Close Billing
          </DialogTitle>
          <DialogDescription>
            {plan.profiles?.full_name || 'Student'} — closing billing stops future invoices. Paid invoices are never altered.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Assignment end date</div>
                <div className="font-medium">{assignmentEnd ? assignmentEnd.slice(0, 10) : 'Not set'}</div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="close-date" className="text-xs text-muted-foreground">Billing close date</Label>
                <Input id="close-date" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
              </div>
            </div>

            {dateDiffers && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                The billing close date differs from the assignment end date. A reason is required and will be recorded in the audit trail.
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="close-reason" className="text-xs text-muted-foreground">
                Reason {dateDiffers ? '(required)' : '(optional)'}
              </Label>
              <Textarea
                id="close-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Family requested billing to run to end of the paid week"
              />
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Final month ({preview?.monthKey})</span>
                <span className="font-medium">{preview?.activeDays} of {preview?.daysInMonth} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Final earned amount</span>
                <span className="font-mono font-semibold">{cur} {preview?.earned.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount paid</span>
                <span className="font-mono">{cur} {preview?.paid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credit / refund due</span>
                <span className={`font-mono font-semibold ${(preview?.creditDue || 0) > 0 ? 'text-amber-700' : ''}`}>
                  {cur} {preview?.creditDue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Future invoices to cancel</span>
                <span className="font-medium">{preview?.futureUnpaid.length || 0}</span>
              </div>
            </div>

            {(preview?.creditDue || 0) > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <Label className="text-xs text-muted-foreground">How should the overpayment be handled?</Label>
                <RadioGroup value={creditKind} onValueChange={(v) => setCreditKind(v as any)} className="gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="credit" id="kind-credit" />
                    Keep as credit against a future invoice
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="refund" id="kind-refund" />
                    Refund in cash (stays pending until confirmed with proof)
                  </label>
                </RadioGroup>
              </div>
            )}

            {(preview?.futureUnpaid.length || 0) > 0 && (
              <div className="flex flex-wrap gap-1">
                {preview!.futureUnpaid.map((i: any) => (
                  <Badge key={i.id} variant="outline" className="text-[10px]">{i.billing_month} · {cur} {Number(i.amount).toLocaleString()}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending || reasonMissing}>
            {closeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirm close-out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
