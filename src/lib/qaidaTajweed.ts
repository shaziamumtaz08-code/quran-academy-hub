/**
 * Tajweed rule detection + colour mapping for the Noorani Qaida display.
 *
 * Colours follow the conventional printed "Rangeen Tajweedi" / QUL tajweed
 * palette (https://qul.tarteel.ai/tajweed_words). They are applied as CSS
 * classes per letter (see .tj-* in index.css) — never baked into the font.
 *
 * Detection is deliberately conservative: Qaida words are short letter drills,
 * so we only colour a letter when the classical rule is unambiguous from the
 * text itself. Anything else stays plain ink.
 */

export type TajweedRule =
  | 'ghunnah'
  | 'qalqalah'
  | 'madd'
  | 'idgham'
  | 'idgham_no_ghunnah'
  | 'ikhfa'
  | 'iqlab'
  | 'izhar'
  | 'none';

export interface TajweedSegment {
  text: string;
  rule: TajweedRule;
}

export interface TajweedRuleInfo {
  label: string;
  urdu: string;
  /** Conventional tajweed colour (hex, printed-mushaf palette). */
  color: string;
  hint: string;
}

export const TAJWEED_RULES: Record<Exclude<TajweedRule, 'none'>, TajweedRuleInfo> = {
  ghunnah: { label: 'Ghunnah', urdu: 'غنّہ', color: '#FF7E1E', hint: 'Nasal sound held ~2 counts' },
  qalqalah: { label: 'Qalqalah', urdu: 'قلقلہ', color: '#DD0008', hint: 'Echoing bounce on ق ط ب ج د' },
  madd: { label: 'Madd', urdu: 'مدّ', color: '#537FFF', hint: 'Elongated vowel' },
  idgham: { label: 'Idgham (with ghunnah)', urdu: 'ادغام', color: '#169777', hint: 'Merged into the next letter' },
  idgham_no_ghunnah: { label: 'Idgham (no ghunnah)', urdu: 'ادغام بلا غنّہ', color: '#169200', hint: 'Merged without nasalisation' },
  ikhfa: { label: 'Ikhfa', urdu: 'اخفا', color: '#9400A8', hint: 'Hidden with light nasalisation' },
  iqlab: { label: 'Iqlab / Qalb', urdu: 'اقلاب', color: '#26BFFD', hint: 'Noon turns into a meem sound' },
  izhar: { label: 'Izhar', urdu: 'اظہار', color: '#2144C1', hint: 'Pronounced clearly, no merging' },
};

export function tajweedColor(rule: TajweedRule): string | null {
  return rule === 'none' ? null : TAJWEED_RULES[rule].color;
}

const MARK_RE = /[\u064B-\u0653\u0670\u06D6-\u06ED]/;

const FATHA = '\u064E';
const KASRA = '\u0650';
const DAMMA = '\u064F';
const SUKUN = '\u0652';
const SHADDA = '\u0651';
const TANWEEN = ['\u064B', '\u064C', '\u064D'];
const MADD_MARK = ['\u0653', '\u0670'];

const QALQALAH = new Set(['ق', 'ط', 'ب', 'ج', 'د']);
const IDGHAM_GHUNNAH = new Set(['ي', 'ن', 'م', 'و']);
const IDGHAM_NO_GHUNNAH = new Set(['ل', 'ر']);
const IZHAR = new Set(['ء', 'أ', 'إ', 'ؤ', 'ئ', 'ه', 'ع', 'ح', 'غ', 'خ']);

interface Unit {
  base: string;
  marks: string;
}

/** Split into letter units, each carrying its own diacritics. */
function units(text: string): Unit[] {
  const out: Unit[] = [];
  for (const ch of text) {
    if (ch === ' ' || ch === '\u00A0') { out.push({ base: ch, marks: '' }); continue; }
    if (MARK_RE.test(ch) && out.length) {
      out[out.length - 1].marks += ch;
      continue;
    }
    out.push({ base: ch, marks: '' });
  }
  return out;
}

const has = (u: Unit, m: string) => u.marks.includes(m);
const hasTanween = (u: Unit) => TANWEEN.some((m) => u.marks.includes(m));
const isBare = (u: Unit) => u.marks === '';

function ruleFor(i: number, us: Unit[]): TajweedRule {
  const u = us[i];
  if (!u || u.base === ' ') return 'none';
  const next = us.slice(i + 1).find((x) => x.base !== ' ');
  const prev = [...us.slice(0, i)].reverse().find((x) => x.base !== ' ');

  /* Madd: explicit madd mark, or a bare madd letter carried by its own vowel. */
  if (MADD_MARK.some((m) => u.marks.includes(m))) return 'madd';
  if (isBare(u) && prev) {
    if ((u.base === 'ا' || u.base === 'ى') && has(prev, FATHA)) return 'madd';
    if (u.base === 'و' && has(prev, DAMMA)) return 'madd';
    if (u.base === 'ي' && has(prev, KASRA)) return 'madd';
  }
  if (u.base === 'آ') return 'madd';

  /* Ghunnah: noon or meem with shadda. */
  if ((u.base === 'ن' || u.base === 'م') && has(u, SHADDA)) return 'ghunnah';

  /* Noon sakinah / tanween rules. */
  const noonSakin = u.base === 'ن' && (has(u, SUKUN) || isBare(u)) && !!next;
  const tanweenHere = hasTanween(u) && !!next;
  if (noonSakin || tanweenHere) {
    const n = next!.base;
    if (n === 'ب') return 'iqlab';
    if (IDGHAM_GHUNNAH.has(n)) return 'idgham';
    if (IDGHAM_NO_GHUNNAH.has(n)) return 'idgham_no_ghunnah';
    if (IZHAR.has(n)) return 'izhar';
    return 'ikhfa';
  }

  /* Meem sakinah rules. */
  if (u.base === 'م' && has(u, SUKUN) && next) {
    if (next.base === 'ب') return 'ikhfa';
    if (next.base === 'م') return 'idgham';
  }

  /* Qalqalah: the five letters carrying sukun (or word-final and bare). */
  if (QALQALAH.has(u.base) && (has(u, SUKUN) || (!next && isBare(u) && i > 0))) return 'qalqalah';

  return 'none';
}

/** Segment a Qaida word/letter into coloured tajweed spans. */
export function tajweedSegments(text: string): TajweedSegment[] {
  const us = units(text);
  const out: TajweedSegment[] = [];
  us.forEach((u, i) => {
    const rule = ruleFor(i, us);
    const piece = u.base + u.marks;
    const last = out[out.length - 1];
    if (last && last.rule === rule) last.text += piece;
    else out.push({ text: piece, rule });
  });
  return out;
}

/** Which rules actually appear in a set of words — drives the page legend. */
export function rulesPresent(texts: string[]): Exclude<TajweedRule, 'none'>[] {
  const seen = new Set<TajweedRule>();
  texts.forEach((t) => tajweedSegments(t).forEach((s) => seen.add(s.rule)));
  return (Object.keys(TAJWEED_RULES) as Exclude<TajweedRule, 'none'>[]).filter((r) => seen.has(r));
}
