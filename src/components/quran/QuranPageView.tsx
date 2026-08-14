import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, RotateCcw, Check } from 'lucide-react';
import { SURAHS } from '@/lib/quranData';
import { JUZ_DATA } from '@/lib/juzData';
import { formatLessonSegment, type LessonMarkerType, type LessonSegment } from '@/lib/lessonFormat';
import {
  fetchPage,
  findPageForJuz,
  findPageForSurah,
  getDefaultEditionId,
  resolveSegment,
  surahNameByNumber,
  type MushafLine,
  type MushafPageInfo,
  type TapPoint,
} from '@/lib/mushafResolve';
import { cn } from '@/lib/utils';

const TOTAL_PAGES = 610;

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
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [info, setInfo] = useState<MushafPageInfo | null>(null);
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState<TapPoint | null>(null);
  const [end, setEnd] = useState<TapPoint | null>(null);
  const [preview, setPreview] = useState<LessonSegment | null>(null);

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

  useEffect(() => setPageInput(String(page)), [page]);

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

  const goto = useCallback((p: number) => {
    setPage(Math.min(TOTAL_PAGES, Math.max(1, p)));
  }, []);

  // Arrow-key page turning (RTL mushaf: left = next page)
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

  const handleTap = (line: MushafLine) => {
    if (line.line_type !== 'ayah' || !line.first_surah) return;
    const point: TapPoint = { page, line };
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

  const isSelected = (line: MushafLine) => {
    if (!start) return false;
    const s = start;
    const e = end ?? start;
    const key = (p: number, l: number) => p * 100 + l;
    const k = key(page, line.line_number);
    return k >= key(s.page, s.line.line_number) && k <= key(e.page, e.line.line_number);
  };

  const previewText = preview ? formatLessonSegment(preview) : '';

  const clear = () => {
    setStart(null);
    setEnd(null);
  };

  const surahOptions = useMemo(() => SURAHS, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Jump to Surah</Label>
          <Select
            onValueChange={async (v) => {
              if (!editionId) return;
              const p = await findPageForSurah(editionId, Number(v));
              if (p) goto(p);
            }}
          >
            <SelectTrigger className="w-[190px] rounded-lg">
              <SelectValue placeholder="Surah" />
            </SelectTrigger>
            <SelectContent className="z-50 max-h-[300px] bg-popover">
              {surahOptions.map((s) => (
                <SelectItem key={s.number} value={String(s.number)}>
                  {s.number}. {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Jump to Juz</Label>
          <Select
            onValueChange={async (v) => {
              if (!editionId) return;
              const p = await findPageForJuz(editionId, Number(v));
              if (p) goto(p);
            }}
          >
            <SelectTrigger className="w-[170px] rounded-lg">
              <SelectValue placeholder="Juz" />
            </SelectTrigger>
            <SelectContent className="z-50 max-h-[300px] bg-popover">
              {JUZ_DATA.map((j) => (
                <SelectItem key={j.number} value={String(j.number)}>
                  Juz {j.number} - {j.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Page</Label>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" className="rounded-lg" onClick={() => goto(page - 1)} aria-label="Previous page">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => goto(parseInt(pageInput, 10) || page)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  goto(parseInt(pageInput, 10) || page);
                }
              }}
              className="w-16 text-center rounded-lg"
              inputMode="numeric"
            />
            <Button type="button" variant="outline" size="icon" className="rounded-lg" onClick={() => goto(page + 1)} aria-label="Next page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 pb-1">
          {info?.juz_number && <Badge variant="secondary">Juz {info.juz_number}</Badge>}
          {info?.surah_start && <Badge variant="outline">{surahNameByNumber(info.surah_start)}</Badge>}
          <Badge variant="outline">Page {page} / {TOTAL_PAGES}</Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Tap the line where the lesson stopped. Tap a second line to cover a range — use ← / → to turn pages.
      </p>

      {/* Page canvas */}
      <div className="rounded-xl border bg-card p-3 sm:p-5" dir="rtl">
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
          <div className="space-y-1">
            {lines.map((line) => {
              const selectable = line.line_type === 'ayah' && !!line.first_surah;
              const selected = isSelected(line);
              const isStart = start?.page === page && start.line.line_number === line.line_number;
              const isEnd = end?.page === page && end.line.line_number === line.line_number;
              return (
                <button
                  key={line.id}
                  type="button"
                  disabled={!selectable}
                  onClick={() => handleTap(line)}
                  className={cn(
                    'w-full rounded-md px-3 py-2 transition-colors text-right',
                    line.is_centered && 'text-center',
                    selectable ? 'hover:bg-primary/10 cursor-pointer' : 'cursor-default',
                    selected && 'bg-primary/15 ring-1 ring-primary/40',
                    (isStart || isEnd) && 'ring-2 ring-primary'
                  )}
                >
                  {line.line_type === 'surah_name' ? (
                    <span className="inline-block rounded-md border border-primary/30 bg-primary/5 px-4 py-1 arabic-text text-base font-semibold">
                      سورة {surahNameByNumber(line.surah_number)}
                    </span>
                  ) : line.line_type === 'basmallah' ? (
                    <span className="arabic-text text-lg">بِسۡمِ اللهِ الرَّحۡمٰنِ الرَّحِيۡمِ</span>
                  ) : (
                    <span className="arabic-text text-xl sm:text-2xl leading-loose">
                      {line.text_indopak}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selection footer */}
      <div className="rounded-xl border bg-muted/40 px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
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
  );
}

export default QuranPageView;
