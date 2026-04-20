import { cn } from '@/lib/utils';

export type StatusKind =
  | 'active'
  | 'paused'
  | 'left'
  | 'completed'
  | 'assigned'
  | 'scheduled'
  | 'pending'
  | 'no_show'
  | 'inactive';

interface StatusMeta {
  label: string;
  /** CSS var name without the leading -- */
  tokenVar: string;
}

const META: Record<StatusKind, StatusMeta> = {
  active:    { label: 'Active',    tokenVar: 'status-active' },
  paused:    { label: 'Paused',    tokenVar: 'status-paused' },
  left:      { label: 'Left',      tokenVar: 'status-left' },
  completed: { label: 'Completed', tokenVar: 'status-completed' },
  assigned:  { label: 'Assigned',  tokenVar: 'status-assigned' },
  scheduled: { label: 'Scheduled', tokenVar: 'status-scheduled' },
  pending:   { label: 'Pending',   tokenVar: 'status-pending' },
  no_show:   { label: 'No Show',   tokenVar: 'status-no-show' },
  inactive:  { label: 'Inactive',  tokenVar: 'status-left' },
};

/** Map any free-form status string into a known StatusKind. */
export function resolveStatusKind(raw?: string | null): StatusKind {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'active';
  if (s === 'active' || s === 'enrolled' || s === 'in_progress') return 'active';
  if (s === 'paused' || s === 'on_hold' || s === 'frozen') return 'paused';
  if (s === 'left' || s === 'dropped' || s === 'cancelled' || s === 'rejected') return 'left';
  if (s === 'completed' || s === 'graduated' || s === 'finished') return 'completed';
  if (s === 'assigned' || s === 'linked') return 'assigned';
  if (s === 'scheduled') return 'scheduled';
  if (s === 'pending' || s === 'new' || s === 'awaiting') return 'pending';
  if (s === 'no_show' || s === 'no-show' || s === 'absent') return 'no_show';
  if (s === 'inactive' || s === 'archived') return 'inactive';
  // Fallback: treat as active so visual stays neutral-positive
  return 'active';
}

interface StatusDotProps {
  /** Pass a known kind, or any raw status string (auto-resolved). */
  kind?: StatusKind;
  status?: string | null;
  label?: string;
  size?: 'xs' | 'sm';
  /** When false, render only the colored dot (no text). */
  showLabel?: boolean;
  className?: string;
}

export function StatusDot({
  kind,
  status,
  label,
  size = 'sm',
  showLabel = true,
  className,
}: StatusDotProps) {
  const resolved = kind || resolveStatusKind(status);
  const m = META[resolved];
  const dotSize = size === 'xs' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  const textSize = size === 'xs' ? 'text-[10px]' : 'text-xs';

  if (!showLabel) {
    return (
      <span
        className={cn('inline-block rounded-full', dotSize, className)}
        style={{ backgroundColor: `hsl(var(--${m.tokenVar}))` }}
        title={label || m.label}
        aria-label={label || m.label}
      />
    );
  }

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 font-medium', textSize, className)}
      style={{ color: `hsl(var(--${m.tokenVar}))` }}
    >
      <span
        className={cn('inline-block rounded-full', dotSize)}
        style={{ backgroundColor: `hsl(var(--${m.tokenVar}))` }}
      />
      <span>{label || m.label}</span>
    </span>
  );
}
