import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FloatingScrollbarSuppressContext } from "@/components/ui/floating-h-scrollbar";

/**
 * Wraps a wide table with a floating horizontal scrollbar that stays visible
 * at the bottom of the viewport whenever the table is in view and overflowing.
 *
 * Usage:
 *   <StickyScrollTable>
 *     <table>...</table>
 *   </StickyScrollTable>
 */
export function StickyScrollTable({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const barInnerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const [barLeft, setBarLeft] = useState(0);
  const [visible, setVisible] = useState(false);
  const syncing = useRef(false);

  // Measure content + wrapper geometry.
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const wrapEl = wrapperRef.current;
    if (!scrollEl || !wrapEl) return;

    const measure = () => {
      setContentWidth(scrollEl.scrollWidth);
      setViewportWidth(scrollEl.clientWidth);
      const rect = wrapEl.getBoundingClientRect();
      setBarLeft(rect.left);
      setBarWidth(rect.width);
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(scrollEl);
    ro.observe(wrapEl);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, []);

  // Show floating bar only when wrapper intersects viewport AND overflows.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          // Show the bar when the bottom of the table is below the viewport
          // (meaning the native bar is not yet visible) and there's overflow.
          const rect = e.boundingClientRect;
          const overflowing = contentWidth > viewportWidth + 1;
          const nativeBarBelow = rect.bottom > window.innerHeight;
          setVisible(e.isIntersecting && overflowing && nativeBarBelow);
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [contentWidth, viewportWidth]);

  // Also re-eval on window scroll (position changes without intersection change).
  useEffect(() => {
    const onScroll = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const overflowing = contentWidth > viewportWidth + 1;
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      const nativeBarBelow = rect.bottom > window.innerHeight;
      setVisible(inView && overflowing && nativeBarBelow);
    };
    window.addEventListener("scroll", onScroll, true);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [contentWidth, viewportWidth]);

  // Two-way scroll sync.
  const onTableScroll = () => {
    if (syncing.current) return;
    syncing.current = true;
    if (barRef.current && scrollRef.current) {
      barRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
    syncing.current = false;
  };
  const onBarScroll = () => {
    if (syncing.current) return;
    syncing.current = true;
    if (barRef.current && scrollRef.current) {
      scrollRef.current.scrollLeft = barRef.current.scrollLeft;
    }
    syncing.current = false;
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div
        ref={scrollRef}
        className={cn("overflow-x-auto", innerClassName)}
        onScroll={onTableScroll}
      >
        <FloatingScrollbarSuppressContext.Provider value={true}>{children}</FloatingScrollbarSuppressContext.Provider>
      </div>
      {visible && (
        <div
          ref={barRef}
          onScroll={onBarScroll}
          className="fixed z-40 overflow-x-auto overflow-y-hidden bg-background/95 backdrop-blur border-t border-border shadow-md"
          style={{
            left: barLeft,
            width: barWidth,
            bottom: 0,
            height: 14,
          }}
        >
          <div ref={barInnerRef} style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}
