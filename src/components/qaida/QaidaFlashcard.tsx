import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Star, RotateCcw, Volume2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  detectHarakat,
  exampleFor,
  HARAKAT_STYLE,
  splitLetters,
  transliterate,
} from '@/lib/qaidaHarakat';
import type { QaidaWordStatus } from '@/hooks/useQaidaWordProgress';

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
  className?: string;
}

/**
 * One bright, flippable Qaida flashcard.
 * Front: the letter / word big, accented by its harakat.
 * Back: transliteration + a familiar example word.
 */
export function QaidaFlashcard({ word, status, onGrade, className }: Props) {
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
    <div className={cn('space-y-4', className)} style={{ ['--qaida-accent' as any]: accent.hsl }}>
      <div className="flex items-center justify-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: 'hsl(var(--qaida-accent) / 0.14)', color: 'hsl(var(--qaida-accent))' }}
        >
          {accent.label}
        </span>
        {status && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {status === 'mastered' ? 'Mastered' : 'Needs practice'}
          </span>
        )}
      </div>

      {/* Flip card */}
      <div className="relative mx-auto w-full max-w-md" style={{ perspective: '1200px' }}>
        {burst && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className="absolute h-2 w-2 rounded-full animate-scale-in"
                style={{
                  background: 'hsl(var(--qaida-accent))',
                  transform: `rotate(${i * 36}deg) translateY(-70px)`,
                  animationDelay: `${i * 25}ms`,
                }}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? 'Show the letter' : 'Show the meaning'}
          className="relative block h-56 w-full rounded-3xl text-center transition-transform duration-500 sm:h-64"
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'none' }}
        >
          {/* Front */}
          <span
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 bg-card shadow-lg"
            style={{
              backfaceVisibility: 'hidden',
              borderColor: 'hsl(var(--qaida-accent) / 0.5)',
              background:
                'linear-gradient(160deg, hsl(var(--qaida-accent) / 0.10), hsl(var(--card)) 65%)',
            }}
          >
            <span className="font-uthmani text-6xl leading-none text-foreground sm:text-7xl" dir="rtl">
              {word.word_text}
            </span>
            <span className="flex flex-wrap items-center justify-center gap-1.5" dir="rtl">
              {letters.map((ch, i) => (
                <span
                  key={i}
                  className="rounded-lg px-2 py-0.5 font-uthmani text-2xl"
                  style={{ background: 'hsl(var(--qaida-accent) / 0.12)', color: 'hsl(var(--qaida-accent))' }}
                >
                  {ch}
                </span>
              ))}
            </span>
            <span className="text-xs text-muted-foreground">Tap the card to flip</span>
          </span>

          {/* Back */}
          <span
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 bg-card p-5 shadow-lg"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderColor: 'hsl(var(--qaida-accent) / 0.5)',
              background:
                'linear-gradient(160deg, hsl(var(--qaida-accent) / 0.16), hsl(var(--card)) 70%)',
            }}
          >
            <span className="text-lg font-semibold text-foreground">{transliterate(word.word_text)}</span>
            {example ? (
              <span className="space-y-1">
                <span className="block text-xs uppercase tracking-wide text-muted-foreground">Example</span>
                <span className="block font-uthmani text-4xl text-foreground" dir="rtl">{example.word}</span>
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
          className="gap-1.5 text-xs"
        >
          <Volume2 className="h-4 w-4" />
          {word.audio_url ? 'Play sound' : 'Sound coming soon'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" onClick={() => grade('needs_practice')} className="h-12 gap-2">
          <RefreshCw className="h-4 w-4" /> Needs practice
        </Button>
        <Button
          type="button"
          onClick={() => grade('mastered')}
          className="h-12 gap-2 text-white"
          style={{ background: 'hsl(var(--qaida-accent))' }}
        >
          <Star className="h-4 w-4" /> Mastered
        </Button>
      </div>

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
