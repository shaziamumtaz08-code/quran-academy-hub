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
  className,
}: Props) {
  const [editionId, setEditionId] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [info, setInfo] = useState<MushafPageInfo | null>(null);
  const [lines, setLines] = useState<MushafLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [turning, setTurning] = useState(false);
  const resolvedResume = useRef(false);

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

  const go = (delta: number) => {
    const next = Math.min(TOTAL_PAGES, Math.max(1, page + delta));
    if (next === page) return;
    playTurn();
    window.setTimeout(() => setPage(next), 210);
  };

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
                    className="my-3 rounded-lg border border-vcr-gold/50 bg-vcr-gold/10 py-2 text-center font-uthmani text-[26px] text-vcr-ink sm:text-3xl"
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
                    'text-[26px] sm:text-[32px] lg:text-[36px]',
                    l.is_centered || l.line_type === 'basmallah' ? 'text-center' : 'text-justify'
                  )}
                >
                  {l.text_indopak}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {canControl && (
        <div className="mx-auto mt-4 flex max-w-4xl items-center justify-between gap-3">
          <button type="button" className="vcr-btn inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base" onClick={() => go(-1)}>
            <ChevronLeft className="h-5 w-5" /> Previous page
          </button>
          <span className="font-mono text-sm tabular-nums text-vcr-chrome/60">{page} / {TOTAL_PAGES}</span>
          <button type="button" className="vcr-btn inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base" onClick={() => go(1)}>
            Next page <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default VcrStaticPage;
