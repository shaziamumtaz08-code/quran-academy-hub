import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Layers, RefreshCw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VcrRenderContext } from '../adapter';
import { QaidaFlashcardSheet } from '@/components/qaida/QaidaFlashcardSheet';
import { QaidaPracticeDeck } from '@/components/qaida/QaidaPracticeDeck';
import { useQaidaWordProgress, type QaidaWordStatus } from '@/hooks/useQaidaWordProgress';
import { detectHarakat, HARAKAT_STYLE } from '@/lib/qaidaHarakat';

export interface QaidaPageWord {
  id: string;
  baab_id: string;
  page_number: number;
  line_number: number;
  word_position: number;
  word_text: string;
  audio_url?: string | null;
}

interface Props extends Partial<VcrRenderContext> {
  page: number;
  fontScale?: number;
  /** Teacher can open flashcards; students mirror the teacher's tapped word. */
  canControl?: boolean;
  onWords?: (words: QaidaPageWord[]) => void;
  /** Fires when the teacher taps a word (broadcast as highlight.wordId). */
  onSelectWord?: (wordId: string | null) => void;
  /**
   * 'flashcard' (default) — tapping a word opens the flip-card bottom sheet.
   * 'select' — tapping picks lesson start / end points (attendance marking).
   */
  mode?: 'flashcard' | 'select';
  /** Render these words instead of fetching (lets callers scope by baab). */
  words?: QaidaPageWord[];
  /** Restrict the fetch to a single baab (transition pages hold two). */
  baabId?: string | null;
  /** Whose flashcard progress is being recorded. */
  studentId?: string | null;
  /** Selection endpoints in 'select' mode. */
  fromId?: string | null;
  toId?: string | null;
  /** Ids that fall inside the selected range (inclusive), for highlighting. */
  inRangeIds?: string[];
  /** Fires in 'select' mode when a word is tapped. */
  onTapWord?: (word: QaidaPageWord) => void;
  /** Light book-page surface (attendance picker) vs the VCR parchment card. */
  surface?: 'parchment' | 'paper';
  className?: string;
}

/**
 * One Noorani Qaida page: the real page content laid out right-to-left as
 * tappable words / letters.
 *
 * In flashcard mode a tap opens a bright bottom-sheet flip card (letter →
 * transliteration + example) that can be graded Mastered / Needs practice;
 * the grade then shows as a small persistent mark on the page itself. A
 * floating Practice deck reviews everything graded so far in shuffled order.
 * In select mode the same page acts as the attendance lesson-range picker.
 */
export function QaidaUnit({
  page,
  fontScale = 1,
  highlight = null,
  canControl = true,
  onWords,
  onSelectWord,
  mode = 'flashcard',
  words: providedWords,
  baabId = null,
  studentId = null,
  fromId = null,
  toId = null,
  inRangeIds,
  onTapWord,
  surface = 'parchment',
  className,
}: Props) {
  const [fetched, setFetched] = useState<QaidaPageWord[]>([]);
  const [loading, setLoading] = useState(!providedWords);
  const [openWordId, setOpenWordId] = useState<string | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);

  const selecting = mode === 'select';
  const { progress, setStatus } = useQaidaWordProgress(selecting ? null : studentId);

  useEffect(() => {
    if (providedWords) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setOpenWordId(null);
    (async () => {
      let q = supabase
        .from('noorani_qaida_words' as any)
        .select('id, baab_id, page_number, line_number, word_position, word_text, audio_url')
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

  /* Students mirror whichever word the teacher opened. */
  const remoteWordId = canControl ? null : highlight?.wordId ?? null;
  const activeWordId = remoteWordId || openWordId;
  const activeWord = useMemo(
    () => words.find((w) => w.id === activeWordId) ?? null,
    [words, activeWordId],
  );

  const lines = useMemo(() => {
    const map = new Map<number, QaidaPageWord[]>();
    words.forEach((w) => {
      const list = map.get(w.line_number) || [];
      list.push(w);
      map.set(w.line_number, list);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [words]);

  /* Review pool: every word already graded on this baab/page set. */
  const deckWords = useMemo(
    () => words.filter((w) => !!progress[w.id]),
    [words, progress],
  );

  const paper = surface === 'paper';
  const inkClass = paper ? 'text-foreground' : 'text-vcr-ink';
  const mutedClass = paper ? 'text-muted-foreground' : 'text-vcr-ink/60';

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className={cn('h-12 w-full', paper ? '' : 'bg-vcr-ink/10')} />
        ))}
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <p className={cn('py-16 text-center', paper ? 'text-base text-muted-foreground' : 'text-2xl text-vcr-ink/60', className)}>
        No Qaida content available for page {page}.
      </p>
    );
  }

  const rangeSet = new Set(inRangeIds || []);

  const tap = (w: QaidaPageWord) => {
    if (selecting) { onTapWord?.(w); return; }
    setOpenWordId(w.id);
    if (canControl) onSelectWord?.(w.id);
  };

  const grade = (wordId: string, status: QaidaWordStatus) => { void setStatus(wordId, status); };

  return (
    <div className={cn('relative', className)}>
      <div dir="rtl" className="space-y-4">
        {lines.map(([lineNo, lineWords]) => (
          <div key={lineNo} className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {lineWords.map((w) => {
              const isEnd = selecting && (w.id === fromId || w.id === toId);
              const inRange = selecting && rangeSet.has(w.id);
              const open = !selecting && activeWordId === w.id;
              const mark = selecting ? null : progress[w.id]?.status ?? null;
              const accent = HARAKAT_STYLE[detectHarakat(w.word_text)];
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => tap(w)}
                  aria-pressed={open || isEnd || inRange}
                  className={cn(
                    'relative rounded-xl border px-4 py-2 transition-all duration-200',
                    isEnd && 'border-primary bg-primary/20 ring-2 ring-primary',
                    !isEnd && inRange && 'border-primary/40 bg-primary/10',
                    open && 'ring-2',
                    !isEnd && !inRange && !open &&
                      (paper
                        ? 'border-border bg-background hover:border-primary/50'
                        : 'border-vcr-ink/15 bg-vcr-ink/[0.03] hover:border-vcr-gold/60'),
                  )}
                  style={open ? { borderColor: `hsl(${accent.hsl})`, boxShadow: `0 0 0 2px hsl(${accent.hsl} / 0.35)` } : undefined}
                >
                  <span className={cn('font-uthmani', inkClass)} style={{ fontSize: `${(paper ? 30 : 38) * fontScale}px` }}>
                    {w.word_text}
                  </span>
                  {mark && (
                    <span
                      className={cn(
                        'absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white shadow',
                        mark === 'mastered' ? 'bg-emerald-500' : 'bg-amber-500',
                      )}
                      aria-label={mark === 'mastered' ? 'Mastered' : 'Needs practice'}
                    >
                      {mark === 'mastered'
                        ? <Star className="h-3 w-3" />
                        : <RefreshCw className="h-3 w-3" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        <p className={cn('pt-2 text-center text-sm', mutedClass)} dir="ltr">
          {selecting
            ? 'Tap the first word of the lesson, then the last word.'
            : 'Tap any letter or word to open its flashcard.'}
        </p>
      </div>

      {!selecting && (
        <>
          <Button
            type="button"
            size="sm"
            onClick={() => setDeckOpen(true)}
            className="sticky bottom-4 float-left mt-4 gap-1.5 rounded-full shadow-lg"
          >
            <Layers className="h-4 w-4" /> Practice deck
            {deckWords.length > 0 && <span className="opacity-80">· {deckWords.length}</span>}
          </Button>

          <QaidaFlashcardSheet
            open={!!activeWord}
            word={activeWord}
            status={activeWord ? progress[activeWord.id]?.status ?? null : null}
            onOpenChange={(o) => {
              if (!o) {
                setOpenWordId(null);
                if (canControl) onSelectWord?.(null);
              }
            }}
            onGrade={grade}
          />

          <QaidaPracticeDeck
            open={deckOpen}
            onOpenChange={setDeckOpen}
            words={deckWords}
            statuses={progress}
            onGrade={grade}
          />
        </>
      )}
    </div>
  );
}

export default QaidaUnit;
