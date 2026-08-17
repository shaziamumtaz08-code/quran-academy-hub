import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Play, Repeat, Square, ZoomIn, ZoomOut } from 'lucide-react';
import {
  fetchPage,
  findPageForAyah,
  findPageForJuz,
  getDefaultEditionId,
  surahNameByNumber,
  type MushafLine,
  type MushafPageInfo,
} from '@/lib/mushafResolve';
import { MushafSearchBar } from '@/components/quran/MushafSearchBar';
import { ayahAudioUrl, tajweedChars, tajweedClass, TAJWEED_LEGEND } from '@/lib/tajweed';
import { cn } from '@/lib/utils';

const TOTAL_PAGES = 610;
const fromArabicDigits = (s: string) =>
  Number(s.replace(/[٠-٩۰-۹]/g, (d) => {
    const a = '٠١٢٣٤٥٦٧٨٩'.indexOf(d);
    return String(a >= 0 ? a : '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  }));

export interface VcrSelection {
  /** Human readable reference, e.g. "Al-Baqarah 2:34 — لَفِى" */
  reference: string;
  surah: number | null;
  ayah: number | null;
  page: number;
  line: number;
  word?: string;
}

interface Token {
  text: string;
  isAyahMark: boolean;
  ayah: number | null;
  surah: number | null;
}

/** Splits a line into words and end-of-verse medallions, tracking the running ayah. */
function tokenize(line: MushafLine): Token[] {
  const text = line.text_indopak ?? '';
  let surah = line.first_surah ?? null;
  let ayah = line.first_ayah ?? null;
  let prev: number | null = null;
  const out: Token[] = [];
  for (const chunk of text.split(/\s+/).filter(Boolean)) {
    const m = chunk.match(/^([٠-٩۰-۹]+)$/);
    if (m) {
      const n = fromArabicDigits(chunk);
      if (prev !== null && n <= prev) surah = (surah ?? 0) + 1;
      prev = n;
      ayah = n;
      out.push({ text: chunk, isAyahMark: true, ayah: n, surah });
      ayah = n + 1;
      continue;
    }
    out.push({ text: chunk, isAyahMark: false, ayah, surah });
  }
  return out;
}

interface Props {
  initialPage?: number;
  resumeAyah?: { surah: number; ayah: number } | null;
  tajweed: boolean;
  /** Teacher-only interaction; students just watch the shared screen. */
  canControl: boolean;
  selection: VcrSelection | null;
  onSelect: (sel: VcrSelection) => void;
  /** Tap-and-tag: fires when a word is tapped so the mistake tagger can open. */
  onWordTap?: (sel: VcrSelection) => void;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function VcrMushafPage({
  initialPage = 1,
  resumeAyah = null,
  tajweed,
  canControl,
  selection,
  onSelect,
  onWordTap,
  onPageChange,
  className,
}: Props) {
  const [editionId, setEditionId] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [info, setInfo] = useState<MushafPageInfo | null>(null);
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1.5);
  const [repeat, setRepeat] = useState(3);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playsLeft = useRef(0);
  const resumed = useRef(false);

  useEffect(() => { getDefaultEditionId().then(setEditionId); }, []);

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
    return () => { cancelled = true; };
  }, [editionId, page]);

  useEffect(() => { onPageChange?.(page); }, [page, onPageChange]);

  // Open where the student stopped last time
  useEffect(() => {
    if (!editionId || resumed.current) return;
    resumed.current = true;
    if (resumeAyah?.surah && resumeAyah?.ayah) {
      findPageForAyah(editionId, resumeAyah.surah, resumeAyah.ayah).then((p) => {
        if (p) setPage(p);
      });
    }
  }, [editionId, resumeAyah]);

  const goto = useCallback((p: number) => {
    setPage(Math.min(TOTAL_PAGES, Math.max(1, p)));
  }, []);

  const jumpToAyah = useCallback(async (surah: number, ayah: number) => {
    if (!editionId) return;
    const p = await findPageForAyah(editionId, surah, ayah);
    if (p) goto(p);
  }, [editionId, goto]);

  const stopAudio = useCallback(() => {
    playsLeft.current = 0;
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const playSelection = useCallback((times = 1, sel = selection) => {
    if (!sel?.surah || !sel?.ayah) return;
    stopAudio();
    const audio = new Audio(ayahAudioUrl(sel.surah, sel.ayah));
    audioRef.current = audio;
    playsLeft.current = times;
    const next = () => {
      playsLeft.current -= 1;
      if (playsLeft.current > 0) { audio.currentTime = 0; void audio.play(); }
      else setPlaying(false);
    };
    audio.addEventListener('ended', next);
    audio.addEventListener('error', () => setPlaying(false));
    setPlaying(true);
    void audio.play().catch(() => setPlaying(false));
  }, [selection, stopAudio]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const handleTap = (line: MushafLine, token: Token) => {
    if (!canControl) return;
    const surah = token.surah ?? line.first_surah ?? null;
    const ayah = token.ayah ?? line.first_ayah ?? null;
    const sel: VcrSelection = {
      reference: surah && ayah
        ? `${surahNameByNumber(surah)} ${surah}:${ayah}${token.isAyahMark ? '' : ` — ${token.text}`}`
        : `Page ${page}, line ${line.line_number}`,
      surah,
      ayah,
      page,
      line: line.line_number,
      word: token.isAyahMark ? undefined : token.text,
    };
    onSelect(sel);
    playSelection(1, sel);
    if (!token.isAyahMark) onWordTap?.(sel);
  };

  const isSelectedLine = (line: MushafLine) =>
    selection?.page === page && selection?.line === line.line_number;

  const renderWord = (t: string) => {
    if (!tajweed) return t;
    return tajweedChars(t).map((c, i) => (
      <span key={i} className={tajweedClass(c.rule)}>{c.text}</span>
    ));
  };

  const legend = useMemo(() => TAJWEED_LEGEND, []);

  return (
    <div className={cn('w-full min-w-0 space-y-3', className)}>
      {canControl && <MushafSearchBar onJump={jumpToAyah} busy={!editionId} />}

      {/* Page chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" aria-label="Previous page"
          onClick={() => goto(page - 1)} disabled={page <= 1}>
          <ChevronRight className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {info?.juz_number && <Badge variant="secondary" className="text-sm">Juz {info.juz_number}</Badge>}
          {info?.surah_start && <Badge variant="outline" className="text-sm">{surahNameByNumber(info.surah_start)}</Badge>}
          <Badge variant="outline" className="text-sm">Page {page}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.9, Number((z - 0.15).toFixed(2))))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-24 hidden sm:block"><Slider value={[zoom]} min={0.9} max={3} step={0.05}
            onValueChange={([v]) => setZoom(v)} aria-label="Text zoom" /></div>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" aria-label="Next page"
            onClick={() => goto(page + 1)} disabled={page >= TOTAL_PAGES}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* The page itself */}
      <div className="rounded-xl border-2 border-lms-border bg-card p-4 sm:p-6" dir="rtl">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : (
          <div className="space-y-1">
            {lines.map((line) => {
              if (line.line_type !== 'ayah') {
                return (
                  <div key={line.id} className="text-center py-2 font-quran text-primary"
                    style={{ fontSize: `${zoom * 1.4}rem` }}>
                    {line.text_indopak}
                  </div>
                );
              }
              return (
                <div
                  key={line.id}
                  className={cn(
                    'rounded-lg px-2 py-1 leading-[2.4] transition-colors font-quran',
                    isSelectedLine(line) && 'bg-primary/10 ring-2 ring-primary'
                  )}
                  style={{ fontSize: `${zoom * 1.5}rem` }}
                >
                  {tokenize(line).map((t, i) =>
                    t.isAyahMark ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleTap(line, t)}
                        disabled={!canControl}
                        className="inline-flex items-center justify-center mx-1 align-middle rounded-full border border-primary/40 text-primary hover:bg-primary/10 disabled:cursor-default"
                        style={{ width: `${zoom * 1.9}rem`, height: `${zoom * 1.9}rem`, fontSize: `${zoom * 0.85}rem` }}
                        aria-label={`Verse ${t.ayah}`}
                      >
                        {t.text}
                      </button>
                    ) : (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleTap(line, t)}
                        disabled={!canControl}
                        className={cn(
                          'inline-block px-1 rounded hover:bg-accent/60 disabled:cursor-default',
                          selection?.word === t.text && selection?.line === line.line_number && selection?.page === page && 'bg-primary text-primary-foreground'
                        )}
                      >
                        {renderWord(t.text)}
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selection + playback bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-lms-border bg-lms-surface px-3 py-2">
        <span className="text-sm text-lms-text-2">Selected:</span>
        <span className="text-base font-semibold text-lms-text-1 truncate max-w-[18rem]" dir="auto">
          {selection?.reference ?? 'Tap a word or verse sign on the page'}
        </span>
        <div className="ms-auto flex items-center gap-2">
          {tajweed && (
            <div className="hidden md:flex items-center gap-2 me-2">
              {legend.map((l) => (
                <span key={l.rule} className={cn('text-xs font-medium', tajweedClass(l.rule))}>{l.label}</span>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="h-9" disabled={!selection?.ayah}
            onClick={() => playSelection(1)}>
            <Play className="h-4 w-4 me-1" /> Play
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-9" disabled={!selection?.ayah}
              onClick={() => playSelection(repeat)}>
              <Repeat className="h-4 w-4 me-1" /> Repeat {repeat}×
            </Button>
            <input
              type="range" min={1} max={10} value={repeat}
              onChange={(e) => setRepeat(Number(e.target.value))}
              className="w-20 accent-primary" aria-label="Repeat count"
            />
          </div>
          {playing && (
            <Button variant="destructive" size="sm" className="h-9" onClick={stopAudio}>
              <Square className="h-4 w-4 me-1" /> Stop
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export { findPageForJuz };
