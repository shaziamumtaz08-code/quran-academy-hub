import { supabase } from '@/integrations/supabase/client';

/**
 * Guarantees a non-expired access token before calling an edge function.
 *
 * On mobile the tab is often frozen for long stretches, so the auto-refresh
 * timer never fires. `functions.invoke` then sends the stale token and the
 * function replies 401 ("token is expired") — which the UI surfaces as
 * "Edge Function returned a non-2xx status code".
 */
export async function ensureFreshSession(): Promise<string> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error('Your session expired. Please sign in again.');
  let session = data.session;

  const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
  const nearExpiry = !expiresAt || expiresAt - Date.now() < 60_000;

  if (!session || nearExpiry) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw new Error('Your session expired. Please sign in again.');
    session = refreshed.session ?? session;
  }

  if (!session?.access_token) {
    throw new Error('Your session expired. Please sign in again.');
  }
  return session.access_token;
}

/** Refreshes the live connection token before opening a Realtime channel. */
export async function ensureRealtimeSession(): Promise<void> {
  const token = await ensureFreshSession();
  await supabase.realtime.setAuth(token);
}
