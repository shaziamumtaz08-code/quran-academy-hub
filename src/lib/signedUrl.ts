import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Private buckets that store sensitive user data. URLs in our DB for these
 * buckets were originally minted via getPublicUrl(), so they look like
 *   .../storage/v1/object/public/<bucket>/<path>
 * After flipping the bucket to private, those URLs 404 — we must mint a
 * signed URL on demand from the embedded <bucket>/<path>.
 */
const PRIVATE_BUCKETS = new Set([
  'payment-receipts',
  'salary-receipts',
  'expense-receipts',
  'voice-notes',
  'chat-attachments',
  'ticket-attachments',
  'receipts',
]);

const DEFAULT_EXPIRES_IN = 60 * 60; // 1 hour

function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  // matches both `/object/public/<bucket>/<path>` and `/object/sign/<bucket>/<path>`
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
  if (!m) return null;
  return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
}

/**
 * Resolve a stored attachment URL to something the browser can fetch.
 * - For private buckets, mints a short-lived signed URL.
 * - For public buckets, returns the original URL unchanged.
 * - Returns null on failure so callers can hide the link gracefully.
 */
export async function resolveFileUrl(
  url: string | null | undefined,
  expiresIn: number = DEFAULT_EXPIRES_IN,
): Promise<string | null> {
  if (!url) return null;
  const parsed = parseStorageUrl(url);
  if (!parsed) return url;
  if (!PRIVATE_BUCKETS.has(parsed.bucket)) return url;
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** React hook: resolves a stored attachment URL to a fetchable URL. */
export function useSignedUrl(
  url: string | null | undefined,
  expiresIn: number = DEFAULT_EXPIRES_IN,
): string | null {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!url) return null;
    const parsed = parseStorageUrl(url);
    if (!parsed || !PRIVATE_BUCKETS.has(parsed.bucket)) return url;
    return null;
  });

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setResolved(null);
      return;
    }
    const parsed = parseStorageUrl(url);
    if (!parsed || !PRIVATE_BUCKETS.has(parsed.bucket)) {
      setResolved(url);
      return;
    }
    setResolved(null);
    resolveFileUrl(url, expiresIn).then((r) => {
      if (!cancelled) setResolved(r);
    });
    return () => {
      cancelled = true;
    };
  }, [url, expiresIn]);

  return resolved;
}
