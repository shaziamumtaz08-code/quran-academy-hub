// Watchdog: resumes quiz generation jobs that stalled (rate limits, cold starts, crashes).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const staleBefore = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  const { data: jobs } = await admin
    .from("quiz_generation_jobs")
    .select("id")
    .in("status", ["queued", "extracting", "generating"])
    .lt("updated_at", staleBefore)
    .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`)
    .limit(5);

  for (const job of jobs || []) {
    await fetch(`${supabaseUrl}/functions/v1/quiz-job-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        "x-worker-secret": serviceKey,
      },
      body: JSON.stringify({ job_id: job.id }),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ resumed: jobs?.length || 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
