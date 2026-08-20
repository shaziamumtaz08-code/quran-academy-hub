import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchPage,
  findPageForAyah,
  findPageForJuz,
  getDefaultEditionId,
  surahNameByNumber,
  type MushafLine,
  type MushafPageInfo,
} from '@/lib/mushafResolve';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const TOTAL_PAGES = 610;

export interface VcrFollowState {
  page: number;
  fontScale: number;
  highlight: { lineId?: string | null; wordId?: string | null } | null;
}

interface Props {
  /** Page to open on first render. */
  initialPage?: number;
  /** Resume position taken from student_progress, e.g. "2:34". */
  resumeAyah?: { surah: number; ayah: number } | null;
  /** Resume by Juz when the syllabus item is a Juz. */
  resumeJuz?: number | null;
  /** Teacher-only page controls; students just watch the shared screen. */
  canControl?: boolean;
  onPageChange?: (page: number, info: MushafPageInfo | null) => void;
  /** Bump this number to replay the 3D page-turn (used after "mark complete"). */
  turnSignal?: number;
  /** Student mirror mode — no controls, view driven entirely by followState. */
  isFollower?: boolean;
  /** Latest view position broadcast by the teacher. Null until they connect. */
  followState?: VcrFollowState | null;
  /** Presenter-side: fires whenever the local view position changes. */
  onViewChange?: (state: VcrFollowState) => void;
  className?: string;
}

/**
 * Static, read-only Mushaf page for the Virtual Class Room.
 * No word-level tap targets — this phase is presentation only.
 */
export function VcrStaticPage({
  initialPage = 1,
  resumeAyah = null,
  resumeJuz = null,
  canControl = true,
  onPageChange,
  turnSignal = 0,
  isFollower = false,
  followState = null,
  onViewChange,
  className,
}: Props) {
  const [editionId, setEditionId] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [info, setInfo] = useState<MushafPageInfo | null>(null);
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [turning, setTurning] = useState(false);
  const [fontScale, setFontScale] = useState(() => {
    const saved = Number(localStorage.getItem('vcr-font-scale'));
    return Number.isFinite(saved) && saved >= 0.7 && saved <= 2 ? saved : 1;
  });
  const [pageInput, setPageInput] = useState(String(initialPage));
  const resolvedResume = useRef(false);

  const showControls = canControl && !isFollower;
  const highlight = isFollower ? followState?.highlight ?? null : null;

  /* Follower: mirror the teacher's page and zoom level. */
  useEffect(() => {
    if (!isFollower || !followState) return;
    setPage((p) => (p === followState.page ? p : followState.page));
    setFontScale((f) => (f === followState.fontScale ? f : followState.fontScale));
  }, [isFollower, followState?.page, followState?.fontScale]);

  /* Presenter: publish the local position so students follow along. */
  useEffect(() => {
    if (isFollower) return;
    onViewChange?.({ page, fontScale, highlight: null });
  }, [isFollower, page, fontScale, onViewChange]);


  useEffect(() => { localStorage.setItem('vcr-font-scale', String(fontScale)); }, [fontScale]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getDefaultEditionId();
      if (!cancelled) setEditionId(id);
    })();
    return () => { cancelled = true; };
  }, []);

  /* Resolve the resume position once the edition is known. */
  useEffect(() => {
    if (!editionId || resolvedResume.current) return;
    resolvedResume.current = true;
    (async () => {
      let target: number | null = null;
      if (resumeAyah) target = await findPageForAyah(editionId, resumeAyah.surah, resumeAyah.ayah);
      if (!target && resumeJuz) target = await findPageForJuz(editionId, resumeJuz);
      if (target) setPage(target);
    })();
  }, [editionId, resumeAyah, resumeJuz]);

  useEffect(() => {
    if (!editionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetchPage(editionId, page);
      if (cancelled) return;
      setInfo(res.info);
      setLines(res.lines);
      setLoading(false);
      onPageChange?.(page, res.info);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId, page]);

  /* Signature interaction: 3D page-turn */
  const playTurn = () => {
    setTurning(false);
    window.requestAnimationFrame(() => setTurning(true));
    window.setTimeout(() => setTurning(false), 700);
  };

  useEffect(() => {
    if (turnSignal > 0) playTurn();
  }, [turnSignal]);

  const goTo = (target: number) => {
    const next = Math.min(TOTAL_PAGES, Math.max(1, target));
    if (next === page) return;
    playTurn();
    window.setTimeout(() => setPage(next), 210);
  };
  const go = (delta: number) => goTo(page + delta);

  useEffect(() => { setPageInput(String(page)); }, [page]);

  const heading = useMemo(() => {
    const s = surahNameByNumber(info?.surah_start);
    const e = surahNameByNumber(info?.surah_end);
    const surahs = s && e && s !== e ? `${s} – ${e}` : s || e || '';
    return { surahs, juz: info?.juz_number ?? null };
  }, [info]);

  return (
    <div className={cn('vcr-stage w-full', className)}>
      <div
        className={cn(
          'vcr-reading-card mx-auto w-full max-w-4xl rounded-2xl px-5 py-6 sm:px-10 sm:py-9',
          turning && 'vcr-turn vcr-turn-rtl'
        )}
      >
        {/* Page chrome */}
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-vcr-ink/15 pb-3">
          <span className="font-display text-xl text-vcr-ink sm:text-2xl">{heading.surahs || 'Mushaf'}</span>
          <span className="font-mono text-base tabular-nums text-vcr-ink/70 sm:text-lg">
            {heading.juz ? `Juz ${heading.juz} · ` : ''}Page {page}
          </span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full bg-vcr-ink/10" />)}
          </div>
        ) : lines.length === 0 ? (
          <p className="py-16 text-center text-2xl text-vcr-ink/60">No page data available for page {page}.</p>
        ) : (
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
                    'font-uthmani leading-[2.1] text-vcr-ink',
                    l.is_centered || l.line_type === 'basmallah' ? 'text-center' : 'text-justify'
                  )}
                  style={{ fontSize: `${32 * fontScale}px` }}
                >
                  {l.text_indopak}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {canControl && (
        <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <button type="button" className="vcr-btn inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base" onClick={() => go(-1)}>
            <ChevronLeft className="h-5 w-5" /> Previous page
          </button>

          <div className="flex items-center gap-3">
            {/* Jump to page */}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); const n = Number(pageInput); if (Number.isFinite(n)) goTo(n); }}
            >
              <label className="font-mono text-xs text-vcr-chrome/60" htmlFor="vcr-page-input">Page</label>
              <input
                id="vcr-page-input"
                type="number"
                min={1}
                max={TOTAL_PAGES}
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                className="h-10 w-20 rounded-lg border border-vcr-chrome/20 bg-black/25 px-2 text-center font-mono text-sm text-vcr-chrome focus:border-vcr-gold/60 focus:outline-none"
              />
              <button type="submit" className="vcr-btn h-10 rounded-lg px-3 text-sm">Go</button>
              <span className="font-mono text-xs text-vcr-chrome/50">/ {TOTAL_PAGES}</span>
            </form>

            {/* Font size */}
            <div className="flex items-center gap-1 rounded-lg border border-vcr-chrome/15 px-1 py-1">
              <button
                type="button" aria-label="Smaller text"
                className="vcr-btn h-8 w-8 rounded-md text-sm"
                onClick={() => setFontScale((f) => Math.max(0.7, Number((f - 0.1).toFixed(2))))}
              >A-</button>
              <span className="w-10 text-center font-mono text-xs text-vcr-chrome/60">{Math.round(fontScale * 100)}%</span>
              <button
                type="button" aria-label="Larger text"
                className="vcr-btn h-8 w-8 rounded-md text-sm"
                onClick={() => setFontScale((f) => Math.min(2, Number((f + 0.1).toFixed(2))))}
              >A+</button>
            </div>
          </div>

          <button type="button" className="vcr-btn inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base" onClick={() => go(1)}>
            Next page <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default VcrStaticPage;
