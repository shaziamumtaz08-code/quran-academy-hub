import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SURAHS } from '@/lib/quranData';
import { cn } from '@/lib/utils';
import { BookCover, BookIndex, IndexEntry } from './BookFront';

export interface MushafIndexData {
  /** Juz number -> first page. */
  juz: { number: number; page: number }[];
  /** Surah number -> first page. */
  surah: { number: number; page: number }[];
}

/** Real navigation data taken from the Mushaf edition already in the database. */
export function useMushafIndex(editionId: string | null): MushafIndexData {
  const [data, setData] = useState<MushafIndexData>({ juz: [], surah: [] });
  useEffect(() => {
    if (!editionId) return;
    let cancelled = false;
    void (async () => {
      const [pagesRes, linesRes] = await Promise.all([
        supabase
          .from('mushaf_pages')
          .select('page_number, juz_number')
          .eq('edition_id', editionId)
          .order('page_number'),
        supabase
          .from('mushaf_lines')
          .select('page_number, first_surah')
          .eq('edition_id', editionId)
          .eq('first_ayah', 1)
          .order('page_number'),
      ]);
      if (cancelled) return;
      const juzFirst = new Map<number, number>();
      for (const p of (pagesRes.data as any[]) ?? []) {
        if (p.juz_number && !juzFirst.has(p.juz_number)) juzFirst.set(p.juz_number, p.page_number);
      }
      const surahFirst = new Map<number, number>();
      for (const l of (linesRes.data as any[]) ?? []) {
        if (l.first_surah && !surahFirst.has(l.first_surah)) surahFirst.set(l.first_surah, l.page_number);
      }
      setData({
        juz: [...juzFirst.entries()].sort((a, b) => a[0] - b[0]).map(([number, page]) => ({ number, page })),
        surah: [...surahFirst.entries()].sort((a, b) => a[0] - b[0]).map(([number, page]) => ({ number, page })),
      });
    })();
    return () => { cancelled = true; };
  }, [editionId]);
  return data;
}

export function MushafCover({ fontScale = 1, pages }: { fontScale?: number; pages: number }) {
  return (
    <BookCover
      fontScale={fontScale}
      arabicTitle="القرآن الكريم"
      title="Mushaf"
      subtitle="The complete Qur’an, page by page, in the Indo-Pak script used in class."
      note={`${pages} pages · 30 juz · 114 surahs`}
    />
  );
}

export function MushafIndexPage({
  index,
  fontScale = 1,
  onOpenPage,
}: {
  index: MushafIndexData;
  fontScale?: number;
  onOpenPage: (page: number) => void;
}) {
  const [view, setView] = useState<'juz' | 'surah'>('juz');
  const [surahPage, setSurahPage] = useState(0);
  const surahRows = useMemo(
    () =>
      index.surah.map((s) => ({
        ...s,
        info: SURAHS.find((x) => x.number === s.number),
      })),
    [index.surah],
  );
  /* Keep the surah view the same balanced length as the juz view:
     one tidy grid page of entries at a time, not one long scroll. */
  const SURAH_PER_PAGE = 39; // 3 columns × 13 rows
  const surahPages = Math.max(1, Math.ceil(surahRows.length / SURAH_PER_PAGE));
  const surahSlice = surahRows.slice(surahPage * SURAH_PER_PAGE, (surahPage + 1) * SURAH_PER_PAGE);

  const tab = (key: 'juz' | 'surah', label: string) => (
    <button
      key={key}
      type="button"
        onClick={() => { setView(key); setSurahPage(0); }}
      aria-pressed={view === key}
      className={cn(
        'h-8 rounded-lg border px-3 text-xs font-medium transition',
        view === key
          ? 'border-vcr-gold/70 bg-amber-50 text-slate-900'
          : 'border-slate-900/10 bg-white/60 text-slate-600 hover:text-slate-900',
      )}
    >
      {label}
    </button>
  );

  return (
    <BookIndex
      fontScale={fontScale}
      title="Index"
      subtitle="Jump straight to a juz or a surah — the reader opens at that page."
    >
      <div className="mb-3 flex justify-center gap-2">
        {tab('juz', 'By Juz')}
        {tab('surah', 'By Surah')}
      </div>

      {index.juz.length === 0 && index.surah.length === 0 ? (
        <p className="text-center text-sm text-slate-500">Loading the Qur’an index…</p>
      ) : view === 'juz' ? (
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {index.juz.map((j) => (
            <li key={j.number}>
              <IndexEntry
                ordinal={String(j.number)}
                title={`Juz ${j.number}`}
                meta={`Page ${j.page}`}
                onOpen={() => onOpenPage(j.page)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {surahSlice.map((s) => (
              <li key={s.number}>
                <IndexEntry
                  ordinal={String(s.number)}
                  title={s.info?.name ?? `Surah ${s.number}`}
                  meta={[s.info?.englishName, `Page ${s.page}`].filter(Boolean).join(' · ')}
                  onOpen={() => onOpenPage(s.page)}
                />
              </li>
            ))}
          </ul>
          {surahPages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {Array.from({ length: surahPages }, (_, i) => {
                const first = i * SURAH_PER_PAGE + 1;
                const last = Math.min(surahRows.length, (i + 1) * SURAH_PER_PAGE);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSurahPage(i)}
                    aria-pressed={surahPage === i}
                    className={cn(
                      'h-7 rounded-lg border px-2.5 text-[11px] font-medium transition',
                      surahPage === i
                        ? 'border-vcr-gold/70 bg-amber-50 text-slate-900'
                        : 'border-slate-900/10 bg-white/60 text-slate-600 hover:text-slate-900',
                    )}
                  >
                    {first}–{last}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </BookIndex>
  );
}
