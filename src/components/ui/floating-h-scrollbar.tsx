import { createContext, useContext, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Context flag used to suppress nested floating scrollbars (e.g. a <Table>
 * rendered inside <StickyScrollTable>).
 */
export const FloatingScrollbarSuppressContext = createContext(false);
export const useFloatingScrollbarSuppressed = () => useContext(FloatingScrollbarSuppressContext);

/**
 * Renders a horizontal scrollbar pinned to the bottom of the viewport that
 * stays usable while the target scroll container is in view and overflowing.
 */
export function FloatingHScrollbar({ targetRef }: { targetRef: RefObject<HTMLElement> }) {
  const barRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [contentWidth, setContentWidth] = useState(0);
  const [geom, setGeom] = useState({ left: 0, width: 0 });
  const [visible, setVisible] = useState(false);
  const suppressed = useFloatingScrollbarSuppressed();

  useEffect(() => {
    if (suppressed) return;
    const el = targetRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const overflowing = el.scrollWidth > el.clientWidth + 1;
      setContentWidth(el.scrollWidth);
      setGeom({ left: rect.left, width: rect.width });
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      setVisible(overflowing && inView && rect.bottom > window.innerHeight - 4);
      if (barRef.current && !syncing.current) {
        syncing.current = true;
        barRef.current.scrollLeft = el.scrollLeft;
        syncing.current = false;
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    el.addEventListener("scroll", update);
    const id = window.setInterval(update, 500);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      el.removeEventListener("scroll", update);
      window.clearInterval(id);
    };
  }, [targetRef, suppressed]);

  if (suppressed || !visible) return null;

  return (
    <div
      ref={barRef}
      onScroll={() => {
        const el = targetRef.current;
        if (!el || syncing.current || !barRef.current) return;
        syncing.current = true;
        el.scrollLeft = barRef.current.scrollLeft;
        syncing.current = false;
      }}
      className="fixed z-40 overflow-x-auto overflow-y-hidden border-t border-border bg-background/95 shadow-md backdrop-blur"
      style={{ left: geom.left, width: geom.width, bottom: 0, height: 14 }}
    >
      <div style={{ width: contentWidth, height: 1 }} />
    </div>
  );
}
