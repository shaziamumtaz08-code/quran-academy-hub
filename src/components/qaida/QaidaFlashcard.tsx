import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Star, RotateCcw, Volume2, RefreshCw, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  detectHarakat,
  exampleFor,
  HARAKAT_STYLE,
  splitLetters,
  transliterate,
} from '@/lib/qaidaHarakat';
import type { QaidaWordStatus } from '@/hooks/useQaidaWordProgress';
import { TajweedText } from '@/components/qaida/TajweedText';

export interface QaidaFlashcardWord {
  id: string;
  word_text: string;
  /** Optional recording — the affordance shows, playback stays silent for now. */
  audio_url?: string | null;
}

interface Props {
  word: QaidaFlashcardWord;
  status?: QaidaWordStatus | null;
  onGrade: (status: QaidaWordStatus) => void;
  /** Optional step-through of the surrounding words. */
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number } | null;
  className?: string;
}

/**
 * One bright, child-friendly Qaida flashcard.
 * Front: the letter / word very large, haloed by its harakat colour.
 * Back: transliteration + a familiar example word.
 */
export function QaidaFlashcard({ word, status, onGrade, onPrev, onNext, position, className }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [burst, setBurst] = useState(false);
  const burstTimer = useRef<number | null>(null);

  useEffect(() => { setFlipped(false); }, [word.id]);
  useEffect(() => () => { if (burstTimer.current) window.clearTimeout(burstTimer.current); }, []);

  const harakat = useMemo(() => detectHarakat(word.word_text), [word.word_text]);
  const accent = HARAKAT_STYLE[harakat];
  const letters = useMemo(() => splitLetters(word.word_text), [word.word_text]);
  const example = useMemo(() => exampleFor(word.word_text), [word.word_text]);

  const grade = (s: QaidaWordStatus) => {
    if (s === 'mastered') {
      setBurst(true);
      if (burstTimer.current) window.clearTimeout(burstTimer.current);
      burstTimer.current = window.setTimeout(() => setBurst(false), 700);
    }
    onGrade(s);
  };

  return (
    <div className={cn('space-y-5', className)} style={{ ['--qaida-accent' as any]: accent.hsl }}>
      {/* Chips */}
      <div className="flex items-center justify-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: 'hsl(var(--qaida-accent) / 0.16)', color: 'hsl(var(--qaida-accent))' }}
        >
          <Sparkles className="h-3.5 w-3.5" /> {accent.label}
        </span>
        {status && (
          <span
            className={cn(
              'rounded-2xl px-3 py-1.5 text-xs font-semibold',
              status === 'mastered'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700',
            )}
          >
            {status === 'mastered' ? 'Mastered' : 'Needs practice'}
          </span>
        )}
      </div>

      {/* Flip card */}
      <div className="relative mx-auto w-full max-w-md" style={{ perspective: '1200px' }}>
        {burst && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="absolute h-2.5 w-2.5 rounded-full animate-scale-in"
                style={{
                  background: 'hsl(var(--qaida-accent))',
                  transform: `rotate(${i * 30}deg) translateY(-84px)`,
                  animationDelay: `${i * 22}ms`,
                }}
              />
            ))}
          </div>
        )}

        {/* Soft halo behind the card */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-3 rounded-[2.25rem] blur-2xl"
          style={{ background: 'hsl(var(--qaida-accent) / 0.22)' }}
        />

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Show the letter' : 'Show the meaning'}
          className="relative block h-64 w-full rounded-[2rem] text-center transition-transform duration-500 motion-reduce:duration-0 sm:h-72"
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'none' }}
        >
          {/* Front */}
          <span
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[2rem] border-4 bg-card shadow-2xl"
            style={{
              backfaceVisibility: 'hidden',
              borderColor: 'hsl(var(--qaida-accent) / 0.45)',
              background:
                'radial-gradient(120% 90% at 50% 0%, hsl(var(--qaida-accent) / 0.18), hsl(var(--card)) 70%)',
            }}
          >
            <span
              aria-hidden
              className="absolute -right-10 -top-10 h-32 w-32 rounded-full"
              style={{ background: 'hsl(var(--qaida-accent) / 0.12)' }}
            />
            <span
              aria-hidden
              className="absolute -bottom-12 -left-8 h-28 w-28 rounded-full"
              style={{ background: 'hsl(var(--qaida-accent) / 0.10)' }}
            />
            <TajweedText
              text={word.word_text}
              className="relative text-7xl leading-none text-foreground drop-shadow-sm sm:text-8xl"
            />
            <span className="relative flex flex-wrap items-center justify-center gap-2" dir="rtl">
              {letters.map((ch, i) => (
                <span
                  key={i}
                  className="flex h-10 min-w-10 items-center justify-center rounded-2xl px-2.5 font-qaida text-2xl shadow-sm"
                  style={{ background: 'hsl(var(--qaida-accent) / 0.14)', color: 'hsl(var(--qaida-accent))' }}
                >
                  {ch}
                </span>
              ))}
            </span>
            <span className="relative rounded-full bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              Tap the card to flip
            </span>
          </span>

          {/* Back */}
          <span
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[2rem] border-4 bg-card p-6 shadow-2xl"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderColor: 'hsl(var(--qaida-accent) / 0.45)',
              background:
                'radial-gradient(120% 90% at 50% 0%, hsl(var(--qaida-accent) / 0.24), hsl(var(--card)) 72%)',
            }}
          >
            <span className="text-xl font-bold tracking-wide text-foreground">
              {transliterate(word.word_text)}
            </span>
            {example ? (
              <span className="space-y-1.5">
                <span className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Example
                </span>
                <TajweedText text={example.word} className="block text-5xl text-foreground" />
                {example.meaning && (
                  <span className="block text-sm text-muted-foreground">{example.meaning}</span>
                )}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Read it aloud with your teacher.</span>
            )}
          </span>
        </button>
      </div>

      {/* Audio affordance — wired to the field, intentionally silent until recordings land */}
      <div className="flex items-center justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!word.audio_url}
          onClick={() => { if (word.audio_url) new Audio(word.audio_url).play().catch(() => {}); }}
          className="gap-1.5 rounded-full text-xs"
        >
          <Volume2 className="h-4 w-4" />
          {word.audio_url ? 'Play sound' : 'Sound coming soon'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => grade('needs_practice')}
          className="h-14 gap-2 rounded-2xl border-2 text-base font-semibold"
        >
          <RefreshCw className="h-5 w-5" /> Practise
        </Button>
        <Button
          type="button"
          onClick={() => grade('mastered')}
          className="h-14 gap-2 rounded-2xl text-base font-semibold text-white shadow-lg"
          style={{ background: 'hsl(var(--qaida-accent))' }}
        >
          <Star className="h-5 w-5" /> Mastered
        </Button>
      </div>

      {(onPrev || onNext) && (
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-12 rounded-full border-2 p-0"
            onClick={onPrev}
            disabled={!onPrev}
            aria-label="Previous card"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {position && (
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
              {position.index + 1} / {position.total}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-12 rounded-full border-2 p-0"
            onClick={onNext}
            disabled={!onNext}
            aria-label="Next card"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setFlipped(false)}
        className="mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reset card
      </button>
    </div>
  );
}

export default QaidaFlashcard;