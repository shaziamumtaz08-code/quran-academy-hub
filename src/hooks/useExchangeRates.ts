import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'exchange_rates_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
  source: 'live' | 'cache' | 'fallback';
}

interface UseExchangeRatesResult {
  rates: Record<string, number>;
  isLoading: boolean;
  isLive: boolean;
  lastUpdated: Date | null;
  error: string | null;
  getRate: (currency: string, spreadPKR?: number) => number;
}

export function useExchangeRates(): UseExchangeRatesResult {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRates = async () => {
      // 1. Try cache first
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed: RateCache = JSON.parse(cached);
          const age = Date.now() - parsed.fetchedAt;
          if (age < CACHE_TTL_MS && Object.keys(parsed.rates).length > 0) {
            if (!cancelled) {
              setRates(parsed.rates);
              setIsLive(false);
              setLastUpdated(new Date(parsed.fetchedAt));
              setIsLoading(false);
            }
            // Still try to refresh in background if older than 1 hour
            if (age < 60 * 60 * 1000) return;
          }
        }
      } catch {}

      // 2. Fetch live rates from open.er-api.com (free, no API key, ~1500 req/month)
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/PKR', {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (json.result === 'success' && json.rates) {
          // Invert: rates[USD] = 1 / json.rates.USD gives PKR per 1 USD
          const inverted: Record<string, number> = {};
          const foreignCurrencies = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SAR'];
          foreignCurrencies.forEach(cur => {
            if (json.rates[cur] && json.rates[cur] > 0) {
              inverted[cur] = Math.round((1 / json.rates[cur]) * 100) / 100;
            }
          });

          const cacheEntry: RateCache = {
            rates: inverted,
            fetchedAt: Date.now(),
            source: 'live',
          };
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry)); } catch {}

          if (!cancelled) {
            setRates(inverted);
            setIsLive(true);
            setLastUpdated(new Date());
            setError(null);
            setIsLoading(false);
          }
        } else {
          throw new Error('Invalid API response');
        }
      } catch (err) {
        // 3. Fallback — use stale cache if available
        try {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed: RateCache = JSON.parse(cached);
            if (!cancelled && Object.keys(parsed.rates).length > 0) {
              setRates(parsed.rates);
              setIsLive(false);
              setLastUpdated(new Date(parsed.fetchedAt));
              setError('Using cached rates — live update failed');
              setIsLoading(false);
              return;
            }
          }
        } catch {}

        if (!cancelled) {
          setError('Exchange rates unavailable');
          setIsLoading(false);
        }
      }
    };

    loadRates();
    return () => { cancelled = true; };
  }, []);

  // getRate(currency, spreadPKR) — returns live rate minus spread
  // spreadPKR defaults to 2 (you typically receive 2 PKR less than market rate)
  const getRate = useCallback((currency: string, spreadPKR = 2): number => {
    if (currency === 'PKR') return 1;
    const baseRate = rates[currency];
    if (!baseRate || baseRate <= 0) return 0;
    return Math.max(0, baseRate - spreadPKR);
  }, [rates]);

  return { rates, isLoading, isLive, lastUpdated, error, getRate };
}
