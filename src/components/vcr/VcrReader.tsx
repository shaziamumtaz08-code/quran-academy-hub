import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VcrAdapter } from './adapter';

export interface VcrFollowState {
  page: number;
  fontScale: number;
  highlight: { lineId?: string | null; wordId?: string | null } | null;
  /** Which front-matter page (cover/index) is showing, or null for a real page. */
  front?: number | null;
}

interface Props {
  adapter: VcrAdapter;
  /** Unit to open on first render. */
  initialUnit?: number;
  /** Whether this account has teaching controls. Reader navigation itself is
   * available to any local reader; only a follower is locked to the presenter. */
  canControl?: boolean;
  /** Bump this number to replay the 3D page-turn (used after "mark complete"). */
  turnSignal?: number;
  /** Student mirror mode — no controls, view driven entirely by followState. */
  isFollower?: boolean;
  /** Latest view position broadcast by the teacher. Null until they connect. */
  followState?: VcrFollowState | null;
  /** Presenter-side: fires whenever the local view position changes. */
  onViewChange?: (state: VcrFollowState) => void;
  onUnitChange?: (unit: number) => void;
  /** Bump-to-jump: set to a page number (e.g. from a bookmark) to open it. */
  jumpRequest?: { unit: number; nonce: number } | null;
  className?: string;
}


/**
 * Content-agnostic reader shell for the Virtual Class Room.
 * Owns the parchment card, elevation, the 3D page-turn, zoom / font-size
 * controls, page jump and the follower (read-only mirror) mode.
 * Content comes entirely from the supplied adapter.
 */
export function VcrReader({
  adapter,
  initialUnit = 1,
  canControl = true,
  turnSignal = 0,
  isFollower = false,
  followState = null,
  onViewChange,
  onUnitChange,
  jumpRequest = null,
  className,

}: Props) {
  const [unit, setUnit] = useState(initialUnit);
  const [turning, setTurning] = useState(false);
  const [fontScale, setFontScale] = useState(() => {
    const saved = Number(localStorage.getItem('vcr-font-scale'));
    return Number.isFinite(saved) && saved >= 0.7 && saved <= 2 ? saved : 1;
  });
  const [pageInput, setPageInput] = useState(String(initialUnit));
  const resolvedStart = useRef(false);

  const total = adapter.totalUnits;
  const front = adapter.front ?? [];
  /* Book-like material opens on its cover, then its index, then page 1.
     Front matter carries no unit number, so bookmarks, annotations and
     progress keep pointing at the real pages. */
  const [frontIdx, setFrontIdx] = useState<number | null>(front.length ? 0 : null);
  /* The person whose screen is local must always be able to turn pages. The
     previous staff-only gate stranded a student presenter on the cover, and
     could also hide navigation when a teacher's role was still loading. */
  const showControls = !isFollower;
  const highlight = isFollower ? followState?.highlight ?? null : null;

  /* Follower: mirror the teacher's page and zoom level. */
  useEffect(() => {
    if (!isFollower || !followState) return;
    setUnit((u) => (u === followState.page ? u : followState.page));
    setFontScale((f) => (f === followState.fontScale ? f : followState.fontScale));
    const f = followState.front ?? null;
    setFrontIdx((cur) => (cur === f ? cur : f));
  }, [isFollower, followState?.page, followState?.fontScale, followState?.front]);

  /* Presenter: publish the local position so students follow along. */
  useEffect(() => {
    if (isFollower) return;
    onViewChange?.({ page: unit, fontScale, highlight: null, front: frontIdx });
  }, [isFollower, unit, fontScale, frontIdx, onViewChange]);

  useEffect(() => {
    if (isFollower) return;
    localStorage.setItem('vcr-font-scale', String(fontScale));
  }, [fontScale, isFollower]);

  /* Resume position, resolved once by the adapter. The book still opens on its
     cover; leaving the index lands on the resumed page. */
  useEffect(() => {
    if (resolvedStart.current || isFollower || !adapter.resolveStartUnit) return;
    resolvedStart.current = true;
    (async () => {
      const target = await adapter.resolveStartUnit!();
      if (target) setUnit(target);
    })();
  }, [adapter, isFollower]);

  useEffect(() => {
    adapter.onUnitChange?.(unit);
    onUnitChange?.(unit);
    setPageInput(String(unit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

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
    const next = Math.min(total, Math.max(1, target));
    const leavingFront = frontIdx !== null;
    if (next === unit && !leavingFront) return;
    playTurn();
    window.setTimeout(() => {
      setFrontIdx(null);
      setUnit(next);
      adapter.goTo?.(next);
    }, 210);
  };

  /* Cover -> Index -> page 1 -> … -> last page, in one continuous sequence. */
  const atFirst = frontIdx !== null ? frontIdx === 0 : front.length === 0 && unit <= 1;
  const atLast = frontIdx === null && unit >= total;

  const go = (delta: number) => {
    if (delta > 0) {
      if (frontIdx !== null) {
        playTurn();
        const nextFront = frontIdx + 1;
        window.setTimeout(() => setFrontIdx(nextFront < front.length ? nextFront : null), 210);
        return;
      }
      goTo(unit + 1);
      return;
    }
    if (frontIdx !== null) {
      if (frontIdx === 0) return;
      playTurn();
      window.setTimeout(() => setFrontIdx(frontIdx - 1), 210);
      return;
    }
    if (unit <= 1) {
      if (!front.length) return;
      playTurn();
      window.setTimeout(() => setFrontIdx(front.length - 1), 210);
      return;
    }
    goTo(unit - 1);
  };

  /* Bookmark jump requested from outside the reader. */
  useEffect(() => {
    if (!jumpRequest || isFollower) return;
    goTo(jumpRequest.unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpRequest?.nonce]);



  /* Student opened the room before the teacher started driving it. */
  if (isFollower && !followState) {
    return (
      <div className={cn('vcr-stage w-full', className)}>
        <div className="vcr-reading-card mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-4 rounded-2xl px-6 py-20 text-center">
          <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-vcr-gold" aria-hidden />
          <h2 className="font-display text-2xl text-vcr-ink sm:text-3xl">Waiting for teacher to start the class</h2>
          <p className="max-w-md text-base text-vcr-ink/65">
            Your page will open automatically as soon as your teacher joins. Keep this screen open.
          </p>
        </div>
      </div>
    );
  }

  /* Qaida and Mushaf share the pastel watercolour reading surface. */
  const pastel = adapter.contentType === 'qaida' || adapter.contentType === 'mushaf';

  return (
    <div className={cn('vcr-stage flex w-full flex-col', className)}>
      <div
        className={cn(
          'order-2 mx-auto w-full max-w-4xl rounded-2xl px-5 py-6 sm:px-10 sm:py-9',
          pastel
            ? 'qaida-pastel border-2 border-white/70 shadow-[0_24px_60px_-24px_rgba(60,50,90,0.55)]'
            : 'vcr-reading-card',
          turning && 'vcr-turn vcr-turn-rtl'
        )}
      >
        {/* Page chrome */}
        <div className={cn('mb-2 flex items-center justify-between gap-3 border-b pb-2',
          pastel ? 'border-slate-900/10' : 'border-vcr-ink/15')}>
          <span className={cn('font-display text-xl sm:text-2xl', pastel ? 'text-slate-800' : 'text-vcr-ink')}>
            {frontIdx !== null ? front[frontIdx]?.label ?? adapter.currentLabel : adapter.currentLabel}
          </span>
          <span className={cn('font-mono text-base tabular-nums sm:text-lg',
            pastel ? 'text-slate-600' : 'text-vcr-ink/70')}>
            {frontIdx !== null ? front[frontIdx]?.subLabel ?? '' : adapter.currentSubLabel}
          </span>
        </div>


        {/* Every page of the book — cover, index and content — uses the same
            page body box, so the reading surface keeps one constant size. */}
        <div
          className={cn(
            'flex w-full flex-col',
            frontIdx !== null
              ? 'h-[clamp(20rem,62vh,42rem)] overflow-y-auto'
              : 'min-h-[clamp(20rem,62vh,42rem)]',
          )}
        >
          {frontIdx !== null && front[frontIdx]
            ? front[frontIdx].render({ fontScale, highlight, goToUnit: goTo })
            : adapter.renderUnit(unit, { fontScale, highlight })}
        </div>
      </div>

      {showControls && (
        <div className={cn(
          'order-1 sticky top-14 z-10 mx-auto mb-3 flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 rounded-xl border border-vcr-chrome/15 bg-vcr-deep/95 p-2 shadow-lg backdrop-blur',
          pastel && 'vcr-controls-light'
        )}>
          <button
            type="button"
            disabled={atFirst}
            aria-disabled={atFirst}
            title={atFirst ? 'You are on the first page of this book' : undefined}
            className="vcr-btn inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => go(-1)}
          >
            <ChevronLeft className="h-5 w-5" /> Previous {adapter.unitNoun}
          </button>


          <div className="flex items-center gap-3">
            {/* Back to this book's own index — internal navigation, not browser history */}
            {front.some((f) => f.key === 'index') && frontIdx === null && (
              <button
                type="button"
                className="vcr-btn h-10 rounded-lg px-3 text-sm"
                onClick={() => { playTurn(); const i = front.findIndex((f) => f.key === 'index'); window.setTimeout(() => setFrontIdx(i), 210); }}
              >
                Contents
              </button>
            )}
            {/* Jump to page */}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); const n = Number(pageInput); if (Number.isFinite(n)) goTo(n); }}
            >
              <label className="font-mono text-xs text-vcr-chrome/60 capitalize" htmlFor="vcr-page-input">{adapter.unitNoun}</label>
              <input
                id="vcr-page-input"
                type="number"
                min={1}
                max={total}
                inputMode="numeric"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                className="h-10 w-20 rounded-lg border border-vcr-chrome/20 bg-black/25 px-2 text-center font-mono text-sm text-vcr-chrome focus:border-vcr-gold/60 focus:outline-none"
              />
              <button type="submit" className="vcr-btn h-10 rounded-lg px-3 text-sm">Go</button>
              <span className="font-mono text-xs text-vcr-chrome/50">/ {total}</span>
            </form>

            {/* Font size */}
            <div className="vcr-fontsize-box flex items-center gap-1 rounded-lg border border-vcr-chrome/15 px-1 py-1">
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

          <button
            type="button"
            disabled={atLast}
            aria-disabled={atLast}
            title={atLast ? `You are on the last ${adapter.unitNoun}` : undefined}
            className="vcr-btn inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => go(1)}
          >
            Next {adapter.unitNoun} <ChevronRight className="h-5 w-5" />
          </button>

        </div>
      )}
    </div>
  );
}

export default VcrReader;
