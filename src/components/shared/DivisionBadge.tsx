import { Hexagon, Diamond, Play, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DivisionKind = 'group' | 'one_to_one' | 'recorded' | 'multi';

interface DivisionMeta {
  kind: DivisionKind;
  label: string;
  Icon: typeof Hexagon;
  /** HSL var name (without --) */
  tokenVar: string;
}

const META: Record<DivisionKind, DivisionMeta> = {
  group:      { kind: 'group',      label: 'Group',    Icon: Hexagon, tokenVar: 'division-group' },
  one_to_one: { kind: 'one_to_one', label: '1:1',      Icon: Diamond, tokenVar: 'division-one-to-one' },
  recorded:   { kind: 'recorded',   label: 'Recorded', Icon: Play,    tokenVar: 'division-recorded' },
  multi:      { kind: 'multi',      label: 'Multi',    Icon: Sparkles, tokenVar: 'division-both' },
};

/** Resolve a division kind from its model_type / name string. */
export function resolveDivisionKind(modelType?: string | null, name?: string | null): DivisionKind {
  const m = (modelType || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (m === 'one_to_one' || n.includes('1:1') || n.includes('1-to-1') || n.includes('mentorship')) return 'one_to_one';
  if (m === 'recorded' || n.includes('recorded')) return 'recorded';
  if (m === 'group' || n.includes('group') || n.includes('academy')) return 'group';
  return 'group';
}

interface DivisionBadgeProps {
  /** Pass either a kind directly or modelType+name to auto-resolve. */
  kind?: DivisionKind;
  modelType?: string | null;
  name?: string | null;
  /** Override label text; defaults to META label */
  label?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

export function DivisionBadge({ kind, modelType, name, label, size = 'sm', className }: DivisionBadgeProps) {
  const resolved = kind || resolveDivisionKind(modelType, name);
  const m = META[resolved];
  const Icon = m.Icon;
  const sizeCls = size === 'xs' ? 'text-[10px] px-1.5 py-0 h-5 gap-1' : 'text-xs px-2 py-0.5 gap-1.5';
  const iconCls = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <span
      className={cn('inline-flex items-center rounded-full font-medium border', sizeCls, className)}
      style={{
        backgroundColor: `hsl(var(--${m.tokenVar}) / 0.12)`,
        color: `hsl(var(--${m.tokenVar}))`,
        borderColor: `hsl(var(--${m.tokenVar}) / 0.25)`,
      }}
    >
      <Icon className={iconCls} strokeWidth={2.25} />
      <span>{label || m.label}</span>
    </span>
  );
}

/** Stack badges from a list of memberships; collapses to a single "Multi" pill when ≥2 distinct kinds. */
export function DivisionBadgeStack({
  memberships,
  size = 'sm',
  className,
}: {
  memberships: Array<{ modelType?: string | null; divisionName?: string | null }>;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  if (!memberships || memberships.length === 0) return null;
  const kinds = Array.from(new Set(memberships.map(m => resolveDivisionKind(m.modelType, m.divisionName))));
  if (kinds.length >= 2) {
    return <DivisionBadge kind="multi" size={size} className={className} />;
  }
  return <DivisionBadge kind={kinds[0]} size={size} className={className} />;
}
