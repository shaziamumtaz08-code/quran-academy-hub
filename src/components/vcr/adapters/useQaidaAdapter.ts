import React, { useCallback, useMemo, useState } from 'react';
import { useQaidaReference, baabsForPage } from '@/hooks/useQaidaProgress';
import type { VcrAdapter, VcrRenderContext } from '../adapter';
import { QaidaUnit, type QaidaPageWord } from './QaidaUnit';

export const QAIDA_FALLBACK_PAGES = 32;

interface Options {
  /** Resume page taken from student_progress.reference. */
  resumePage?: number | null;
  canControl?: boolean;
  libraryItemId?: string | null;
  /** Student whose flashcard progress is recorded. */
  studentId?: string | null;
  /** Teacher tapped a word — used to broadcast the flip to followers. */
  onSelectWord?: (wordId: string | null) => void;
}

/** Noorani Qaida implementation of the VCR adapter contract. */
export function useQaidaAdapter({
  resumePage = null,
  canControl = true,
  libraryItemId = null,
  studentId = null,
  onSelectWord,
}: Options = {}): VcrAdapter {
  const { data: ref } = useQaidaReference();
  const [unit, setUnit] = useState(1);
  const [, setWords] = useState<QaidaPageWord[]>([]);

  const totalUnits = ref?.pages?.length || QAIDA_FALLBACK_PAGES;

  const resolveStartUnit = useCallback(async () => {
    return resumePage && resumePage > 0 ? resumePage : null;
  }, [resumePage]);

  const renderUnit = useCallback(
    (u: number, ctx: VcrRenderContext) => {
      /* Transition pages belong to two baabs — show the content baab (the one
         that actually has transcribed words) so the grid is never mixed. */
      const covering = ref ? baabsForPage(ref.baabs, u) : [];
      const scoped =
        covering.find((b) => b.picker_mode === 'word_dropdown') ?? covering[0] ?? null;
      return React.createElement(QaidaUnit, {
        page: u,
        baabId: scoped?.id ?? null,
        fontScale: ctx.fontScale,
        highlight: ctx.highlight,
        canControl,
        studentId,
        onWords: setWords,
        onSelectWord,
      });
    },
    [ref, canControl, studentId, onSelectWord]
  );


  return useMemo<VcrAdapter>(() => {
    const baabs = ref ? baabsForPage(ref.baabs, unit) : [];
    const label = baabs.length
      ? baabs.map((b) => b.name_english).join(' / ')
      : 'Noorani Qaida';
    const sub = baabs.length
      ? `Baab ${baabs.map((b) => b.baab_number).join('/')} · Page ${unit}`
      : `Page ${unit}`;
    return {
      contentType: 'qaida',
      libraryItemId,
      totalUnits,
      unitNoun: 'page',
      currentLabel: label,
      currentSubLabel: sub,
      resolveStartUnit,
      onUnitChange: setUnit,
      renderUnit,
      referenceFor: (u: number) => ({
        page: u,
        baab_ids: ref ? baabsForPage(ref.baabs, u).map((b) => b.id) : [],
      }),
    };
  }, [ref, unit, totalUnits, resolveStartUnit, renderUnit, libraryItemId]);
}

export default useQaidaAdapter;
