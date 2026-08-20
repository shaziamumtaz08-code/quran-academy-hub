import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  findPageForAyah,
  findPageForJuz,
  getDefaultEditionId,
  surahNameByNumber,
  type MushafPageInfo,
} from '@/lib/mushafResolve';
import type { VcrAdapter, VcrRenderContext } from '../adapter';
import { MushafUnit } from './MushafUnit';

export const MUSHAF_TOTAL_PAGES = 610;

interface Options {
  /** Resume position taken from student_progress, e.g. "2:34". */
  resumeAyah?: { surah: number; ayah: number } | null;
  /** Resume by Juz when the syllabus item is a Juz. */
  resumeJuz?: number | null;
  libraryItemId?: string | null;
}

/** Mushaf implementation of the VCR adapter contract. */
export function useMushafAdapter({ resumeAyah = null, resumeJuz = null, libraryItemId = null }: Options): VcrAdapter {
  const [editionId, setEditionId] = useState<string | null>(null);
  const [info, setInfo] = useState<MushafPageInfo | null>(null);
  const [unit, setUnit] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getDefaultEditionId();
      if (!cancelled) setEditionId(id);
    })();
    return () => { cancelled = true; };
  }, []);

  const resolveStartUnit = useCallback(async () => {
    if (!editionId) return null;
    if (resumeAyah) {
      const p = await findPageForAyah(editionId, resumeAyah.surah, resumeAyah.ayah);
      if (p) return p;
    }
    if (resumeJuz) return await findPageForJuz(editionId, resumeJuz);
    return null;
  }, [editionId, resumeAyah?.surah, resumeAyah?.ayah, resumeJuz]);

  const renderUnit = useCallback(
    (unit: number, ctx: VcrRenderContext) =>
      React.createElement(MushafUnit, {
        editionId,
        page: unit,
        fontScale: ctx.fontScale,
        highlight: ctx.highlight,
        onInfo: setInfo,
      }),
    [editionId]
  );

  return useMemo<VcrAdapter>(() => {
    const s = surahNameByNumber(info?.surah_start);
    const e = surahNameByNumber(info?.surah_end);
    const surahs = s && e && s !== e ? `${s} – ${e}` : s || e || '';
    return {
      contentType: 'mushaf',
      libraryItemId,
      totalUnits: MUSHAF_TOTAL_PAGES,
      unitNoun: 'page',
      currentLabel: surahs || 'Mushaf',
      currentSubLabel: `${info?.juz_number ? `Juz ${info.juz_number} · ` : ''}Page ${unit}`.trim(),
      resolveStartUnit: editionId ? resolveStartUnit : undefined,
      onUnitChange: setUnit,
      renderUnit,
      referenceFor: (unit: number) => ({ page: unit, juz: info?.juz_number ?? null }),
    };
  }, [info, unit, editionId, resolveStartUnit, renderUnit, libraryItemId]);
}

export default useMushafAdapter;
