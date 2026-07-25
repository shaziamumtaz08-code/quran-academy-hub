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
  const { data } = await supabase.auth.getSession();
  let session = data.session;

  const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
  const nearExpiry = !expiresAt || expiresAt - Date.now() < 60_000;

  if (!session || nearExpiry) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session ?? session;
  }

  if (!session?.access_token) {
    throw new Error('Your session expired. Please sign in again.');
  }
  return session.access_token;
}
