import React from 'react';
import { useQaidaProgress } from '@/hooks/useQaidaProgress';
import { cn } from '@/lib/utils';
import { BookOpen, Check } from 'lucide-react';

interface Props {
  studentId?: string | null;
  compact?: boolean;
}

export function QaidaMilestoneTracker({ studentId, compact }: Props) {
  const progress = useQaidaProgress(studentId);
  // Only surfaced for students who actually have Qaida lessons recorded.
  if (!progress || progress.unitsReached === 0) return null;
  const { baabs, overallPercent, currentBaab, currentPage } = progress;
  const started = progress.unitsReached > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-extrabold text-foreground">Noorani Qaida progress</p>
            <p className="text-[11px] text-muted-foreground">
              Page {currentPage ?? '—'} of 31
              {currentBaab ? ` · Currently on Baab ${currentBaab.baab_number}: ${currentBaab.name_english}` : ''}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary leading-none">{overallPercent}%</p>
          <p className="text-[10px] text-muted-foreground">
            {progress.unitsReached} of {progress.totalUnits} units
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${overallPercent}%` }}
        />
      </div>

      {!started && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          No Qaida lessons recorded yet — the milestone path fills as attendance is marked.
        </p>
      )}

      {/* Milestone path — horizontal on desktop, vertical on mobile */}
      <div
        className={cn(
          'mt-4 flex gap-3 overflow-x-auto pb-2',
          'flex-col sm:flex-row sm:items-start',
          compact && 'max-h-[420px] overflow-y-auto sm:max-h-none',
        )}
      >
        {baabs.map((b, i) => {
          const isCurrent = currentBaab?.id === b.id;
          const done = b.percent >= 100;
          return (
            <div key={b.id} className="flex items-center gap-3 sm:flex-col sm:items-center sm:min-w-[70px]">
              <div className="relative flex items-center sm:flex-col">
                <div
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold transition-all',
                    done
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'border-primary bg-primary/10 text-primary ring-4 ring-primary/15'
                        : b.percent > 0
                          ? 'border-primary/50 bg-primary/5 text-primary'
                          : 'border-border bg-muted text-muted-foreground',
                  )}
                  title={`Baab ${b.baab_number}: ${b.name_english} — ${b.percent}%`}
                >
                  {done ? <Check className="h-4 w-4" /> : b.baab_number}
                </div>
                {i < baabs.length - 1 && (
                  <span className="absolute left-1/2 top-10 hidden h-3 w-0.5 -translate-x-1/2 bg-border sm:block" />
                )}
              </div>
              <div className="min-w-0 sm:text-center">
                <p className="truncate text-[10px] font-semibold text-foreground sm:max-w-[70px]">{b.name_english}</p>
                <p className="text-[10px] text-muted-foreground">{b.percent}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
