import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  addToMyResources, deleteMyResource, listMyResources, listSharedWithMe,
  listVersions, type ResourceKind, type UserResource,
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

  const refresh = () => {
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

  return {
    mine: (mine.data ?? []) as UserResource[],
    sharedWithMe: (shared.data ?? []) as UserResource[],
    isLoading: mine.isLoading || shared.isLoading,
    add,
    remove,
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
