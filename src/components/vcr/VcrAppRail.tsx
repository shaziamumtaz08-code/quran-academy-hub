import React from 'react';
import {
  BookMarked, ChevronLeft, ChevronRight, Folder, HardDrive, Library,
  Link2, PhoneCall, PlayCircle, Square, Youtube,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type VcrRailKey =
  | 'drive' | 'youtube' | 'url' | 'whiteboard' | 'call'
  | 'recordings' | 'syllabus' | 'myspace' | 'library';

const ITEMS: { key: VcrRailKey; label: string; hint: string; icon: React.ElementType }[] = [
  { key: 'drive', label: 'Google Drive', hint: 'Show a Drive file or folder', icon: HardDrive },
  { key: 'youtube', label: 'YouTube', hint: 'Play a video together', icon: Youtube },
  { key: 'url', label: 'URL', hint: 'Open a web page', icon: Link2 },
  { key: 'whiteboard', label: 'Whiteboard', hint: 'Blank board to write on', icon: Square },
  { key: 'call', label: 'Voice Call', hint: 'Talk to the class', icon: PhoneCall },
  { key: 'recordings', label: 'Recordings', hint: 'Saved class recordings', icon: PlayCircle },
  { key: 'syllabus', label: 'Syllabus', hint: 'Qaida, Mushaf and set books', icon: BookMarked },
  { key: 'myspace', label: 'My Drive', hint: 'My own files and copies', icon: Folder },
  { key: 'library', label: 'Library', hint: 'Academy library', icon: Library },
];

interface Props {
  active: VcrRailKey | null;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (key: VcrRailKey) => void;
}

/**
 * The VCR's own vertical app rail. It lives inside the classroom working area
 * and is completely separate from the LMS main sidebar — nothing here ever
 * navigates the student into general LMS navigation.
 */
export function VcrAppRail({ active, expanded, onToggle, onSelect }: Props) {
  return (
    <nav
      aria-label="Classroom apps"
      className={cn(
        'shrink-0 self-start rounded-2xl border border-vcr-chrome/12 bg-black/25 p-2 transition-all',
        expanded ? 'w-[13.5rem]' : 'w-[3.75rem]',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        title={expanded ? 'Collapse to icons' : 'Show labels'}
        className="mb-1 flex h-9 w-full items-center justify-center gap-2 rounded-xl text-vcr-chrome/60 transition-colors hover:bg-white/5 hover:text-vcr-chrome"
      >
        {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {expanded && <span className="text-xs font-semibold uppercase tracking-wider">Class apps</span>}
      </button>

      <ul className="space-y-1">
        {ITEMS.map(({ key, label, hint, icon: Icon }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(key)}
              aria-current={active === key ? 'true' : undefined}
              title={expanded ? hint : `${label} — ${hint}`}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                expanded ? '' : 'justify-center px-0',
                active === key
                  ? 'bg-vcr-gold/15 text-vcr-gold'
                  : 'text-vcr-chrome/70 hover:bg-white/5 hover:text-vcr-chrome',
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {expanded && (
                <span className="min-w-0">
                  <span className="block truncate leading-tight">{label}</span>
                  <span className="block truncate text-[11px] leading-tight text-vcr-chrome/45">{hint}</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
