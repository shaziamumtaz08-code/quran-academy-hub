import React from 'react';
import { TrendingUp, Wallet, Clock, Users, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PaymentsSummaryCardsProps {
  // Legacy (back-compat, unused)
  localTotalPKR: number;
  lcyCollected: number;
  lcyPending: number;
  fcyCurrencyBreakdown: [string, { total: number; collected: number; pending: number }][];
  // Active
  pkrExpectedMonth?: number;
  pkrCollectedMonth?: number;
  pendingCount?: number;
  overdueCount?: number;
  activePlansCount?: number;
  /** Live FX getter (PKR per 1 unit of currency). Used for the tentative combined forecast. */
  getRate?: (currency: string) => number;
}

interface CardShellProps {
  icon: React.ReactNode;
  iconTint: string;
  label: string;
  sublabel: React.ReactNode;
  children: React.ReactNode;
}

function CardShell({ icon, iconTint, label, sublabel, children }: CardShellProps) {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className={cn('absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full', iconTint)}>
        {icon}
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-3 min-h-[36px]">{children}</div>
      <div className="mt-2 text-xs text-muted-foreground">{sublabel}</div>
    </div>
  );
}

const fmt = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });

export function PaymentsSummaryCards({
  lcyCollected,
  fcyCurrencyBreakdown,
  pkrExpectedMonth = 0,
  pkrCollectedMonth,
  pendingCount = 0,
  overdueCount = 0,
  activePlansCount = 0,
  getRate,
}: PaymentsSummaryCardsProps) {
  const collectedPKR = pkrCollectedMonth ?? lcyCollected ?? 0;
  const fcyEntries = fcyCurrencyBreakdown.filter(([, v]) => v.total > 0);
  const isOverdue = overdueCount > 0;
  const totalPending = pendingCount + overdueCount;

  // Tentative combined forecast in PKR equivalent (PKR native + FCY converted at live rates)
  const fcyEstPKR = fcyEntries.reduce((s, [code, v]) => {
    const r = getRate ? getRate(code) : 0;
    return s + (r > 0 ? v.total * r : 0);
  }, 0);
  const tentativeCombinedPKR = pkrExpectedMonth + fcyEstPKR;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 — Forecasted collection: PKR + FCY separately, with tentative combined */}
        <CardShell
          icon={<TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
          iconTint="bg-cyan-50 dark:bg-cyan-950/40"
          label="Forecasted Collection"
          sublabel={
            <div className="flex items-center gap-1">
              <span>
                ≈ ₨ {fmt(tentativeCombinedPKR)} <span className="text-muted-foreground/70">tentative</span>
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label="Forecast disclaimer">
                    <Info className="h-3 w-3 text-muted-foreground/70" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                  Combined PKR equivalent is indicative. Actual receipts vary with live FX rates,
                  bank/processor fees, and any taxes or waivers applied at collection.
                </TooltipContent>
              </Tooltip>
            </div>
          }
        >
          <div className="space-y-0.5">
            <p className="text-lg font-bold text-foreground tabular-nums">
              <span className="text-muted-foreground font-medium mr-1 text-xs">PKR</span>
              ₨ {fmt(pkrExpectedMonth)}
            </p>
            {fcyEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No FCY invoices</p>
            ) : (
              fcyEntries.slice(0, 3).map(([code, v]) => (
                <p key={code} className="text-sm font-semibold text-foreground tabular-nums">
                  <span className="text-muted-foreground font-medium mr-1 text-xs">{code}</span>
                  {fmt(v.total, 2)}
                </p>
              ))
            )}
            {fcyEntries.length > 3 && (
              <p className="text-xs text-muted-foreground">+{fcyEntries.length - 3} more</p>
            )}
          </div>
        </CardShell>

        {/* Card 2 — PKR Collected */}
        <CardShell
          icon={<Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          iconTint="bg-emerald-50 dark:bg-emerald-950/40"
          label="PKR Collected"
          sublabel="Received in PKR"
        >
          <p className="text-2xl font-bold text-foreground tabular-nums">
            ₨ {fmt(collectedPKR)}
          </p>
        </CardShell>

        {/* Card 3 — Pending */}
        <CardShell
          icon={
            <Clock
              className={cn(
                'h-4 w-4',
                isOverdue ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
              )}
            />
          }
          iconTint={isOverdue ? 'bg-red-50 dark:bg-red-950/40' : 'bg-amber-50 dark:bg-amber-950/40'}
          label="Pending"
          sublabel={isOverdue ? `${overdueCount} overdue` : 'Awaiting payment'}
        >
          <p
            className={cn(
              'text-2xl font-bold tabular-nums',
              isOverdue ? 'text-red-600 dark:text-red-400' : 'text-foreground',
            )}
          >
            {totalPending}
          </p>
        </CardShell>

        {/* Card 4 — Active Plans */}
        <CardShell
          icon={<Users className="h-4 w-4 text-[hsl(var(--navy,222_47%_20%))] dark:text-primary" />}
          iconTint="bg-secondary"
          label="Active Plans"
          sublabel="Active billing plans"
        >
          <p className="text-2xl font-bold text-foreground tabular-nums">{activePlansCount}</p>
        </CardShell>
      </div>
    </TooltipProvider>
  );
}
