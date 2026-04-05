import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ChevronRight, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MonthStatusBannerProps {
  monthFilter: string;
  formatBillingMonth: (bm: string) => string;
  monthStatusData: {
    recovered: any[];
    arrearsStillPending: any[];
    genuinelyUnpaid: any[];
    canCloseMonth: boolean;
    isFullySettled: boolean;
  };
  statusViewFilter: 'recovered' | 'arrears_pending' | 'genuine' | null;
  setStatusViewFilter: (v: 'recovered' | 'arrears_pending' | 'genuine' | null) => void;
  onCloseMonth: () => void;
}

export function MonthStatusBanner({
  monthFilter,
  formatBillingMonth,
  monthStatusData,
  statusViewFilter,
  setStatusViewFilter,
  onCloseMonth,
}: MonthStatusBannerProps) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm mb-4">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-semibold text-foreground">
            {formatBillingMonth(monthFilter)} — Month Status
          </span>
        </div>
        <div className="flex items-center gap-2">
          {statusViewFilter && (
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setStatusViewFilter(null)}>
              <X className="h-3 w-3" /> Clear filter
            </Button>
          )}
          <Button
            size="sm"
            className={cn(
              'h-7 text-xs gap-1.5 font-semibold',
              monthStatusData.canCloseMonth
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            )}
            disabled={!monthStatusData.canCloseMonth}
            onClick={onCloseMonth}
            title={!monthStatusData.canCloseMonth ? 'Cannot close — genuine unpaid invoices remain' : 'Close this billing month'}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Close Month
          </Button>
        </div>
      </div>
      <div className="divide-y divide-border">
        {monthStatusData.recovered.length > 0 && (
          <div
            className={cn(
              'flex items-center justify-between px-4 py-2.5 transition-colors',
              statusViewFilter === 'recovered' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-muted/30 cursor-pointer'
            )}
            onClick={() => setStatusViewFilter(statusViewFilter === 'recovered' ? null : 'recovered')}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Recovered via arrears</p>
                <p className="text-xs text-muted-foreground">Arrears paid in a later month — these can be closed</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 font-semibold">
                {monthStatusData.recovered.length} student{monthStatusData.recovered.length !== 1 ? 's' : ''}
              </Badge>
              <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', statusViewFilter === 'recovered' && 'rotate-90')} />
            </div>
          </div>
        )}
        {monthStatusData.arrearsStillPending.length > 0 && (
          <div
            className={cn(
              'flex items-center justify-between px-4 py-2.5 transition-colors',
              statusViewFilter === 'arrears_pending' ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-muted/30 cursor-pointer'
            )}
            onClick={() => setStatusViewFilter(statusViewFilter === 'arrears_pending' ? null : 'arrears_pending')}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Arrears created — still pending</p>
                <p className="text-xs text-muted-foreground">Arrears invoice exists in a future month but not yet paid</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 font-semibold">
                {monthStatusData.arrearsStillPending.length} student{monthStatusData.arrearsStillPending.length !== 1 ? 's' : ''}
              </Badge>
              <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', statusViewFilter === 'arrears_pending' && 'rotate-90')} />
            </div>
          </div>
        )}
        {monthStatusData.genuinelyUnpaid.length > 0 && (
          <div
            className={cn(
              'flex items-center justify-between px-4 py-2.5 transition-colors',
              statusViewFilter === 'genuine' ? 'bg-red-50 dark:bg-red-950/30' : 'hover:bg-muted/30 cursor-pointer'
            )}
            onClick={() => setStatusViewFilter(statusViewFilter === 'genuine' ? null : 'genuine')}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Genuinely unpaid</p>
                <p className="text-xs text-muted-foreground">No arrears created — student still owes this amount</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-semibold">
                {monthStatusData.genuinelyUnpaid.length} student{monthStatusData.genuinelyUnpaid.length !== 1 ? 's' : ''}
              </Badge>
              <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', statusViewFilter === 'genuine' && 'rotate-90')} />
            </div>
          </div>
        )}
        {monthStatusData.genuinelyUnpaid.length === 0 && monthStatusData.arrearsStillPending.length === 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              All partial invoices recovered — month is ready to close
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
