import React, { useEffect } from 'react';
import {
  BookMarked, Chrome, Folder, Grid2X2, HardDrive, Library,
  Link2, PlayCircle, Presentation, Video, X, Youtube,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type VcrRailKey =
  | 'drive' | 'youtube' | 'google' | 'url' | 'whiteboard'
  | 'recordings' | 'syllabus' | 'myspace' | 'library' | 'zoom';

interface RailItem {
  key: VcrRailKey;
  label: string;
  icon: React.ElementType;
  /** AI-style accent colour for the icon. */
  accent: string;
}

/** Syllabus first — it is the source of Qaida, Mushaf and every set book. */
const ITEMS: RailItem[] = [
  { key: 'syllabus', label: 'Syllabus', icon: BookMarked, accent: 'amber' },
  { key: 'whiteboard', label: 'Whiteboard', icon: Presentation, accent: 'violet' },
  { key: 'drive', label: 'Google Drive', icon: HardDrive, accent: 'blue' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, accent: 'rose' },
  { key: 'google', label: 'Google', icon: Chrome, accent: 'cyan' },
  { key: 'url', label: 'URL / Web', icon: Link2, accent: 'teal' },
  { key: 'recordings', label: 'Recordings', icon: PlayCircle, accent: 'fuchsia' },
  { key: 'myspace', label: 'My Drive', icon: Folder, accent: 'sky' },
  { key: 'library', label: 'Library', icon: Library, accent: 'emerald' },
  { key: 'zoom', label: 'Zoom', icon: Video, accent: 'indigo' },
];

const ACCENT_STYLES: Record<string, { text: string; ring: string }> = {
  amber:   { text: 'text-amber-600',   ring: 'ring-amber-400/40' },
  violet:  { text: 'text-violet-600',  ring: 'ring-violet-400/40' },
  blue:    { text: 'text-blue-600',    ring: 'ring-blue-400/40' },
  rose:    { text: 'text-rose-600',    ring: 'ring-rose-400/40' },
  cyan:    { text: 'text-cyan-600',    ring: 'ring-cyan-400/40' },
  teal:    { text: 'text-teal-600',    ring: 'ring-teal-400/40' },
  fuchsia: { text: 'text-fuchsia-600', ring: 'ring-fuchsia-400/40' },
  sky:     { text: 'text-sky-600',     ring: 'ring-sky-400/40' },
  emerald: { text: 'text-emerald-600', ring: 'ring-emerald-400/40' },
  indigo:  { text: 'text-indigo-600',  ring: 'ring-indigo-400/40' },
};

interface Props {
  active: VcrRailKey | null;
  /** Is the launcher popover showing? */
  open: boolean;
  onToggle: () => void;
  onSelect: (key: VcrRailKey) => void;
  isMobile?: boolean;
  className?: string;
}

/**
 * The VCR's own app launcher. A very slim icon-only rail whose first control
 * opens a light vertical launcher menu. Users scroll the list with the rail's
 * own scrollbar; there are no up/down buttons. Icons sit on clean white
 * backgrounds and pop out on hover, revealing their label.
 */
export function VcrAppRail({ active, open, onToggle, onSelect, isMobile = false, className }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggle(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onToggle]);

  return (
    <div className="relative z-40 shrink-0 self-start">
      <nav
        aria-label="Class apps"
        className={cn(
          'flex w-11 flex-col items-center gap-1 overflow-visible rounded-md border border-vcr-chrome/15 bg-background/95 p-1 shadow-sm backdrop-blur-md',
          isMobile ? 'sticky top-2' : 'sticky top-4',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? 'Close class apps' : 'Open class apps'}
          title={open ? 'Close class apps' : 'Class apps'}
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
            open
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {open ? <X className="h-[18px] w-[18px]" /> : <Grid2X2 className="h-[18px] w-[18px]" />}
        </button>

        {open && <div className="h-px w-6 shrink-0 bg-border" aria-hidden />}

        {open && (
          <TooltipProvider delayDuration={120}>
            <ul className="flex max-h-[calc(100dvh-12rem)] w-full flex-col items-center gap-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ITEMS.map(({ key, label, icon: Icon, accent }) => {
                const styles = ACCENT_STYLES[accent];
                const selected = active === key;
                return (
                  <li key={key} className="shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onSelect(key)}
                          aria-current={selected ? 'true' : undefined}
                          aria-label={label}
                          className={cn(
                            'group relative inline-flex h-9 w-9 items-center justify-center rounded-md bg-background transition-all',
                            selected
                              ? cn('ring-1 shadow-sm', styles.ring)
                              : 'hover:scale-110 hover:shadow-md',
                          )}
                        >
                          <Icon className={cn('h-4 w-4 transition-transform group-hover:scale-110', styles.text)} />
                          {selected && (
                            <span className={cn('absolute -end-0.5 h-1.5 w-1.5 rounded-full', styles.text.replace('text-', 'bg-'))} />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
                        {label}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </TooltipProvider>
        )}
      </nav>
    </div>
  );
}
