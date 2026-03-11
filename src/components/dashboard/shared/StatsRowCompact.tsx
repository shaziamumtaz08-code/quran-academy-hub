import React from 'react';

export interface CompactStat {
  value: string | number;
  label: string;
  sub: string;
  color: string;
}

interface StatsRowCompactProps {
  title: string;
  stats: CompactStat[];
}

export function StatsRowCompact({ title, stats }: StatsRowCompactProps) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-card">
      <p className="font-extrabold text-[15px] text-foreground mb-3">{title}</p>
      <div className={`grid grid-cols-${stats.length} gap-2.5`}>
        {stats.map((s) => (
          <div key={s.label} className="text-center bg-secondary/50 rounded-xl py-2.5 px-1.5">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs font-bold text-foreground">{s.label}</p>
            <p className="text-[10px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
