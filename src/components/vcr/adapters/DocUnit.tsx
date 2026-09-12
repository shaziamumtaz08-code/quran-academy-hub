import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  fileUrl: string | null;
  isPdf: boolean;
  page: number;
  fontScale: number;
  onNumPages?: (n: number) => void;
}

/**
 * One page of a Library document (PDF) or a single image, rendered into the
 * VCR page area. The page is drawn to fit the width it is given, so it always
 * lands inside the reading card; zoom follows the shared font scale so the
 * student's mirror matches the teacher's screen, and anything taller than the
 * area scrolls inside it rather than pushing the navigation buttons away.
 */
export function DocUnit({ fileUrl, isPdf, page, fontScale, onNumPages }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  /* Keep the drawing width in step with the space the reader gives us. */
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      setBoxWidth((prev) => (Math.abs(prev - w) < 8 ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!fileUrl) return;
    if (isPdf && boxWidth === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (!isPdf) {
          onNumPages?.(1);
          setLoading(false);
          return;
        }
        const { pdfjsLib } = await import('@/lib/pdfWorker');
        const pdf = await pdfjsLib.getDocument({ url: fileUrl }).promise;
        if (cancelled) return;
        onNumPages?.(pdf.numPages);
        const p = await pdf.getPage(Math.min(Math.max(page, 1), pdf.numPages));
        if (cancelled) return;

        /* Fit the page to the available width, then apply the zoom level.
           Device pixel ratio keeps the text crisp on phones and retina. */
        const base = p.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const fit = (boxWidth * Math.max(fontScale, 0.7)) / base.width;
        const viewport = p.getViewport({ scale: Math.max(fit, 0.2) * dpr });

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
        const ctx = canvas.getContext('2d')!;
        await p.render({ canvasContext: ctx, viewport, canvas } as any).promise;
        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Could not open this file');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fileUrl, isPdf, page, boxWidth, fontScale]);

  if (!fileUrl) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Choose a book or worksheet from the syllabus list above.
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative w-full flex-1">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error ? (
        <p className="p-6 text-sm text-muted-foreground">{error}</p>
      ) : (
        <div className="h-full max-h-[clamp(20rem,62vh,42rem)] w-full overflow-auto overscroll-contain rounded-md">
          <div className="flex w-full justify-center p-1">
            {isPdf ? (
              <canvas ref={canvasRef} className="h-auto max-w-none rounded-md bg-white shadow-sm" />
            ) : (
              <img
                src={fileUrl}
                alt="Lesson page"
                onLoad={() => setLoading(false)}
                onError={() => { setError('Could not load this image'); setLoading(false); }}
                className="h-auto rounded-md shadow-sm"
                style={{ width: `${Math.round(100 * Math.min(Math.max(fontScale, 0.7), 2))}%`, maxWidth: 'none' }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
