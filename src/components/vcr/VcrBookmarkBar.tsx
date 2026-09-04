import React from 'react';
import { Bookmark, BookmarkPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VcrBookmark } from '@/hooks/useVcrBookmarks';

interface Props {
  bookmarks: VcrBookmark[];
  currentUnit: number;
  unitNoun?: string;
  canAdd?: boolean;
  onAdd: (unit: number) => void;
  onOpen: (unit: number) => void;
  onRemove: (id: string) => void;
}

/** Shared bookmark strip — same behaviour for Mushaf, Qaida and Library files. */
export function VcrBookmarkBar({
  bookmarks,
  currentUnit,
  unitNoun = 'page',
  canAdd = true,
  onAdd,
  onOpen,
  onRemove,
}: Props) {
  const already = bookmarks.some((b) => b.unit === currentUnit);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-vcr-chrome/15 bg-black/10 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-vcr-chrome/50">
        <Bookmark className="h-3.5 w-3.5" /> Bookmarks
      </span>

      {canAdd && (
        <button
          type="button"
          onClick={() => onAdd(currentUnit)}
          disabled={already}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors',
            already
              ? 'border-vcr-chrome/15 text-vcr-chrome/35'
              : 'border-vcr-gold/50 text-vcr-gold hover:bg-vcr-gold/10',
          )}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          {already ? `${unitNoun} ${currentUnit} saved` : `Save ${unitNoun} ${currentUnit}`}
        </button>
      )}

      {bookmarks.length === 0 ? (
        <span className="text-xs text-vcr-chrome/45">Nothing saved yet.</span>
      ) : (
        bookmarks.map((b) => (
          <span
            key={b.id}
            className={cn(
              'group inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs transition-colors',
              b.unit === currentUnit
                ? 'border-vcr-gold bg-vcr-gold/15 text-vcr-gold'
                : 'border-vcr-chrome/20 text-vcr-chrome/70 hover:text-vcr-chrome',
            )}
          >
            <button type="button" onClick={() => onOpen(b.unit)}>
              {b.label || `${unitNoun} ${b.unit}`}
            </button>
            <button
              type="button"
              aria-label="Remove bookmark"
              onClick={() => onRemove(b.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))
      )}
    </div>
  );
}
