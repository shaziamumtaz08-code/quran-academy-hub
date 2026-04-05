import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface LandingCard {
  id: string;
  title: string;
  subtitle: string;
  count?: string | number;
  countLoading?: boolean;
  icon: React.ReactNode;
  color: string; // tailwind bg class e.g. 'bg-emerald-500'
}

interface LandingPageShellProps {
  title: string;
  subtitle: string;
  cards: LandingCard[];
  /** Map card.id → React content to render below. Only the active card's content is shown. */
  contentMap: Record<string, React.ReactNode>;
  /** Default selected card id */
  defaultCard?: string;
}

export function LandingPageShell({ title, subtitle, cards, contentMap, defaultCard }: LandingPageShellProps) {
  const [activeCard, setActiveCard] = useState(defaultCard || cards[0]?.id || '');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {cards.map((card) => {
          const isActive = activeCard === card.id;
          return (
            <button
              key={card.id}
              onClick={() => setActiveCard(card.id)}
              className={cn(
                "relative text-left rounded-2xl border-2 p-4 transition-all duration-200 group",
                isActive
                  ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
                  : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}

              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  isActive ? card.color + '/20' : 'bg-muted'
                )}>
                  <div className={cn(
                    "transition-colors",
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {card.icon}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-semibold truncate",
                    isActive ? 'text-primary' : 'text-foreground'
                  )}>
                    {card.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {card.subtitle}
                  </p>
                </div>
              </div>

              {/* Count */}
              <div className="mt-3">
                {card.countLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className={cn(
                    "text-2xl font-black",
                    isActive ? 'text-primary' : 'text-foreground'
                  )}>
                    {card.count ?? '—'}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {contentMap[activeCard] || (
          <div className="text-center py-12 text-muted-foreground">
            Select a section above to view details.
          </div>
        )}
      </div>
    </div>
  );
}
