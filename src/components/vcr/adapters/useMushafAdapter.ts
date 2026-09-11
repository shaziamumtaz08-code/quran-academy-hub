import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  findPageForAyah,
  findPageForJuz,
  getDefaultEditionId,
  surahNameByNumber,
  type MushafPageInfo,
} from '@/lib/mushafResolve';
import type { VcrAdapter, VcrRenderContext } from '../adapter';
import { MushafUnit, type MushafAyahRange } from './MushafUnit';
import { MushafCover, MushafIndexPage, useMushafIndex } from './MushafFront';

export const MUSHAF_TOTAL_PAGES = 610;

/** "Ayah 3–5" within one surah, "Ayah 2:255 – 3:2" when the page spans two. */
function ayahLabel(range: MushafAyahRange | null): string | null {
  const a = range?.first;
  const b = range?.last;
  if (!a?.ayah) return null;
  if (!b?.ayah) return `Ayah ${a.ayah}`;
  if (a.surah && b.surah && a.surah !== b.surah) {
    return `Ayah ${a.surah}:${a.ayah} – ${b.surah}:${b.ayah}`;
  }
  return a.ayah === b.ayah ? `Ayah ${a.ayah}` : `Ayah ${a.ayah}–${b.ayah}`;
}

interface Options {
  /** Resume position taken from student_progress, e.g. "2:34". */
  resumeAyah?: { surah: number; ayah: number } | null;
  /** Resume by Juz when the syllabus item is a Juz. */
  resumeJuz?: number | null;
  libraryItemId?: string | null;
  /** Teacher-side: pointing at a line is mirrored to the student. */
  canControl?: boolean;
  onPointLine?: (lineId: string | null) => void;
}

/** Mushaf implementation of the VCR adapter contract. */
export function useMushafAdapter({ resumeAyah = null, resumeJuz = null, libraryItemId = null, canControl = false, onPointLine }: Options): VcrAdapter {
  const [editionId, setEditionId] = useState<string | null>(null);
  const [info, setInfo] = useState<MushafPageInfo | null>(null);
  const [range, setRange] = useState<MushafAyahRange | null>(null);
  const [unit, setUnit] = useState(1);
  const mushafIndex = useMushafIndex(editionId);

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
        onAyahRange: setRange,
        canPoint: canControl,
        onPointLine,
      }),
    [editionId, canControl, onPointLine]
  );

  return useMemo<VcrAdapter>(() => {
    const s = surahNameByNumber(info?.surah_start);
    const e = surahNameByNumber(info?.surah_end);
    const surahs = s && e && s !== e ? `${s} – ${e}` : s || e || '';
    return {
      contentType: 'mushaf',
      front: [
        {
          key: 'cover',
          label: 'Mushaf',
          subLabel: 'Cover',
          render: (ctx) => React.createElement(MushafCover, { fontScale: ctx.fontScale, pages: MUSHAF_TOTAL_PAGES }),
        },
        {
          key: 'index',
          label: 'Mushaf',
          subLabel: 'Index',
          render: (ctx) =>
            React.createElement(MushafIndexPage, {
              index: mushafIndex,
              fontScale: ctx.fontScale,
              onOpenPage: ctx.goToUnit,
            }),
        },
      ],
      libraryItemId,
      totalUnits: MUSHAF_TOTAL_PAGES,
      unitNoun: 'page',
      currentLabel: surahs || 'Mushaf',
      currentSubLabel: [
        info?.juz_number ? `Juz ${info.juz_number}` : null,
        `Page ${unit}`,
        ayahLabel(range),
      ].filter(Boolean).join(' · '),
      resolveStartUnit: editionId ? resolveStartUnit : undefined,
      onUnitChange: setUnit,
      renderUnit,
      referenceFor: (unit: number) => ({ page: unit, juz: info?.juz_number ?? null }),
    };
  }, [info, range, unit, editionId, resolveStartUnit, renderUnit, libraryItemId, mushafIndex]);
}

export default useMushafAdapter;
