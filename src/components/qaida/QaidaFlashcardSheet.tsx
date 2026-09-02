import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { QaidaFlashcard, type QaidaFlashcardWord } from './QaidaFlashcard';
import type { QaidaWordStatus } from '@/hooks/useQaidaWordProgress';

interface Props {
  word: QaidaFlashcardWord | null;
  status?: QaidaWordStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGrade: (wordId: string, status: QaidaWordStatus) => void;
}

/** Bright bottom-sheet flashcard opened by tapping a word on the Qaida page. */
export function QaidaFlashcardSheet({ word, status, open, onOpenChange, onGrade }: Props) {
  return (
    <Sheet open={open && !!word} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-center text-base">Flashcard</SheetTitle>
        </SheetHeader>
        {word && (
          <QaidaFlashcard
            key={word.id}
            word={word}
            status={status}
            onGrade={(s) => {
              onGrade(word.id, s);
              window.setTimeout(() => onOpenChange(false), s === 'mastered' ? 650 : 200);
            }}
            className="mx-auto max-w-md"
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

export default QaidaFlashcardSheet;
