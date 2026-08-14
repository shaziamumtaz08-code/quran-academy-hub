/**
 * Bridges the visual Mushaf page view to the existing lesson-marking system.
 * A tapped start/end line on a Quran page is turned into the SAME
 * `LessonSegment` shape used by dropdown marking (src/lib/lessonFormat.ts),
 * so nothing about storage, display or reporting changes.
 */
import { supabase } from '@/integrations/supabase/client';
import { SURAHS } from '@/lib/quranData';
import type { LessonSegment, LessonMarkerType } from '@/lib/lessonFormat';

export interface MushafLine {
  id: string;
  page_number: number;
  line_number: number;
  line_type: 'ayah' | 'surah_name' | 'basmallah' | string;
  surah_number: number | null;
  first_surah: number | null;
  first_ayah: number | null;
  last_surah: number | null;
  last_ayah: number | null;
  is_centered: boolean | null;
  text_indopak: string | null;
}

export interface MushafPageInfo {
  page_number: number;
  juz_number: number | null;
  surah_start: number | null;
  surah_end: number | null;
}

export const surahNameByNumber = (n: number | null | undefined): string =>
  SURAHS.find((s) => s.number === n)?.name || '';

/** Default edition (Qudratullah 15-line IndoPak). */
export async function getDefaultEditionId(): Promise<string | null> {
  const { data } = await supabase
    .from('mushaf_editions')
    .select('id')
    .eq('is_default', true)
    .maybeSingle();
  return data?.id ?? null;
}

export async function fetchPage(editionId: string, page: number): Promise<{
  info: MushafPageInfo | null;
  lines: MushafLine[];
}> {
  const [pageRes, lineRes] = await Promise.all([
    supabase
      .from('mushaf_pages')
      .select('page_number, juz_number, surah_start, surah_end')
      .eq('edition_id', editionId)
      .eq('page_number', page)
      .maybeSingle(),
    supabase
      .from('mushaf_lines')
      .select('id, page_number, line_number, line_type, surah_number, first_surah, first_ayah, last_surah, last_ayah, is_centered, text_indopak')
      .eq('edition_id', editionId)
      .eq('page_number', page)
      .order('line_number'),
  ]);
  return {
    info: (pageRes.data as MushafPageInfo) ?? null,
    lines: (lineRes.data as MushafLine[]) ?? [],
  };
}

/** First page that contains a given surah (its opening page). */
export async function findPageForSurah(editionId: string, surah: number): Promise<number | null> {
  const { data } = await supabase
    .from('mushaf_lines')
    .select('page_number')
    .eq('edition_id', editionId)
    .eq('first_surah', surah)
    .eq('first_ayah', 1)
    .order('page_number')
    .limit(1);
  return data?.[0]?.page_number ?? null;
}

/** First page of a Juz. */
export async function findPageForJuz(editionId: string, juz: number): Promise<number | null> {
  const { data } = await supabase
    .from('mushaf_pages')
    .select('page_number')
    .eq('edition_id', editionId)
    .eq('juz_number', juz)
    .order('page_number')
    .limit(1);
  return data?.[0]?.page_number ?? null;
}

export interface TapPoint {
  page: number;
  line: MushafLine;
  /** Exact ayah tapped (its round end-marker), overriding the line boundary. */
  ayahAt?: { surah: number; ayah: number } | null;
}

const startOf = (p: TapPoint) => ({
  surah: p.ayahAt?.surah ?? p.line.first_surah,
  ayah: p.ayahAt?.ayah ?? p.line.first_ayah,
});

const endOf = (p: TapPoint) => ({
  surah: p.ayahAt?.surah ?? p.line.last_surah,
  ayah: p.ayahAt?.ayah ?? p.line.last_ayah,
});

/** Ayah-mode segment built straight from the tapped start/end lines. */
export function segmentFromTaps(start: TapPoint, end: TapPoint | null): LessonSegment {
  const from = startOf(start);
  const to = endOf(end ?? start);
  return {
    markerType: 'ayah',
    surahFrom: surahNameByNumber(from.surah),
    ayahFrom: from.ayah,
    surahTo: surahNameByNumber(to.surah),
    ayahTo: to.ayah,
  };
}


/** Juz numbers covering the tapped range. */
async function juzForAyah(surah: number, ayah: number): Promise<number | null> {
  const { data } = await supabase
    .from('quran_ayahs')
    .select('juz_number')
    .eq('surah_number', surah)
    .eq('ayah_number', ayah)
    .maybeSingle();
  return data?.juz_number ?? null;
}

/**
 * Juz-scoped ruku position for one ayah: which ruku (1..n) inside its juz.
 * Matches how Ruku marking is entered in the dropdowns (Juz + Ruku #).
 */
async function rukuForAyah(surah: number, ayah: number): Promise<{ juz: number; unit: number } | null> {
  const juz = await juzForAyah(surah, ayah);
  if (!juz) return null;
  const { data } = await supabase
    .from('rukus')
    .select('surah_number, ruku_number, ayah_from, ayah_to')
    .eq('juz_number', juz)
    .order('surah_number')
    .order('ruku_number');
  const rows = data ?? [];
  const idx = rows.findIndex(
    (r: any) => r.surah_number === surah && ayah >= r.ayah_from && ayah <= r.ayah_to
  );
  if (idx === -1) return { juz, unit: 1 };
  return { juz, unit: idx + 1 };
}

/**
 * Converts the tapped range into the segment shape for the teacher's chosen
 * marker type. Ayah is exact; ruku/juz are resolved from reference data.
 */
export async function resolveSegment(
  markerType: LessonMarkerType,
  start: TapPoint,
  end: TapPoint | null
): Promise<LessonSegment> {
  const ayahSeg = segmentFromTaps(start, end);
  if (markerType === 'ayah' || markerType === 'quarter') return ayahSeg;

  const sFrom = start.line.first_surah;
  const aFrom = start.line.first_ayah;
  const endLine = end?.line ?? start.line;
  const sTo = endLine.last_surah;
  const aTo = endLine.last_ayah;
  if (!sFrom || !aFrom || !sTo || !aTo) return ayahSeg;

  if (markerType === 'juz') {
    const [jFrom, jTo] = await Promise.all([juzForAyah(sFrom, aFrom), juzForAyah(sTo, aTo)]);
    if (!jFrom) return ayahSeg;
    return { markerType: 'juz', juzFrom: jFrom, juzTo: jTo ?? jFrom };
  }

  const [rFrom, rTo] = await Promise.all([rukuForAyah(sFrom, aFrom), rukuForAyah(sTo, aTo)]);
  if (!rFrom) return ayahSeg;
  return {
    markerType: 'ruku',
    juzFrom: rFrom.juz,
    unitFrom: rFrom.unit,
    juzTo: rTo?.juz ?? rFrom.juz,
    unitTo: rTo?.unit ?? rFrom.unit,
  };
}
