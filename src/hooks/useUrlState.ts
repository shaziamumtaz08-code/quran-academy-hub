import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL-persisted state hook. Behaves like useState but reads/writes a query param
 * so state survives remounts, tab switches, and page refreshes.
 *
 * Uses `replace: true` (no history spam). Pass an empty string default (`""`)
 * or `null` default to represent "no value" (param is removed from URL).
 *
 * Generic parameter lets you constrain to a string-literal union, e.g.
 *   useUrlState<'a' | 'b' | 'all'>('tab', 'all')
 */
export function useUrlState<T extends string = string>(
  key: string,
  defaultValue: T,
  options?: { historyMode?: "push" | "replace" },
): [T, (value: T) => void];
export function useUrlState<T extends string>(
  key: string,
  defaultValue: T | null,
  options?: { historyMode?: "push" | "replace" },
): [T | null, (value: T | null) => void];
export function useUrlState(
  key: string,
  defaultValue: string | null,
  options: { historyMode?: "push" | "replace" } = {},
): [string | null, (value: string | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(key);
  const value = raw ?? defaultValue;

  const setValue = useCallback(
    (next: string | null) => {
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
  const [raw, setRaw] = useUrlState("__num_" + key, String(defaultValue));
  const [, setActual] = useUrlState(key, String(defaultValue));
  const value = useMemo(() => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  }, [raw, defaultValue]);
  const setValue = useCallback((n: number) => setActual(String(n)), [setActual]);
  return [value, setValue];
}
