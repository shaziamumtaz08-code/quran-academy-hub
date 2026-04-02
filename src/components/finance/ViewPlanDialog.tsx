import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PlanHistorySection } from './PlanHistorySection';
import { format } from 'date-fns';

interface ViewPlanDialogProps {
  plan: any | null;
  onClose: () => void;
}

export function ViewPlanDialog({ plan, onClose }: ViewPlanDialogProps) {
  if (!plan) return null;

  const fields = [
    { label: 'Student', value: plan.profiles?.full_name || '—' },
    { label: 'Package', value: plan.fee_packages?.name || '—' },
    { label: 'Session Duration', value: `${plan.session_duration} min` },
    { label: 'Net Recurring Fee', value: `${plan.currency} ${Number(plan.net_recurring_fee).toLocaleString()}` },
    { label: 'Flat Discount', value: Number(plan.flat_discount) > 0 ? `${plan.currency} ${Number(plan.flat_discount).toLocaleString()}` : '—' },
    { label: 'Duration Surcharge', value: Number(plan.duration_surcharge) > 0 ? `${plan.currency} ${Number(plan.duration_surcharge).toLocaleString()}` : '—' },
    { label: 'Status', value: plan.is_active ? 'Active' : 'Inactive' },
    { label: 'Created', value: format(new Date(plan.created_at), 'dd MMM yyyy') },
  ];

  return (
    <Dialog open={!!plan} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Billing Plan Details
            <Badge variant={plan.is_active ? 'default' : 'secondary'} className="text-[10px]">
              {plan.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </DialogTitle>
          <DialogDescription>Read-only view of this billing plan and its change history.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {fields.map(f => (
            <div key={f.label} className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="font-medium text-foreground">{f.value}</span>
            </div>
          ))}
        </div>
        <Separator />
        <PlanHistorySection planId={plan.id} />
      </DialogContent>
    </Dialog>
  );
}
