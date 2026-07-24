export function registerPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(r => r.unregister()));

    caches.keys().then(keys =>
      keys.forEach(key => caches.delete(key)));
  }

  // Auto-recover from stale dynamic chunks after a new deploy.
  // When index.html points to hashes that no longer exist on the CDN,
  // dynamic imports throw "Failed to fetch dynamically imported module".
  // Reload once to pick up the fresh index.html + chunk hashes.
  const RELOAD_KEY = '__chunk_reload_at__';
  const shouldReload = () => {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last < 10_000) return false;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      return true;
    } catch {
      return true;
    }
  };
  const isChunkError = (msg: string) =>
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg);

  window.addEventListener('error', (e) => {
    if (e?.message && isChunkError(e.message) && shouldReload()) {
      window.location.reload();
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String((e.reason && (e.reason.message || e.reason)) || '');
    if (isChunkError(msg) && shouldReload()) {
      window.location.reload();
    }
  });
}
