import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, ChevronLeft, Loader2, User as UserIcon } from 'lucide-react';

export const toneMap: Record<
  string,
  { border: string; bg: string; text: string; ring: string; head: string; glow: string }
> = {
  primary: {
    border: 'border-l-primary',
    bg: 'bg-primary/10',
    text: 'text-primary',
    ring: 'ring-primary/20',
    head: 'from-primary/12 via-primary/5 to-transparent',
    glow: 'shadow-[0_10px_30px_-16px_hsl(var(--primary)/0.55)]',
  },
  teal: {
    border: 'border-l-teal-500',
    bg: 'bg-teal-500/10',
    text: 'text-teal-600',
    ring: 'ring-teal-500/20',
    head: 'from-teal-500/12 via-teal-500/5 to-transparent',
    glow: 'shadow-[0_10px_30px_-16px_rgba(20,184,166,0.55)]',
  },
  amber: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    ring: 'ring-amber-500/20',
    head: 'from-amber-500/12 via-amber-500/5 to-transparent',
    glow: 'shadow-[0_10px_30px_-16px_rgba(245,158,11,0.55)]',
  },
  violet: {
    border: 'border-l-violet-500',
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    ring: 'ring-violet-500/20',
    head: 'from-violet-500/12 via-violet-500/5 to-transparent',
    glow: 'shadow-[0_10px_30px_-16px_rgba(139,92,246,0.55)]',
  },
  rose: {
    border: 'border-l-rose-500',
    bg: 'bg-rose-500/10',
    text: 'text-rose-600',
    ring: 'ring-rose-500/20',
    head: 'from-rose-500/12 via-rose-500/5 to-transparent',
    glow: 'shadow-[0_10px_30px_-16px_rgba(244,63,94,0.55)]',
  },
  sky: {
    border: 'border-l-sky-500',
    bg: 'bg-sky-500/10',
    text: 'text-sky-600',
    ring: 'ring-sky-500/20',
    head: 'from-sky-500/12 via-sky-500/5 to-transparent',
    glow: 'shadow-[0_10px_30px_-16px_rgba(14,165,233,0.55)]',
  },
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
  onAvatarSelect,
  avatarUploading,
}: {
  name: string;
  avatarUrl?: string | null;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  gradient?: string;
  onAvatarSelect?: (file: File) => void;
  avatarUploading?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <header className="rounded-2xl border bg-card overflow-hidden shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]">
      <div className={`relative h-24 sm:h-28 bg-gradient-to-br ${gradient}`}>
        <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/15 to-transparent" />
      </div>

      <div className="px-5 pb-5">
        <div className="-mt-11 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end min-w-0">
            <div className="relative h-24 w-24 shrink-0">
              <div className="h-24 w-24 rounded-full ring-4 ring-card bg-secondary flex items-center justify-center overflow-hidden shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={`${name} profile photo`} className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-9 w-9 text-muted-foreground" />
                )}
              </div>
              {onAvatarSelect && (
                <>
                  <button
                    type="button"
                    aria-label="Change profile photo"
                    disabled={avatarUploading}
                    onClick={() => inputRef.current?.click()}
                    className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition hover:opacity-90 disabled:opacity-60"
                  >
                    {avatarUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) onAvatarSelect(file);
                    }}
                  />
                </>
              )}
            </div>

            <div className="min-w-0 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-serif font-bold text-foreground break-words">{name}</h1>
                {badges}
              </div>
              {meta && (
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">{meta}</div>
              )}
            </div>
          </div>

          {actions && <div className="flex flex-wrap gap-2 lg:pb-1">{actions}</div>}
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
          <div
            key={s.label}
            className={`group relative overflow-hidden rounded-2xl border border-l-4 ${tone.border} bg-gradient-to-br ${tone.head} bg-card p-4 ${tone.glow} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
          >
            <div
              className={`h-9 w-9 rounded-xl ${tone.bg} ring-1 ${tone.ring} flex items-center justify-center mb-2.5 shadow-sm`}
            >
              <s.icon className={`h-4 w-4 ${tone.text}`} />
            </div>
            <p className="text-2xl font-black tracking-tight text-foreground truncate">{s.value}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
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
  className,
}: {
  icon: any;
  title: string;
  tone?: keyof typeof toneMap;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const t = toneMap[tone];
  return (
    <section
      className={`rounded-2xl border bg-card overflow-hidden ${t.glow} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${className ?? ''}`}
    >
      <div className={`flex items-center justify-between gap-3 border-b bg-gradient-to-r ${t.head} px-5 py-3.5`}>
        <div className="flex items-center gap-2.5">
          <div className={`h-9 w-9 rounded-xl ${t.bg} ring-1 ${t.ring} flex items-center justify-center shadow-sm`}>
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
    <div className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/40">
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
