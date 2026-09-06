import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VcrTabKind =
  | 'lesson' | 'syllabus' | 'library' | 'myspace'
  | 'whiteboard' | 'recordings' | 'web';

export interface VcrTab {
  id: string;
  kind: VcrTabKind;
  title: string;
  icon: React.ElementType;
  /** Pinned tabs stay for the whole class and cannot be closed. */
  pinned?: boolean;
  /** Web tabs only. */
  url?: string;
  app?: 'drive' | 'youtube' | 'google' | 'url';
}

interface Props {
  tabs: VcrTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  /** The apps launcher trigger lives at the start of the strip. */
  leading?: React.ReactNode;
}

/**
 * A thin, browser-like tab strip across the top of the classroom canvas.
 * Deliberately slim: the lesson page is the hero, tabs are just navigation.
 */
export function VcrTabStrip({ tabs, activeId, onSelect, onClose, leading }: Props) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      {leading}
      <div
        role="tablist"
        aria-label="Open in this class"
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.06] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              className={cn(
                'group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full ps-2.5 pe-1.5 text-xs transition-colors',
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-vcr-chrome/65 hover:bg-white/10 hover:text-vcr-chrome',
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(t.id)}
                className="inline-flex max-w-[11rem] items-center gap-1.5"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.title}</span>
              </button>
              {t.pinned ? (
                <span className="w-1.5" aria-hidden />
              ) : (
                <button
                  type="button"
                  onClick={() => onClose(t.id)}
                  aria-label={`Close ${t.title}`}
                  className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full',
                    active ? 'text-slate-400 hover:bg-slate-900/10 hover:text-slate-700' : 'text-vcr-chrome/45 hover:text-vcr-chrome',
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
