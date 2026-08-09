// QA Test-Mate orchestrator — runs checks across 9 modules of the app.
// Read-only probes; writes a single row into qa_runs with full result set.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ModuleKey =
  | "identity"
  | "academics"
  | "attendance"
  | "finance_invoicing"
  | "finance_payroll"
  | "demo_links"
  | "teaching_os"
  | "comms"
  | "rls_isolation";

type CheckResult = {
  id: string;
  module: ModuleKey;
  area?: string; // legacy
  name: string;
  status: "passed" | "failed" | "skipped" | "warning";
  details?: string;
  evidence?: unknown;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- helpers ----------
const ok = (id: string, module: ModuleKey, name: string, details?: string, evidence?: unknown): CheckResult =>
  ({ id, module, name, status: "passed", details, evidence });
const fail = (id: string, module: ModuleKey, name: string, details?: string, evidence?: unknown): CheckResult =>
  ({ id, module, name, status: "failed", details, evidence });
const warn = (id: string, module: ModuleKey, name: string, details?: string, evidence?: unknown): CheckResult =>
  ({ id, module, name, status: "warning", details, evidence });
const skip = (id: string, module: ModuleKey, name: string, details?: string): CheckResult =>
  ({ id, module, name, status: "skipped", details });

async function safe<T>(fn: () => Promise<T[]>, onErr: (msg: string) => T): Promise<T[]> {
  try { return await fn(); } catch (e: any) { return [onErr(e?.message ?? String(e))]; }
}

// ---------- 1. IDENTITY ----------
async function checkIdentity(): Promise<CheckResult[]> {
  const m: ModuleKey = "identity";
  const out: CheckResult[] = [];

  // Duplicate emails
  const { data: dupEmails } = await admin.rpc("execute_sql" as any, {}).then(() => ({ data: null })).catch(() => ({ data: null }));
  // Fallback: use a direct query
  const { data: emailDupes, error: e1 } = await admin
    .from("profiles")
    .select("email")
    .not("email", "is", null)
    .is("archived_at", null);
  if (e1) {
    out.push(fail("id.emails.query", m, "Duplicate email scan", e1.message));
  } else {
    const counts = new Map<string, number>();
    for (const r of emailDupes ?? []) {
      const e = (r as any).email?.toLowerCase().trim();
      if (e) counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
    out.push(dupes.length === 0
      ? ok("id.emails.unique", m, "Active profile emails are unique", `${emailDupes?.length ?? 0} profiles scanned`)
      : fail("id.emails.unique", m, "Active profile emails are unique", `${dupes.length} duplicate email(s) found`, dupes.slice(0, 10)));
  }

  // Profiles missing email
  const { count: noEmail } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .is("email", null)
    .is("archived_at", null);
  out.push(((noEmail ?? 0) === 0)
    ? ok("id.emails.present", m, "Every active profile has an email")
    : warn("id.emails.present", m, "Active profiles missing email", `${noEmail} profile(s) without email`));

  // Orphan user_roles (user_id not in profiles)
  const { data: roles } = await admin.from("user_roles").select("id, user_id").limit(2000);
  const userIds = [...new Set((roles ?? []).map((r: any) => r.user_id))];
  let orphanRoles = 0;
  if (userIds.length) {
    const { data: existing } = await admin.from("profiles").select("id").in("id", userIds);
    const have = new Set((existing ?? []).map((p: any) => p.id));
    orphanRoles = userIds.filter((u) => !have.has(u)).length;
  }
  out.push(orphanRoles === 0
    ? ok("id.roles.orphan", m, "No orphan user_roles rows", `${userIds.length} unique users with roles`)
    : fail("id.roles.orphan", m, "No orphan user_roles rows", `${orphanRoles} role row(s) reference missing profile`));

  // Archived users not in active assignments
  const { data: archivedActive } = await admin
    .from("student_teacher_assignments")
    .select("id, student_id, teacher_id, status")
    .in("status", ["active"])
    .limit(500);
  let leaked = 0;
  if (archivedActive?.length) {
    const ids = [...new Set(archivedActive.flatMap((a: any) => [a.student_id, a.teacher_id]).filter(Boolean))];
    const { data: arch } = await admin.from("profiles").select("id").in("id", ids).not("archived_at", "is", null);
    leaked = (arch ?? []).length;
  }
  out.push(leaked === 0
    ? ok("id.archived.no_active", m, "No archived users on active assignments")
    : fail("id.archived.no_active", m, "No archived users on active assignments", `${leaked} archived user(s) on active assignment`));

  // Phone normalization sanity (sampling)
  const { data: phones } = await admin
    .from("profiles")
    .select("id, phone")
    .not("phone", "is", null)
    .limit(100);
  const bad = (phones ?? []).filter((p: any) => p.phone && !/^\+?[1-9]\d{6,14}$/.test(String(p.phone).replace(/\s|-/g, "")));
  out.push(bad.length === 0
    ? ok("id.phones.format", m, "Phone numbers look E.164-ish (sample of 100)")
    : warn("id.phones.format", m, "Phone format", `${bad.length}/100 phones look unnormalized`, bad.slice(0, 5)));

  return out;
}

// ---------- 2. ACADEMICS ----------
async function checkAcademics(): Promise<CheckResult[]> {
  const m: ModuleKey = "academics";
  const out: CheckResult[] = [];

  // Active assignments must have teacher + student
  const { data: assigns, error } = await admin
    .from("student_teacher_assignments")
    .select("id, teacher_id, student_id, subject_id, status")
    .eq("status", "active")
    .limit(500);
  if (error) {
    out.push(fail("ac.assign.query", m, "Active assignment query", error.message));
  } else {
    const missing = (assigns ?? []).filter((a: any) => !a.teacher_id || !a.student_id);
    out.push(missing.length === 0
      ? ok("ac.assign.complete", m, "Active assignments have teacher + student", `${assigns?.length ?? 0} checked`)
      : fail("ac.assign.complete", m, "Active assignments have teacher + student", `${missing.length} incomplete`, missing.slice(0, 5)));
  }

  // Paused assignments should not have future schedules
  const { data: paused } = await admin
    .from("student_teacher_assignments")
    .select("id")
    .eq("status", "paused")
    .limit(100);
  if (paused?.length) {
    const ids = paused.map((p: any) => p.id);
    const { data: sch } = await admin
      .from("schedules")
      .select("id, assignment_id")
      .in("assignment_id", ids)
      .limit(50);
    out.push((sch?.length ?? 0) === 0
      ? ok("ac.paused.no_schedule", m, "Paused assignments have no schedules")
      : warn("ac.paused.no_schedule", m, "Paused assignments have no schedules", `${sch!.length} schedule(s) on paused assignment(s)`, sch));
  } else {
    out.push(skip("ac.paused.no_schedule", m, "Paused assignments have no schedules", "No paused assignments"));
  }

  // Schedule overlap detection (per teacher, same day/time)
  const { data: schedules } = await admin
    .from("schedules")
    .select("id, teacher_id, day_of_week, start_time, end_time, is_active")
    .eq("is_active", true)
    .limit(1000);
  let overlaps = 0;
  if (schedules) {
    const byTeacherDay = new Map<string, any[]>();
    for (const s of schedules) {
      const k = `${(s as any).teacher_id}|${(s as any).day_of_week}`;
      if (!byTeacherDay.has(k)) byTeacherDay.set(k, []);
      byTeacherDay.get(k)!.push(s);
    }
    for (const [, list] of byTeacherDay) {
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j];
          if (a.start_time < b.end_time && b.start_time < a.end_time) overlaps++;
        }
    }
  }
  out.push(overlaps === 0
    ? ok("ac.schedule.overlap", m, "No overlapping teacher schedules", `${schedules?.length ?? 0} active schedules checked`)
    : fail("ac.schedule.overlap", m, "No overlapping teacher schedules", `${overlaps} overlap pair(s) detected`));

  return out;
}

// ---------- 3. ATTENDANCE ----------
async function checkAttendance(): Promise<CheckResult[]> {
  const m: ModuleKey = "attendance";
  const out: CheckResult[] = [];

  // Recent attendance rows must reference an assignment
  const { data: att } = await admin
    .from("attendance")
    .select("id, assignment_id, status, attended_at")
    .order("attended_at", { ascending: false })
    .limit(200);
  const noAssign = (att ?? []).filter((a: any) => !a.assignment_id);
  out.push(noAssign.length === 0
    ? ok("at.assignment.fk", m, "Recent attendance rows linked to an assignment", `${att?.length ?? 0} checked`)
    : warn("at.assignment.fk", m, "Recent attendance rows linked to an assignment", `${noAssign.length} unlinked`, noAssign.slice(0, 5)));

  // Zoom logs should reference a session or assignment
  const { data: zlogs } = await admin
    .from("zoom_attendance_logs")
    .select("id, session_id, assignment_id")
    .order("created_at", { ascending: false })
    .limit(200);
  const orphan = (zlogs ?? []).filter((z: any) => !z.session_id && !z.assignment_id);
  out.push(orphan.length === 0
    ? ok("at.zoom.orphan", m, "Zoom logs linked to a session/assignment", `${zlogs?.length ?? 0} checked`)
    : warn("at.zoom.orphan", m, "Zoom logs linked to a session/assignment", `${orphan.length} orphan zoom log(s)`, orphan.slice(0, 5)));

  // Zoom license coverage
  const { count: licCount } = await admin.from("zoom_licenses").select("id", { count: "exact", head: true }).eq("is_active", true);
  out.push((licCount ?? 0) > 0
    ? ok("at.zoom.license", m, "At least one active Zoom license present", `${licCount} active`)
    : warn("at.zoom.license", m, "At least one active Zoom license present", "No active Zoom licenses"));

  return out;
}

// ---------- 4. FINANCE — INVOICING ----------
async function checkFinanceInvoicing(): Promise<CheckResult[]> {
  const m: ModuleKey = "finance_invoicing";
  const out: CheckResult[] = [];

  const { data: invs, error } = await admin
    .from("fee_invoices")
    .select("id, student_id, amount, status, paid_at, updated_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    out.push(fail("fi.query", m, "Invoice query", error.message));
    return out;
  }

  // Every invoice has a student
  const noStudent = (invs ?? []).filter((i: any) => !i.student_id);
  out.push(noStudent.length === 0
    ? ok("fi.student.fk", m, "Recent invoices have a student", `${invs?.length ?? 0} checked`)
    : fail("fi.student.fk", m, "Recent invoices have a student", `${noStudent.length} missing student`, noStudent.slice(0, 5)));

  // Paid invoice immutability: updated_at should be <= paid_at + small grace, or close
  const mutated = (invs ?? []).filter((i: any) => i.status === "paid" && i.paid_at && i.updated_at &&
    new Date(i.updated_at).getTime() - new Date(i.paid_at).getTime() > 60_000);
  out.push(mutated.length === 0
    ? ok("fi.paid.immutable", m, "Paid invoices are immutable post-payment")
    : warn("fi.paid.immutable", m, "Paid invoices are immutable post-payment", `${mutated.length} paid invoice(s) updated after paid_at`, mutated.slice(0, 5)));

  // Negative / zero amounts
  const bad = (invs ?? []).filter((i: any) => Number(i.amount) <= 0);
  out.push(bad.length === 0
    ? ok("fi.amount.positive", m, "Invoice amounts > 0")
    : warn("fi.amount.positive", m, "Invoice amounts > 0", `${bad.length} non-positive amounts`, bad.slice(0, 5)));

  return out;
}

// ---------- 5. FINANCE — PAYROLL ----------
async function checkFinancePayroll(): Promise<CheckResult[]> {
  const m: ModuleKey = "finance_payroll";
  const out: CheckResult[] = [];

  const { data: payouts, error } = await admin
    .from("salary_payouts")
    .select("id, teacher_id, amount, currency, status, period_month, period_year")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    out.push(fail("fp.query", m, "Payout query", error.message));
    return out;
  }

  // Currency must be PKR
  const wrongCur = (payouts ?? []).filter((p: any) => p.currency && p.currency !== "PKR");
  out.push(wrongCur.length === 0
    ? ok("fp.currency.pkr", m, "All payouts in PKR", `${payouts?.length ?? 0} checked`)
    : fail("fp.currency.pkr", m, "All payouts in PKR", `${wrongCur.length} payout(s) not PKR`, wrongCur.slice(0, 5)));

  // Teacher FK
  const noTeacher = (payouts ?? []).filter((p: any) => !p.teacher_id);
  out.push(noTeacher.length === 0
    ? ok("fp.teacher.fk", m, "Payouts reference a teacher")
    : fail("fp.teacher.fk", m, "Payouts reference a teacher", `${noTeacher.length} missing teacher`, noTeacher.slice(0, 5)));

  // Volunteer staff should have zero payouts
  const { data: vols } = await admin
    .from("staff_salaries")
    .select("user_id, employment_type")
    .eq("employment_type", "volunteer")
    .limit(100);
  if (vols?.length) {
    const ids = vols.map((v: any) => v.user_id);
    const { data: volPay } = await admin
      .from("salary_payouts")
      .select("id, teacher_id, amount")
      .in("teacher_id", ids)
      .gt("amount", 0)
      .limit(20);
    out.push((volPay?.length ?? 0) === 0
      ? ok("fp.volunteer.zero", m, "Volunteer staff have no positive payouts")
      : fail("fp.volunteer.zero", m, "Volunteer staff have no positive payouts", `${volPay!.length} positive payout(s) to volunteers`, volPay));
  } else {
    out.push(skip("fp.volunteer.zero", m, "Volunteer staff have no positive payouts", "No volunteer staff"));
  }

  return out;
}

// ---------- 6. DEMO LINKS ----------
async function checkDemoLinks(): Promise<CheckResult[]> {
  const m: ModuleKey = "demo_links";
  const out: CheckResult[] = [];

  const { data: missing, error: e1 } = await admin
    .from("demo_sessions")
    .select("id, teacher_share_token, student_share_token")
    .or("teacher_share_token.is.null,student_share_token.is.null")
    .limit(20);
  if (e1) {
    out.push(fail("dl.tokens.query", m, "Token coverage query", e1.message));
  } else {
    out.push((missing?.length ?? 0) === 0
      ? ok("dl.tokens.coverage", m, "Every demo has teacher + student share tokens")
      : fail("dl.tokens.coverage", m, "Every demo has teacher + student share tokens", `${missing!.length} missing`, missing));
  }

  const { data: sample } = await admin
    .from("demo_sessions")
    .select("id, teacher_share_token, student_share_token")
    .not("teacher_share_token", "is", null)
    .not("student_share_token", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sample) {
    out.push(skip("dl.rpc.teacher", m, "Public RPC resolves teacher token", "No demos available"));
    out.push(skip("dl.rpc.student", m, "Public RPC resolves student token", "No demos available"));
    out.push(skip("dl.rpc.bogus", m, "Invalid share token rejected", "No demos available"));
  } else {
    const { data: tRes, error: tErr } = await anon.rpc("get_demo_by_share_token", { p_token: sample.teacher_share_token });
    out.push(!tErr && tRes
      ? ok("dl.rpc.teacher", m, "Public RPC resolves teacher token (anonymous)")
      : fail("dl.rpc.teacher", m, "Public RPC resolves teacher token (anonymous)", tErr?.message));
    const { data: sRes, error: sErr } = await anon.rpc("get_demo_by_share_token", { p_token: sample.student_share_token });
    out.push(!sErr && sRes
      ? ok("dl.rpc.student", m, "Public RPC resolves student token (anonymous)")
      : fail("dl.rpc.student", m, "Public RPC resolves student token (anonymous)", sErr?.message));
    const { data: bogus, error: bErr } = await anon.rpc("get_demo_by_share_token", { p_token: "0".repeat(32) });
    const blocked = bErr || !bogus || (Array.isArray(bogus) && bogus.length === 0);
    out.push(blocked
      ? ok("dl.rpc.bogus", m, "Invalid share token is rejected")
      : fail("dl.rpc.bogus", m, "Invalid share token is rejected", "Random token resolved!", bogus));
  }
  return out;
}

// ---------- 7. TEACHING OS ----------
async function checkTeachingOS(): Promise<CheckResult[]> {
  const m: ModuleKey = "teaching_os";
  const out: CheckResult[] = [];

  const { data: plans } = await admin
    .from("session_plans")
    .select("id, syllabus_id")
    .order("created_at", { ascending: false })
    .limit(200);
  const noSyl = (plans ?? []).filter((p: any) => !p.syllabus_id);
  out.push(noSyl.length === 0
    ? ok("to.plans.syllabus", m, "Session plans linked to a syllabus", `${plans?.length ?? 0} checked`)
    : warn("to.plans.syllabus", m, "Session plans linked to a syllabus", `${noSyl.length} unlinked`, noSyl.slice(0, 5)));

  // Speaking attempts have audio
  const { data: sp } = await admin
    .from("speaking_attempts")
    .select("id, audio_url, transcript")
    .order("created_at", { ascending: false })
    .limit(100);
  const noAudio = (sp ?? []).filter((s: any) => !s.audio_url);
  out.push(noAudio.length === 0
    ? ok("to.speaking.audio", m, "Speaking attempts have audio_url")
    : warn("to.speaking.audio", m, "Speaking attempts have audio_url", `${noAudio.length} missing audio`));

  return out;
}

// ---------- 8. COMMUNICATION ----------
async function checkComms(): Promise<CheckResult[]> {
  const m: ModuleKey = "comms";
  const out: CheckResult[] = [];

  const { data: groups } = await admin
    .from("chat_groups")
    .select("id")
    .limit(200);
  let empty = 0;
  if (groups?.length) {
    const ids = groups.map((g: any) => g.id);
    const { data: members } = await admin.from("chat_members").select("group_id").in("group_id", ids);
    const has = new Set((members ?? []).map((m: any) => m.group_id));
    empty = ids.filter((i) => !has.has(i)).length;
  }
  out.push(empty === 0
    ? ok("co.groups.members", m, "Chat groups have at least one member", `${groups?.length ?? 0} checked`)
    : warn("co.groups.members", m, "Chat groups have at least one member", `${empty} empty group(s)`));

  // WhatsApp messages must have a contact
  const { data: wa } = await admin
    .from("whatsapp_messages")
    .select("id, contact_id")
    .order("created_at", { ascending: false })
    .limit(200);
  const noContact = (wa ?? []).filter((w: any) => !w.contact_id);
  out.push(noContact.length === 0
    ? ok("co.wa.contact", m, "WhatsApp messages linked to a contact")
    : warn("co.wa.contact", m, "WhatsApp messages linked to a contact", `${noContact.length} missing`));

  // Notification queue backlog
  const { count: pending } = await admin
    .from("notification_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  out.push((pending ?? 0) === 0
    ? ok("co.queue.backlog", m, "Notification queue not backed up >24h")
    : warn("co.queue.backlog", m, "Notification queue not backed up >24h", `${pending} pending older than 24h`));

  return out;
}

// ---------- 9. RLS ISOLATION ----------
async function checkRls(): Promise<CheckResult[]> {
  const m: ModuleKey = "rls_isolation";
  const out: CheckResult[] = [];

  const protectedTables = [
    "profiles", "leads", "demo_sessions", "demo_feedback", "fee_invoices",
    "salary_payouts", "user_roles", "student_teacher_assignments",
    "expenses", "cash_advances", "staff_salaries", "tickets", "qa_runs", "qa_chat_messages",
  ];
  for (const t of protectedTables) {
    const { data, error } = await anon.from(t as any).select("*").limit(1);
    const leaked = !error && Array.isArray(data) && data.length > 0;
    out.push(leaked
      ? fail(`rls.anon.${t}`, m, `Anonymous read blocked on ${t}`, `Leaked ${data.length} row(s)`, data)
      : ok(`rls.anon.${t}`, m, `Anonymous read blocked on ${t}`, error ? `Blocked (${error.code ?? "ok"})` : "Empty result"));
  }

  const { data: spoofRole, error: spoofErr } = await anon.rpc("has_role" as any, {
    _user_id: "00000000-0000-0000-0000-000000000000",
    _role: "super_admin",
  });
  out.push(spoofRole === false || spoofErr
    ? ok("rls.has_role.anon", m, "has_role() returns false for unknown user", spoofErr ? `Blocked: ${spoofErr.message}` : "Returned false")
    : fail("rls.has_role.anon", m, "has_role() returns false for unknown user", `Returned ${spoofRole}`));

  return out;
}

// ---------- registry ----------
const MODULES: Record<ModuleKey, () => Promise<CheckResult[]>> = {
  identity: checkIdentity,
  academics: checkAcademics,
  attendance: checkAttendance,
  finance_invoicing: checkFinanceInvoicing,
  finance_payroll: checkFinancePayroll,
  demo_links: checkDemoLinks,
  teaching_os: checkTeachingOS,
  comms: checkComms,
  rls_isolation: checkRls,
};

import { requireRole } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireRole(req, ["super_admin"]);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  let triggeredBy: string | null = null;
  let triggerSource = "manual";
  let kind: string = "full"; // "full" | ModuleKey | legacy values
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    triggeredBy = body.triggered_by ?? null;
    triggerSource = body.trigger_source ?? "manual";
    kind = body.kind ?? "full";
  } catch (_) {}

  const { data: run, error: insErr } = await admin
    .from("qa_runs")
    .insert({ kind, status: "running", triggered_by: triggeredBy, trigger_source: triggerSource })
    .select()
    .single();
  if (insErr || !run) {
    return new Response(JSON.stringify({ error: insErr?.message ?? "could not create run" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const toRun: ModuleKey[] = kind === "full"
      ? (Object.keys(MODULES) as ModuleKey[])
      : (kind in MODULES ? [kind as ModuleKey] : (Object.keys(MODULES) as ModuleKey[]));

    // Run modules in parallel with isolation
    const settled = await Promise.all(
      toRun.map(async (mod) => {
        try { return await MODULES[mod](); }
        catch (e: any) {
          return [fail(`${mod}.crash`, mod, `${mod} module crashed`, e?.message ?? "unknown")];
        }
      })
    );
    const results = settled.flat();

    const passed = results.filter((r) => r.status === "passed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const warning = results.filter((r) => r.status === "warning").length;
    const total = results.length;
    const status = failed > 0 ? "failed" : "passed";
    const summary = `${passed}/${total} passed${failed ? `, ${failed} failed` : ""}${warning ? `, ${warning} warnings` : ""}.`;

    await admin
      .from("qa_runs")
      .update({
        status, finished_at: new Date().toISOString(),
        passed_count: passed, failed_count: failed, total_count: total,
        summary, results,
      })
      .eq("id", run.id);

    return new Response(JSON.stringify({ ok: true, run_id: run.id, status, summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await admin
      .from("qa_runs")
      .update({ status: "error", finished_at: new Date().toISOString(), summary: e?.message ?? "internal" })
      .eq("id", run.id);
    return new Response(JSON.stringify({ error: e?.message ?? "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
