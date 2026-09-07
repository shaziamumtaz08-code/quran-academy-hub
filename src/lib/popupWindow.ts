/**
 * Popup-safe window opening.
 *
 * Browsers only allow `window.open` during a user gesture. When we open a tab
 * *after* an async call (edge function round-trip), the popup blocker kills it
 * silently — the button looks broken. The fix: reserve the tab synchronously in
 * the click handler, then point it at the real URL once we have it.
 */
export function reserveTab(): Window | null {
  try {
    return window.open('about:blank', '_blank');
  } catch {
    return null;
  }
}

export function navigateTab(tab: Window | null, url: string) {
  if (tab && !tab.closed) {
    try {
      tab.location.href = url;
      tab.focus?.();
      return;
    } catch {
      /* fall through to a direct open */
    }
  }
  window.open(url, '_blank', 'noopener');
}

export function closeTab(tab: Window | null) {
  if (tab && !tab.closed) {
    try {
      tab.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Open an external site in a real browser tab.
 *
 * `window.open` can be silently swallowed inside an embedded/sandboxed frame or
 * by a popup blocker. Falling back to a synthetic anchor click works in those
 * cases; if even that fails we hand the URL back so the caller can show it.
 */
export function openExternal(url: string): boolean {
  try {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) { w.opener = null; return true; }
  } catch { /* fall through */ }
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}
