// Service worker registration with iframe + preview-host guard.
// Lovable preview iframes must NEVER register a service worker.

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
    host.includes("lovable.app") === false && host.includes("lovable") === true;

  // Unregister any existing SWs in preview/iframe contexts to prevent stale caches
  if (isInIframe || isPreviewHost) {
    navigator.serviceWorker?.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    return;
  }

  // Production / installed app → register
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      // plugin not available in this build
    });
}
