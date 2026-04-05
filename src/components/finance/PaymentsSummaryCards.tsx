import React from 'react';
import { CheckCircle, XCircle, DollarSign } from 'lucide-react';

interface CurrencyBreakdown {
  currency: string;
  total: number;
  collected: number;
  pending: number;
}

interface PaymentsSummaryCardsProps {
  localTotalPKR: number;
  lcyCollected: number;
  lcyPending: number;
  fcyCurrencyBreakdown: [string, { total: number; collected: number; pending: number }][];
}

export function PaymentsSummaryCards({
  localTotalPKR,
  lcyCollected,
  lcyPending,
  fcyCurrencyBreakdown,
}: PaymentsSummaryCardsProps) {
  return (
    <div className="space-y-3">
      {/* PKR Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-primary">₨</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Fees (PKR)</p>
              <p className="text-2xl font-serif font-bold text-foreground">₨ {localTotalPKR.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/30 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Collected (PKR)</p>
              <p className="text-2xl font-serif font-bold text-emerald-700 dark:text-emerald-400">₨ {lcyCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border border-red-100 dark:border-red-900/30 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pending (PKR)</p>
              <p className="text-2xl font-serif font-bold text-red-600 dark:text-red-400">₨ {lcyPending.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FCY Rows — one per currency */}
      {fcyCurrencyBreakdown.map(([currency, data]) => (
        <div key={currency} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary/30 to-secondary/50 border border-border p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Total Fees ({currency})</p>
                <p className="text-2xl font-serif font-bold text-foreground">{currency} {data.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/10 dark:to-teal-950/10 border border-emerald-100/50 dark:border-emerald-900/20 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100/70 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Collected ({currency})</p>
                <p className="text-2xl font-serif font-bold text-emerald-700 dark:text-emerald-400">{currency} {data.collected.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-50/50 to-rose-50/50 dark:from-red-950/10 dark:to-rose-950/10 border border-red-100/50 dark:border-red-900/20 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100/70 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Pending ({currency})</p>
                <p className="text-2xl font-serif font-bold text-red-600 dark:text-red-400">{currency} {data.pending.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
