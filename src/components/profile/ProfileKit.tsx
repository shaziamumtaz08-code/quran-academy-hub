import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, User as UserIcon } from 'lucide-react';

export const toneMap: Record<string, { border: string; bg: string; text: string }> = {
  primary: { border: 'border-l-primary', bg: 'bg-primary/10', text: 'text-primary' },
  teal: { border: 'border-l-teal-500', bg: 'bg-teal-500/10', text: 'text-teal-600' },
  amber: { border: 'border-l-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-600' },
  violet: { border: 'border-l-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-600' },
  rose: { border: 'border-l-rose-500', bg: 'bg-rose-500/10', text: 'text-rose-600' },
};

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-xs gap-1">
      <Link to={to}>
        <ChevronLeft className="h-3.5 w-3.5" /> {label}
      </Link>
    </Button>
  );
}

export function ProfileHero({
  name,
  avatarUrl,
  badges,
  meta,
  actions,
  gradient = 'from-primary via-primary/80 to-accent',
}: {
  name: string;
  avatarUrl?: string | null;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  gradient?: string;
}) {
  return (
    <header className="rounded-2xl border overflow-hidden bg-card">
      <div className={`h-24 bg-gradient-to-r ${gradient}`} />
      <div className="px-5 pb-5 -mt-10">
        <div className="flex flex-wrap items-end gap-4">
          <div className="h-20 w-20 rounded-full ring-4 ring-card bg-secondary flex items-center justify-center overflow-hidden shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={`${name} profile photo`} className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-serif font-bold text-foreground">{name}</h1>
              {badges}
            </div>
            {meta && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">{meta}</div>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2 pb-1">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

export function StatTiles({
  stats,
}: {
  stats: { label: string; value: React.ReactNode; icon: any; tone?: keyof typeof toneMap }[];
}) {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => {
        const tone = toneMap[s.tone ?? 'primary'];
        return (
          <div key={s.label} className={`rounded-xl border border-l-4 ${tone.border} bg-card p-4`}>
            <div className={`h-8 w-8 rounded-lg ${tone.bg} flex items-center justify-center mb-2`}>
              <s.icon className={`h-4 w-4 ${tone.text}`} />
            </div>
            <p className="text-xl font-black text-foreground truncate">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export function InfoCard({
  icon: Icon,
  title,
  tone = 'primary',
  action,
  children,
}: {
  icon: any;
  title: string;
  tone?: keyof typeof toneMap;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = toneMap[tone];
  return (
    <section className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-lg ${t.bg} flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${t.text}`} />
          </div>
          <h2 className="font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="divide-y">{children}</div>
    </section>
  );
}

export function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: any;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-4 w-4 opacity-70" />}
        {label}
      </span>
      <span className="text-sm font-medium text-foreground text-right break-words">{value || '—'}</span>
    </div>
  );
}

export function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={ok ? 'border-teal-500/40 bg-teal-500/10 text-teal-600' : 'border-border bg-muted text-muted-foreground'}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${ok ? 'bg-teal-500' : 'bg-muted-foreground'}`} />
      {label}
    </Badge>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground/50" />
      <p className="mt-2 text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
