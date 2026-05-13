import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { password = "Test1234", confirm } = await req.json().catch(() => ({}));

  if (confirm !== "RESET_ALL") {
    return new Response(JSON.stringify({ error: "Pass { confirm: 'RESET_ALL' }" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: { email: string; ok: boolean; error?: string }[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data.users.length) break;

    for (const u of data.users) {
      const { error: upErr } = await admin.auth.admin.updateUserById(u.id, { password });
      results.push({ email: u.email ?? u.id, ok: !upErr, error: upErr?.message });
    }
    if (data.users.length < perPage) break;
    page++;
  }

  const success = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);

  return new Response(JSON.stringify({ total: results.length, success, failed_count: failed.length, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
