import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Fetch all profiles
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .not("full_name", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let updated = 0, skipped = 0, errors = 0;
  const results: any[] = [];

  for (const p of profiles || []) {
    const rawFirst = (p.full_name || "").split(/\s+/)[0] || "User";
    // Title case: first letter uppercase, rest lowercase
    const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
    const newPassword = firstName + "1234";

    try {
      const { error: updateErr } = await admin.auth.admin.updateUserById(p.id, {
        password: newPassword,
      });

      if (updateErr) {
        if (updateErr.message?.includes("not found")) {
          skipped++;
        } else {
          errors++;
          results.push({ email: p.email, error: updateErr.message });
        }
      } else {
        updated++;
      }
    } catch (e) {
      skipped++;
    }
  }

  return new Response(JSON.stringify({ updated, skipped, errors, results }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
