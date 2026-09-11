import React, { useEffect, useRef, useState } from 'react';
import type { VcrPointer } from '@/hooks/useVcrViewSync';

interface Props {
  /** The page area the pointer belongs to — positions are relative to it. */
  targetRef: React.RefObject<HTMLElement>;
  /** Teacher side: tracking is on. */
  active: boolean;
  style: 'laser' | 'finger';
  /** Teacher side: send the live position (or null when the finger lifts). */
  onMove?: (p: VcrPointer | null) => void;
  /** Student side: the teacher's position mirrored here. */
  remote?: VcrPointer | null;
}

/**
 * Live teaching pointer.
 *
 * A purely visual, temporary dot that follows the teacher's finger or mouse
 * over the page and shows on the student's screen at the same spot. It writes
 * nothing: no marks, no bookmarks, no page data. The overlay never takes
 * clicks, so reading, selecting, scrolling and drawing all behave as before.
 */
export function VcrPointerLayer({ targetRef, active, style, onMove, remote }: Props) {
  const [local, setLocal] = useState<VcrPointer | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !active) {
      setLocal(null);
      if (active === false) onMove?.(null);
      return;
    }

    const toPoint = (clientX: number, clientY: number): VcrPointer | null => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return null;
      return { x, y, style };
    };

    const handle = (e: PointerEvent) => {
      const p = toPoint(e.clientX, e.clientY);
      setLocal(p);
      const now = performance.now();
      if (now - lastSent.current < 40) return;
      lastSent.current = now;
      onMove?.(p);
    };
    const leave = () => { setLocal(null); onMove?.(null); };

    el.addEventListener('pointermove', handle);
    el.addEventListener('pointerdown', handle);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointercancel', leave);
    return () => {
      el.removeEventListener('pointermove', handle);
      el.removeEventListener('pointerdown', handle);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointercancel', leave);
      onMove?.(null);
    };
  }, [targetRef, active, style, onMove]);

  const point = remote ?? local;
  if (!point) return null;

  const isLaser = point.style === 'laser';
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,top] duration-75 ease-linear"
        style={{
          left: `${point.x * 100}%`,
          top: `${point.y * 100}%`,
          width: isLaser ? 18 : 46,
          height: isLaser ? 18 : 46,
          background: isLaser
            ? 'radial-gradient(circle, rgba(255,70,50,0.98) 0%, rgba(255,90,60,0.65) 42%, rgba(255,120,80,0) 72%)'
            : 'radial-gradient(circle, rgba(250,204,21,0.30) 0%, rgba(250,204,21,0.16) 55%, rgba(250,204,21,0) 78%)',
          boxShadow: isLaser
            ? '0 0 12px 5px rgba(255,60,40,0.45)'
            : '0 0 0 2px rgba(202,138,4,0.45) inset',
        }}
      />
    </div>
  );
}

export default VcrPointerLayer;
