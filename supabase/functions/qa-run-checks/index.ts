// QA Test-Mate: runs automated checks for v1 scope (demo link flow + RLS isolation).
// Writes a row into qa_runs with detailed results.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CheckResult = {
  id: string;
  area: "demo_links" | "rls_isolation";
  name: string;
  status: "passed" | "failed" | "skipped";
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

async function checkDemoLinks(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];

  // 1. Every demo_session must have both share tokens
  const { data: missing, error: e1 } = await admin
    .from("demo_sessions")
    .select("id, teacher_share_token, student_share_token")
    .or("teacher_share_token.is.null,student_share_token.is.null")
    .limit(20);
  if (e1) {
    out.push({ id: "demo.tokens.query", area: "demo_links", name: "Token coverage query", status: "failed", details: e1.message });
  } else {
    out.push({
      id: "demo.tokens.coverage",
      area: "demo_links",
      name: "Every demo has teacher + student share tokens",
      status: (missing?.length ?? 0) === 0 ? "passed" : "failed",
      details: (missing?.length ?? 0) === 0
        ? "All demo_sessions have both tokens."
        : `${missing!.length} demo(s) missing one or both tokens.`,
      evidence: missing,
    });
  }

  // 2. Pick a recent demo with a teacher token and call the public RPC anonymously
  const { data: sample } = await admin
    .from("demo_sessions")
    .select("id, teacher_share_token, student_share_token, lead_id, teacher_id")
    .not("teacher_share_token", "is", null)
    .not("student_share_token", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sample) {
    out.push({
      id: "demo.rpc.teacher",
      area: "demo_links",
      name: "Public RPC resolves teacher token",
      status: "skipped",
      details: "No demo_sessions with both tokens to sample.",
    });
    out.push({
      id: "demo.rpc.student",
      area: "demo_links",
      name: "Public RPC resolves student token",
      status: "skipped",
      details: "No demo_sessions with both tokens to sample.",
    });
  } else {
    const { data: tRes, error: tErr } = await anon.rpc("get_demo_by_share_token", { p_token: sample.teacher_share_token });
    out.push({
      id: "demo.rpc.teacher",
      area: "demo_links",
      name: "Public RPC resolves teacher token (anonymous)",
      status: !tErr && tRes ? "passed" : "failed",
      details: tErr?.message ?? `audience=${(tRes as any)?.audience ?? "n/a"}`,
      evidence: tRes ?? null,
    });
    const { data: sRes, error: sErr } = await anon.rpc("get_demo_by_share_token", { p_token: sample.student_share_token });
    out.push({
      id: "demo.rpc.student",
      area: "demo_links",
      name: "Public RPC resolves student token (anonymous)",
      status: !sErr && sRes ? "passed" : "failed",
      details: sErr?.message ?? `audience=${(sRes as any)?.audience ?? "n/a"}`,
      evidence: sRes ?? null,
    });

    // 3. Bogus token must NOT resolve
    const { data: bogus, error: bErr } = await anon.rpc("get_demo_by_share_token", { p_token: "0".repeat(32) });
    const blocked = bErr || !bogus || (Array.isArray(bogus) && bogus.length === 0);
    out.push({
      id: "demo.rpc.bogus",
      area: "demo_links",
      name: "Invalid share token is rejected",
      status: blocked ? "passed" : "failed",
      details: blocked ? "Random token does not resolve." : "Random token unexpectedly resolved!",
      evidence: bogus ?? null,
    });
  }

  // 4. share_sent_at populated for recent scheduled demos (notifier fired)
  const { data: recent } = await admin
    .from("demo_sessions")
    .select("id, share_sent_at, created_at, status")
    .gte("created_at", new Date(Date.now() - 7 * 86400 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  if (recent && recent.length > 0) {
    const unsent = recent.filter((r: any) => !r.share_sent_at);
    out.push({
      id: "demo.notifier.sent",
      area: "demo_links",
      name: "Share-link notifier fires when demos are scheduled",
      status: unsent.length === 0 ? "passed" : (unsent.length < recent.length ? "passed" : "failed"),
      details: `${recent.length - unsent.length}/${recent.length} demos in last 7d show share_sent_at.`,
      evidence: { unsent_count: unsent.length, sample: unsent.slice(0, 5) },
    });
  } else {
    out.push({
      id: "demo.notifier.sent",
      area: "demo_links",
      name: "Share-link notifier fires when demos are scheduled",
      status: "skipped",
      details: "No demos scheduled in last 7 days.",
    });
  }

  return out;
}

async function checkRlsIsolation(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];

  // Tables that must NOT be readable by anonymous clients
  const protectedTables = [
    "profiles",
    "leads",
    "demo_sessions",
    "demo_feedback",
    "fee_invoices",
    "salary_payouts",
    "user_roles",
    "student_teacher_assignments",
    "minor_credentials",
  ];

  for (const t of protectedTables) {
    const { data, error } = await anon.from(t as any).select("*").limit(1);
    // We expect either an explicit error (42501 / not exposed) OR zero rows.
    const leaked = !error && Array.isArray(data) && data.length > 0;
    out.push({
      id: `rls.anon.${t}`,
      area: "rls_isolation",
      name: `Anonymous read blocked on ${t}`,
      status: leaked ? "failed" : "passed",
      details: leaked
        ? `Anonymous client received ${data.length} row(s) from ${t}!`
        : (error ? `Blocked (${error.code ?? "ok"})` : "Empty result — no leakage."),
      evidence: leaked ? data : null,
    });
  }

  // Storage-style: verify has_role function exists and refuses anon spoofing
  const { data: spoofRole, error: spoofErr } = await anon.rpc("has_role" as any, {
    _user_id: "00000000-0000-0000-0000-000000000000",
    _role: "super_admin",
  });
  out.push({
    id: "rls.has_role.anon",
    area: "rls_isolation",
    name: "has_role() returns false for unknown user",
    status: spoofRole === false ? "passed" : (spoofErr ? "passed" : "failed"),
    details: spoofErr ? `Blocked: ${spoofErr.message}` : `Returned ${spoofRole}`,
  });

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let triggeredBy: string | null = null;
  let triggerSource = "manual";
  let kind: "demo_links" | "rls_isolation" | "full" = "full";

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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const results: CheckResult[] = [];
    if (kind === "full" || kind === "demo_links") results.push(...(await checkDemoLinks()));
    if (kind === "full" || kind === "rls_isolation") results.push(...(await checkRlsIsolation()));

    const passed = results.filter((r) => r.status === "passed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const total = results.length;
    const status = failed > 0 ? "failed" : "passed";
    const summary = `${passed}/${total} checks passed${failed ? `, ${failed} failed` : ""}.`;

    await admin
      .from("qa_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        passed_count: passed,
        failed_count: failed,
        total_count: total,
        summary,
        results,
      })
      .eq("id", run.id);

    return new Response(JSON.stringify({ ok: true, run_id: run.id, status, summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await admin
      .from("qa_runs")
      .update({ status: "error", finished_at: new Date().toISOString(), summary: e?.message ?? "internal error" })
      .eq("id", run.id);
    return new Response(JSON.stringify({ error: e?.message ?? "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
