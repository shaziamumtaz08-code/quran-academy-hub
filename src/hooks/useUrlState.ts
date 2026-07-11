import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL-persisted state hook. Behaves like useState but reads/writes a query param
 * so state survives remounts, tab switches, and page refreshes.
 *
 * Uses `replace: true` so it doesn't spam browser history.
 * Pass `null` as default to represent "no value" (param is removed from URL).
 */
export function useUrlState<T extends string | null>(
  key: string,
  defaultValue: T,
  options: { historyMode?: "push" | "replace" } = {},
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(key);
  const value = (raw ?? defaultValue) as T;

  const setValue = useCallback(
    (next: T) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === null || next === undefined || next === "" || next === defaultValue) {
            p.delete(key);
          } else {
            p.set(key, String(next));
          }
          return p;
        },
        { replace: options.historyMode !== "push" },
      );
    },
    [key, defaultValue, setSearchParams, options.historyMode],
  );

  return [value, setValue];
}

/** Number variant. */
export function useUrlNumberState(
  key: string,
  defaultValue: number,
): [number, (value: number) => void] {
  const [raw, setRaw] = useUrlState(key, String(defaultValue));
  const value = useMemo(() => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  }, [raw, defaultValue]);
  const setValue = useCallback((n: number) => setRaw(String(n)), [setRaw]);
  return [value, setValue];
}
