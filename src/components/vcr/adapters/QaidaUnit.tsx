import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { VcrRenderContext } from '../adapter';

export interface QaidaPageWord {
  id: string;
  baab_id: string;
  page_number: number;
  line_number: number;
  word_position: number;
  word_text: string;
}

interface Props extends VcrRenderContext {
  page: number;
  /** Teacher can flip cards; students mirror the teacher's flipped word. */
  canControl?: boolean;
  onWords?: (words: QaidaPageWord[]) => void;
  /** Fires when the teacher taps a word (broadcast as highlight.wordId). */
  onSelectWord?: (wordId: string | null) => void;
  /**
   * 'flashcard' (default) — tapping flips a word into its letters.
   * 'select' — tapping picks lesson start / end points (attendance marking).
   */
  mode?: 'flashcard' | 'select';
  /** Render these words instead of fetching (lets callers scope by baab). */
  words?: QaidaPageWord[];
  /** Restrict the fetch to a single baab (transition pages hold two). */
  baabId?: string | null;
  /** Selection endpoints in 'select' mode. */
  fromId?: string | null;
  toId?: string | null;
  /** Ids that fall inside the selected range (inclusive), for highlighting. */
  inRangeIds?: string[];
  /** Fires in 'select' mode when a word is tapped. */
  onTapWord?: (word: QaidaPageWord) => void;
}

/** Split a Qaida word into its individual letters for the flashcard back. */
function letters(text: string) {
  return Array.from(text.replace(/\s+/g, ' ').trim()).filter((c) => c !== ' ');
}

/**
 * One Noorani Qaida page: a right-to-left grid of tappable words.
 * In flashcard mode tapping a word flips it into a parchment/gold card showing
 * the word's letters in isolation. In select mode the same tappable words act
 * as the lesson-range picker used by attendance marking.
 */
export function QaidaUnit({
  page,
  fontScale,
  highlight,
  canControl = true,
  onWords,
  onSelectWord,
  mode = 'flashcard',
  words: providedWords,
  baabId = null,
  fromId = null,
  toId = null,
  inRangeIds,
  onTapWord,
}: Props) {
  const [fetched, setFetched] = useState<QaidaPageWord[]>([]);
  const [loading, setLoading] = useState(!providedWords);
  const [localFlipped, setLocalFlipped] = useState<string | null>(null);

  useEffect(() => {
    if (providedWords) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setLocalFlipped(null);
    (async () => {
      let q = supabase
        .from('noorani_qaida_words' as any)
        .select('id, baab_id, page_number, line_number, word_position, word_text')
        .eq('page_number', page);
      if (baabId) q = q.eq('baab_id', baabId);
      const { data } = await q.order('line_number').order('word_position');
      if (cancelled) return;
      const rows = ((data as any[]) || []) as QaidaPageWord[];
      setFetched(rows);
      setLoading(false);
      onWords?.(rows);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, baabId, providedWords]);

  const words = providedWords ?? fetched;



  /* Teacher's flip always wins; otherwise the learner can explore words too. */
  const remoteFlip = canControl ? null : highlight?.wordId ?? null;
  const flippedId = remoteFlip || localFlipped;

  const lines = useMemo(() => {
    const map = new Map<number, QaidaPageWord[]>();
    words.forEach((w) => {
      const list = map.get(w.line_number) || [];
      list.push(w);
      map.set(w.line_number, list);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [words]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-vcr-ink/10" />)}
      </div>
    );
  }

  if (words.length === 0) {
    return <p className="py-16 text-center text-2xl text-vcr-ink/60">No Qaida content available for page {page}.</p>;
  }

  const toggle = (id: string) => {
    const next = localFlipped === id ? null : id;
    setLocalFlipped(next);
    if (canControl) onSelectWord?.(next);
  };

  const selecting = mode === 'select';
  const rangeSet = new Set(inRangeIds || []);

  return (
    <div dir="rtl" className="space-y-4">
      {lines.map(([lineNo, lineWords]) => (
        <div key={lineNo} className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {lineWords.map((w) => {
            const flipped = !selecting && flippedId === w.id;
            const isEnd = selecting && (w.id === fromId || w.id === toId);
            const inRange = selecting && rangeSet.has(w.id);
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => (selecting ? onTapWord?.(w) : toggle(w.id))}
                aria-pressed={flipped || isEnd || inRange}
                className={cn(
                  'vcr-flip-card relative rounded-xl border px-4 py-2 transition-all duration-300 cursor-pointer',
                  flipped && 'border-vcr-gold bg-vcr-gold/15 shadow-[0_0_0_2px_rgba(197,160,89,0.35)]',
                  isEnd && 'border-primary bg-primary/20 ring-2 ring-primary',
                  !isEnd && inRange && 'border-primary/40 bg-primary/10',
                  !flipped && !isEnd && !inRange && 'border-vcr-ink/15 bg-vcr-ink/[0.03] hover:border-vcr-gold/60'
                )}
                style={{ perspective: '900px' }}
              >
                {flipped ? (
                  <span className="flex items-center gap-2 font-uthmani text-vcr-ink" style={{ fontSize: `${30 * fontScale}px` }}>
                    {letters(w.word_text).map((ch, i) => (
                      <span key={i} className="rounded-md bg-vcr-parchment/70 px-2 py-0.5 ring-1 ring-vcr-gold/40">
                        {ch}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="font-uthmani text-vcr-ink" style={{ fontSize: `${38 * fontScale}px` }}>
                    {w.word_text}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
      <p className="pt-2 text-center text-sm text-vcr-ink/50" dir="ltr">
        {selecting
          ? 'Tap the first word of the lesson, then the last word.'
          : 'Tap any word to break it into letters. Tap again to close.'}
      </p>
    </div>
  );
}


export default QaidaUnit;
