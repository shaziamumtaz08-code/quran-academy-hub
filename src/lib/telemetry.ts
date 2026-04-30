import { supabase } from '@/integrations/supabase/client';

const inflight = new Map<string, number>();
const DEDUP_MS = 5000;

/**
 * Records a single route hit for analytics. Best-effort:
 * - Dedupes within DEDUP_MS for the same role+route.
 * - Silently swallows failures (telemetry must never block UX).
 * - Skips when role is not yet resolved (anonymous / loading).
 */
export async function logRouteHit(
  role: string | null,
  route: string,
  divisionId?: string | null
) {
  if (!role) return;
  if (!route) return;

  const key = `${role}:${route}`;
  const now = Date.now();
  const last = inflight.get(key) || 0;
  if (now - last < DEDUP_MS) return;
  inflight.set(key, now);

  try {
    await supabase.from('route_hits' as any).insert({
      role,
      route,
      division_id: divisionId ?? null,
      hit_at: new Date().toISOString(),
    });
  } catch {
    // Silently swallow — telemetry must never block UX
  }
}
