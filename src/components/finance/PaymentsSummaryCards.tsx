import React from 'react';
import { TrendingUp, Wallet, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentsSummaryCardsProps {
  // Legacy (kept for back-compat — unused in new layout)
  localTotalPKR: number;
  lcyCollected: number;
  lcyPending: number;
  fcyCurrencyBreakdown: [string, { total: number; collected: number; pending: number }][];
  // New
  pkrCollectedMonth?: number;
  pendingCount?: number;
  overdueCount?: number;
  activePlansCount?: number;
}

interface CardShellProps {
  icon: React.ReactNode;
  iconTint: string;
  label: string;
  sublabel: string;
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
      <p className="mt-2 text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}

export function PaymentsSummaryCards({
  lcyCollected,
  fcyCurrencyBreakdown,
  pkrCollectedMonth,
  pendingCount = 0,
  overdueCount = 0,
  activePlansCount = 0,
}: PaymentsSummaryCardsProps) {
  const collectedPKR = pkrCollectedMonth ?? lcyCollected ?? 0;
  const fcyEntries = fcyCurrencyBreakdown.filter(([, v]) => v.total > 0);
  const isOverdue = overdueCount > 0;
  const totalPending = pendingCount + overdueCount;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card 1 — FCY Receivable, stacked per currency */}
      <CardShell
        icon={<TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
        iconTint="bg-cyan-50 dark:bg-cyan-950/40"
        label="FCY Receivable"
        sublabel="Expected this month"
      >
        {fcyEntries.length === 0 ? (
          <p className="text-2xl font-bold text-foreground">—</p>
        ) : fcyEntries.length === 1 ? (
          <p className="text-2xl font-bold text-foreground">
            {fcyEntries[0][0]} {fcyEntries[0][1].total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        ) : (
          <div className="space-y-0.5">
            {fcyEntries.slice(0, 3).map(([code, v]) => (
              <p key={code} className="text-sm font-semibold text-foreground tabular-nums">
                <span className="text-muted-foreground font-medium mr-1">{code}</span>
                {v.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            ))}
            {fcyEntries.length > 3 && (
              <p className="text-xs text-muted-foreground">+{fcyEntries.length - 3} more</p>
            )}
          </div>
        )}
      </CardShell>

      {/* Card 2 — PKR Collected */}
      <CardShell
        icon={<Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
        iconTint="bg-emerald-50 dark:bg-emerald-950/40"
        label="PKR Collected"
        sublabel="Received in PKR"
      >
        <p className="text-2xl font-bold text-foreground tabular-nums">
          ₨ {collectedPKR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
  );
}
