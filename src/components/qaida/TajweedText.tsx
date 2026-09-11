import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { tajweedSegments, tajweedColor, TAJWEED_RULES, rulesPresent } from '@/lib/qaidaTajweed';

interface Props {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  /** Turn colouring off (keeps the Indo-Pak font). */
  plain?: boolean;
}

/**
 * Noorani Qaida Arabic text: Indo-Pak Nastaleeq typography with per-letter
 * tajweed rule colouring (Rangeen Tajweedi convention).
 */
/**
 * Arabic-Indic / Urdu digit runs (optionally wrapped in RLM marks) — these are
 * end-of-verse numbers. The Indo-Pak Nastaleeq Qaida face has no standalone
 * glyphs for them, so they must be rendered with a digit-safe Naskh stack.
 */
const AYAH_DIGITS_RE = /([\u0660-\u0669\u06F0-\u06F9]+)/g;

/**
 * Non-printing controls and legacy private-use Quran markers stored around
 * ayah endings. The QUL text already carries the visible digit separately;
 * allowing these markers through produces an empty/tofu square in web fonts.
 */
const INVISIBLES_RE = /[\u200B-\u200C\u200E\u200F\u202A-\u202E\u2066-\u2069\uE000-\uF8FF\uFEFF]/g;

/** Arabic letters that join to the following letter (i.e. can take a medial form). */
const DUAL_JOINING_RE = /[\u0620\u0626\u0628\u062A-\u062E\u0633-\u0645\u0647\u0649\u064A\u066E-\u066F\u0678-\u0687\u069A-\u06BF\u06C1-\u06C2\u06CC\u06CE\u06D0-\u06D1\u06FA-\u06FC]/;
/** Any Arabic letter (right-joining letters can still receive a final form). */
const ARABIC_LETTER_RE = /[\u0620-\u064A\u066E-\u06D3\u06EE-\u06EF\u06FA-\u06FF]/;
/** Combining marks (harakaat) — skipped when looking at joining neighbours. */
const MARK_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;

const lastLetter = (s: string) => {
  for (let i = s.length - 1; i >= 0; i--) if (!MARK_RE.test(s[i])) return s[i];
  return '';
};
const firstLetter = (s: string) => {
  for (let i = 0; i < s.length; i++) if (!MARK_RE.test(s[i])) return s[i];
  return '';
};

const ZWJ = '\u200D';

/**
 * Colouring splits a word across several <span>s, and every browser shapes each
 * element separately — that is what makes joined Arabic come apart. Re-attach
 * the boundaries with a zero-width joiner so each piece keeps its initial /
 * medial / final form in Chrome, Edge, Firefox and Safari alike.
 */
function joinBoundaries(pieces: string[]): string[] {
  return pieces.map((piece, i) => {
    let out = piece;
    const prev = pieces[i - 1];
    const next = pieces[i + 1];
    if (prev && DUAL_JOINING_RE.test(lastLetter(prev)) && ARABIC_LETTER_RE.test(firstLetter(piece))) {
      out = ZWJ + out;
    }
    if (next && DUAL_JOINING_RE.test(lastLetter(piece)) && ARABIC_LETTER_RE.test(firstLetter(next))) {
      out = out + ZWJ;
    }
    return out;
  });
}

export function TajweedText({ text, className, style, plain }: Props) {
  const parts = useMemo(() => {
    const clean = text.replace(INVISIBLES_RE, '');
    const chunks = clean.split(AYAH_DIGITS_RE).filter((c) => c !== '');
    return chunks.map((chunk) => {
      const digits = chunk;
      if (/^[\u0660-\u0669\u06F0-\u06F9]+$/.test(digits)) {
        return { kind: 'digits' as const, text: digits, segments: [] as { text: string; rule: string }[] };
      }
      const segments = plain
        ? [{ text: chunk, rule: 'none' as const }]
        : tajweedSegments(chunk);
      const joined = joinBoundaries(segments.map((s) => s.text));
      return {
        kind: 'text' as const,
        text: chunk,
        segments: segments.map((s, i) => ({ ...s, text: joined[i] })),
      };
    });
  }, [text, plain]);

  return (
    <span dir="rtl" lang="ar" className={cn('font-qaida', className)} style={style}>
      {parts.map((p, pi) =>
        p.kind === 'digits' ? (
          <span key={pi} className="ayah-mark" aria-label={`Verse ${p.text}`} style={{ cursor: 'default' }}>
            {p.text}
          </span>
        ) : (
          p.segments.map((s: any, i: number) => {
            const color = tajweedColor(s.rule);
            return (
              <span key={`${pi}-${i}`} style={color ? { color } : undefined}>
                {s.text}
              </span>
            );
          })
        ),
      )}
    </span>
  );
}

/** Compact legend of the tajweed rules that actually appear on the page. */
export function TajweedLegend({ texts, className }: { texts: string[]; className?: string }) {
  const rules = useMemo(() => rulesPresent(texts), [texts]);
  if (rules.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px]', className)}>
      {rules.map((r) => {
        const info = TAJWEED_RULES[r];
        return (
          <span key={r} className="inline-flex items-center gap-1.5" title={info.hint}>
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: info.color }} />
            <span style={{ color: info.color }} className="font-medium">{info.label}</span>
          </span>
        );
      })}
    </div>
  );
}

export default TajweedText;
