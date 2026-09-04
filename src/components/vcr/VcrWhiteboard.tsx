import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VcrStroke } from '@/hooks/useVcrViewSync';

const PENS = [
  { label: 'Ink', color: '#0f172a' },
  { label: 'Red', color: '#dc2626' },
  { label: 'Green', color: '#059669' },
  { label: 'Blue', color: '#2563eb' },
];

interface Props {
  strokes: VcrStroke[];
  /** 'annotate' = transparent layer over the page, 'board' = separate blank board. */
  mode?: 'annotate' | 'board';
  /** Only the presenter can draw; students see a live mirror. */
  canDraw: boolean;
  onStroke?: (stroke: VcrStroke) => void;
  onUndo?: () => void;
  onClear?: () => void;
  onClose?: () => void;
  className?: string;
}

/**
 * Transparent drawing layer sitting over the reader. Coordinates are stored
 * normalised (0..1) so a stroke drawn on the teacher's screen lands in the same
 * place on the student's, whatever the viewport size.
 */
export function VcrWhiteboard({ strokes, mode = 'annotate', canDraw, onStroke, onUndo, onClear, onClose, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef<VcrStroke | null>(null);
  const [pen, setPen] = useState(PENS[0].color);
  const [size, setSize] = useState({ w: 0, h: 0 });

  /* Keep the bitmap in step with the layout box */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const all = drawing.current ? [...strokes.filter((s) => s.id !== drawing.current!.id), drawing.current] : strokes;
    all.forEach((s) => {
      if (s.points.length === 0) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.x * size.w;
        const y = p.y * size.h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }, [strokes, size]);

  useEffect(() => { paint(); }, [paint]);

  const pointFrom = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleDown = (e: React.PointerEvent) => {
    if (!canDraw) return;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color: pen,
      width: 3,
      points: [pointFrom(e)],
    };
    paint();
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!canDraw || !drawing.current) return;
    drawing.current.points.push(pointFrom(e));
    paint();
    // Stream the in-progress stroke so the student sees it live.
    if (drawing.current.points.length % 4 === 0) onStroke?.({ ...drawing.current, points: [...drawing.current.points] });
  };

  const handleUp = () => {
    if (!canDraw || !drawing.current) return;
    const stroke = { ...drawing.current, points: [...drawing.current.points] };
    drawing.current = null;
    onStroke?.(stroke);
  };

  const board = mode === 'board';

  return (
    <div
      ref={wrapRef}
      className={cn(
        'absolute inset-0 z-30 overflow-hidden',
        board
          ? 'rounded-2xl border border-white/50 bg-white shadow-2xl'
          : 'pointer-events-none',
        className
      )}
    >
      {board && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(15,23,42,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,.08) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
      )}

      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
        className={cn('h-full w-full touch-none', canDraw ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none')}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />

      {!canDraw && board && (
        <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-slate-900/5 px-3 py-1 text-xs text-slate-500">
          Whiteboard — your teacher is writing
        </span>
      )}

      {canDraw && (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-white/60 bg-white/85 px-3 py-2 shadow-xl backdrop-blur-md">
          <span className="ps-1 pe-1 text-xs font-medium text-slate-500">
            {board ? 'Whiteboard' : 'Annotate'}
          </span>
          <span className="h-6 w-px bg-foreground/15" />
          {PENS.map((p) => (
            <button
              key={p.color}
              type="button"
              aria-label={`${p.label} pen`}
              title={`${p.label} pen`}
              onClick={() => setPen(p.color)}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-transform active:scale-95',
                pen === p.color ? 'scale-110 border-slate-900' : 'border-white/80'
              )}
              style={{ background: p.color }}
            />
          ))}
          <span className="mx-1 h-6 w-px bg-foreground/15" />
          <button type="button" onClick={onUndo} aria-label="Undo stroke" title="Undo" className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClear} aria-label="Clear board" title="Clear all" className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900">
            <Eraser className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default VcrWhiteboard;
