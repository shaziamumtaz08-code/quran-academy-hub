/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getCorsHeaders, corsHeaders } from "../_shared/cors.ts";

type CriteriaEntry = {
  criteria_name: string;
  obtained_marks: number;
  max_marks: number;
  remarks?: string;
};

function json(status: number, body: unknown, requestOrigin?: string | null) {
  const headers = requestOrigin ? getCorsHeaders(requestOrigin) : corsHeaders;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function sanitizeText(v: string) {
  return v.replace(/[<>]/g, "").trim();
}

function isAllowedRole(role: string | null) {
  if (!role) return false;
  return (
    role === "super_admin" ||
    role === "admin" ||
    role === "examiner" ||
    role === "teacher" ||
    role.startsWith("admin_")
  );
}

serve(async (req) => {
  const requestOrigin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    const headers = requestOrigin ? getCorsHeaders(requestOrigin) : corsHeaders;
    return new Response("ok", { headers });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, requestOrigin);

  const SUPABASE_URL =
    Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing required environment variables");
    return json(500, { error: "Service temporarily unavailable" }, requestOrigin);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(401, { error: "Authentication required" }, requestOrigin);

    // Validate caller session
    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await authedClient.auth.getUser(token);

    if (callerErr || !caller) {
      console.error("Auth validation failed:", callerErr?.message);
      return json(401, { error: "Invalid session" }, requestOrigin);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Role gate
    const { data: roleRow, error: roleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (roleErr) {
      console.error("Role lookup failed:", roleErr.message);
      return json(500, { error: "Authorization check failed" }, requestOrigin);
    }
    if (!isAllowedRole(roleRow?.role ?? null)) {
      return json(403, { error: "Forbidden" }, requestOrigin);
    }

    const body = await req.json().catch(() => null);
    if (!body) return json(400, { error: "Invalid request body" }, requestOrigin);

    const template_id = String(body?.template_id ?? "").trim();
    const student_id = String(body?.student_id ?? "").trim();
    const exam_date = String(body?.exam_date ?? "").trim();
    const examiner_remarks = body?.examiner_remarks ? sanitizeText(String(body.examiner_remarks)) : null;
    const public_remarks = body?.public_remarks ? sanitizeText(String(body.public_remarks)) : null;

    const criteria_entries_raw = body?.criteria_entries;

    const errors: string[] = [];
    if (!isUuid(template_id)) errors.push("Invalid template_id");
    if (!isUuid(student_id)) errors.push("Invalid student_id");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exam_date)) errors.push("Invalid exam_date");
    if (!Array.isArray(criteria_entries_raw) || criteria_entries_raw.length === 0)
      errors.push("criteria_entries is required");

    if (errors.length) return json(400, { error: errors.join(", ") }, requestOrigin);

    const criteria_entries: CriteriaEntry[] = [];
    for (const row of criteria_entries_raw as any[]) {
      const criteria_name = sanitizeText(String(row?.criteria_name ?? ""));
      const obtained_marks = Number(row?.obtained_marks);
      const max_marks = Number(row?.max_marks);
      const remarks = row?.remarks ? sanitizeText(String(row.remarks)) : undefined;

      if (!criteria_name) {
        return json(400, { error: "Each row must have criteria_name" }, requestOrigin);
      }
      if (!Number.isFinite(max_marks) || max_marks <= 0) {
        return json(400, { error: `Invalid max_marks for ${criteria_name}` }, requestOrigin);
      }
      if (!Number.isFinite(obtained_marks)) {
        return json(400, { error: `Obtained marks required for ${criteria_name}` }, requestOrigin);
      }
      if (obtained_marks < 0) {
        return json(400, { error: `Obtained marks cannot be negative (${criteria_name})` }, requestOrigin);
      }
      if (obtained_marks > max_marks) {
        return json(400, { error: `Obtained marks cannot exceed max marks (${criteria_name})` }, requestOrigin);
      }
      if (remarks && remarks.length > 1000) {
        return json(400, { error: `Remarks too long (${criteria_name})` }, requestOrigin);
      }

      criteria_entries.push({ criteria_name, obtained_marks, max_marks, remarks });
    }

    const total_marks = criteria_entries.reduce((sum, r) => sum + r.obtained_marks, 0);
    const max_total_marks = criteria_entries.reduce((sum, r) => sum + r.max_marks, 0);
    const percentage = max_total_marks > 0 ? Math.round((total_marks / max_total_marks) * 100) : 0;

    const { data: examData, error: examError } = await adminClient
      .from("exams")
      .insert({
        template_id,
        student_id,
        examiner_id: caller.id,
        exam_date,
        total_marks,
        max_total_marks,
        percentage,
        criteria_values_json: criteria_entries as unknown,
        examiner_remarks,
        public_remarks,
      })
      .select("id")
      .single();

    if (examError) {
      console.error("Insert exam failed:", examError.message);
      return json(500, { error: "Failed to save report card" }, requestOrigin);
    }

    return json(200, { id: examData?.id, total_marks, max_total_marks, percentage }, requestOrigin);
  } catch (e) {
    console.error("Unexpected error:", e instanceof Error ? e.message : "Unknown error");
    return json(500, { error: "An unexpected error occurred" }, requestOrigin);
  }
});
