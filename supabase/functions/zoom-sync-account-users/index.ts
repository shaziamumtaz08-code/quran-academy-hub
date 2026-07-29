// Lists every Zoom user inside the org's Zoom account (the account that owns the
// Server-to-Server OAuth app) and auto-maps them to LMS teachers by email,
// backfilling zoom_accounts.zoom_user_id / meeting_link / tier.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const norm = (e?: string | null) => (e || "").trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: any) =>
      ["super_admin", "admin"].includes(r.role) || String(r.role).startsWith("admin_")
    );
    if (!allowed) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({} as any));
    const apply: boolean = body?.apply !== false; // default: write mappings

    // ---- Resolve S2S credentials (env first, then any stored account creds)
    let accountId = body?.account_id || Deno.env.get("ZOOM_ACCOUNT_ID");
    let clientId = body?.client_id || Deno.env.get("ZOOM_CLIENT_ID");
    let clientSecret = body?.client_secret || Deno.env.get("ZOOM_CLIENT_SECRET");

    if (!accountId || !clientId || !clientSecret) {
      const { data: credRow } = await admin
        .from("zoom_accounts")
        .select("zoom_account_id_cred, zoom_client_id, zoom_client_secret")
        .not("zoom_account_id_cred", "is", null)
        .not("zoom_client_secret", "is", null)
        .order("last_validated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      accountId = accountId || credRow?.zoom_account_id_cred;
      clientId = clientId || credRow?.zoom_client_id;
      clientSecret = clientSecret || credRow?.zoom_client_secret;
    }

    if (!accountId || !clientId || !clientSecret) {
      return json({ error: "Zoom S2S credentials are not configured. Link one account first or set ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET." }, 400);
    }

    // ---- Mint token
    const tokenResp = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      { method: "POST", headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` } }
    );
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      return json({ error: "Zoom rejected credentials", status: tokenResp.status, details: tokenData }, 400);
    }
    const accessToken = tokenData.access_token as string;

    // ---- List all users in the Zoom account (paginated)
    const zoomUsers: any[] = [];
    for (const status of ["active", "pending"]) {
      let nextToken = "";
      do {
        const url = `https://api.zoom.us/v2/users?page_size=300&status=${status}${nextToken ? `&next_page_token=${nextToken}` : ""}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const b = await resp.json();
        if (!resp.ok) {
          return json({
            error: "Failed to list Zoom users",
            status: resp.status,
            details: b,
            hint: "Add scope user:read:list_users:admin (Granular) or user:read:admin (Classic) to the S2S app and reactivate it.",
          }, resp.status);
        }
        for (const u of b.users || []) zoomUsers.push({ ...u, account_status: status });
        nextToken = b.next_page_token || "";
      } while (nextToken);
    }

    // ---- Load teachers + existing zoom_accounts
    const { data: teacherRoles } = await admin
      .from("user_roles")
      .select("user_id, profile:profiles!user_roles_user_id_fkey(id, full_name, email)")
      .eq("role", "teacher");
    const teachers = new Map<string, any>();
    for (const r of (teacherRoles || []) as any[]) {
      const p = r.profile;
      if (p?.email) teachers.set(norm(p.email), p);
    }

    const { data: existing } = await admin
      .from("zoom_accounts")
      .select("id, teacher_id, zoom_account_email, zoom_user_id, tier, meeting_link");
    const existingByEmail = new Map<string, any>();
    for (const a of (existing || []) as any[]) existingByEmail.set(norm(a.zoom_account_email), a);

    const mapped: any[] = [];
    const unmatchedZoomUsers: any[] = [];

    for (const zu of zoomUsers) {
      const email = norm(zu.email);
      const teacher = teachers.get(email);
      const tier: "free" | "licensed" = zu.type === 2 ? "licensed" : "free";
      const row = existingByEmail.get(email);

      if (!teacher && !row) {
        unmatchedZoomUsers.push({
          email: zu.email,
          name: [zu.first_name, zu.last_name].filter(Boolean).join(" "),
          host_id: zu.id,
          tier,
          status: zu.account_status,
        });
        continue;
      }

      const teacherId = row?.teacher_id || teacher?.id;
      const payload: any = {
        teacher_id: teacherId,
        zoom_account_email: zu.email,
        zoom_user_id: zu.id,
        tier,
        meeting_link: row?.meeting_link || zu.personal_meeting_url || null,
        is_active: true,
        last_validated_at: new Date().toISOString(),
      };

      let action = row ? (row.zoom_user_id === zu.id ? "already_mapped" : "updated") : "created";

      if (apply && action !== "already_mapped") {
        if (row) {
          const { error } = await admin.from("zoom_accounts").update(payload).eq("id", row.id);
          if (error) action = `update_failed: ${error.message}`;
        } else {
          const { error } = await admin
            .from("zoom_accounts")
            .upsert(payload, { onConflict: "teacher_id,tier" });
          if (error) action = `create_failed: ${error.message}`;
        }
      }

      mapped.push({
        email: zu.email,
        host_id: zu.id,
        tier,
        teacher: teacher?.full_name || null,
        teacher_id: teacherId,
        action,
      });
    }

    // Teachers with no Zoom user in the org account
    const mappedEmails = new Set(mapped.map((m) => norm(m.email)));
    const teachersWithoutZoom = [...teachers.values()]
      .filter((t) => !mappedEmails.has(norm(t.email)))
      .map((t) => ({ id: t.id, full_name: t.full_name, email: t.email }));

    return json({
      success: true,
      applied: apply,
      zoom_user_count: zoomUsers.length,
      summary: {
        created: mapped.filter((m) => m.action === "created").length,
        updated: mapped.filter((m) => m.action === "updated").length,
        already_mapped: mapped.filter((m) => m.action === "already_mapped").length,
        failed: mapped.filter((m) => String(m.action).includes("failed")).length,
      },
      mapped,
      unmatched_zoom_users: unmatchedZoomUsers,
      teachers_without_zoom: teachersWithoutZoom,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
