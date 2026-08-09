// QA Test-Mate chat agent. Streams AI SDK responses and exposes tools for running
// checks and reading recent QA runs. Super-admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "npm:ai@5.0.92";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@1.0.27";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const gateway = createOpenAICompatible({
  name: "lovable",
  baseURL: "https://ai.gateway.lovable.dev/v1",
  headers: { "Lovable-API-Key": LOVABLE_API_KEY },
});

const SYSTEM_PROMPT = `You are the QA Test-Mate for Al Quran Time Academy's LMS, talking to a Super Admin.

Your v1 scope (only these areas):
  1. Demo Link Flow — shareable demo URLs (teacher + student tokens), the public /demo/:token page, and the post-class feedback form.
  2. RLS Isolation — confirm that anonymous/unauthenticated clients cannot read sensitive tables (profiles, leads, demo_sessions, demo_feedback, fee_invoices, salary_payouts, user_roles, student_teacher_assignments).

How to behave:
- Be concise. Speak in plain English (no SQL keywords unless asked).
- When the user asks you to run checks, validate, test, verify, or "make sure", call the run_qa_checks tool.
- When the user asks about recent results, the nightly run, or "what failed", call get_recent_runs or get_run_details.
- After a tool call, summarize the result in 2–4 sentences: what passed, what failed, and the next action.
- If something fails, explain the likely cause in business terms (e.g. "the notifier did not fire when demo X was scheduled").
- If asked about anything outside the v1 scope (attendance, payroll, etc.), politely say it's not in v1 and offer to add it later.
`;

const tools = {
  run_qa_checks: tool({
    description: "Run the automated QA checks for the demo link flow and/or RLS isolation. Returns pass/fail counts and a summary.",
    inputSchema: z.object({
      kind: z.enum(["demo_links", "rls_isolation", "full"]).default("full"),
    }),
    execute: async ({ kind }) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/qa-run-checks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
        body: JSON.stringify({ kind, trigger_source: "chat" }),
      });
      const body = await res.json();
      return body;
    },
  }),
  get_recent_runs: tool({
    description: "List the most recent QA runs (status, summary, started_at).",
    inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(5) }),
    execute: async ({ limit }) => {
      const { data, error } = await admin
        .from("qa_runs")
        .select("id, kind, status, summary, passed_count, failed_count, total_count, started_at, finished_at, trigger_source")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) return { error: error.message };
      return { runs: data ?? [] };
    },
  }),
  get_run_details: tool({
    description: "Get the full details (including failed checks) of a specific QA run by ID.",
    inputSchema: z.object({ run_id: z.string().uuid() }),
    execute: async ({ run_id }) => {
      const { data, error } = await admin.from("qa_runs").select("*").eq("id", run_id).maybeSingle();
      if (error) return { error: error.message };
      return data ?? { error: "not found" };
    },
  }),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: must be a signed-in super admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("unauthorized", { status: 401, headers: corsHeaders });

  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes.user) {
    return new Response("unauthorized", { status: 401, headers: corsHeaders });
  }
  const userId = userRes.user.id;

  const { data: isSuper } = await admin.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!isSuper) return new Response("forbidden", { status: 403, headers: corsHeaders });

  let body: { messages?: UIMessage[] } = {};
  try { body = await req.json(); } catch (_) {}
  const incoming = body.messages ?? [];

  // Persist the latest user message (single shared conversation)
  const lastUser = [...incoming].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const textPart = (lastUser.parts ?? []).find((p: any) => p.type === "text") as any;
    const text = textPart?.text ?? "";
    await admin.from("qa_chat_messages").insert({
      role: "user",
      content: text,
      parts: lastUser.parts ?? null,
      author_id: userId,
    });
  }

  const result = streamText({
    model: gateway("google/gemini-3-flash-preview"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(incoming),
    tools,
    stopWhen: stepCountIs(50),
  });

  return result.toUIMessageStreamResponse({
    headers: corsHeaders,
    originalMessages: incoming,
    onFinish: async ({ responseMessage }) => {
      try {
        const textParts = (responseMessage.parts ?? [])
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("\n");
        await admin.from("qa_chat_messages").insert({
          role: "assistant",
          content: textParts,
          parts: responseMessage.parts ?? null,
          author_id: null,
        });
      } catch (e) {
        console.error("qa-chat persist error:", e);
      }
    },
  });
});
