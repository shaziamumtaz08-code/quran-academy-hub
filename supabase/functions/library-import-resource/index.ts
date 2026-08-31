import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TYPE_MAP: Record<string, string> = {
  pdf: "ebook", epub: "ebook", mobi: "ebook",
  doc: "document", docx: "document", txt: "document", rtf: "document",
  ppt: "presentation", pptx: "presentation",
  xls: "spreadsheet", xlsx: "spreadsheet", csv: "spreadsheet",
  mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio",
  mp4: "video", mov: "video", webm: "video", mkv: "video",
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", svg: "image",
  zip: "archive", rar: "archive",
};

function inferType(name: string, assetType?: string | null): string {
  const ext = (name.split("?")[0].split(".").pop() || "").toLowerCase();
  if (TYPE_MAP[ext]) return TYPE_MAP[ext];
  if (assetType === "video") return "video";
  if (assetType === "audio") return "audio";
  if (assetType === "image") return "image";
  if (assetType === "link") return "link";
  if (assetType === "pdf") return "ebook";
  return "document";
}

/** Extract the object path inside the course-materials bucket from a storage URL. */
function storagePathFromUrl(url: string): string | null {
  const marker = "/course-materials/";
  const i = url.indexOf(marker);
  if (i === -1) return null;
  try {
    return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  } catch {
    return url.slice(i + marker.length).split("?")[0];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json(401, { error: "Missing authorization" });

    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: uErr } = await authed.auth.getUser();
    const caller = userData?.user;
    if (uErr || !caller) return json(401, { error: "Invalid session" });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => null);
    const assetIds: string[] = Array.isArray(body?.assetIds)
      ? body.assetIds.map((x: unknown) => String(x)).filter(Boolean)
      : [];
    if (assetIds.length === 0) return json(400, { error: "assetIds is required" });
    if (assetIds.length > 100) return json(400, { error: "Too many items (max 100)" });

    const categoryId = body?.categoryId ? String(body.categoryId) : null;
    if (!categoryId) return json(400, { error: "categoryId is required" });
    const visibility = ["all", "students", "parents", "teachers", "admins"].includes(String(body?.visibility))
      ? String(body.visibility)
      : "all";
    const status = String(body?.status) === "draft" ? "draft" : "published";
    const allowDownloads = body?.allowDownloads !== false;

    // Authorization: platform admin, or owner/teacher of every course involved
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", caller.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = ["super_admin", "admin", "admin_division", "admin_academic"].some((r) => roleSet.has(r));

    const { data: assets, error: aErr } = await admin
      .from("course_library_assets")
      .select("id, title, asset_type, content_url, course_id, owner_id")
      .in("id", assetIds);
    if (aErr) return json(500, { error: aErr.message });
    if (!assets || assets.length === 0) return json(404, { error: "No matching resources" });

    if (!isAdmin) {
      const courseIds = [...new Set(assets.map((a: any) => a.course_id).filter(Boolean))];
      const { data: courses } = await admin
        .from("courses").select("id, teacher_id").in("id", courseIds);
      const owned = new Set((courses ?? []).filter((c: any) => c.teacher_id === caller.id).map((c: any) => c.id));
      const allowed = assets.every((a: any) => a.owner_id === caller.id || (a.course_id && owned.has(a.course_id)));
      if (!allowed) return json(403, { error: "Forbidden" });
    }

    // Already-imported guard
    const { data: existing } = await admin
      .from("library_items").select("id, source_asset_id").in("source_asset_id", assetIds);
    const existingMap = new Map((existing ?? []).map((r: any) => [r.source_asset_id, r.id]));

    const results: Array<{ assetId: string; title: string; ok: boolean; skipped?: boolean; error?: string }> = [];

    for (const asset of assets as any[]) {
      const title = asset.title || "Untitled";
      try {
        if (existingMap.has(asset.id)) {
          results.push({ assetId: asset.id, title, ok: true, skipped: true });
          continue;
        }
        if (!asset.content_url) {
          results.push({ assetId: asset.id, title, ok: false, error: "No file or link on this resource" });
          continue;
        }

        const srcPath = storagePathFromUrl(asset.content_url);
        let file_path: string | null = null;
        let url: string | null = null;
        let file_size_bytes: number | null = null;
        let type: string;

        if (srcPath) {
          const { data: blob, error: dErr } = await admin.storage.from("course-materials").download(srcPath);
          if (dErr || !blob) throw new Error(dErr?.message || "Could not read the source file");
          const baseName = srcPath.split("/").pop() || "file";
          const ext = baseName.includes(".") ? baseName.split(".").pop() : "bin";
          const destName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          file_path = `library/${destName}`;
          const buf = new Uint8Array(await blob.arrayBuffer());
          const { error: upErr } = await admin.storage.from("resources").upload(file_path, buf, {
            contentType: (blob as any).type || "application/octet-stream",
            upsert: false,
          });
          if (upErr) throw new Error(upErr.message);
          file_size_bytes = buf.byteLength;
          type = inferType(baseName, asset.asset_type);
        } else {
          url = asset.content_url;
          type = asset.asset_type === "link" ? "link" : inferType(asset.content_url, asset.asset_type);
        }

        const { error: insErr } = await admin.from("library_items").insert({
          title,
          category_id: categoryId,
          type,
          file_path,
          url,
          file_size_bytes,
          status,
          visibility,
          allow_downloads: allowDownloads,
          language: "English",
          tags: [],
          uploaded_by: caller.id,
          source_asset_id: asset.id,
        } as any);
        if (insErr) throw new Error(insErr.message);

        results.push({ assetId: asset.id, title, ok: true });
      } catch (e: any) {
        console.error(`Import failed for ${asset.id}:`, e?.message || e);
        results.push({ assetId: asset.id, title, ok: false, error: e?.message || "Import failed" });
      }
    }

    return json(200, {
      added: results.filter((r) => r.ok && !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (e: any) {
    console.error("library-import-resource error:", e?.message || e);
    return json(500, { error: e?.message || "Unexpected error" });
  }
});
