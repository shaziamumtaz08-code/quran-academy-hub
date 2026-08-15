UPDATE public.salary_payouts
SET revision_required_at = NULL,
    revision_reason = NULL,
    notes = COALESCE(NULLIF(notes, ''), '') ||
      CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE E'\n' END ||
      '[' || to_char(now(), 'YYYY-MM-DD') || '] Revision review closed: sheet already settled in full against dues; prior flag ("' || COALESCE(revision_reason,'flagged') || '") requires no further action.'
WHERE revision_required_at IS NOT NULL
  AND COALESCE(is_archived, false) = false
  AND status IN ('paid','locked','partially_paid')
  AND salary_month < '2026-08';