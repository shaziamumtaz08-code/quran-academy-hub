import React, { useEffect, useRef } from 'react';
import {
  BookMarked, Folder, Grid2X2, HardDrive, Library,
  Link2, PhoneCall, PlayCircle, Presentation, X, Youtube,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type VcrRailKey =
  | 'drive' | 'youtube' | 'url' | 'whiteboard' | 'call'
  | 'recordings' | 'syllabus' | 'myspace' | 'library';

/** Syllabus first — it is the source of Qaida, Mushaf and every set book. */
const ITEMS: { key: VcrRailKey; label: string; icon: React.ElementType }[] = [
  { key: 'syllabus', label: 'Syllabus', icon: BookMarked },
  { key: 'drive', label: 'Google Drive', icon: HardDrive },
  { key: 'youtube', label: 'YouTube', icon: Youtube },
  { key: 'url', label: 'Web link', icon: Link2 },
  { key: 'whiteboard', label: 'Whiteboard', icon: Presentation },
  { key: 'call', label: 'Voice call', icon: PhoneCall },
  { key: 'recordings', label: 'Recordings', icon: PlayCircle },
  { key: 'myspace', label: 'My Drive', icon: Folder },
  { key: 'library', label: 'Library', icon: Library },
];

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
 * whose first control opens a light, compact launcher popover. It is entirely
 * separate from the LMS main sidebar and never navigates out of the class.
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
        'vcr-launcher z-50 overflow-hidden rounded-2xl border border-slate-900/10 bg-white/95 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl',
        isMobile
          ? 'fixed inset-x-3 bottom-3'
          : 'absolute start-[3.5rem] top-0 w-[19rem]',
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-900/8 bg-gradient-to-r from-vcr-gold/12 via-transparent to-sky-400/10 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Class apps</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Close class apps"
          className="ms-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ul className="grid grid-cols-3 gap-1 p-2">
        {ITEMS.map(({ key, label, icon: Icon }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(key)}
              aria-current={active === key ? 'true' : undefined}
              className={cn(
                'flex h-[4.25rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl px-1 text-center transition-colors',
                active === key
                  ? 'bg-vcr-gold/18 text-slate-900 ring-1 ring-vcr-gold/50'
                  : 'text-slate-700 hover:bg-slate-900/5',
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0 text-slate-700" />
              <span className="w-full truncate px-0.5 text-[11px] font-medium leading-tight">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label="Class apps"
          className={cn(
            'fixed bottom-4 end-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-vcr-gold/45 bg-vcr-gold/90 text-[#0C1B1E] shadow-lg',
          )}
        >
          <Grid2X2 className="h-5 w-5" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40 bg-slate-900/25" onClick={onToggle} aria-hidden />
            {launcher}
          </>
        )}
      </>
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
          title="Class apps"
          aria-label="Class apps"
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
            open
              ? 'bg-vcr-gold/20 text-vcr-gold ring-1 ring-vcr-gold/40'
              : 'text-vcr-chrome/70 hover:bg-white/10 hover:text-vcr-chrome',
          )}
        >
          <Grid2X2 className="h-[18px] w-[18px]" />
        </button>
        <span className="my-0.5 h-px w-6 bg-vcr-chrome/10" aria-hidden />
        {ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            title={label}
            aria-label={label}
            aria-current={active === key ? 'true' : undefined}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
              active === key
                ? 'bg-vcr-gold/18 text-vcr-gold'
                : 'text-vcr-chrome/55 hover:bg-white/10 hover:text-vcr-chrome',
            )}
          >
            <Icon className="h-[17px] w-[17px]" />
          </button>
        ))}
      </nav>
      {open && launcher}
    </div>
  );
}
