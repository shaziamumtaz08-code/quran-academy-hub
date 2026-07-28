import type jsPDF from 'jspdf';
import { ArabicShaper } from 'arabic-persian-reshaper';
import notoNaskhUrl from '@/assets/fonts/NotoNaskhArabic-Regular.ttf?url';
import jameelNooriAssetRaw from '@/assets/fonts/Jameel-Noori-Nastaleeq-Regular.ttf.asset.json?raw';

export const ARABIC_FONT = 'NotoNaskhArabic';
export const URDU_FONT = 'JameelNooriNastaleeq';

/** Arabic / Urdu / Persian blocks (incl. presentation forms). */
const RTL_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const URDU_RE = /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06CC\u06BE\u06C1\u06D2]/;

export const hasArabic = (s: string | null | undefined) => !!s && RTL_RE.test(s);
export const hasUrdu = (s: string | null | undefined) => !!s && URDU_RE.test(s);

let naskhBase64: string | null = null;
let nastaleeqBase64: string | null = null;
let naskhReady = false;
let nastaleeqReady = false;

const jameelNooriUrl = (() => {
  try {
    const manifest = JSON.parse(jameelNooriAssetRaw) as { url?: string };
    return manifest.url || '';
  } catch {
    return '';
  }
})();

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
 * Registers Noto Naskh Arabic and Jameel Noori Nastaleeq into the jsPDF instance
 * so Arabic/Urdu glyphs render for real (jsPDF's built-in fonts have no RTL coverage).
 */
export async function ensureArabicFont(doc: jsPDF): Promise<boolean> {
  let loadedAny = false;

  try {
    if (!naskhBase64) {
      const res = await fetch(notoNaskhUrl);
      if (!res.ok) throw new Error(`font fetch ${res.status}`);
      naskhBase64 = toBase64(await res.arrayBuffer());
    }
    doc.addFileToVFS('NotoNaskhArabic-Regular.ttf', naskhBase64);
    doc.addFont('NotoNaskhArabic-Regular.ttf', ARABIC_FONT, 'normal');
    // No separate bold file — alias bold to the same face so style switches don't break.
    doc.addFont('NotoNaskhArabic-Regular.ttf', ARABIC_FONT, 'bold');
    naskhReady = true;
    loadedAny = true;
  } catch {
    naskhReady = false;
  }

  try {
    if (jameelNooriUrl) {
      if (!nastaleeqBase64) {
        const res = await fetch(jameelNooriUrl);
        if (!res.ok) throw new Error(`font fetch ${res.status}`);
        nastaleeqBase64 = toBase64(await res.arrayBuffer());
      }
      doc.addFileToVFS('Jameel-Noori-Nastaleeq-Regular.ttf', nastaleeqBase64);
      doc.addFont('Jameel-Noori-Nastaleeq-Regular.ttf', URDU_FONT, 'normal');
      doc.addFont('Jameel-Noori-Nastaleeq-Regular.ttf', URDU_FONT, 'bold');
      nastaleeqReady = true;
      loadedAny = true;
    }
  } catch {
    nastaleeqReady = false;
  }

  return loadedAny;
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
export function pdfFontFor(text: string | null | undefined, latin = 'helvetica') {
  if (!hasArabic(text)) return latin;
  if (hasUrdu(text) && nastaleeqReady) return URDU_FONT;
  return naskhReady ? ARABIC_FONT : latin;
}

export function setFontFor(
  doc: jsPDF,
  text: string,
  style: 'normal' | 'bold' = 'normal',
  latin = 'helvetica',
) {
  doc.setFont(pdfFontFor(text, latin), style);
}
