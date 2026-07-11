import { useEffect, useRef } from "react";

/**
 * Persist unsaved form state to sessionStorage so it survives accidental refresh.
 * Call `clearDraft(key)` after successful save/cancel.
 */
export function useDraftPersistence<T>(
  key: string,
  values: T,
  options: { enabled?: boolean; debounceMs?: number } = {},
) {
  const { enabled = true, debounceMs = 300 } = options;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        sessionStorage.setItem(key, JSON.stringify(values));
      } catch {
        /* ignore quota errors */
      }
    }, debounceMs);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [key, values, enabled, debounceMs]);
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
