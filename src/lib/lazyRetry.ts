import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "__chunk_reload_at__";

function isChunkError(msg: string) {
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

function shouldReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

/**
 * React.lazy that survives stale chunk hashes after a deploy.
 * Retries once with a cache-busting query, then forces a single page reload.
 */
export function lazyWithRetry<T extends ComponentType<never>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const msg = String((error as Error)?.message || error);
      if (!isChunkError(msg)) throw error;
      try {
        return await factory();
      } catch {
        if (shouldReload()) {
          window.location.reload();
          // Never resolves; the reload takes over.
          return await new Promise<{ default: T }>(() => {});
        }
        throw error;
      }
    }
  });
}
