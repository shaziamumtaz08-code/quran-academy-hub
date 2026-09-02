import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Zoom accounts that are deliberately kept OFF the in-app Meeting SDK embed.
 *
 * Some teacher seats never joined reliably through the embedded player, so they
 * run on the plain Zoom link/browser-join flow instead. The flag lives on
 * `zoom_accounts.sdk_embed_enabled`, so switching an account back on (or moving
 * another one off) is a data change — no code edits.
 */
export function useSdkEmbedDisabledAccounts() {
  return useQuery({
    queryKey: ['zoom-sdk-embed-disabled'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zoom_accounts')
        .select('id')
        .eq('sdk_embed_enabled', false);
      if (error) throw error;
      return new Set<string>(((data || []) as Array<{ id: string }>).map((r) => r.id));
    },
  });
}

/** True when the given class may use the in-app player (unknown class → allowed). */
export function useClassSdkEmbedAllowed(classId?: string | null) {
  const { data } = useQuery({
    queryKey: ['zoom-sdk-embed-class', classId],
    enabled: !!classId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: cls } = await (supabase as any)
        .from('course_classes')
        .select('zoom_account_id')
        .eq('id', classId!)
        .maybeSingle();
      if (!cls?.zoom_account_id) return true;
      const { data: acct } = await (supabase as any)
        .from('zoom_accounts')
        .select('sdk_embed_enabled')
        .eq('id', cls.zoom_account_id)
        .maybeSingle();
      return (acct as any)?.sdk_embed_enabled !== false;
    },
  });
  return data !== false;
}
