import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QaidaUnit } from '@/components/vcr/adapters/QaidaUnit';
import { useQaidaReference, useQaidaWords, unitLabel, type QaidaWord } from '@/hooks/useQaidaProgress';

export interface QaidaTapSelection {
  baabId: string;
  baabNumber: number;
  pageNumber: number;
  pageId: string;
  /** Only for content baabs (word / phrase pickers). */
  wordFromId: string;
  wordToId: string;
  /** Continuous unit ordinals inside the baab — what progress maths uses. */
  unitFrom: string;
  unitTo: string;
}

interface Props {
  /** Baab currently chosen in the form (kept in sync both ways). */
  baabId?: string;
  onBaabIdChange?: (id: string) => void;
  /** Page to open on (e.g. the page shown in the Virtual Class Room). */
  initialPage?: number;
  onUseLesson: (selection: QaidaTapSelection) => void;
  className?: string;
}

/**
 * Tap-to-mark Qaida lesson picker.
 *
 * Content baabs (real words / phrases) render the page's actual words through
 * the shared QaidaUnit primitive — first tap is the start, second the end.
 * Pattern-drill baabs have no stored word content, so the same two-tap gesture
 * runs over the baab's numbered line tiles instead. Both write the identical
 * baab / page / unit-range fields the dropdown picker writes.
 */
export function QaidaTapPicker({ baabId = '', onBaabIdChange, initialPage, onUseLesson, className }: Props) {
  const { data: ref, isLoading } = useQaidaReference();
  const baabs = ref?.baabs || [];
  const [localBaabId, setLocalBaabId] = useState(baabId);

  useEffect(() => { if (baabId) setLocalBaabId(baabId); }, [baabId]);

  // Fall back to the baab covering the requested page, else the first baab.
  const effectiveBaabId = useMemo(() => {
    if (localBaabId) return localBaabId;
    if (initialPage) {
      const hit = baabs.find(b => initialPage >= b.start_page && initialPage <= b.end_page);
      if (hit) return hit.id;
    }
    return baabs[0]?.id || '';
  }, [localBaabId, initialPage, baabs]);

  const baab = baabs.find(b => b.id === effectiveBaabId) || null;
  const uLabel = unitLabel(baab?.unit_label);

  // Always try the real page content first — the same QaidaUnit page powers
  // reading, flashcards and this range picker. Pattern-drill baabs that have
  // no stored words fall back to numbered line tiles.
  const { data: wordsData } = useQaidaWords(effectiveBaabId || null);
  const words = useMemo(() => (wordsData || []) as QaidaWord[], [wordsData]);
  const isWordMode = words.length > 0;

  const ordinals = useMemo(() => {
    const m = new Map<string, number>();
    words.forEach((w, i) => m.set(w.id, i + 1));
    return m;
  }, [words]);

  const pages = useMemo(() => {
    if (isWordMode) return [...new Set(words.map(w => w.page_number))].sort((a, b) => a - b);
    if (!baab) return [];
    const out: number[] = [];
    for (let p = baab.start_page; p <= baab.end_page; p++) out.push(p);
    return out;
  }, [isWordMode, words, baab]);

  const [page, setPage] = useState<number>(initialPage || 1);
  useEffect(() => {
    if (pages.length === 0) return;
    setPage(p => (pages.includes(p) ? p : (initialPage && pages.includes(initialPage) ? initialPage : pages[0])));
  }, [pages, initialPage]);

  /* Two-tap range state — held as continuous unit ordinals so both modes share it. */
  const [fromUnit, setFromUnit] = useState<number | null>(null);
  const [toUnit, setToUnit] = useState<number | null>(null);

  const reset = () => { setFromUnit(null); setToUnit(null); };
  useEffect(() => { reset(); }, [effectiveBaabId]);

  const tapUnit = (n: number) => {
    if (fromUnit === null || toUnit !== null) { setFromUnit(n); setToUnit(null); return; }
    if (n < fromUnit) { setToUnit(fromUnit); setFromUnit(n); return; }
    setToUnit(n);
  };

  const lo = fromUnit ?? null;
  const hi = toUnit ?? fromUnit ?? null;

  const pageWords = useMemo(() => words.filter(w => w.page_number === page), [words, page]);
  const idFor = (n: number | null) => (n ? words[n - 1]?.id ?? '' : '');
  const inRangeIds = useMemo(() => {
    if (!lo || !hi) return [];
    return words.slice(lo - 1, hi).map(w => w.id);
  }, [words, lo, hi]);

  const changeBaab = (id: string) => {
    setLocalBaabId(id);
    onBaabIdChange?.(id);
    const b = baabs.find(x => x.id === id);
    if (b) setPage(b.start_page);
    reset();
  };

  const apply = () => {
    if (!baab || !lo || !hi) return;
    const pageNumber = isWordMode ? (words[lo - 1]?.page_number ?? page) : page;
    const pageRow = ref?.pages.find(p => p.page_number === pageNumber);
    onUseLesson({
      baabId: baab.id,
      baabNumber: baab.baab_number,
      pageNumber,
      pageId: pageRow?.id || '',
      wordFromId: isWordMode ? idFor(lo) : '',
      wordToId: isWordMode ? idFor(hi) : '',
      unitFrom: String(lo),
      unitTo: String(hi),
    });
  };

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  const pageIdx = pages.indexOf(page);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={effectiveBaabId} onValueChange={changeBaab}>
          <SelectTrigger className="h-9 w-full sm:w-[19rem]"><SelectValue placeholder="Select baab" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {baabs.map(b => (
              <SelectItem key={b.id} value={b.id}>
                Baab {b.baab_number}: {b.name_urdu} / {b.name_english}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {baab && (
          <Badge variant="secondary" className="text-[10px]">
            {baab.total_units} {uLabel.toLowerCase()}s
          </Badge>
        )}
      </div>

      {pages.length > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pageIdx <= 0}
            onClick={() => setPage(pages[Math.max(0, pageIdx - 1)])}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page}</span>
          <Button type="button" variant="outline" size="sm" disabled={pageIdx >= pages.length - 1}
            onClick={() => setPage(pages[Math.min(pages.length - 1, pageIdx + 1)])}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-[hsl(var(--vcr-parchment,45_45%_95%))] p-2 sm:p-3 dark:border-amber-900/50">
        {isWordMode ? (
          pageWords.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No word content stored for this page.</p>
          ) : (
            <QaidaUnit
              mode="select"
              page={page}
              words={pageWords}
              fontScale={1}
              highlight={null}
              fromId={idFor(lo)}
              toId={idFor(hi)}
              inRangeIds={inRangeIds}
              onTapWord={(w) => { const n = ordinals.get(w.id); if (n) tapUnit(n); }}
            />
          )
        ) : (
          <div dir="rtl" className="flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: baab?.total_units || 0 }).map((_, i) => {
              const n = i + 1;
              const isEnd = n === lo || n === hi;
              const inRange = lo && hi ? n > lo && n < hi : false;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => tapUnit(n)}
                  className={cn(
                    'h-9 min-w-9 rounded-lg border px-2 text-sm font-mono transition-colors',
                    isEnd ? 'border-primary bg-primary/20 ring-2 ring-primary'
                      : inRange ? 'border-primary/40 bg-primary/10'
                      : 'border-border bg-background hover:border-primary/50'
                  )}
                >
                  {n}
                </button>
              );
            })}
            <p className="w-full pt-2 text-center text-xs text-muted-foreground" dir="ltr">
              Tap the first {uLabel.toLowerCase()} of the lesson, then the last one.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {lo ? `${uLabel} ${lo}${hi && hi !== lo ? `–${hi}` : ''}` : `No ${uLabel.toLowerCase()} selected yet`}
        </span>
        <div className="ms-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!lo}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
          <Button type="button" size="sm" onClick={apply} disabled={!lo}>
            <Check className="mr-1 h-4 w-4" /> Use this lesson
          </Button>
        </div>
      </div>
    </div>
  );
}

export default QaidaTapPicker;
