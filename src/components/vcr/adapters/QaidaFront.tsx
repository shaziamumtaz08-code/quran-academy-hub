import React from 'react';
import { BookCover, BookIndex, IndexEntry } from './BookFront';
import type { QaidaBaab } from '@/hooks/useQaidaProgress';

export function QaidaCover({ fontScale = 1, pages }: { fontScale?: number; pages: number }) {
  return (
    <BookCover
      fontScale={fontScale}
      arabicTitle="القاعدة النورانية"
      title="Noorani Qaida"
      subtitle="The complete foundation book for reading the Qur’an — letters, sounds, joining and tajweed."
      note={`${pages} pages · one complete book`}
    />
  );
}

export function QaidaIndexPage({
  baabs,
  fontScale = 1,
  onOpenPage,
}: {
  baabs: QaidaBaab[];
  fontScale?: number;
  onOpenPage: (page: number) => void;
}) {
  return (
    <BookIndex
      fontScale={fontScale}
      title="Index"
      subtitle="Every chapter of the Qaida, in order. Tap a chapter to open its first page."
    >
      {baabs.length === 0 ? (
        <p className="text-center text-sm text-slate-500">Loading the chapters…</p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {baabs.map((b) => (
            <li key={b.id}>
              <IndexEntry
                ordinal={String(b.baab_number)}
                title={b.name_english || `Baab ${b.baab_number}`}
                arabic={b.name_urdu}
                meta={b.start_page === b.end_page ? `Page ${b.start_page}` : `Pages ${b.start_page}–${b.end_page}`}
                onOpen={() => onOpenPage(b.start_page)}
              />
            </li>
          ))}
        </ul>
      )}
    </BookIndex>
  );
}
