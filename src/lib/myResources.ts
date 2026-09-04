import { supabase } from "@/integrations/supabase/client";

/**
 * My Resources — the personal shelf that sits beside the canonical Library.
 *
 * A shelf entry is either:
 *  - `reference` → a pointer at a canonical Library item. Nothing about the
 *    original is ever changed.
 *  - `copy`      → the user's own working copy. It still *points* at the
 *    canonical file (no byte duplication) but owns its annotations and its
 *    version history. A saved version may carry its own file once a flattened
 *    artifact is produced.
 */

export type ResourceKind = "reference" | "copy";

export interface UserResource {
  id: string;
  user_id: string;
  source_item_id: string | null;
  kind: ResourceKind;
  title: string;
  description: string | null;
  type: string | null;
  cover_image: string | null;
  file_path: string | null;
  current_version: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ResourceVersion {
  id: string;
  resource_id: string;
  version_no: number;
  file_path: string | null;
  note: string | null;
  snapshot: Record<string, any>;
  created_by: string;
  created_at: string;
}

export interface ResourceShare {
  id: string;
  resource_id: string;
  shared_with: string;
  shared_by: string;
  can_edit: boolean;
  note: string | null;
  created_at: string;
}

const t = (name: string) => (supabase.from(name as any) as any);

/** Everything on my own shelf. */
export async function listMyResources(userId: string): Promise<UserResource[]> {
  const { data, error } = await t("user_resources")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserResource[];
}

/** Personal resources other people shared with me. */
export async function listSharedWithMe(userId: string): Promise<UserResource[]> {
  const { data, error } = await t("user_resource_shares")
    .select("can_edit, resource:user_resources(*)")
    .eq("shared_with", userId);
  if (error) throw error;
  return ((data ?? []) as any[])
    .map((r) => r.resource)
    .filter(Boolean) as UserResource[];
}

/** Save a Library item onto my shelf. */
export async function addToMyResources(opts: {
  userId: string;
  item: { id: string; title: string; type?: string | null; description?: string | null; cover_image?: string | null };
  kind: ResourceKind;
}): Promise<UserResource> {
  const { userId, item, kind } = opts;
  const payload = {
    user_id: userId,
    source_item_id: item.id,
    kind,
    title: kind === "copy" ? `${item.title} (my copy)` : item.title,
    description: item.description ?? null,
    type: item.type ?? null,
    cover_image: item.cover_image ?? null,
  };
  const { data, error } = await t("user_resources").insert(payload).select("*").single();
  if (error) throw error;
  return data as UserResource;
}

export async function deleteMyResource(id: string) {
  const { error } = await t("user_resources").delete().eq("id", id);
  if (error) throw error;
}

export async function getResource(id: string): Promise<UserResource | null> {
  const { data, error } = await t("user_resources").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as UserResource) ?? null;
}

/* ── Annotations ──────────────────────────────────────────────────────── */

export async function getAnnotations(resourceId: string, page: number): Promise<any[]> {
  const { data, error } = await t("user_resource_annotations")
    .select("data")
    .eq("resource_id", resourceId)
    .eq("page", page)
    .maybeSingle();
  if (error) throw error;
  return ((data as any)?.data?.strokes ?? []) as any[];
}

export async function getAllAnnotations(resourceId: string): Promise<Record<string, any[]>> {
  const { data, error } = await t("user_resource_annotations")
    .select("page, data")
    .eq("resource_id", resourceId);
  if (error) throw error;
  const out: Record<string, any[]> = {};
  for (const row of (data ?? []) as any[]) out[String(row.page)] = row.data?.strokes ?? [];
  return out;
}

export async function saveAnnotations(opts: {
  resourceId: string;
  page: number;
  strokes: any[];
  userId: string;
}) {
  const { error } = await t("user_resource_annotations").upsert(
    {
      resource_id: opts.resourceId,
      page: opts.page,
      data: { strokes: opts.strokes },
      updated_by: opts.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "resource_id,page" }
  );
  if (error) throw error;
}

/* ── Versions ─────────────────────────────────────────────────────────── */

export async function listVersions(resourceId: string): Promise<ResourceVersion[]> {
  const { data, error } = await t("user_resource_versions")
    .select("*")
    .eq("resource_id", resourceId)
    .order("version_no", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ResourceVersion[];
}

/**
 * Freeze the current annotations as a numbered version. The canonical Library
 * file is untouched — only the personal working copy gains a version.
 */
export async function saveVersion(opts: {
  resourceId: string;
  userId: string;
  note?: string | null;
  filePath?: string | null;
}): Promise<ResourceVersion> {
  const resource = await getResource(opts.resourceId);
  if (!resource) throw new Error("Resource not found");
  const snapshot = await getAllAnnotations(opts.resourceId);
  const nextNo = (resource.current_version ?? 0) + 1;

  const { data, error } = await t("user_resource_versions")
    .insert({
      resource_id: opts.resourceId,
      version_no: nextNo,
      file_path: opts.filePath ?? null,
      note: opts.note ?? null,
      snapshot: { pages: snapshot },
      created_by: opts.userId,
    })
    .select("*")
    .single();
  if (error) throw error;

  await t("user_resources").update({ current_version: nextNo }).eq("id", opts.resourceId);
  return data as ResourceVersion;
}

/** Put a saved version's marks back onto the working copy. */
export async function restoreVersion(version: ResourceVersion, userId: string) {
  const pages = (version.snapshot as any)?.pages ?? {};
  const rows = Object.entries(pages).map(([page, strokes]) => ({
    resource_id: version.resource_id,
    page: Number(page),
    data: { strokes },
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await t("user_resource_annotations").upsert(rows, { onConflict: "resource_id,page" });
  if (error) throw error;
}

/* ── Sharing ──────────────────────────────────────────────────────────── */

export async function listShares(resourceId: string): Promise<ResourceShare[]> {
  const { data, error } = await t("user_resource_shares").select("*").eq("resource_id", resourceId);
  if (error) throw error;
  return (data ?? []) as ResourceShare[];
}

export async function shareResource(opts: {
  resourceId: string;
  sharedWith: string;
  sharedBy: string;
  canEdit?: boolean;
  note?: string | null;
}) {
  const { error } = await t("user_resource_shares").upsert(
    {
      resource_id: opts.resourceId,
      shared_with: opts.sharedWith,
      shared_by: opts.sharedBy,
      can_edit: !!opts.canEdit,
      note: opts.note ?? null,
    },
    { onConflict: "resource_id,shared_with" }
  );
  if (error) throw error;
}

export async function unshareResource(resourceId: string, sharedWith: string) {
  const { error } = await t("user_resource_shares")
    .delete()
    .eq("resource_id", resourceId)
    .eq("shared_with", sharedWith);
  if (error) throw error;
}

/** Resolve the file behind a shelf entry: its own artifact, else the canonical one. */
export async function resolveResourceFile(resource: UserResource): Promise<{
  itemId: string | null;
  file_path: string | null;
  url: string | null;
  type: string | null;
  pages_count: number | null;
  title: string;
}> {
  if (resource.file_path) {
    return {
      itemId: resource.source_item_id,
      file_path: resource.file_path,
      url: null,
      type: resource.type,
      pages_count: null,
      title: resource.title,
    };
  }
  if (!resource.source_item_id) {
    return { itemId: null, file_path: null, url: null, type: resource.type, pages_count: null, title: resource.title };
  }
  const { data } = await t("library_items")
    .select("id, title, file_path, url, type, pages_count")
    .eq("id", resource.source_item_id)
    .maybeSingle();
  const row = (data as any) ?? {};
  return {
    itemId: row.id ?? resource.source_item_id,
    file_path: row.file_path ?? null,
    url: row.url ?? null,
    type: row.type ?? resource.type,
    pages_count: row.pages_count ?? null,
    title: resource.title || row.title,
  };
}

/* ── Personal folders ─────────────────────────────────────────────────── */

export interface ResourceFolder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function listFolders(userId: string): Promise<ResourceFolder[]> {
  const { data, error } = await t("user_resource_folders")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ResourceFolder[];
}

export async function createFolder(userId: string, name: string, parentId?: string | null) {
  const { data, error } = await t("user_resource_folders")
    .insert({ user_id: userId, name, parent_id: parentId ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as ResourceFolder;
}

export async function renameFolder(id: string, name: string) {
  const { error } = await t("user_resource_folders").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string) {
  const { error } = await t("user_resource_folders").delete().eq("id", id);
  if (error) throw error;
}

/* ── Personal uploads (name + file only) ──────────────────────────────── */

const guessType = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(ext)) return "image";
  if (["mp3", "wav", "m4a", "ogg"].includes(ext)) return "audio";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  return "file";
};

/**
 * Upload a personal file into My Resources. Only a name and the file are
 * required — no Library metadata (category, book credentials, …) applies here.
 */
export async function uploadPersonalResource(opts: {
  userId: string;
  title: string;
  file: File;
  folderId?: string | null;
}): Promise<UserResource> {
  const safe = opts.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `personal/${opts.userId}/${crypto.randomUUID()}-${safe}`;
  const up = await supabase.storage.from("resources").upload(path, opts.file, {
    contentType: opts.file.type || undefined,
  });
  if (up.error) throw up.error;

  const { data, error } = await t("user_resources")
    .insert({
      user_id: opts.userId,
      source_item_id: null,
      kind: "copy",
      origin: "own",
      title: opts.title.trim() || opts.file.name,
      type: guessType(opts.file.name),
      file_path: path,
      folder_id: opts.folderId ?? null,
      metadata: { original_file_name: opts.file.name, size: opts.file.size },
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as UserResource;
}

export async function renameResource(id: string, title: string) {
  const { error } = await t("user_resources").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function moveResource(id: string, folderId: string | null) {
  const { error } = await t("user_resources").update({ folder_id: folderId }).eq("id", id);
  if (error) throw error;
}

/**
 * Put a copy of an entry onto someone else's shelf (a student, usually) while
 * keeping provenance: who sent it and what it came from. Nothing is duplicated
 * in storage — the recipient's entry points at the same file/Library original.
 */
export async function sendToUserShelf(opts: {
  resource: UserResource;
  recipientId: string;
  senderId: string;
  asCopy?: boolean;
}): Promise<void> {
  const { resource, recipientId, senderId } = opts;
  const { error } = await t("user_resources").insert({
    user_id: recipientId,
    source_item_id: resource.source_item_id,
    kind: opts.asCopy ? "copy" : "reference",
    origin: "shared",
    received_from: senderId,
    title: resource.title,
    description: resource.description,
    type: resource.type,
    cover_image: resource.cover_image,
    file_path: resource.file_path,
    metadata: { shared_from_resource_id: resource.id },
  });
  if (error && !String(error.message || "").includes("duplicate")) throw error;
}

/** Put a canonical Library item straight onto someone's shelf as a reference. */
export async function sendLibraryItemToUser(opts: {
  item: { id: string; title: string; type?: string | null; description?: string | null; cover_image?: string | null };
  recipientId: string;
  senderId: string;
}) {
  const { error } = await t("user_resources").insert({
    user_id: opts.recipientId,
    source_item_id: opts.item.id,
    kind: "reference",
    origin: "shared",
    received_from: opts.senderId,
    title: opts.item.title,
    description: opts.item.description ?? null,
    type: opts.item.type ?? null,
    cover_image: opts.item.cover_image ?? null,
  });
  if (error && !String(error.message || "").includes("duplicate")) throw error;
}
