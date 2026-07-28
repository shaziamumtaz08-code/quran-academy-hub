// Single source of truth for the pdf.js worker.
// Uses the worker shipped with the installed pdfjs-dist package so the
// API and Worker versions can never drift (no CDN version pinning).
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const separator = pdfWorkerUrl.includes('?') ? '&' : '?';
pdfjsLib.GlobalWorkerOptions.workerSrc = `${pdfWorkerUrl}${separator}pdfjs=${pdfjsLib.version}`;

export { pdfjsLib };
