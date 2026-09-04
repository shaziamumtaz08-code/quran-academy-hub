import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  addToMyResources, deleteMyResource, listMyResources, listSharedWithMe,
  listVersions, listFolders, createFolder, renameFolder, deleteFolder,
  uploadPersonalResource, renameResource, moveResource,
  type ResourceFolder, type ResourceKind, type UserResource,
} from "@/lib/myResources";
import { toast } from "sonner";

/** My Resources shelf — my own entries plus anything shared with me. */
export function useMyResources() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id;

  const mine = useQuery({
    queryKey: ["my-resources", uid],
    queryFn: () => listMyResources(uid!),
    enabled: !!uid,
  });

  const shared = useQuery({
    queryKey: ["my-resources-shared", uid],
    queryFn: () => listSharedWithMe(uid!),
    enabled: !!uid,
  });

  const folders = useQuery({
    queryKey: ["my-resource-folders", uid],
    queryFn: () => listFolders(uid!),
    enabled: !!uid,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-resource-folders"] });
    qc.invalidateQueries({ queryKey: ["my-resources"] });
    qc.invalidateQueries({ queryKey: ["my-resources-shared"] });
  };

  const add = async (
    item: { id: string; title: string; type?: string | null; description?: string | null; cover_image?: string | null },
    kind: ResourceKind
  ) => {
    if (!uid) return null;
    try {
      const row = await addToMyResources({ userId: uid, item, kind });
      toast.success(kind === "copy" ? "Added as your own working copy" : "Saved to My Resources");
      refresh();
      return row;
    } catch (e: any) {
      if (String(e?.message || "").includes("duplicate")) {
        toast.info("This is already on your shelf");
        return null;
      }
      toast.error(e?.message ?? "Could not add this");
      return null;
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMyResource(id);
      toast.success("Removed from My Resources");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove this");
    }
  };

  const upload = async (title: string, file: File, folderId?: string | null) => {
    if (!uid) return null;
    try {
      const row = await uploadPersonalResource({ userId: uid, title, file, folderId });
      toast.success("Added to My Resources");
      refresh();
      return row;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload this file");
      return null;
    }
  };

  const rename = async (id: string, title: string) => {
    try { await renameResource(id, title); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Could not rename"); }
  };

  const move = async (id: string, folderId: string | null) => {
    try { await moveResource(id, folderId); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Could not move"); }
  };

  const addFolder = async (name: string, parentId?: string | null) => {
    if (!uid) return null;
    try { const f = await createFolder(uid, name, parentId); refresh(); return f; }
    catch (e: any) { toast.error(e?.message ?? "Could not create folder"); return null; }
  };

  const editFolder = async (id: string, name: string) => {
    try { await renameFolder(id, name); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Could not rename folder"); }
  };

  const removeFolder = async (id: string) => {
    try { await deleteFolder(id); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Could not delete folder"); }
  };

  return {
    mine: (mine.data ?? []) as UserResource[],
    sharedWithMe: (shared.data ?? []) as UserResource[],
    folders: (folders.data ?? []) as ResourceFolder[],
    isLoading: mine.isLoading || shared.isLoading,
    add,
    remove,
    upload,
    rename,
    move,
    addFolder,
    editFolder,
    removeFolder,
    refresh,
  };
}

export function useResourceVersions(resourceId: string | null) {
  return useQuery({
    queryKey: ["resource-versions", resourceId],
    queryFn: () => listVersions(resourceId!),
    enabled: !!resourceId,
  });
}
