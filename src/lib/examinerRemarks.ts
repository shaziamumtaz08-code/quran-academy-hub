import { supabase } from '@/integrations/supabase/client';

/**
 * `exams.examiner_remarks` is internal staff-only. The column-level SELECT grant
 * is revoked for the `authenticated` role, so it can never be selected directly
 * (students/parents could otherwise read it via the API).
 *
 * Staff (admins, examiners, and the student's own teachers) read it through the
 * `get_exam_examiner_remarks` security-definer RPC, which enforces the role check.
 * For anyone else the RPC simply returns no rows.
 */
export async function fetchExaminerRemarks(
  examIds: (string | null | undefined)[],
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(examIds.filter(Boolean))) as string[];
  const out = new Map<string, string | null>();
  if (ids.length === 0) return out;
  try {
    const { data } = await (supabase as any).rpc('get_exam_examiner_remarks', { _exam_ids: ids });
    (data || []).forEach((row: { id: string; examiner_remarks: string | null }) => {
      out.set(row.id, row.examiner_remarks ?? null);
    });
  } catch {
    /* not permitted — treat as hidden */
  }
  return out;
}

export async function fetchExaminerRemark(examId: string | null | undefined): Promise<string | null> {
  if (!examId) return null;
  const map = await fetchExaminerRemarks([examId]);
  return map.get(examId) ?? null;
}
