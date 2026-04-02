import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

function formatMonth(m: string) {
  const [y, mo] = m.split('-');
  return `${MONTH_LABELS[mo] || mo} ${y}`;
}

export function PlanHistorySection({ planId }: { planId: string }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['billing-plan-history', planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_plan_history')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!planId,
  });

  if (isLoading) return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (history.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <History className="h-3.5 w-3.5" /> Change History
      </div>
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {history.map((h: any) => {
          const prev = h.previous_values as any || {};
          const next = h.new_values as any || {};
          return (
            <div key={h.id} className="bg-muted/40 rounded-lg p-2.5 border border-border text-xs space-y-1">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px]">Effective: {formatMonth(h.effective_from)}</Badge>
                <span className="text-muted-foreground">{format(new Date(h.created_at), 'dd MMM yyyy, HH:mm')}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                {prev.net_recurring_fee !== next.net_recurring_fee && (
                  <>
                    <span>Fee: <span className="line-through text-destructive">{Number(prev.net_recurring_fee || 0).toLocaleString()}</span></span>
                    <span>→ <span className="font-semibold text-foreground">{Number(next.net_recurring_fee || 0).toLocaleString()}</span></span>
                  </>
                )}
                {prev.currency !== next.currency && (
                  <>
                    <span>Currency: <span className="line-through text-destructive">{prev.currency}</span></span>
                    <span>→ <span className="font-semibold text-foreground">{next.currency}</span></span>
                  </>
                )}
                {prev.session_duration !== next.session_duration && (
                  <>
                    <span>Duration: <span className="line-through text-destructive">{prev.session_duration} min</span></span>
                    <span>→ <span className="font-semibold text-foreground">{next.session_duration} min</span></span>
                  </>
                )}
                {prev.flat_discount !== next.flat_discount && (
                  <>
                    <span>Discount: <span className="line-through text-destructive">{Number(prev.flat_discount || 0).toLocaleString()}</span></span>
                    <span>→ <span className="font-semibold text-foreground">{Number(next.flat_discount || 0).toLocaleString()}</span></span>
                  </>
                )}
              </div>
              {h.reason && <p className="text-muted-foreground italic">Reason: {h.reason}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
