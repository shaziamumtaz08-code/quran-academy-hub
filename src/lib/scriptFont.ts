/**
 * Detect whether a string contains significant Urdu (Nastaliq) or Arabic (Naskh) script
 * and return the appropriate CSS class for font rendering.
 *
 * Urdu-specific ranges: U+0679 (ٹ), U+067E (پ), U+0686 (چ), U+0688 (ڈ), U+0691 (ڑ), U+0698 (ژ), U+06A9 (ک), U+06AF (گ), U+06CC (ی), U+06BE (ھ)
 * If any Urdu-specific character is found → 'urdu-text'
 * If Arabic range (U+0600–U+06FF) dominates → 'arabic-text'
 */

const URDU_CHARS = /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06CC\u06BE]/;
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g;

export function detectScriptClass(text: string | null | undefined): string {
  if (!text) return '';
  if (URDU_CHARS.test(text)) return 'urdu-text';
  const matches = text.match(ARABIC_RANGE);
  if (matches && matches.length > text.length * 0.15) return 'arabic-text';
  return '';
}
