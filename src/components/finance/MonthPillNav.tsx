import React, { useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface MonthPillNavProps {
  value: string; // 'YYYY-MM'
  onChange: (v: string) => void;
  monthsBack?: number;
  monthsForward?: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatPill = (d: Date) => `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function MonthPillNav({ value, onChange, monthsBack = 6, monthsForward = 1 }: MonthPillNavProps) {
  const now = new Date();
  const currentKey = toKey(now);

  const months = useMemo(() => {
    const arr: { key: string; label: string; isCurrent: boolean }[] = [];
    for (let i = -monthsBack; i <= monthsForward; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      arr.push({ key: toKey(d), label: formatPill(d), isCurrent: toKey(d) === currentKey });
    }
    return arr;
  }, [monthsBack, monthsForward]);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const c = containerRef.current;
      const el = activeRef.current;
      const offset = el.offsetLeft - c.offsetWidth / 2 + el.offsetWidth / 2;
      c.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
    }
  }, [value]);

  return (
    <div ref={containerRef} className="overflow-x-auto scrollbar-hide -mx-1 px-1">
      <div className="flex min-w-max items-end gap-2 py-1">
        {months.map((m) => {
          const active = m.key === value;
          return (
            <div key={m.key} className="flex flex-col items-center">
              <button
                ref={active ? activeRef : undefined}
                type="button"
                onClick={() => onChange(m.key)}
                className={cn(
                  'h-9 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-all',
                  active
                    ? 'bg-[hsl(var(--navy,222_47%_20%))] text-white shadow-sm dark:bg-primary dark:text-primary-foreground'
                    : 'border border-border bg-background text-foreground hover:bg-muted',
                )}
              >
                {m.label}
              </button>
              {m.isCurrent && (
                <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Current</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
