import { supabase } from "@/integrations/supabase/client";
import { getAllAnnotations, saveVersion, type UserResource } from "@/lib/myResources";

/**
 * Synced Submissions — handing a *shared working object* in as an assignment.
 *
 * A "Synced Copy" lives in the classroom workspace. When the student submits it
 * we do NOT move or mutate her own resource. Instead we:
 *   1. snapshot it into a new, assignment-owned personal copy,
 *   2. freeze that snapshot as version 1 (the submitted state),
 *   3. link the copy from the assignment submission row,
 *   4. share the copy with the teaching staff so they can mark it live,
 *   5. notify the teacher.
 *
 * The teacher's marks auto-save onto the assignment copy (never the student's
 * original). Returning the work writes a numbered `assignment_submission_reviews`
 * row, so the submitted state and every reviewed state stay side by side.
 */

const t = (name: string) => (supabase.from(name as any) as any);

export type SubmissionMode = "file" | "synced";
/** Draft → Submitted → Under Review → Reviewed. */
export type SubmissionStatus = "draft" | "submitted" | "under_review" | "reviewed" | string;

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  status: SubmissionStatus;
  submission_mode: SubmissionMode;
  synced_resource_id: string | null;
  synced_origin: string | null;
  synced_state: Record<string, any>;
  response_text: string | null;
  file_url: string | null;
  file_name: string | null;
  submitted_at: string;
  feedback: string | null;
  score: number | null;
}

export const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  reviewed: "Reviewed & returned",
  graded: "Graded",
  returned: "Returned",
};

const SUBMISSION_COLS =
  "id, assignment_id, student_id, status, submission_mode, synced_resource_id, synced_origin, synced_state, response_text, file_url, file_name, submitted_at, feedback, score";

export async function getSubmission(assignmentId: string, studentId: string): Promise<AssignmentSubmission | null> {
  const { data, error } = await t("course_assignment_submissions")
    .select(SUBMISSION_COLS)
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as AssignmentSubmission) ?? null;
}

export async function getSubmissionById(id: string): Promise<AssignmentSubmission | null> {
  const { data, error } = await t("course_assignment_submissions").select(SUBMISSION_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as AssignmentSubmission) ?? null;
}

/** Assignments the student can hand work in to, for a given course. */
export async function listOpenAssignments(courseId: string) {
  const { data, error } = await t("course_assignments")
    .select("id, title, due_date, status, course_id")
    .eq("course_id", courseId)
    .eq("status", "published")
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as { id: string; title: string; due_date: string | null; course_id: string }[];
}

/** Every assignment across the courses this student is enrolled in. */
export async function listAssignmentsForStudent(studentId: string) {
  const { data: enrolments } = await t("course_enrollments").select("course_id").eq("student_id", studentId);
  const courseIds = [...new Set(((enrolments ?? []) as any[]).map((e) => e.course_id).filter(Boolean))];
  if (!courseIds.length) return [];
  const { data, error } = await t("course_assignments")
    .select("id, title, due_date, course_id, status, course:course_id(name)")
    .in("course_id", courseIds)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).filter((a) => a.status !== "archived");
}

/** Teaching staff who should be able to open and mark the submission. */
export async function getAssignmentTeachers(assignmentId: string): Promise<string[]> {
  const ids = new Set<string>();
  const { data: assignment } = await t("course_assignments")
    .select("created_by, course_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return [];
  if (assignment.created_by) ids.add(assignment.created_by);

  const { data: classes } = await t("course_classes").select("id").eq("course_id", assignment.course_id);
  const classIds = ((classes ?? []) as any[]).map((c) => c.id);
  if (classIds.length) {
    const { data: staff } = await t("course_class_staff").select("user_id").in("class_id", classIds);
    for (const s of (staff ?? []) as any[]) if (s.user_id) ids.add(s.user_id);
  }
  return [...ids];
}

/**
 * Alerts go through a guarded database function: a student may only raise the
 * "submitted" alert for her own submission, and only staff may raise
 * "reviewed". The client never writes to the notification queue directly.
 */
async function notifyAssignmentEvent(submissionId: string, kind: "submitted" | "reviewed") {
  await (supabase.rpc as any)("notify_assignment_event", { _submission_id: submissionId, _kind: kind });
}

/**
 * Hand the current synced working object in as an assignment submission.
 * Returns the submission row and the assignment-owned copy it points at.
 */
export async function submitSyncedToAssignment(opts: {
  assignmentId: string;
  studentId: string;
  /** The synced object the student is handing in. */
  source:
    | { kind: "resource"; resource: UserResource }
    | { kind: "content"; content: "qaida" | "mushaf"; title: string; state?: Record<string, any> }
    | { kind: "doc"; docId: string; title: string; type?: string | null };
  /** Live classroom state worth preserving (page, baab, marks, notes …). */
  syncedState?: Record<string, any>;
  origin?: "vcr" | "my_resources";
  note?: string | null;
}): Promise<{ submission: AssignmentSubmission; resourceId: string }> {
  const { assignmentId, studentId, source } = opts;
  const origin = opts.origin ?? "vcr";

  /* 1 ─ assignment-owned snapshot copy (the student's own copy is untouched) */
  const base: Record<string, any> = {
    user_id: studentId,
    kind: "copy",
    origin: "assignment",
    current_version: 0,
    metadata: { assignment_id: assignmentId, synced: true, synced_state: opts.syncedState ?? {} },
  };

  let carriedAnnotations: Record<string, any[]> = {};
  if (source.kind === "resource") {
    const r = source.resource;
    Object.assign(base, {
      title: `${r.title} — assignment copy`,
      description: r.description,
      type: r.type,
      cover_image: r.cover_image,
      file_path: r.file_path,
      source_item_id: r.source_item_id,
    });
    carriedAnnotations = await getAllAnnotations(r.id);
    base.metadata.source_resource_id = r.id;
  } else if (source.kind === "doc") {
    Object.assign(base, { title: `${source.title} — assignment copy`, type: source.type ?? "file", source_item_id: source.docId });
  } else {
    Object.assign(base, {
      title: `${source.title} — assignment copy`,
      type: source.content,
      metadata: { ...base.metadata, content: source.content, content_state: source.state ?? {} },
    });
  }

  const { data: copy, error: copyErr } = await t("user_resources").insert(base).select("*").single();
  if (copyErr) throw copyErr;
  const resourceId = copy.id as string;

  /* 2 ─ carry the marks made on the synced object into the assignment copy */
  const rows = Object.entries(carriedAnnotations).map(([page, strokes]) => ({
    resource_id: resourceId,
    page: Number(page),
    data: { strokes },
    updated_by: studentId,
  }));
  if (rows.length) await t("user_resource_annotations").upsert(rows, { onConflict: "resource_id,page" });

  /* 3 ─ freeze the submitted state as version 1 */
  await saveVersion({ resourceId, userId: studentId, note: opts.note ?? "Submitted state" });

  /* 4 ─ the submission row */
  const payload = {
    assignment_id: assignmentId,
    student_id: studentId,
    status: "submitted",
    submission_mode: "synced",
    synced_resource_id: resourceId,
    synced_origin: origin,
    synced_state: opts.syncedState ?? {},
    response_text: opts.note ?? null,
  };
  const existing = await getSubmission(assignmentId, studentId);
  let submission: AssignmentSubmission;
  if (existing) {
    const { data, error } = await t("course_assignment_submissions")
      .update({ ...payload, submitted_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select(SUBMISSION_COLS)
      .single();
    if (error) throw error;
    submission = data as AssignmentSubmission;
  } else {
    const { data, error } = await t("course_assignment_submissions").insert(payload).select(SUBMISSION_COLS).single();
    if (error) throw error;
    submission = data as AssignmentSubmission;
  }

  /* 5 ─ let the teaching staff in, and tell them */
  const teacherIds = await getAssignmentTeachers(assignmentId);
  if (teacherIds.length) {
    await t("user_resource_shares").upsert(
      teacherIds.map((id) => ({
        resource_id: resourceId,
        shared_with: id,
        shared_by: studentId,
        can_edit: true,
        note: "Assignment submission",
      })),
      { onConflict: "resource_id,shared_with" },
    );
  }

  await notifyAssignmentEvent(submission.id, "submitted").catch(() => {});

  return { submission, resourceId };
}

/** Teacher opened the work — move it along the lifecycle exactly once. */
export async function markUnderReview(submissionId: string) {
  const { error } = await t("course_assignment_submissions")
    .update({ status: "under_review" })
    .eq("id", submissionId)
    .eq("status", "submitted");
  if (error) throw error;
}

/**
 * Save the teacher's marks as a reviewed version and (optionally) return it.
 * The submitted version stays intact as version 1 of the assignment copy.
 */
export async function saveSyncedReview(opts: {
  submissionId: string;
  resourceId: string;
  reviewerId: string;
  comment?: string | null;
  returnNow?: boolean;
}) {
  const pages = await getAllAnnotations(opts.resourceId);
  await saveVersion({
    resourceId: opts.resourceId,
    userId: opts.reviewerId,
    note: opts.returnNow ? "Teacher reviewed" : "Teacher working copy",
  });

  const { data: existing } = await t("assignment_submission_reviews")
    .select("version_no")
    .eq("submission_id", opts.submissionId)
    .order("version_no", { ascending: false })
    .limit(1);
  const nextNo = (((existing ?? []) as any[])[0]?.version_no ?? 0) + 1;

  const { error } = await t("assignment_submission_reviews").insert({
    submission_id: opts.submissionId,
    version_no: nextNo,
    reviewer_id: opts.reviewerId,
    annotations: pages as any,
    comment: opts.comment ?? null,
    returned_at: opts.returnNow ? new Date().toISOString() : null,
  });
  if (error) throw error;

  if (opts.returnNow) {
    await t("course_assignment_submissions")
      .update({ status: "reviewed", graded_by: opts.reviewerId, graded_at: new Date().toISOString() })
      .eq("id", opts.submissionId);

    await notifyAssignmentEvent(opts.submissionId, "reviewed").catch(() => {});
  }
}
