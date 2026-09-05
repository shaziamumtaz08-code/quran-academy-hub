import { supabase } from '@/integrations/supabase/client';

export interface AssignmentPayout {
  payout_amount: number | null;
  payout_type: string | null;
  salary_linked: boolean | null;
}

/**
 * `student_teacher_assignments.payout_amount` / `.payout_type` are not readable
 * directly by app roles — students and parents must never see what a teacher is paid.
 * Read them through the security-definer RPC instead (admin / super admin / own teacher).
 */
export async function fetchAssignmentPayouts(
  assignmentIds: (string | null | undefined)[],
): Promise<Map<string, AssignmentPayout>> {
  const ids = Array.from(new Set(assignmentIds.filter(Boolean))) as string[];
  const out = new Map<string, AssignmentPayout>();
  if (ids.length === 0) return out;

  // Chunk to keep the RPC payload reasonable on large salary runs.
  const chunkSize = 500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const { data } = await (supabase as any).rpc('get_assignment_payouts', { _assignment_ids: chunk });
      (data || []).forEach((row: any) =>
        out.set(row.assignment_id, {
          payout_amount: row.payout_amount,
          payout_type: row.payout_type,
          salary_linked: row.salary_linked ?? null,
        }),
      );
    } catch {
      /* not permitted — leave empty */
    }
  }
  return out;
}

/** Merges payout fields back onto rows fetched without them. */
export async function withAssignmentPayouts<T extends { id: string }>(rows: T[]): Promise<(T & AssignmentPayout)[]> {
  const map = await fetchAssignmentPayouts(rows.map((r) => r.id));
  return rows.map((r) => ({
    ...r,
    payout_amount: map.get(r.id)?.payout_amount ?? null,
    payout_type: map.get(r.id)?.payout_type ?? null,
    salary_linked: map.get(r.id)?.salary_linked ?? null,
  }));
}
