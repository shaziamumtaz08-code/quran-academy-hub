import React from 'react';

export interface QuickAction {
  icon: string;
  label: string;
  bg: string;
  textColor: string;
  border: string;
  onClick: () => void;
}

interface QuickActionsGridProps {
  actions: QuickAction[];
  title?: string;
}

export function QuickActionsGrid({ actions, title = 'Quick Actions' }: QuickActionsGridProps) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-2.5">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`${a.bg} ${a.textColor} border ${a.border} rounded-2xl p-3.5 flex items-center gap-2 cursor-pointer text-left font-bold text-sm hover:opacity-90 transition-opacity`}
          >
            <span className="text-xl">{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
