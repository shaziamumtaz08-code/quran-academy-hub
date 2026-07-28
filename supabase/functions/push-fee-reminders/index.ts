import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireRole } from "../_shared/auth.ts";
import {
  dispatchPush,
  emptySummary,
  loadPushTemplate,
  type PushRecipient,
} from "../_shared/pushDispatch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function authorize(req: Request) {
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const cronSecret = Deno.env.get("CRON_PUSH_SECRET") ?? "";
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  const isCron = !!cronSecret && cronHeader === cronSecret;
  if (SERVICE_KEY && (isCron || token === SERVICE_KEY)) {
    return { ok: true as const, adminClient: createClient(SUPABASE_URL, SERVICE_KEY) };
  }
  return await requireRole(req, ["super_admin", "admin", "admin_division", "admin_fees"]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const summary = emptySummary();

  try {
    const auth = await authorize(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = auth.adminClient;

    // Same source the Finance section uses for outstanding invoices:
    // fee_invoices, excluding voided rows.
    const { data: invoices, error: invErr } = await supabase
      .from("fee_invoices")
      .select("id, student_id, amount, amount_paid, currency, status, due_date, billing_month")
      .is("voided_at", null)
      .in("status", ["pending", "overdue", "partially_paid"]);
    if (invErr) throw invErr;

    // deno-lint-ignore no-explicit-any
    const rows = (invoices ?? []) as any[];
    const byStudent = new Map<string, { outstanding: number; currency: string; count: number }>();
    for (const inv of rows) {
      if (!inv.student_id) continue;
      const outstanding = Math.max(0, Number(inv.amount || 0) - Number(inv.amount_paid || 0));
      if (outstanding <= 0) continue;
      const cur = byStudent.get(inv.student_id) ??
        { outstanding: 0, currency: inv.currency || "PKR", count: 0 };
      cur.outstanding += outstanding;
      cur.count++;
      byStudent.set(inv.student_id, cur);
    }

    const studentIds = [...byStudent.keys()];
    if (studentIds.length === 0) {
      console.log("push-fee-reminders summary", summary);
      return new Response(JSON.stringify({ success: true, ...summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: links } = await supabase
      .from("student_parent_links")
      .select("student_id, parent_id")
      .in("student_id", studentIds);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", studentIds);
    // deno-lint-ignore no-explicit-any
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    const template = await loadPushTemplate(supabase, "fee_reminder");
    if (!template) {
      summary.template_missing = true;
      summary.notes.push("No active push template for trigger: fee_reminder");
      console.log("push-fee-reminders summary", summary);
      return new Response(JSON.stringify({ success: true, ...summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // deno-lint-ignore no-explicit-any
    for (const l of (links ?? []) as any[]) {
      if (!l.parent_id) continue;
      const agg = byStudent.get(l.student_id);
      if (!agg) continue;

      const vars: Record<string, string> = {
        student_name: String(nameMap.get(l.student_id) ?? "your child"),
        amount_due: agg.outstanding.toLocaleString("en-US", { maximumFractionDigits: 0 }),
        currency: agg.currency,
        invoice_count: String(agg.count),
      };
      const recipients: PushRecipient[] = [{ profile_id: l.parent_id, vars }];
      await dispatchPush(supabase, template, recipients, vars, summary);
    }

    console.log("push-fee-reminders summary", summary);
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("push-fee-reminders error:", message, summary);
    return new Response(JSON.stringify({ error: message, ...summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
