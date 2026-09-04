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
 * VCR parchment card. Zoom follows the shared font scale so the student's
 * mirror matches the teacher's screen.
 */
export function DocUnit({ fileUrl, isPdf, page, fontScale, onNumPages }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrl) return;
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
        const viewport = p.getViewport({ scale: 2 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
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
  }, [fileUrl, isPdf, page]);

  if (!fileUrl) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Choose a book or worksheet from the syllabus list above.
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[50vh] items-start justify-center">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error ? (
        <p className="p-6 text-sm text-muted-foreground">{error}</p>
      ) : isPdf ? (
        <canvas
          ref={canvasRef}
          className="h-auto w-full rounded-md shadow-sm"
          style={{ maxWidth: `${Math.round(100 * Math.min(fontScale, 1))}%`, transformOrigin: 'top center' }}
        />
      ) : (
        <img
          src={fileUrl}
          alt="Lesson page"
          onLoad={() => setLoading(false)}
          onError={() => { setError('Could not load this image'); setLoading(false); }}
          className="h-auto w-full rounded-md shadow-sm"
          style={{ maxWidth: `${Math.round(100 * Math.min(fontScale, 1))}%` }}
        />
      )}
    </div>
  );
}
