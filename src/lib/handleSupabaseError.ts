import { toast } from 'sonner';

/**
 * Centralized Supabase error → toast surfacing.
 * Detects common PostgREST/Postgres error codes and renders a friendly toast.
 *
 * - 42501 → RLS denial
 * - 23503 → Foreign key violation
 * - default → error.message
 */
export function handleSupabaseError(error: any, action: string) {
  if (!error) return;
  const code = error?.code || error?.details?.code;
  if (code === '42501') {
    toast.error(
      `You don't have permission to ${action}. Confirm your assignment is active.`
    );
    return;
  }
  if (code === '23503') {
    toast.error('Linked record missing — please refresh and try again.');
    return;
  }
  toast.error(error?.message || `Failed to ${action}`);
}
