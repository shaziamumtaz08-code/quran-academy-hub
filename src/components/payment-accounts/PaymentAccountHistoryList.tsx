import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { Loader2, History } from 'lucide-react';

interface Props { profileId: string; }

const TRACKED = ['account_title','account_number','iban','bank_name','bank_branch','bank_swift','currency','is_primary','is_active'];

export function PaymentAccountHistoryList({ profileId }: Props) {
  const { data: rows, isLoading } = useQuery({
    queryKey: ['payment-account-history', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_payment_account_history')
        .select('*, changed_by_profile:profiles!profile_payment_account_history_changed_by_fkey(full_name)')
        .eq('profile_id', profileId)
        .order('changed_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!rows?.length) return <div className="text-sm text-muted-foreground py-8 text-center">No change history yet.</div>;

  return (
    <div className="space-y-3">
      {rows.map((r: any) => {
        const prev = r.previous_values || {};
        const next = r.new_values || {};
        const diffs = TRACKED
          .map((f) => ({ f, a: prev[f], b: next[f] }))
          .filter(d => r.change_type === 'created' ? d.b != null && d.b !== '' : JSON.stringify(d.a) !== JSON.stringify(d.b));

        return (
          <div key={r.id} className="border-l-2 border-primary/30 pl-3 pb-3">
            <div className="flex items-center gap-2 text-xs">
              <History className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium capitalize">{r.change_type}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{format(parseISO(r.changed_at), 'dd MMM yyyy, HH:mm')}</span>
              {r.changed_by_profile?.full_name && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">by {r.changed_by_profile.full_name}</span>
                </>
              )}
            </div>
            {diffs.length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {diffs.slice(0, 8).map(d => (
                  <div key={d.f} className="text-xs">
                    <span className="font-mono text-muted-foreground">{d.f}:</span>{' '}
                    {r.change_type !== 'created' && (
                      <>
                        <span className="line-through text-destructive/70">{String(d.a ?? '—')}</span>{' → '}
                      </>
                    )}
                    <span className="text-emerald-700 dark:text-emerald-400">{String(d.b ?? '—')}</span>
                  </div>
                ))}
              </div>
            )}
            {r.reason && <p className="text-xs text-muted-foreground mt-1 italic">"{r.reason}"</p>}
          </div>
        );
      })}
    </div>
  );
}
