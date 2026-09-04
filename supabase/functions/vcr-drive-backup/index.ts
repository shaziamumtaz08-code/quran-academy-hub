/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders, getCorsHeaders } from "../_shared/cors.ts";

function json(status: number, body: unknown, origin?: string | null) {
  const headers = origin ? getCorsHeaders(origin) : corsHeaders;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

const BUCKET = "vcr-call-recordings";

// --- Google service-account auth (JWT -> OAuth access token) ---

function base64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function googleAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const jwt = `${header}.${claims}.${base64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function findInDrive(token: string, folderId: string, name: string): Promise<boolean> {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return (data.files?.length ?? 0) > 0;
}

async function uploadToDrive(token: string, folderId: string, name: string, blob: Blob): Promise<string> {
  const boundary = "vcr_backup_boundary";
  const metadata = JSON.stringify({ name, parents: [folderId] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: audio/webm\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Drive upload failed: ${JSON.stringify(data)}`);
  return data.id;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: origin ? getCorsHeaders(origin) : corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, origin);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const SA_JSON = Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON") ?? "";
  const FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID") ?? "";
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "Service unavailable" }, origin);
  if (!SA_JSON || !FOLDER_ID) {
    return json(400, { error: "Google Drive backup is not configured yet. The academy needs to add its Drive service-account credentials first." }, origin);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json(401, { error: "Unauthorized" }, origin);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: uErr } = await authed.auth.getUser();
  if (uErr || !userData?.user?.id) return json(401, { error: "Invalid session" }, origin);

  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
  const isAdmin = (roles || []).some((r: any) => r.role === "admin" || r.role === "super_admin");
  if (!isAdmin) return json(403, { error: "Only admins can run the Drive backup" }, origin);

  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(SA_JSON);
  } catch {
    return json(500, { error: "Drive credentials are malformed" }, origin);
  }

  try {
    const gToken = await googleAccessToken(sa);

    const { data: recs, error: rErr } = await admin
      .from("vcr_call_recordings")
      .select("id, storage_path, started_at")
      .eq("status", "completed")
      .not("storage_path", "is", null)
      .order("started_at", { ascending: false })
      .limit(200);
    if (rErr) throw rErr;

    let uploaded = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rec of recs || []) {
      const name = `vcr-${rec.started_at.slice(0, 10)}-${rec.id}.webm`;
      try {
        if (await findInDrive(gToken, FOLDER_ID, name)) { skipped++; continue; }
        const { data: file, error: dErr } = await admin.storage.from(BUCKET).download(rec.storage_path);
        if (dErr || !file) { errors.push(`${rec.id}: download failed`); continue; }
        await uploadToDrive(gToken, FOLDER_ID, name, file);
        uploaded++;
      } catch (e: any) {
        errors.push(`${rec.id}: ${e.message}`);
      }
    }

    return json(200, { uploaded, skipped, errors }, origin);
  } catch (e: any) {
    return json(500, { error: e.message }, origin);
  }
});
