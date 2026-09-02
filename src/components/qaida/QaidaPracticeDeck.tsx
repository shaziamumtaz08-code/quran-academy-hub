import React, { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { QaidaFlashcard, type QaidaFlashcardWord } from './QaidaFlashcard';
import type { QaidaWordStatus } from '@/hooks/useQaidaWordProgress';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every word graded so far — the review pool. */
  words: QaidaFlashcardWord[];
  statuses: Record<string, { status: QaidaWordStatus } | undefined>;
  onGrade: (wordId: string, status: QaidaWordStatus) => void;
}

const shuffle = <T,>(list: T[]) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Shuffled review of everything already tapped/graded — mixed assessment practice. */
export function QaidaPracticeDeck({ open, onOpenChange, words, statuses, onGrade }: Props) {
  const [seed, setSeed] = useState(0);
  const [index, setIndex] = useState(0);

  const deck = useMemo(() => shuffle(words), [words, seed]);
  useEffect(() => { if (open) { setSeed((s) => s + 1); setIndex(0); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = deck[index] || null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="qaida-pop qaida-pastel max-h-[92vh] overflow-y-auto rounded-t-3xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-center text-base">
            Practice deck {deck.length > 0 && <span className="text-muted-foreground">· {index + 1} / {deck.length}</span>}
          </SheetTitle>
        </SheetHeader>

        {current ? (
          <div className="mx-auto max-w-md space-y-4">
            <QaidaFlashcard
              key={current.id}
              word={current}
              status={statuses[current.id]?.status ?? null}
              onGrade={(s) => {
                onGrade(current.id, s);
                window.setTimeout(() => setIndex((i) => (i + 1 < deck.length ? i + 1 : i)), 500);
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setSeed((s) => s + 1); setIndex(0); }}>
                <Shuffle className="mr-1 h-4 w-4" /> Reshuffle
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={index >= deck.length - 1} onClick={() => setIndex((i) => i + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Tap words on the page and grade them — they collect here for mixed review.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default QaidaPracticeDeck;
