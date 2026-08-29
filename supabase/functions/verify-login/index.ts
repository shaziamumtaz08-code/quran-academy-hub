/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";
import { requireRole } from "../_shared/auth.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Admin credential checker: attempts a real sign-in for the given
 * email + password in an isolated client and immediately discards the
 * session. Nothing about the account changes, and the admin's own
 * session in the browser is untouched.
 *
 * body: { email: string, password: string }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireRole(req, ["super_admin", "admin"]);
    if (!auth.ok) return json(auth.status, { error: auth.error });

    const { email, password } = await req.json().catch(() => ({}));
    if (!email || !password) return json(400, { error: "Email and password are required" });

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
    const probe = createClient(url, anon, { auth: { persistSession: false } });

    const { data, error } = await probe.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password: String(password),
    });
    if (error) return json(200, { valid: false, reason: error.message });

    await probe.auth.signOut().catch(() => undefined);

    // Does the account still have to pick its own password?
    const { data: prof } = await (auth.adminClient as any)
      .from("profiles")
      .select("full_name, force_password_reset")
      .eq("id", data.user?.id)
      .maybeSingle();

    return json(200, {
      valid: true,
      user_id: data.user?.id,
      name: prof?.full_name ?? null,
      must_change_password: Boolean(prof?.force_password_reset),
    });
  } catch (err: any) {
    console.error("verify-login failed:", err?.message);
    return json(500, { error: err?.message || "Unexpected error" });
  }
});
