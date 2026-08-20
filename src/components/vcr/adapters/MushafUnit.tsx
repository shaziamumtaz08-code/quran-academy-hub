import React, { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fetchPage, surahNameByNumber, type MushafLine, type MushafPageInfo } from '@/lib/mushafResolve';
import type { VcrRenderContext } from '../adapter';

interface Props extends VcrRenderContext {
  editionId: string | null;
  page: number;
  onInfo?: (info: MushafPageInfo | null) => void;
}

/** Renders one Mushaf page (RTL, IndoPak lines) inside the reader shell. */
export function MushafUnit({ editionId, page, fontScale, highlight, onInfo }: Props) {
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!editionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetchPage(editionId, page);
      if (cancelled) return;
      setLines(res.lines);
      setLoading(false);
      onInfo?.(res.info);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId, page]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full bg-vcr-ink/10" />)}
      </div>
    );
  }

  if (lines.length === 0) {
    return <p className="py-16 text-center text-2xl text-vcr-ink/60">No page data available for page {page}.</p>;
  }

  return (
    <div dir="rtl" className="space-y-1">
      {lines.map((l) => {
        if (l.line_type === 'surah_name') {
          return (
            <div
              key={l.id}
              className="my-3 rounded-lg border border-vcr-gold/50 bg-vcr-gold/10 py-2 text-center font-uthmani text-vcr-ink"
              style={{ fontSize: `${28 * fontScale}px` }}
            >
              {l.text_indopak || surahNameByNumber(l.surah_number)}
            </div>
          );
        }
        return (
          <p
            key={l.id}
            className={cn(
              'rounded-md font-uthmani leading-[2.1] text-vcr-ink transition-colors',
              l.is_centered || l.line_type === 'basmallah' ? 'text-center' : 'text-justify',
              highlight?.lineId === l.id && 'bg-vcr-gold/25 ring-1 ring-vcr-gold/60'
            )}
            style={{ fontSize: `${32 * fontScale}px` }}
          >
            {l.text_indopak}
          </p>
        );
      })}
    </div>
  );
}

export default MushafUnit;
