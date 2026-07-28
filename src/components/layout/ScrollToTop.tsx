import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets scroll position to the top on route changes and on initial load.
 * Query-string changes (tab/filter state) are intentionally ignored so
 * switching tabs doesn't yank the user's scroll position.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const scrollAllToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      // Inner scroll containers (dashboard shell uses overflow-auto <main>)
      document.querySelectorAll('main, [data-scroll-container]').forEach((el) => {
        (el as HTMLElement).scrollTop = 0;
      });
    };

    scrollAllToTop();
    // Run again after lazy content paints so restored offsets don't win.
    const raf = requestAnimationFrame(scrollAllToTop);
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
