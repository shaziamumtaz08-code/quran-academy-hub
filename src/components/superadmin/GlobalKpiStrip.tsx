import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { DivisionMeta, DivisionMetrics } from '@/hooks/useSuperAdminOverview';

export interface KpiCardData {
  label: string;
  value: string;
  breakdown: string;
  tone?: 'default' | 'warning' | 'danger';
}

export function shortDivisionLabel(name: string) {
  return name.replace(/^1:1\s*/i, '').replace(/\s*Academy$/i, '');
}

export function buildKpis(divisions: DivisionMeta[], metrics: Record<string, DivisionMetrics>): KpiCardData[] {
  const split = (fn: (m: DivisionMetrics) => string | number) =>
    divisions.map((d) => `${shortDivisionLabel(d.name)} ${fn(metrics[d.id])}`).join(' · ');
  const sum = (fn: (m: DivisionMetrics) => number) =>
    divisions.reduce((acc, d) => acc + fn(metrics[d.id]), 0);

  const totalMarked = sum((m) => m.attendanceMarked);
  const totalPresent = sum((m) => m.attendancePresent);

  return [
    { label: 'Students', value: String(sum((m) => m.students)), breakdown: split((m) => m.students) },
    { label: 'Teachers', value: String(sum((m) => m.teachers)), breakdown: split((m) => m.teachers) },
    { label: 'Classes today', value: String(sum((m) => m.classesToday)), breakdown: split((m) => m.classesToday) },
    {
      label: 'Attendance %',
      value: totalMarked ? `${Math.round((totalPresent / totalMarked) * 100)}%` : '—',
      breakdown: split((m) => (m.attendancePct === null ? '—' : `${m.attendancePct}%`)),
    },
    {
      label: 'Overdue fees',
      value: String(sum((m) => m.overdueCount)),
      breakdown: split((m) => m.overdueCount),
      tone: 'warning',
    },
    {
      label: 'Active alerts',
      value: String(sum((m) => m.alerts)),
      breakdown: split((m) => m.alerts),
      tone: 'danger',
    },
  ];
}

const toneStyles: Record<string, string> = {
  default: 'bg-card border-border',
  warning: 'bg-warning/10 border-warning/25',
  danger: 'bg-destructive/10 border-destructive/25',
};

const toneText: Record<string, string> = {
  default: 'text-foreground',
  warning: 'text-warning',
  danger: 'text-destructive',
};

export function GlobalKpiStrip({ items, loading }: { items: KpiCardData[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn('rounded-xl border p-4 shadow-card', toneStyles[item.tone || 'default'])}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className={cn('mt-1 text-2xl font-bold', toneText[item.tone || 'default'])}>{item.value}</p>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{item.breakdown}</p>
        </div>
      ))}
    </div>
  );
}
