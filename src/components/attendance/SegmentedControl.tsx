import React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** Tailwind classes applied to the active pill (defaults to teal). */
  activeClass?: string;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  /**
   * Tailwind grid-template classes. When provided, the control uses these
   * instead of the default "one column per option" inline style — this lets
   * callers drop to a 2x2 grid on narrow screens so labels never truncate.
   */
  gridClassName?: string;
  'aria-label'?: string;
}

/**
 * Compact segmented pill control — replaces native dropdowns for 2–4
 * mutually exclusive options. Purely presentational.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  gridClassName,
  ...rest
}: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      className={cn(
        'grid w-full gap-1 rounded-xl bg-muted p-1',
        gridClassName,
        className,
      )}
      style={gridClassName ? undefined : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex min-w-0 items-center justify-center gap-1.5 rounded-lg font-medium transition-all',
              size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-2 py-2 text-[13px] sm:text-sm',
              active
                ? cn('shadow-sm', opt.activeClass || 'bg-teal-600 text-white')
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="shrink-0">{opt.icon}</span>
            <span className="min-w-0">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}


export default SegmentedControl;
