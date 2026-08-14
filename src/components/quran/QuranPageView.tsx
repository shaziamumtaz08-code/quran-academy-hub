import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, RotateCcw, Check } from 'lucide-react';
import { formatLessonSegment, type LessonMarkerType, type LessonSegment } from '@/lib/lessonFormat';
import {
  fetchPage,
  getDefaultEditionId,
  resolveSegment,
  surahNameByNumber,
  type MushafLine,
  type MushafPageInfo,
  type TapPoint,
} from '@/lib/mushafResolve';
import { cn } from '@/lib/utils';

const TOTAL_PAGES = 610;

/** Arabic-Indic numerals, as printed in an Indo-Pak mushaf */
const toArabicDigits = (n: number) =>
  String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

const fromArabicDigits = (s: string) =>
  Number(s.replace(/[٠-٩۰-۹]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d) >= 0
    ? '٠١٢٣٤٥٦٧٨٩'.indexOf(d)
    : '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));

interface LineToken {
  text: string;
  ayah?: number | null;
  surah?: number | null;
}

/**
 * Splits an IndoPak line into plain text and the round end-of-verse marks,
 * so each verse sign becomes its own tappable medallion.
 */
function splitAyahMarks(line: MushafLine): LineToken[] {
  const text = line.text_indopak ?? '';
  const parts = text.split(/([٠-٩۰-۹]+)/);
  let surah = line.first_surah ?? null;
  let prev: number | null = null;
  return parts
    .filter((p) => p !== '')
    .map((p) => {
      if (!/^[٠-٩۰-۹]+$/.test(p)) return { text: p };
      const ayah = fromArabicDigits(p);
      // a number lower than the previous one means a new surah started on this line
      if (prev !== null && ayah <= prev) surah = (surah ?? 0) + 1;
      prev = ayah;
      return { text: p, ayah, surah };
    });
}


interface Props {
  /** Marker type the teacher is using — the emitted segment matches it. */
  markerType?: LessonMarkerType;
  initialPage?: number;
  /** Called with the normalized segment when the teacher confirms. */
  onUseLesson?: (segment: LessonSegment) => void;
  /** Called to append the selection as an additional segment. */
  onAddSegment?: (segment: LessonSegment) => void;
  /** Screen-share friendly: larger text, calmer chrome. */
  presentation?: boolean;
  className?: string;
}

export function QuranPageView({
  markerType = 'ayah',
  initialPage = 1,
  onUseLesson,
  onAddSegment,
  presentation = false,
  className,
}: Props) {
  const [editionId, setEditionId] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [info, setInfo] = useState<MushafPageInfo | null>(null);
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [flip, setFlip] = useState<'next' | 'prev' | null>(null);
  const [start, setStart] = useState<TapPoint | null>(null);
  const [end, setEnd] = useState<TapPoint | null>(null);
  const [preview, setPreview] = useState<LessonSegment | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    getDefaultEditionId().then(setEditionId);
  }, []);

  useEffect(() => {
    if (!editionId) return;
    let cancelled = false;
    setLoading(true);
    fetchPage(editionId, page).then(({ info, lines }) => {
      if (cancelled) return;
      setInfo(info);
      setLines(lines);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [editionId, page]);

  // Recompute the normalized preview whenever the selection or marker changes
  useEffect(() => {
    if (!start) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    resolveSegment(markerType, start, end).then((seg) => {
      if (!cancelled) setPreview(seg);
    });
    return () => {
      cancelled = true;
    };
  }, [start, end, markerType]);

  const goto = useCallback(
    (p: number) => {
      const next = Math.min(TOTAL_PAGES, Math.max(1, p));
      if (next === page) return;
      setFlip(next > page ? 'next' : 'prev');
      // swap the content mid-turn, while the sheet is nearly edge-on
      window.setTimeout(() => setPage(next), 240);
      window.setTimeout(() => setFlip(null), 520);
    },
    [page]
  );


  // Arrow-key page turning (RTL mushaf: left arrow = next page)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === 'ArrowLeft') goto(page + 1);
      if (e.key === 'ArrowRight') goto(page - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goto, page]);

  const handleTap = (line: MushafLine, ayahAt?: { surah: number; ayah: number } | null) => {
    if (line.line_type !== 'ayah' || !line.first_surah) return;
    const point: TapPoint = { page, line, ayahAt: ayahAt ?? null };
    if (!start || (start && end)) {
      setStart(point);
      setEnd(null);
      return;
    }
    // second tap sets the end — swap when tapped before the start
    const before =
      point.page < start.page ||
      (point.page === start.page && point.line.line_number < start.line.line_number);
    if (before) {
      setEnd(start);
      setStart(point);
    } else {
      setEnd(point);
    }
  };

  const key = (p: number, l: number) => p * 100 + l;
  const isAyahMarked = (p: number, surah: number, ayah: number) =>
    [start, end].some(
      (m) => m?.page === p && m?.ayahAt?.surah === surah && m?.ayahAt?.ayah === ayah
    );
  const isSelected = (line: MushafLine) => {

    if (!start) return false;
    const e = end ?? start;
    const k = key(page, line.line_number);
    return k >= key(start.page, start.line.line_number) && k <= key(e.page, e.line.line_number);
  };

  const previewText = preview ? formatLessonSegment(preview) : '';
  const clear = () => {
    setStart(null);
    setEnd(null);
  };

  const pointLabel = (p: TapPoint) =>
    p.ayahAt
      ? `${surahNameByNumber(p.ayahAt.surah)}, verse ${p.ayahAt.ayah} (page ${p.page})`
      : `End of line ${p.line.line_number}, page ${p.page}`;

  const startLabel = start ? pointLabel(start) : null;
  const endLabel = end
    ? pointLabel(end)
    : start
      ? 'Same line (tap another line or verse sign to extend)'
      : null;


  return (
    <div className={cn('space-y-4', className)}>
      {/* Book chrome: page turner, no dropdowns */}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" className="rounded-full gap-1" onClick={() => goto(page - 1)} disabled={page <= 1}>
          <ChevronRight className="h-4 w-4" />
          Previous
        </Button>
        <div className="flex items-center gap-2">
          {info?.juz_number && <Badge variant="secondary">Juz {info.juz_number}</Badge>}
          {info?.surah_start && <Badge variant="outline">{surahNameByNumber(info.surah_start)}</Badge>}
        </div>
        <Button type="button" variant="outline" className="rounded-full gap-1" onClick={() => goto(page + 1)} disabled={page >= TOTAL_PAGES}>
          Next
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Mushaf page */}
      <div className="book-stage">
        <div
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 60) goto(dx > 0 ? page - 1 : page + 1);
            touchX.current = null;
          }}
          className={cn(
            'book-page relative overflow-hidden rounded-[1.25rem] border-4 border-primary/25 bg-[hsl(var(--card))] shadow-lg p-2',
            flip === 'next' && 'animate-page-turn-next',
            flip === 'prev' && 'animate-page-turn-prev'
          )}
          dir="rtl"
        >
          {/* Spine shading — the gutter of the bound book */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-foreground/15 to-transparent rounded-l-[1.1rem]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-foreground/5 to-transparent rounded-r-[1.1rem]" />
          {flip && (
            <div className="page-sheen pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-background/70 to-transparent" />
          )}
        <div className="rounded-[0.9rem] border border-primary/30 px-3 py-4 sm:px-6 sm:py-6">

          {/* Running head */}
          <div className="flex items-center justify-between border-b border-primary/20 pb-2 mb-3 text-xs text-muted-foreground">
            <span className="mushaf-text text-base">{info?.surah_start ? surahNameByNumber(info.surah_start) : ''}</span>
            <span>{info?.juz_number ? `الجزء ${toArabicDigits(info.juz_number)}` : ''}</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 15 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" dir="ltr">
              No layout data for this page.
            </p>
          ) : (
            <div className="space-y-0.5">
              {lines.map((line) => {
                const selectable = line.line_type === 'ayah' && !!line.first_surah;
                const selected = isSelected(line);
                const isStart = start?.page === page && start.line.line_number === line.line_number;
                const isEnd = end?.page === page && end.line.line_number === line.line_number;
                return (
                  <div
                    key={line.id}
                    role={selectable ? 'button' : undefined}
                    tabIndex={selectable ? 0 : undefined}
                    onClick={() => selectable && handleTap(line)}
                    onKeyDown={(e) => {
                      if (selectable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleTap(line);
                      }
                    }}
                    className={cn(
                      'relative w-full rounded-md px-3 py-1.5 transition-colors text-center',
                      selectable ? 'hover:bg-primary/10 cursor-pointer' : 'cursor-default',
                      selected && 'bg-primary/10',
                      (isStart || isEnd) && 'bg-primary/15 ring-1 ring-primary/50'
                    )}
                  >
                    {(isStart || isEnd) && (
                      <span
                        className="absolute -top-1 left-1 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground"
                        dir="ltr"
                      >
                        {isStart && isEnd ? 'Start & End' : isStart ? 'Start' : 'End'}
                      </span>
                    )}
                    {line.line_type === 'surah_name' ? (
                      <span className="inline-block rounded-md border border-primary/30 bg-primary/5 px-6 py-1 mushaf-text text-base font-semibold">
                        سورة {surahNameByNumber(line.surah_number)}
                      </span>
                    ) : line.line_type === 'basmallah' ? (
                      <span className="mushaf-text text-lg">بِسۡمِ اللهِ الرَّحۡمٰنِ الرَّحِيۡمِ</span>
                    ) : !line.text_indopak ? (
                      <span className="block h-6" aria-hidden />
                    ) : (
                      <span
                        className={cn(
                          'mushaf-text block',
                          presentation ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'
                        )}
                      >
                        {splitAyahMarks(line).map((tok, i) =>
                          tok.ayah == null ? (
                            <React.Fragment key={i}>{tok.text}</React.Fragment>
                          ) : (
                            <span
                              key={i}
                              role="button"
                              tabIndex={0}
                              title={`Mark at ${surahNameByNumber(tok.surah)}, verse ${tok.ayah}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTap(line, { surah: tok.surah!, ayah: tok.ayah! });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleTap(line, { surah: tok.surah!, ayah: tok.ayah! });
                                }
                              }}
                              className={cn(
                                'ayah-mark',
                                isAyahMarked(page, tok.surah!, tok.ayah!) && 'ayah-mark-active'
                              )}
                            >
                              {tok.text}
                            </span>
                          )
                        )}
                      </span>
                    )}
                  </div>
                );

              })}
            </div>
          )}

          {/* Page number medallion */}
          <div className="mt-4 flex justify-center">
            <span className="rounded-full border border-primary/30 bg-primary/5 px-4 py-0.5 mushaf-text text-sm">
              {toArabicDigits(page)}
            </span>
          </div>
        </div>
        </div>
      </div>


      {/* Page scrubber — turn through the book */}
      <div className="flex items-center gap-3 px-1" dir="ltr">
        <span className="text-xs text-muted-foreground w-14">Page {page}</span>
        <Slider
          value={[page]}
          min={1}
          max={TOTAL_PAGES}
          step={1}
          onValueChange={(v) => setPage(v[0])}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-10 text-right">{TOTAL_PAGES}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Tap a round verse sign to mark that exact verse, or tap anywhere else on a line to mark the end of that line. First tap = start, second tap = end. Swipe or use ← / → to turn pages.
      </p>

      {/* Selection footer */}
      <div className="rounded-xl border bg-muted/40 px-4 py-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Start</p>
            <p className="text-sm font-semibold">{startLabel || 'Not set'}</p>
          </div>
          <div className="rounded-lg bg-background/60 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">End</p>
            <p className="text-sm font-semibold">{endLabel || 'Not set'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Selected lesson</p>
            <p className="text-sm font-semibold text-foreground truncate">
              {previewText || 'Nothing selected yet'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!start}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Clear
            </Button>
            {onAddSegment && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!preview}
                onClick={() => preview && onAddSegment(preview)}
              >
                Add as another segment
              </Button>
            )}
            {onUseLesson && (
              <Button type="button" size="sm" disabled={!preview} onClick={() => preview && onUseLesson(preview)}>
                <Check className="h-4 w-4 mr-1.5" />
                Use this lesson
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuranPageView;
