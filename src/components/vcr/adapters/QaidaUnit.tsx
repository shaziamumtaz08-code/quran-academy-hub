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

interface QaidaBaabMeta {
  id: string;
  baab_number: number;
  name_urdu: string | null;
  name_english: string | null;
  start_page: number;
  end_page: number;
  total_units: number | null;
  unit_label: string | null;
  picker_mode: string | null;
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
  const [baab, setBaab] = useState<QaidaBaabMeta | null>(null);

  const selecting = mode === 'select';
  const { progress, setStatus } = useQaidaWordProgress(selecting ? null : studentId);

  /* Baab metadata for the page — used to render a real chapter panel on the
     pattern-drill baabs that have no word-level rows yet. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('noorani_qaida_baabs' as any)
        .select('id, baab_number, name_urdu, name_english, start_page, end_page, total_units, unit_label, picker_mode')
        .lte('start_page', page)
        .gte('end_page', page)
        .order('baab_number')
        .limit(2);
      if (cancelled) return;
      const rows = ((data as any[]) || []) as QaidaBaabMeta[];
      const match = baabId ? rows.find((r) => r.id === baabId) : rows[0];
      setBaab(match ?? rows[0] ?? null);
    })();
    return () => { cancelled = true; };
  }, [page, baabId]);

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
    /* Page 1 (and the closing page) sit outside every baab — render the book
       itself rather than an error, so no page in 1–32 ever looks broken. */
    if (!baab) {
      const closing = page > 1;
      return (
        <div className={cn('flex flex-col items-center justify-center gap-4 py-14 text-center', className)}>
          <span className={cn('font-uthmani leading-none', inkClass)} style={{ fontSize: `${64 * fontScale}px` }} dir="rtl">
            {closing ? 'تمت بالخیر' : 'نورانی قاعدہ'}
          </span>
          <h3 className={cn('font-display text-2xl', inkClass)}>
            {closing ? 'End of the Qaida' : 'Noorani Qaida'}
          </h3>
          <p className={cn('max-w-sm text-sm leading-relaxed', mutedClass)}>
            {closing
              ? 'The student has reached the closing page. Move back a page to revise, or continue to the Mushaf.'
              : 'Cover page. The lessons begin on page 2 with Baab 1 — Single Letters (مفردات).'}
          </p>
        </div>
      );
    }

    /* Pattern-drill baabs are marked by line range, not word-by-word, so
       there are no word rows to tap — show the chapter panel instead. */
    const unit = baab.unit_label || 'unit';
    return (
      <div className={cn('flex flex-col items-center justify-center gap-4 py-12 text-center', className)}>
        <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
          paper ? 'border-border text-muted-foreground' : 'border-vcr-ink/20 text-vcr-ink/70')}>
          Baab {baab.baab_number} · Pages {baab.start_page}–{baab.end_page}
        </span>
        <span className={cn('font-uthmani leading-tight', inkClass)} style={{ fontSize: `${44 * fontScale}px` }} dir="rtl">
          {baab.name_urdu || ''}
        </span>
        <h3 className={cn('font-display text-2xl', inkClass)}>{baab.name_english || `Baab ${baab.baab_number}`}</h3>
        <p className={cn('max-w-md text-sm leading-relaxed', mutedClass)}>
          This is a practice-drill chapter — it is read and marked by {unit} range rather than
          tapped word by word. {baab.total_units ? `${baab.total_units} ${unit}s` : 'The drills'} run across
          pages {baab.start_page}–{baab.end_page}.
        </p>
        <p className={cn('text-xs', mutedClass)}>
          {selecting
            ? `Use the ${unit}-range option to record today's lesson for this chapter.`
            : 'Read from the printed Qaida for this chapter; flashcards resume in the next lesson chapter.'}
        </p>
      </div>
    );
  }


  const rangeSet = new Set(inRangeIds || []);

  const tap = (w: QaidaPageWord) => {
    if (selecting) { onTapWord?.(w); return; }
    setOpenWordId(w.id);
    if (canControl) onSelectWord?.(w.id);
  };

  const grade = (wordId: string, status: QaidaWordStatus) => { void setStatus(wordId, status); };

  const tileSize = Math.round((paper ? 68 : 84) * fontScale);
  const glyphSize = Math.round((paper ? 30 : 38) * fontScale);

  return (
    <div className={cn('relative', className)}>
      <div className="qaida-pastel relative overflow-hidden rounded-3xl p-4 sm:p-6">
        <div dir="rtl" className="space-y-3 sm:space-y-4">
          {lines.map(([lineNo, lineWords]) => (
            <div key={lineNo} className="flex flex-wrap items-center justify-center gap-3">
              {lineWords.map((w) => {
                const isEnd = selecting && (w.id === fromId || w.id === toId);
                const inRange = selecting && rangeSet.has(w.id);
                const open = !selecting && activeWordId === w.id;
                const mark = selecting ? null : progress[w.id]?.status ?? null;
                const accent = HARAKAT_STYLE[detectHarakat(w.word_text)];
                const active = isEnd || inRange || open;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => tap(w)}
                    aria-pressed={active}
                    style={{
                      width: tileSize,
                      height: tileSize,
                      ...(open
                        ? { borderColor: `hsl(${accent.hsl} / 0.7)` }
                        : {}),
                    }}
                    className={cn(
                      'qaida-tile relative flex shrink-0 items-center justify-center p-2',
                      active && 'qaida-tile-selected',
                      isEnd && 'ring-2 ring-primary',
                    )}
                  >
                    <span
                      className="font-uthmani leading-none text-slate-900"
                      style={{ fontSize: `${glyphSize}px` }}
                    >
                      {w.word_text}
                    </span>
                    {mark && (
                      <span
                        className={cn(
                          'absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white/80',
                          mark === 'mastered' ? 'bg-emerald-500' : 'bg-amber-500',
                        )}
                        aria-label={mark === 'mastered' ? 'Mastered' : 'Needs practice'}
                      >
                        {mark === 'mastered'
                          ? <Star className="h-3.5 w-3.5" />
                          : <RefreshCw className="h-3.5 w-3.5" />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          <p className="pt-2 text-center text-sm text-slate-600" dir="ltr">
            {selecting
              ? 'Tap the first word of the lesson, then the last word.'
              : 'Tap any letter or word to open its flashcard.'}
          </p>
        </div>
      </div>

      {!selecting && (
        <>
          <div className="pointer-events-none sticky bottom-4 z-50 mt-4 flex justify-start">
            <Button
              type="button"
              size="sm"
              onClick={() => setDeckOpen(true)}
              className="pointer-events-auto gap-1.5 rounded-full shadow-xl"
            >
              <Layers className="h-4 w-4" /> Practice deck
              {deckWords.length > 0 && <span className="opacity-80">· {deckWords.length}</span>}
            </Button>
          </div>

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
