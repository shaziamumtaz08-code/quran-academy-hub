import { supabase } from '@/integrations/supabase/client';

/**
 * Contact / banking fields live in `profile_sensitive_data`, NOT on `profiles`.
 * Selecting them straight from `profiles` fails the whole query with
 * "permission denied for column ..." because of column-level grants.
 *
 * These helpers read them from the correct table and fail soft (empty map)
 * when the current user isn't allowed to see them.
 */

export interface SensitiveProfileRow {
  user_id: string;
  whatsapp_number: string | null;
  bank_name?: string | null;
  bank_account_title?: string | null;
  bank_account_number?: string | null;
  bank_iban?: string | null;
}

export async function fetchSensitiveByUserIds(
  userIds: string[],
  columns = 'user_id, whatsapp_number',
): Promise<Map<string, SensitiveProfileRow>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  try {
    const { data } = await (supabase as any)
      .from('profile_sensitive_data')
      .select(columns)
      .in('user_id', ids);
    return new Map<string, SensitiveProfileRow>(
      (data || []).map((row: any) => [row.user_id, row as SensitiveProfileRow]),
    );
  } catch {
    return new Map();
  }
}

export async function fetchWhatsappMap(userIds: string[]): Promise<Map<string, string | null>> {
  const rows = await fetchSensitiveByUserIds(userIds);
  const out = new Map<string, string | null>();
  rows.forEach((row, id) => out.set(id, row.whatsapp_number ?? null));
  return out;
}

export async function fetchWhatsapp(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const map = await fetchWhatsappMap([userId]);
  return map.get(userId) ?? null;
}
