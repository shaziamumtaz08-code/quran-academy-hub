import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ZoomCredentials {
  account_id?: string;
  client_id?: string;
  client_secret?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user role
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Super admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ZoomCredentials = await req.json().catch(() => ({}));

    // Use provided credentials or fall back to stored secrets
    const accountId = body.account_id || Deno.env.get("ZOOM_ACCOUNT_ID");
    const clientId = body.client_id || Deno.env.get("ZOOM_CLIENT_ID");
    const clientSecret = body.client_secret || Deno.env.get("ZOOM_CLIENT_SECRET");

    if (!accountId || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Zoom credentials not configured. Please provide account_id, client_id, and client_secret." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get Zoom OAuth token
    const authString = btoa(`${clientId}:${clientSecret}`);
    const tokenResp = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${authString}` },
      }
    );

    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: "Failed to get Zoom access token", details: tokenData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.access_token;

    // Step 2: Get all zoom_licenses emails
    const { data: licenses, error: licError } = await adminClient
      .from("zoom_licenses")
      .select("id, zoom_email, host_id");

    if (licError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch licenses", details: licError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Fetch host_id for each email
    const results: Array<{ email: string; host_id: string | null; status: string; error?: string }> = [];

    for (const license of licenses || []) {
      if (!license.zoom_email) {
        results.push({ email: "unknown", host_id: null, status: "skipped", error: "No email" });
        continue;
      }

      try {
        const userResp = await fetch(
          `https://api.zoom.us/v2/users/${encodeURIComponent(license.zoom_email)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (userResp.ok) {
          const userData = await userResp.json();
          const zoomUserId = userData.id;

          // Update the license
          const { error: updateError } = await adminClient
            .from("zoom_licenses")
            .update({ host_id: zoomUserId })
            .eq("id", license.id);

          if (updateError) {
            results.push({
              email: license.zoom_email,
              host_id: zoomUserId,
              status: "fetch_ok_update_failed",
              error: updateError.message,
            });
          } else {
            results.push({
              email: license.zoom_email,
              host_id: zoomUserId,
              status: "updated",
            });
          }
        } else {
          const errBody = await userResp.text();
          results.push({
            email: license.zoom_email,
            host_id: null,
            status: "failed",
            error: `HTTP ${userResp.status}: ${errBody.substring(0, 200)}`,
          });
        }
      } catch (e) {
        results.push({
          email: license.zoom_email,
          host_id: null,
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
