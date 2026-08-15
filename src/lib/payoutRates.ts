import { supabase } from '@/integrations/supabase/client';

/**
 * `profiles.default_payout_rate` is not readable directly by the app roles —
 * students/parents/teachers must never see another person's payout rate.
 * Read it through the security-definer RPC instead (self / admin / admin_fees only).
 */
export async function fetchPayoutRates(userIds: (string | null | undefined)[]): Promise<Map<string, number | null>> {
  const ids = Array.from(new Set(userIds.filter(Boolean))) as string[];
  const out = new Map<string, number | null>();
  if (ids.length === 0) return out;
  try {
    const { data } = await (supabase as any).rpc('get_payout_rates', { _user_ids: ids });
    (data || []).forEach((row: any) => out.set(row.user_id, row.default_payout_rate));
  } catch {
    /* not permitted — leave empty */
  }
  return out;
}

export async function fetchPayoutRate(userId: string | null | undefined): Promise<number | null> {
  if (!userId) return null;
  const map = await fetchPayoutRates([userId]);
  return map.get(userId) ?? null;
}
