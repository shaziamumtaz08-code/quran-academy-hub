import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL-persisted state hook. Behaves like useState but reads/writes a query param
 * so state survives remounts, tab switches, and page refreshes.
 *
 * Uses `replace: true` (no history spam). Pass an empty string default ("")
 * to represent "no value" (param is removed from URL when set to "" or default).
 *
 * For string-literal unions (e.g. 'a' | 'b' | 'all'), pass the generic explicitly:
 *   const [tab, setTab] = useUrlState<'a' | 'b'>('tab', 'a');
 */
export function useUrlState<T extends string = string>(
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
          const s = next as unknown as string;
          if (s === null || s === undefined || s === "" || s === defaultValue) {
            p.delete(key);
          } else {
            p.set(key, s);
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

/** Nullable variant — `null` clears the param. */
export function useUrlStateNullable(
  key: string,
  defaultValue: string | null = null,
): [string | null, (value: string | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(key);
  const value = raw ?? defaultValue;

  const setValue = useCallback(
    (next: string | null) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === null || next === undefined || next === "") p.delete(key);
          else p.set(key, next);
          return p;
        },
        { replace: true },
      );
    },
    [key, setSearchParams],
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
