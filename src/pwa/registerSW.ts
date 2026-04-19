// Service worker registration with iframe + preview-host guard.
// Lovable preview iframes must NEVER register a service worker.

const OFFLINE_RECOVERY_KEY = "__aqt_offline_recovery_attempt__";

async function nukeServiceWorkers() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore
  }
}

/**
 * If we're online but the user is staring at the offline fallback page,
 * unregister the SW, clear caches, and reload once.
 */
function watchForStaleOfflinePage() {
  if (typeof window === "undefined") return;

  const checkAndRecover = async () => {
    if (!navigator.onLine) return;
    const onOfflinePage =
      window.location.pathname.endsWith("/offline.html") ||
      document.title.toLowerCase().includes("offline");
    if (!onOfflinePage) return;

    // Avoid infinite reload loops
    if (sessionStorage.getItem(OFFLINE_RECOVERY_KEY)) return;
    sessionStorage.setItem(OFFLINE_RECOVERY_KEY, "1");

    await nukeServiceWorkers();
    window.location.replace("/");
  };

  // Run immediately + whenever connectivity returns
  checkAndRecover();
  window.addEventListener("online", checkAndRecover);
}

export function registerPWA() {
  if (typeof window === "undefined") return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    (host.includes("lovable") === true && host.includes("lovable.app") === false);

  // Unregister any existing SWs in preview/iframe contexts to prevent stale caches
  if (isInIframe || isPreviewHost) {
    nukeServiceWorkers();
    return;
  }

  // Always watch for the "online but stuck on offline page" scenario
  watchForStaleOfflinePage();

  // Production / installed app → register
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          // Periodically check for SW updates so stale workers don't linger
          if (registration) {
            setInterval(() => {
              registration.update().catch(() => {});
            }, 60 * 60 * 1000); // hourly
          }
        },
        onNeedRefresh() {
          // Auto-apply updates so users always get the newest SW
          updateSW(true).catch(() => {});
        },
      });

      // Clear the recovery flag on a successful normal load
      sessionStorage.removeItem(OFFLINE_RECOVERY_KEY);
    })
    .catch(() => {
      // plugin not available in this build
    });
}
