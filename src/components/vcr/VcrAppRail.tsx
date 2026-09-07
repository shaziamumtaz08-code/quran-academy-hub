import React, { useEffect } from 'react';
import {
  BookMarked, Chrome, Folder, Grid2X2, HardDrive, Library,
  Link2, PlayCircle, Presentation, Video, X, Youtube,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type VcrRailKey =
  | 'drive' | 'youtube' | 'google' | 'url' | 'whiteboard'
  | 'recordings' | 'syllabus' | 'myspace' | 'library' | 'zoom';

interface RailItem {
  key: VcrRailKey;
  label: string;
  icon: React.ElementType;
  /** AI-style accent colour for the icon orb and hover glow. */
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

const ACCENT_STYLES: Record<string, { orb: string; text: string; glow: string; ring: string }> = {
  amber:    { orb: 'bg-amber-100 text-amber-600',      text: 'text-amber-600',      glow: 'group-hover:shadow-amber-500/20',      ring: 'ring-amber-400/40' },
  violet:   { orb: 'bg-violet-100 text-violet-600',    text: 'text-violet-600',    glow: 'group-hover:shadow-violet-500/20',   ring: 'ring-violet-400/40' },
  blue:     { orb: 'bg-blue-100 text-blue-600',        text: 'text-blue-600',        glow: 'group-hover:shadow-blue-500/20',     ring: 'ring-blue-400/40' },
  rose:     { orb: 'bg-rose-100 text-rose-600',        text: 'text-rose-600',        glow: 'group-hover:shadow-rose-500/20',     ring: 'ring-rose-400/40' },
  cyan:     { orb: 'bg-cyan-100 text-cyan-600',        text: 'text-cyan-600',        glow: 'group-hover:shadow-cyan-500/20',     ring: 'ring-cyan-400/40' },
  teal:     { orb: 'bg-teal-100 text-teal-600',        text: 'text-teal-600',        glow: 'group-hover:shadow-teal-500/20',     ring: 'ring-teal-400/40' },
  fuchsia:  { orb: 'bg-fuchsia-100 text-fuchsia-600',  text: 'text-fuchsia-600',  glow: 'group-hover:shadow-fuchsia-500/20', ring: 'ring-fuchsia-400/40' },
  sky:      { orb: 'bg-sky-100 text-sky-600',          text: 'text-sky-600',          glow: 'group-hover:shadow-sky-500/20',     ring: 'ring-sky-400/40' },
  emerald:  { orb: 'bg-emerald-100 text-emerald-600',  text: 'text-emerald-600',  glow: 'group-hover:shadow-emerald-500/20', ring: 'ring-emerald-400/40' },
  indigo:   { orb: 'bg-indigo-100 text-indigo-600',    text: 'text-indigo-600',    glow: 'group-hover:shadow-indigo-500/20',  ring: 'ring-indigo-400/40' },
};

interface Props {
  active: VcrRailKey | null;
  /** Is the launcher popover showing? */
  open: boolean;
  onToggle: () => void;
  onSelect: (key: VcrRailKey) => void;
  isMobile?: boolean;
}

/**
 * The VCR's own app launcher. By default it is a very slim icon-only rail
 * whose first control opens a light, compact vertical launcher menu. It is
 * entirely separate from the LMS main sidebar and never navigates out of the class.
 */
export function VcrAppRail({ active, open, onToggle, onSelect, isMobile = false }: Props) {
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
          'flex w-11 flex-col items-center gap-1 overflow-y-auto rounded-md border border-vcr-chrome/15 bg-background/95 p-1 shadow-sm backdrop-blur-md',
          open && 'max-h-[calc(100dvh-8rem)]',
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

        {open && <ul className="flex flex-col items-center gap-1">
        {ITEMS.map(({ key, label, icon: Icon, accent }) => {
          const styles = ACCENT_STYLES[accent];
          const selected = active === key;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(key)}
                aria-current={selected ? 'true' : undefined}
                aria-label={label}
                title={label}
                className={cn(
                  'group relative inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                  selected
                    ? cn('bg-muted ring-1', styles.ring)
                    : 'hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-shadow',
                    styles.orb,
                    selected ? 'shadow-sm' : 'group-hover:shadow-sm',
                    styles.glow,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {selected && (
                  <span className={cn('absolute -end-0.5 h-1.5 w-1.5 rounded-full', styles.text.replace('text-', 'bg-'))} />
                )}
              </button>
            </li>
          );
        })}
        </ul>}
      </nav>
    </div>
  );
}
