/**
 * Harakat (vowel-mark) helpers for the Noorani Qaida flashcards.
 *
 * The Qaida's teaching sequence (letters → joining → one harakat at a time) is
 * carried by the real page content, so all we need here is: which harakat a
 * word/letter carries, what colour to accent its flashcard with, and a rough
 * transliteration for the card back.
 */

export type Harakat =
  | 'fatha'
  | 'kasra'
  | 'damma'
  | 'sukun'
  | 'shadda'
  | 'tanween'
  | 'madd'
  | 'none';

const MARKS: Record<string, Harakat> = {
  '\u064E': 'fatha',
  '\u0650': 'kasra',
  '\u064F': 'damma',
  '\u0652': 'sukun',
  '\u0651': 'shadda',
  '\u064B': 'tanween',
  '\u064C': 'tanween',
  '\u064D': 'tanween',
  '\u0653': 'madd',
  '\u0670': 'madd',
};

const PRIORITY: Harakat[] = ['shadda', 'madd', 'tanween', 'sukun', 'damma', 'kasra', 'fatha'];

/** Dominant harakat carried by a word / letter. */
export function detectHarakat(text: string): Harakat {
  const found = new Set<Harakat>();
  for (const ch of text) {
    const h = MARKS[ch];
    if (h) found.add(h);
  }
  return PRIORITY.find((h) => found.has(h)) ?? 'none';
}

export interface HarakatStyle {
  label: string;
  /** Vivid card accent, expressed as raw HSL channels. */
  hsl: string;
}

export const HARAKAT_STYLE: Record<Harakat, HarakatStyle> = {
  fatha: { label: 'Fatha (zabar)', hsl: '4 84% 56%' },
  kasra: { label: 'Kasra (zer)', hsl: '212 92% 52%' },
  damma: { label: 'Damma (pesh)', hsl: '38 96% 50%' },
  sukun: { label: 'Sukun (jazm)', hsl: '265 78% 60%' },
  shadda: { label: 'Shadda (tashdeed)', hsl: '160 74% 38%' },
  tanween: { label: 'Tanween', hsl: '324 80% 54%' },
  madd: { label: 'Madd / Leen', hsl: '188 80% 40%' },
  none: { label: 'Letter', hsl: '30 30% 38%' },
};

/** Strip every diacritic, leaving the bare letter skeleton. */
export function stripMarks(text: string) {
  return text.replace(/[\u064B-\u0653\u0670\u06D6-\u06ED]/g, '');
}

const LETTERS: Record<string, { t: string; example?: string; meaning?: string }> = {
  'ا': { t: 'alif', example: 'أَسَد', meaning: 'lion' },
  'أ': { t: 'alif', example: 'أَسَد', meaning: 'lion' },
  'إ': { t: 'alif', example: 'إِبِل', meaning: 'camels' },
  'آ': { t: 'aa', example: 'آدَم', meaning: 'Adam' },
  'ب': { t: 'ba', example: 'بَاب', meaning: 'door' },
  'ت': { t: 'ta', example: 'تَمْر', meaning: 'dates' },
  'ث': { t: 'tha', example: 'ثَمَر', meaning: 'fruit' },
  'ج': { t: 'jeem', example: 'جَمَل', meaning: 'camel' },
  'ح': { t: 'ha', example: 'حَجَر', meaning: 'stone' },
  'خ': { t: 'kha', example: 'خُبْز', meaning: 'bread' },
  'د': { t: 'dal', example: 'دَار', meaning: 'house' },
  'ذ': { t: 'dhal', example: 'ذَهَب', meaning: 'gold' },
  'ر': { t: 'ra', example: 'رَجُل', meaning: 'man' },
  'ز': { t: 'zay', example: 'زَيْت', meaning: 'oil' },
  'س': { t: 'seen', example: 'سَمَك', meaning: 'fish' },
  'ش': { t: 'sheen', example: 'شَمْس', meaning: 'sun' },
  'ص': { t: 'saad', example: 'صَبْر', meaning: 'patience' },
  'ض': { t: 'daad', example: 'ضَوْء', meaning: 'light' },
  'ط': { t: 'taa', example: 'طَيْر', meaning: 'bird' },
  'ظ': { t: 'zaa', example: 'ظِل', meaning: 'shade' },
  'ع': { t: 'ain', example: 'عَيْن', meaning: 'eye' },
  'غ': { t: 'ghain', example: 'غُصْن', meaning: 'branch' },
  'ف': { t: 'fa', example: 'فَجْر', meaning: 'dawn' },
  'ق': { t: 'qaf', example: 'قَلَم', meaning: 'pen' },
  'ك': { t: 'kaf', example: 'كِتَاب', meaning: 'book' },
  'ل': { t: 'lam', example: 'لَيْل', meaning: 'night' },
  'م': { t: 'meem', example: 'مَاء', meaning: 'water' },
  'ن': { t: 'noon', example: 'نَهْر', meaning: 'river' },
  'ه': { t: 'ha', example: 'هَوَاء', meaning: 'air' },
  'ة': { t: 'ta marbuta' },
  'و': { t: 'waw', example: 'وَرْد', meaning: 'rose' },
  'ي': { t: 'ya', example: 'يَد', meaning: 'hand' },
  'ى': { t: 'alif maqsura' },
  'ء': { t: 'hamza' },
  'ؤ': { t: 'hamza on waw' },
  'ئ': { t: 'hamza on ya' },
  'ل\u0627': { t: 'laam-alif' },
};

const VOWEL_SOUND: Partial<Record<Harakat, string>> = {
  fatha: 'a',
  kasra: 'i',
  damma: 'u',
  tanween: 'an / in / un',
  sukun: '(no vowel)',
  madd: 'long vowel',
};

/** Rough transliteration used on the flashcard back — teaching aid, not scholarly. */
export function transliterate(text: string): string {
  const bare = stripMarks(text).replace(/\s+/g, ' ').trim();
  const parts = Array.from(bare)
    .map((ch) => LETTERS[ch]?.t)
    .filter(Boolean) as string[];
  if (parts.length === 0) return '—';
  const h = detectHarakat(text);
  const vowel = VOWEL_SOUND[h];
  return vowel ? `${parts.join(' · ')} — ${vowel}` : parts.join(' · ');
}

/** A familiar example word for the first recognised letter, if we know one. */
export function exampleFor(text: string): { word: string; meaning: string } | null {
  for (const ch of stripMarks(text)) {
    const hit = LETTERS[ch];
    if (hit?.example) return { word: hit.example, meaning: hit.meaning || '' };
  }
  return null;
}

/** Split a Qaida word into its individual letters (with their marks attached). */
export function splitLetters(text: string): string[] {
  const out: string[] = [];
  for (const ch of text.replace(/\s+/g, ' ').trim()) {
    if (ch === ' ') continue;
    if (/[\u064B-\u0653\u0670\u06D6-\u06ED]/.test(ch) && out.length) {
      out[out.length - 1] += ch;
    } else {
      out.push(ch);
    }
  }
  return out;
}
