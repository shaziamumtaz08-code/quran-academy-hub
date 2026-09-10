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
const AYAH_DIGITS_RE = /([\u200F]*[\u0660-\u0669\u06F0-\u06F9]+[\u200F]*)/g;

export function TajweedText({ text, className, style, plain }: Props) {
  const parts = useMemo(() => {
    const chunks = text.split(AYAH_DIGITS_RE).filter((c) => c !== '');
    return chunks.map((chunk) => {
      const digits = chunk.replace(/[\u200F]/g, '');
      if (/^[\u0660-\u0669\u06F0-\u06F9]+$/.test(digits)) {
        return { kind: 'digits' as const, text: digits, segments: [] };
      }
      return {
        kind: 'text' as const,
        text: chunk,
        segments: plain ? [{ text: chunk, rule: 'none' as const }] : tajweedSegments(chunk),
      };
    });
  }, [text, plain]);

  return (
    <span dir="rtl" className={cn('font-qaida', className)} style={style}>
      {parts.map((p, pi) =>
        p.kind === 'digits' ? (
          <span key={pi} className="ayah-mark" aria-label={`Verse ${p.text}`} style={{ cursor: 'default' }}>
            {p.text}
          </span>
        ) : (
          p.segments.map((s, i) => {
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
