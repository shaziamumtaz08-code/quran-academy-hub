import { supabase } from "@/integrations/supabase/client";

/**
 * Reviewed Work — a teacher's checked copy of a student's submission.
 *
 * The student's original submission row is never altered. Each review is a
 * separate, numbered version carrying its own marks and comment, and is only
 * visible to the student once it has been returned.
 */

export interface SubmissionReview {
  id: string;
  submission_id: string;
  version_no: number;
  reviewer_id: string;
  annotations: any[];
  file_path: string | null;
  comment: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
}

const t = (name: string) => (supabase.from(name as any) as any);

export async function listReviews(submissionId: string): Promise<SubmissionReview[]> {
  const { data, error } = await t("assignment_submission_reviews")
    .select("*")
    .eq("submission_id", submissionId)
    .order("version_no", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubmissionReview[];
}

export async function listReviewsForSubmissions(ids: string[]): Promise<SubmissionReview[]> {
  if (!ids.length) return [];
  const { data, error } = await t("assignment_submission_reviews")
    .select("*")
    .in("submission_id", ids)
    .order("version_no", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SubmissionReview[];
}

/** Save the current marks as a new reviewed version. */
export async function saveReview(opts: {
  submissionId: string;
  reviewerId: string;
  annotations: any[];
  comment?: string | null;
  returnNow?: boolean;
}): Promise<SubmissionReview> {
  const existing = await listReviews(opts.submissionId);
  const nextNo = (existing[0]?.version_no ?? 0) + 1;

  const { data, error } = await t("assignment_submission_reviews")
    .insert({
      submission_id: opts.submissionId,
      version_no: nextNo,
      reviewer_id: opts.reviewerId,
      annotations: opts.annotations ?? [],
      comment: opts.comment ?? null,
      returned_at: opts.returnNow ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SubmissionReview;
}

/** Send an already-saved reviewed version back to the student. */
export async function returnReview(reviewId: string) {
  const { error } = await t("assignment_submission_reviews")
    .update({ returned_at: new Date().toISOString() })
    .eq("id", reviewId);
  if (error) throw error;
}

/** Keep the reviewed copy on the teacher's own shelf too. */
export async function saveReviewToMyResources(opts: {
  userId: string;
  title: string;
  submissionId: string;
  fileType?: string | null;
  annotations: any[];
}) {
  const { error } = await t("user_resources").insert({
    user_id: opts.userId,
    kind: "copy",
    origin: "review",
    title: opts.title,
    type: opts.fileType ?? "file",
    source_submission_id: opts.submissionId,
    metadata: { annotations: opts.annotations },
  });
  if (error) throw error;
}
