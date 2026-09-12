import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subMonths, startOfMonth } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Period = 'ytd' | 'last12' | 'lastYear' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  ytd: 'This year to date',
  last12: 'Last 12 months',
  lastYear: 'Last calendar year',
  all: 'All time',
};

const money = (n: number) => `PKR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function periodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  if (period === 'ytd') return { from: `${y}-01`, to: format(now, 'yyyy-MM') };
  if (period === 'last12') return { from: format(startOfMonth(subMonths(now, 11)), 'yyyy-MM'), to: format(now, 'yyyy-MM') };
  if (period === 'lastYear') return { from: `${y - 1}-01`, to: `${y - 1}-12` };
  return { from: '0000-01', to: '9999-12' };
}

/**
 * Teacher-facing earnings history: every salary sheet raised for the signed-in
 * teacher across a chosen period (YTD, last 12 months, last year, all time),
 * with totals for earned / paid / outstanding.
 */
export function MyEarningsHistory() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('ytd');
  const { from, to } = periodRange(period);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['my-earnings-history', user?.id, from, to],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('salary_payouts')
        .select('id, salary_month, base_salary, extra_class_amount, adjustment_amount, deductions, net_salary, amount_paid, status, paid_at')
        .eq('teacher_id', user!.id)
        .or('is_archived.is.null,is_archived.eq.false')
        .is('voided_at', null)
        .gte('salary_month', from)
        .lte('salary_month', to)
        .order('salary_month', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const totals = useMemo(() => {
    const earned = rows.reduce((s: number, r: any) => s + Number(r.net_salary || 0), 0);
    const paid = rows.reduce(
      (s: number, r: any) => s + Number(r.amount_paid ?? (r.status === 'paid' ? r.net_salary : 0) ?? 0),
      0,
    );
    return { earned, paid, outstanding: Math.max(0, earned - paid), months: rows.length };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <CardTitle className="text-base">My earnings history</CardTitle>
          <p className="text-sm text-muted-foreground">Every salary sheet raised for you in the selected period.</p>
        </div>
        <div className="w-full sm:w-56">
          <Label className="text-xs">Period</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total earned', value: money(totals.earned), tone: 'text-foreground' },
            { label: 'Total received', value: money(totals.paid), tone: 'text-emerald-600' },
            { label: 'Outstanding', value: money(totals.outstanding), tone: 'text-amber-600' },
            { label: 'Months', value: String(totals.months), tone: 'text-foreground' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              {isLoading ? <Skeleton className="mt-2 h-6 w-24" /> : <p className={`mt-1 text-base font-bold ${s.tone}`}>{s.value}</p>}
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Extras</TableHead>
                <TableHead className="text-right">Additions</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No salary sheets in this period yet.</TableCell></TableRow>
              ) : (
                rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{format(parseISO(`${r.salary_month}-01`), 'MMMM yyyy')}</TableCell>
                    <TableCell className="text-right">{money(r.base_salary)}</TableCell>
                    <TableCell className="text-right">{money(r.extra_class_amount)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{money(r.adjustment_amount)}</TableCell>
                    <TableCell className="text-right text-red-600">{money(r.deductions)}</TableCell>
                    <TableCell className="text-right font-bold">{money(r.net_salary)}</TableCell>
                    <TableCell className="text-right">{money(r.amount_paid ?? (r.status === 'paid' ? r.net_salary : 0))}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'paid' || r.status === 'locked' ? 'default' : 'secondary'} className="capitalize">
                        {String(r.status || 'draft').replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
