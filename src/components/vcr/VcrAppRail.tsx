import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onToggle(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onToggle]);

  const launcher = (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Class apps"
      className={cn(
        'vcr-launcher z-50 overflow-hidden rounded-2xl border border-slate-900/10 bg-white/97 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl',
        isMobile
          ? 'fixed inset-x-3 bottom-3 z-[120]'
          : 'absolute start-[3.5rem] top-0 w-[15rem]',
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-900/8 bg-gradient-to-r from-cyan-50/60 via-white to-violet-50/60 px-3 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">Class apps</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Close class apps"
          className="ms-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="flex flex-col gap-0.5 p-2">
        {ITEMS.map(({ key, label, icon: Icon, accent }) => {
          const styles = ACCENT_STYLES[accent];
          const selected = active === key;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(key)}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-all',
                  selected
                    ? cn('bg-gradient-to-r from-slate-50 to-white shadow-sm ring-1', styles.ring)
                    : 'hover:bg-slate-50',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm transition-shadow',
                    styles.orb,
                    selected ? 'shadow-md' : 'group-hover:shadow-md',
                    styles.glow,
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', selected ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900')}>
                  {label}
                </span>
                {selected && (
                  <span className={cn('mr-1 h-1.5 w-1.5 rounded-full', styles.text.replace('text-', 'bg-'))} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (isMobile) {
    /* Portal to <body> so the launcher escapes any transformed/overflow
       ancestors inside the LMS layout — otherwise `fixed` positioning and
       taps can be trapped behind the lesson canvas. */
    return createPortal(
      <>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label="Class apps"
          className={cn(
            'fixed bottom-24 end-4 z-[100] inline-flex h-12 w-12 items-center justify-center rounded-full border border-vcr-gold/45 bg-vcr-gold/90 text-[#0C1B1E] shadow-lg active:scale-95 transition-transform',
          )}
        >
          <Grid2X2 className="h-5 w-5" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-[110] bg-slate-900/25" onClick={onToggle} aria-hidden />
            {launcher}
          </>
        )}
      </>,
      document.body,
    );
  }

  return (
    <div className="relative shrink-0">
      <nav
        aria-label="Class apps"
        className="flex w-[3rem] flex-col items-center gap-1 rounded-2xl border border-vcr-chrome/10 bg-white/5 p-1.5"
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label="Class apps"
          title="Class apps"
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
            open
              ? 'bg-vcr-gold/20 text-vcr-gold'
              : 'text-vcr-chrome/60 hover:bg-white/10 hover:text-vcr-chrome',
          )}
        >
          <Grid2X2 className="h-[18px] w-[18px]" />
        </button>
      </nav>
      {open && launcher}
    </div>
  );
}
