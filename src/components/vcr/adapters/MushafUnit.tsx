import React, { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fetchPage, surahNameByNumber, type MushafLine, type MushafPageInfo } from '@/lib/mushafResolve';
import { TajweedText, TajweedLegend } from '@/components/qaida/TajweedText';
import type { VcrRenderContext } from '../adapter';

interface Props extends VcrRenderContext {
  editionId: string | null;
  page: number;
  onInfo?: (info: MushafPageInfo | null) => void;
  /** Teacher can point at a line; the student's screen follows the pointer. */
  canPoint?: boolean;
  onPointLine?: (lineId: string | null) => void;
}

/**
 * One Mushaf page (Indo-Pak 15-line Qudratullah layout, RTL).
 *
 * Typography: the same self-hosted QUL Indo-Pak Nastaleeq Hanafi face used by
 * Noorani Qaida, and the same tajweed rule colouring, so both readers match.
 * Surface: pastel watercolour wash + frosted-glass line tiles (no parchment).
 * The teacher can tap a line to point at it while teaching; the same line
 * lights up on the student's screen.
 */
export function MushafUnit({ editionId, page, fontScale, highlight, onInfo, canPoint = false, onPointLine }: Props) {
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointed, setPointed] = useState<string | null>(null);

  useEffect(() => { setPointed(null); }, [page]);


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

  const texts = useMemo(
    () => lines.map((l) => l.text_indopak || '').filter(Boolean),
    [lines],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full bg-white/60" />)}
      </div>
    );
  }

  if (lines.length === 0) {
    return <p className="py-16 text-center text-2xl text-slate-600">No page data available for page {page}.</p>;
  }

  return (
    <div className="space-y-4">
      <div dir="rtl" className="space-y-1.5">
        {lines.map((l, idx) => {
          if (l.line_type === 'surah_name' || l.line_type === 'basmallah') {
            const heading = l.line_type === 'basmallah'
              ? 'بِسۡمِ اللهِ الرَّحۡمٰنِ الرَّحِيۡمِ'
              : l.text_indopak || surahNameByNumber(l.surah_number);
            if (!heading) return null;
            return (
              <div
                key={l.id}
                className={cn('qaida-tile mb-2 px-4 py-2 text-center', idx === 0 ? 'mt-0' : 'mt-2')}
              >
                <TajweedText
                  text={heading}
                  className="text-slate-800"
                  style={{ fontSize: `${26 * fontScale}px`, lineHeight: 2 }}
                  plain={l.line_type === 'surah_name'}
                />
              </div>
            );
          }
          if (!l.text_indopak) return <div key={l.id} className="h-2" aria-hidden />;
          const lit = (canPoint ? pointed : highlight?.lineId) === l.id;
          return (
            <div
              key={l.id}
              role={canPoint ? 'button' : undefined}
              tabIndex={canPoint ? 0 : undefined}
              onClick={canPoint ? () => {
                const next = pointed === l.id ? null : l.id;
                setPointed(next);
                onPointLine?.(next);
              } : undefined}
              title={canPoint ? 'Point at this line' : undefined}
              className={cn(
                'qaida-tile px-3 py-1.5 transition-all',
                l.is_centered ? 'text-center' : 'text-justify',
                canPoint && 'cursor-pointer hover:ring-2 hover:ring-primary/30',
                lit && 'qaida-tile-selected scale-[1.01] shadow-lg ring-2 ring-amber-400',
              )}
            >
              <TajweedText
                text={l.text_indopak}
                className="block text-slate-900"
                style={{ fontSize: `${32 * fontScale}px`, lineHeight: 2.1 }}
              />
            </div>
          );

        })}
      </div>

      <TajweedLegend texts={texts} className="pt-1 opacity-90" />
    </div>
  );
}

export default MushafUnit;
