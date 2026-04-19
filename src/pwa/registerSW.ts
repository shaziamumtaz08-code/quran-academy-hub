// SERVICE WORKER DISABLED — emergency fix.
// Users were stuck on offline.html even with working internet.
// We unregister any existing SW and clear all caches on every load.

async function nukeServiceWorkers() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore
  }
}

export function registerPWA() {
  if (typeof window === "undefined") return;
  // Always nuke — do not register a new SW.
  nukeServiceWorkers();
}
