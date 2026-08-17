/**
 * Lightweight tajweed helpers for the Virtual Class Room.
 *
 * These are teaching aids, not a certified tajweed engine: the rules below are
 * the three a teacher points at most during a 1:1 Qaida/Nazra class
 * (ghunnah, qalqalah, madd), detected from the IndoPak text itself.
 */

export type TajweedRule = 'ghunnah' | 'qalqalah' | 'madd' | null;

const SHADDA = '\u0651';
const SUKUN = '\u0652';
const MADDAH = '\u0653';
const QALQALAH = new Set(['ق', 'ط', 'ب', 'ج', 'د']);
const TANWEEN = new Set(['\u064B', '\u064C', '\u064D']);
const HARAKAT = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;

export interface TajweedChar {
  /** Base letter plus every diacritic attached to it. */
  text: string;
  rule: TajweedRule;
}

/** Splits Arabic text into letter clusters and tags the ones carrying a rule. */
export function tajweedChars(text: string): TajweedChar[] {
  const clusters: string[] = [];
  for (const ch of text) {
    if (clusters.length && HARAKAT.test(ch)) clusters[clusters.length - 1] += ch;
    else clusters.push(ch);
  }
  return clusters.map((cluster, i) => {
    const base = cluster[0];
    const marks = cluster.slice(1);
    let rule: TajweedRule = null;
    if ((base === 'ن' || base === 'م') && marks.includes(SHADDA)) rule = 'ghunnah';
    else if (QALQALAH.has(base) && marks.includes(SUKUN)) rule = 'qalqalah';
    else if (base === 'آ' || marks.includes(MADDAH)) rule = 'madd';
    else if (
      (base === 'ن' && marks.includes(SUKUN)) ||
      [...marks].some((m) => TANWEEN.has(m))
    ) {
      // نْ / tanween followed by a ghunnah-producing letter
      const next = clusters[i + 1]?.[0];
      if (next && ['م', 'ن', 'و', 'ي'].includes(next)) rule = 'ghunnah';
    }
    return { text: cluster, rule };
  });
}

export const TAJWEED_LEGEND: { rule: Exclude<TajweedRule, null>; label: string }[] = [
  { rule: 'ghunnah', label: 'Ghunnah' },
  { rule: 'qalqalah', label: 'Qalqalah' },
  { rule: 'madd', label: 'Madd' },
];

export const tajweedClass = (rule: TajweedRule) =>
  rule === 'ghunnah'
    ? 'text-tajweed-ghunnah'
    : rule === 'qalqalah'
      ? 'text-tajweed-qalqalah'
      : rule === 'madd'
        ? 'text-tajweed-madd'
        : '';

/** Reference recitation for a single verse (Mishary Alafasy, 128kbps). */
export const ayahAudioUrl = (surah: number, ayah: number) =>
  `https://everyayah.com/data/Alafasy_128kbps/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
