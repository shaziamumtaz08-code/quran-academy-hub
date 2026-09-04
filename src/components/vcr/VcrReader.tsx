import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VcrAdapter } from './adapter';

export interface VcrFollowState {
  page: number;
  fontScale: number;
  highlight: { lineId?: string | null; wordId?: string | null } | null;
}

interface Props {
  adapter: VcrAdapter;
  /** Unit to open on first render. */
  initialUnit?: number;
  /** Teacher-only navigation; students just mirror the shared view. */
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
  const showControls = canControl && !isFollower;
  const highlight = isFollower ? followState?.highlight ?? null : null;

  /* Follower: mirror the teacher's page and zoom level. */
  useEffect(() => {
    if (!isFollower || !followState) return;
    setUnit((u) => (u === followState.page ? u : followState.page));
    setFontScale((f) => (f === followState.fontScale ? f : followState.fontScale));
  }, [isFollower, followState?.page, followState?.fontScale]);

  /* Presenter: publish the local position so students follow along. */
  useEffect(() => {
    if (isFollower) return;
    onViewChange?.({ page: unit, fontScale, highlight: null });
  }, [isFollower, unit, fontScale, onViewChange]);

  useEffect(() => {
    if (isFollower) return;
    localStorage.setItem('vcr-font-scale', String(fontScale));
  }, [fontScale, isFollower]);

  /* Resume position, resolved once by the adapter. */
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
    if (next === unit) return;
    playTurn();
    window.setTimeout(() => {
      setUnit(next);
      adapter.goTo?.(next);
    }, 210);
  };
  const go = (delta: number) => goTo(unit + delta);

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

  const pastel = adapter.contentType === 'qaida';

  return (
    <div className={cn('vcr-stage w-full', className)}>
      <div
        className={cn(
          'mx-auto w-full max-w-4xl rounded-2xl px-5 py-6 sm:px-10 sm:py-9',
          pastel
            ? 'qaida-pastel border-2 border-white/70 shadow-[0_24px_60px_-24px_rgba(60,50,90,0.55)]'
            : 'vcr-reading-card',
          turning && 'vcr-turn vcr-turn-rtl'
        )}
      >
        {/* Page chrome */}
        <div className={cn('mb-5 flex items-center justify-between gap-3 border-b pb-3',
          pastel ? 'border-slate-900/10' : 'border-vcr-ink/15')}>
          <span className={cn('font-display text-xl sm:text-2xl', pastel ? 'text-slate-800' : 'text-vcr-ink')}>
            {adapter.currentLabel}
          </span>
          <span className={cn('font-mono text-base tabular-nums sm:text-lg',
            pastel ? 'text-slate-600' : 'text-vcr-ink/70')}>
            {adapter.currentSubLabel}
          </span>
        </div>


        {adapter.renderUnit(unit, { fontScale, highlight })}
      </div>

      {showControls && (
        <div className="mx-auto mt-4 flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <button type="button" className="vcr-btn inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base" onClick={() => go(-1)}>
            <ChevronLeft className="h-5 w-5" /> Previous {adapter.unitNoun}
          </button>

          <div className="flex items-center gap-3">
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
            Next {adapter.unitNoun} <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default VcrReader;
