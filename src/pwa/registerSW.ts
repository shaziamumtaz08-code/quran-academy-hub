// Service workers we must never unregister. The Firebase messaging worker
// owns web-push delivery; unregistering it on every load would silently
// invalidate push subscriptions with no visible error.
const PROTECTED_SW_SCRIPTS = ['firebase-messaging-sw.js'];

function isProtectedRegistration(reg: ServiceWorkerRegistration): boolean {
  const scriptURL =
    reg.active?.scriptURL ||
    reg.waiting?.scriptURL ||
    reg.installing?.scriptURL ||
    '';
  const candidates = [reg.scope, scriptURL];
  return PROTECTED_SW_SCRIPTS.some((name) =>
    candidates.some((value) => value.includes(name)),
  );
}

export function registerPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(r => {
        if (isProtectedRegistration(r)) return;
        r.unregister();
      }));

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
