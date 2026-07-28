import type jsPDF from 'jspdf';
import { ArabicShaper } from 'arabic-persian-reshaper';
import notoNaskhUrl from '@/assets/fonts/NotoNaskhArabic-Regular.ttf?url';

export const ARABIC_FONT = 'NotoNaskhArabic';

/** Arabic / Urdu / Persian blocks (incl. presentation forms). */
const RTL_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export const hasArabic = (s: string | null | undefined) => !!s && RTL_RE.test(s);

let fontBase64: string | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/**
 * Registers Noto Naskh Arabic into the jsPDF instance so Arabic/Urdu glyphs
 * render for real (jsPDF's built-in fonts have no Arabic coverage).
 */
export async function ensureArabicFont(doc: jsPDF): Promise<boolean> {
  try {
    if (!fontBase64) {
      const res = await fetch(notoNaskhUrl);
      if (!res.ok) throw new Error(`font fetch ${res.status}`);
      fontBase64 = toBase64(await res.arrayBuffer());
    }
    doc.addFileToVFS('NotoNaskhArabic-Regular.ttf', fontBase64);
    doc.addFont('NotoNaskhArabic-Regular.ttf', ARABIC_FONT, 'normal');
    // No separate bold file — alias bold to the same face so style switches don't break.
    doc.addFont('NotoNaskhArabic-Regular.ttf', ARABIC_FONT, 'bold');
    return true;
  } catch {
    return false;
  }
}

/**
 * jsPDF does not shape or bidi-reorder Arabic script. Reshape to presentation
 * forms, then reverse RTL runs so the visual order is correct in the PDF.
 */
export function shapeRtl(input: string): string {
  if (!hasArabic(input)) return input;
  const reshaped: string = ArabicShaper.convertArabic(input);
  const runs: { rtl: boolean; s: string }[] = [];
  for (const ch of reshaped) {
    const rtl = RTL_RE.test(ch);
    const last = runs[runs.length - 1];
    if (last && last.rtl === rtl) last.s += ch;
    else runs.push({ rtl, s: ch });
  }
  return runs
    .reverse()
    .map((r) => (r.rtl ? [...r.s].reverse().join('') : r.s))
    .join('');
}

/** Picks the Arabic-capable font when the text needs it, else the Latin font. */
export function setFontFor(
  doc: jsPDF,
  text: string,
  style: 'normal' | 'bold' = 'normal',
  latin = 'helvetica',
) {
  doc.setFont(hasArabic(text) ? ARABIC_FONT : latin, style);
}
