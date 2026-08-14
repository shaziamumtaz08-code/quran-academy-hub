/**
 * Single source of truth for turning any Quran lesson marking style
 * (ayah range, ruku, quarter, whole juz) into one clean, consistent
 * display string — so reports, history and dashboards look identical
 * no matter how the teacher entered the lesson.
 */

export type LessonMarkerType = 'ayah' | 'ruku' | 'quarter' | 'juz';

export interface LessonSegment {
  markerType: LessonMarkerType;
  // ayah mode
  surahFrom?: string | null;
  ayahFrom?: number | string | null;
  surahTo?: string | null;
  ayahTo?: number | string | null;
  // ruku / quarter / juz mode
  juzFrom?: number | string | null;
  unitFrom?: number | string | null;
  juzTo?: number | string | null;
  unitTo?: number | string | null;
}

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

/** "Al-Jinn" -> "Surah Al-Jinn"; already-prefixed names are left alone. */
export function surahLabel(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  return /^surah\s/i.test(trimmed) ? trimmed : `Surah ${trimmed}`;
}

const range = (label: string, from: number, to: number | null) =>
  to !== null && to !== from ? `${label} ${from}-${to}` : `${label} ${from}`;

/** Normalized display string for one lesson segment. Empty string when incomplete. */
export function formatLessonSegment(seg: LessonSegment | null | undefined): string {
  if (!seg) return '';

  if (seg.markerType === 'ayah') {
    const sFrom = (seg.surahFrom || '').trim();
    const aFrom = num(seg.ayahFrom);
    if (!sFrom || aFrom === null) return '';
    const sTo = (seg.surahTo || '').trim();
    const aTo = num(seg.ayahTo);
    if (!sTo || sTo === sFrom) {
      return `${surahLabel(sFrom)}, ${range('verse', aFrom, aTo)}`;
    }
    return `${surahLabel(sFrom)}, verse ${aFrom} – ${surahLabel(sTo)}, verse ${aTo ?? ''}`.replace(/ verse $/, '').trim();
  }

  if (seg.markerType === 'juz') {
    const jFrom = num(seg.juzFrom);
    if (jFrom === null) return '';
    const jTo = num(seg.juzTo);
    return range('Juz', jFrom, jTo);
  }

  const unitLabel = seg.markerType === 'ruku' ? 'Ruku' : 'Quarter';
  const jFrom = num(seg.juzFrom);
  const uFrom = num(seg.unitFrom);
  if (jFrom === null || uFrom === null) return '';
  const jTo = num(seg.juzTo);
  const uTo = num(seg.unitTo);

  if (jTo === null || jTo === jFrom) {
    return `Juz ${jFrom}, ${range(unitLabel, uFrom, uTo)}`;
  }
  return `Juz ${jFrom}, ${unitLabel} ${uFrom} – Juz ${jTo}, ${unitLabel} ${uTo ?? ''}`.trim();
}

/** Joins multiple segments into a single normalized lesson string. */
export function formatLessonSegments(segments: (LessonSegment | null | undefined)[]): string {
  return segments
    .map(formatLessonSegment)
    .filter(Boolean)
    .join(' + ');
}

/** True when a segment carries enough data to be saved/displayed. */
export function isSegmentComplete(seg: LessonSegment): boolean {
  return formatLessonSegment(seg).length > 0;
}

export function emptySegment(markerType: LessonMarkerType = 'ayah'): LessonSegment {
  return { markerType };
}

type AnyRow = Record<string, any>;

/** Rebuilds segments from the legacy flat `sabaq_*` / `surah_name` columns. */
export function segmentsFromLegacyRow(row: AnyRow | null | undefined): LessonSegment[] {
  if (!row) return [];
  const marker = (row.sabaq_marker_type as LessonMarkerType) || 'ayah';

  if (marker === 'ruku') {
    return [{
      markerType: 'ruku',
      juzFrom: row.sabaq_ruku_from_juz,
      unitFrom: row.sabaq_ruku_from_number,
      juzTo: row.sabaq_ruku_to_juz,
      unitTo: row.sabaq_ruku_to_number,
    }];
  }
  if (marker === 'quarter') {
    return [{
      markerType: 'quarter',
      juzFrom: row.sabaq_quarter_from_juz,
      unitFrom: row.sabaq_quarter_from_number,
      juzTo: row.sabaq_quarter_to_juz,
      unitTo: row.sabaq_quarter_to_number,
    }];
  }
  if (marker === 'juz') {
    return [{ markerType: 'juz', juzFrom: row.sabaq_juz_from, juzTo: row.sabaq_juz_to }];
  }
  return [{
    markerType: 'ayah',
    surahFrom: row.sabaq_surah_from ?? row.surah_name,
    ayahFrom: row.sabaq_ayah_from ?? row.ayah_from,
    surahTo: row.sabaq_surah_to,
    ayahTo: row.sabaq_ayah_to ?? row.ayah_to,
  }];
}

/** Maps a DB `attendance_lesson_segments` row into a LessonSegment. */
export function segmentFromDbRow(row: AnyRow): LessonSegment {
  return {
    markerType: (row.marker_type as LessonMarkerType) || 'ayah',
    surahFrom: row.surah_from,
    ayahFrom: row.ayah_from,
    surahTo: row.surah_to,
    ayahTo: row.ayah_to,
    juzFrom: row.juz_from,
    unitFrom: row.unit_from,
    juzTo: row.juz_to,
    unitTo: row.unit_to,
  };
}

/** Maps a LessonSegment into an `attendance_lesson_segments` insert payload. */
export function segmentToDbRow(seg: LessonSegment, attendanceId: string, index: number, section = 'sabaq') {
  return {
    attendance_id: attendanceId,
    segment_index: index,
    section,
    marker_type: seg.markerType,
    surah_from: seg.markerType === 'ayah' ? (seg.surahFrom || null) : null,
    ayah_from: seg.markerType === 'ayah' ? num(seg.ayahFrom) : null,
    surah_to: seg.markerType === 'ayah' ? (seg.surahTo || null) : null,
    ayah_to: seg.markerType === 'ayah' ? num(seg.ayahTo) : null,
    juz_from: seg.markerType === 'ayah' ? null : num(seg.juzFrom),
    unit_from: seg.markerType === 'ayah' || seg.markerType === 'juz' ? null : num(seg.unitFrom),
    juz_to: seg.markerType === 'ayah' ? null : num(seg.juzTo),
    unit_to: seg.markerType === 'ayah' || seg.markerType === 'juz' ? null : num(seg.unitTo),
    display_text: formatLessonSegment(seg) || null,
  };
}

/**
 * The one function every read path should use to render a lesson.
 * Prefers the stored normalized string, then rebuilds it from the
 * structured columns, and only then falls back to legacy free text.
 */
export function lessonDisplayFromRow(row: AnyRow | null | undefined): string {
  if (!row) return '';
  if (row.lesson_display) return row.lesson_display as string;
  const rebuilt = formatLessonSegments(segmentsFromLegacyRow(row));
  if (rebuilt) return rebuilt;
  return (row.lesson_covered as string) || '';
}
