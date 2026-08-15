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
  ...rest
}: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      className={cn(
        'grid w-full gap-1 rounded-xl bg-muted p-1',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
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
              'flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all whitespace-nowrap',
              size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-sm',
              active
                ? cn('shadow-sm', opt.activeClass || 'bg-teal-600 text-white')
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.icon}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
