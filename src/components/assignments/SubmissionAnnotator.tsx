import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Highlighter, Pencil, MapPin, MousePointer2, Trash2, Undo2,
  ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';

export type AnnotationTool = 'select' | 'highlight' | 'draw' | 'pin';

export interface Annotation {
  id: string;
  page: number;
  type: 'highlight' | 'draw' | 'pin';
  /** normalized 0..1 coords */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  points?: { x: number; y: number }[];
  text?: string;
}

interface Props {
  fileUrl: string;
  fileName?: string | null;
  value: Annotation[];
  onChange: (next: Annotation[]) => void;
  disabled?: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function SubmissionAnnotator({ fileUrl, fileName, value, onChange, disabled }: Props) {
  const [tool, setTool] = useState<AnnotationTool>('select');
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [pendingPin, setPendingPin] = useState<Annotation | null>(null);
  const [pinText, setPinText] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);

  const isPdf = /\.pdf($|\?)/i.test(fileUrl) || /\.pdf$/i.test(fileName || '');

  // ─── Render the source document ───
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (isPdf) {
          const { pdfjsLib } = await import('@/lib/pdfWorker');
          const pdf = await pdfjsLib.getDocument(fileUrl).promise;
          if (cancelled) return;
          setNumPages(pdf.numPages);
          const p = await pdf.getPage(Math.min(page, pdf.numPages));
          const viewport = p.getViewport({ scale: 1.5 });
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await p.render({ canvasContext: ctx, viewport, canvas } as any).promise;
        } else {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (cancelled) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            setLoading(false);
          };
          img.onerror = () => !cancelled && (setError('Could not load image'), setLoading(false));
          img.src = fileUrl;
          setNumPages(1);
          return;
        }
        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Could not load file');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fileUrl, page, isPdf]);

  const rel = useCallback((e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || tool === 'select') return;
    const { x, y } = rel(e);
    if (tool === 'pin') {
      setPendingPin({ id: uid(), page, type: 'pin', x, y, text: '' });
      setPinText('');
      return;
    }
    drawingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDraft(
      tool === 'highlight'
        ? { id: uid(), page, type: 'highlight', x, y, w: 0, h: 0 }
        : { id: uid(), page, type: 'draw', points: [{ x, y }] },
    );
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !draft) return;
    const { x, y } = rel(e);
    setDraft(d => {
      if (!d) return d;
      if (d.type === 'highlight') return { ...d, w: x - (d.x ?? 0), h: y - (d.y ?? 0) };
      return { ...d, points: [...(d.points || []), { x, y }] };
    });
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (draft) {
      const valid =
        draft.type === 'highlight'
          ? Math.abs(draft.w ?? 0) > 0.01 && Math.abs(draft.h ?? 0) > 0.005
          : (draft.points?.length ?? 0) > 2;
      if (valid) {
        const norm =
          draft.type === 'highlight'
            ? {
                ...draft,
                x: Math.min(draft.x!, draft.x! + draft.w!),
                y: Math.min(draft.y!, draft.y! + draft.h!),
                w: Math.abs(draft.w!),
                h: Math.abs(draft.h!),
              }
            : draft;
        onChange([...value, norm]);
      }
    }
    setDraft(null);
  };

  const remove = (id: string) => onChange(value.filter(a => a.id !== id));
  const undo = () => onChange(value.slice(0, -1));

  const pageAnnotations = value.filter(a => a.page === page);
  const pins = pageAnnotations.filter(a => a.type === 'pin');
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`).join(' ');

  const tools: { id: AnnotationTool; icon: React.ElementType; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'highlight', icon: Highlighter, label: 'Highlight' },
    { id: 'draw', icon: Pencil, label: 'Draw' },
    { id: 'pin', icon: MapPin, label: 'Pin comment' },
  ];

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap">
        {tools.map(t => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tool === t.id ? 'default' : 'outline'}
            className="h-7 px-2 text-xs"
            onClick={() => setTool(t.id)}
            disabled={disabled}
          >
            <t.icon className="h-3.5 w-3.5 mr-1" /> {t.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
            onClick={undo} disabled={disabled || value.length === 0}>
            <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
          </Button>
          {value.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{value.length} marks</Badge>
          )}
        </div>
      </div>

      {/* Canvas + overlay */}
      <div className="relative rounded-lg border bg-muted/30 overflow-auto max-h-[520px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error ? (
          <p className="p-4 text-sm text-muted-foreground">{error} — open the file directly to review it.</p>
        ) : (
          <div
            ref={wrapRef}
            className={cn(
              'relative w-full select-none touch-none',
              tool !== 'select' && !disabled && 'cursor-crosshair',
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <canvas ref={canvasRef} className="w-full h-auto block" />

            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
              {[...pageAnnotations, ...(draft ? [draft] : [])].map(a => {
                if (a.type === 'highlight') {
                  const x = Math.min(a.x!, a.x! + (a.w ?? 0));
                  const y = Math.min(a.y!, a.y! + (a.h ?? 0));
                  return (
                    <rect key={a.id} x={x * 100} y={y * 100}
                      width={Math.abs(a.w ?? 0) * 100} height={Math.abs(a.h ?? 0) * 100}
                      className="fill-amber-400/35 stroke-amber-500" strokeWidth={0.2} vectorEffect="non-scaling-stroke" />
                  );
                }
                if (a.type === 'draw') {
                  return (
                    <path key={a.id} d={toPath(a.points || [])} fill="none"
                      className="stroke-rose-500" strokeWidth={2} vectorEffect="non-scaling-stroke"
                      strokeLinecap="round" strokeLinejoin="round" />
                  );
                }
                return null;
              })}
            </svg>

            {/* Pins */}
            {pins.map((p, i) => (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-full"
                style={{ left: `${(p.x ?? 0) * 100}%`, top: `${(p.y ?? 0) * 100}%` }}
                title={p.text}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pin comment input */}
      {pendingPin && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={pinText}
            onChange={e => setPinText(e.target.value)}
            placeholder="Comment for this spot…"
            className="h-8 text-sm"
            onKeyDown={e => {
              if (e.key === 'Enter' && pinText.trim()) {
                onChange([...value, { ...pendingPin, text: pinText.trim() }]);
                setPendingPin(null);
                setPinText('');
              }
            }}
          />
          <Button type="button" size="sm" className="h-8 text-xs"
            disabled={!pinText.trim()}
            onClick={() => {
              onChange([...value, { ...pendingPin, text: pinText.trim() }]);
              setPendingPin(null);
              setPinText('');
            }}>
            Add
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setPendingPin(null)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Page nav */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
            disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[11px] text-muted-foreground">Page {page} / {numPages}</span>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
            disabled={page >= numPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Pin list */}
      {pins.length > 0 && (
        <ul className="space-y-1">
          {pins.map((p, i) => (
            <li key={p.id} className="flex items-start gap-2 text-xs bg-muted/50 rounded-md px-2 py-1.5">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="flex-1 break-words">{p.text}</span>
              <button type="button" onClick={() => remove(p.id)} disabled={disabled}
                className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
