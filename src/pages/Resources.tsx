import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload, Grid3X3, List, Search, Loader2, FolderOpen, Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FileDetailPanel } from "@/components/resources/FileDetailPanel";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileItem } from "@/components/resources/FileItem";
import { UploadFileDialog } from "@/components/resources/UploadFileDialog";
import { RenameDialog } from "@/components/resources/RenameDialog";
import { cn } from "@/lib/utils";

type Resource = {
  id: string;
  title: string;
  type: string;
  url: string;
  folder_id: string | null;
  folder: string;
  sub_folder: string | null;
  created_at: string;
  updated_at: string;
  visibility?: string;
};

const EXTENSION_TO_TYPE: Record<string, string> = {
  ".pdf": "pdf", ".mp3": "audio", ".wav": "audio", ".m4a": "audio", ".ogg": "audio",
  ".mp4": "video", ".webm": "video", ".mov": "video", ".avi": "video",
  ".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image", ".webp": "image",
  ".zip": "zip", ".rar": "zip", ".7z": "zip",
};
const getFileType = (n: string) => EXTENSION_TO_TYPE["." + n.split(".").pop()?.toLowerCase()] || "file";

export default function Resources() {
  const { user, isSuperAdmin, profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<Resource | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Resource | null>(null);
  const [detailResource, setDetailResource] = useState<any>(null);

  const isAdmin = isSuperAdmin || profile?.role === "admin";
  const isTeacher = profile?.role === "teacher";
  const canManage = isAdmin;
  const canUpload = isAdmin || isTeacher;
  const activeTab = tabParam || "all";

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Resource[];
    },
  });

  const { data: assignedResources = [] } = useQuery({
    queryKey: ["my-assigned-resources", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: a } = await supabase.from("resource_assignments").select("resource_id").eq("assigned_to", user.id);
      const ids = (a || []).map((x: any) => x.resource_id);
      if (!ids.length) return [];
      const { data: res } = await supabase.from("resources").select("*").in("id", ids);
      return (res || []).map((r: any) => ({ ...r, isAssigned: true }));
    },
    enabled: !!user?.id,
  });

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const visibleResources = useMemo(() => {
    const base = activeTab === "assigned" ? assignedResources : resources;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter((r: Resource) => r.title.toLowerCase().includes(q));
  }, [activeTab, resources, assignedResources, searchQuery]);

  const uploadFilesMutation = useMutation({
    mutationFn: async ({ files, visibility }: { files: FileList; visibility: string }) => {
      const records = await Promise.all(Array.from(files).map(async (file) => {
        const ext = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = `root/${fileName}`;
        const { error } = await supabase.storage.from("resources").upload(filePath, file);
        if (error) throw error;
        return {
          title: file.name.replace(/\.[^/.]+$/, ""),
          type: getFileType(file.name),
          url: filePath,
          folder_id: null,
          folder: "Uploads",
          uploaded_by: user?.id,
          visibility,
        };
      }));
      const { error } = await supabase.from("resources").insert(records);
      if (error) throw error;
      return records.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["resources-all"] });
      toast.success(`${n} file(s) uploaded`);
    },
    onError: (e: Error) => toast.error("Upload failed: " + e.message),
  });

  const addLinkMutation = useMutation({
    mutationFn: async ({ title, url, visibility }: { title: string; url: string; visibility: string }) => {
      const { error } = await supabase.from("resources").insert({
        title, type: "link", url, folder_id: null, folder: "Links",
        uploaded_by: user?.id, visibility,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources-all"] });
      toast.success("Link added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameResourceMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("resources").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["resources-all"] }); toast.success("Renamed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (resource: Resource) => {
      if (resource.type !== "link") await supabase.storage.from("resources").remove([resource.url]);
      const { error } = await supabase.from("resources").delete().eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["resources-all"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    await deleteResourceMutation.mutateAsync(deleteItem);
    setDeleteItem(null);
    setDeleteConfirmOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 lg:-m-6 animate-fade-in">
      {/* Header */}
      <div className="px-4 lg:px-6 pt-4 pb-2 flex items-center gap-2 border-b border-border/60">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-accent" /> Resources
          </h1>
          <p className="text-xs text-muted-foreground">Shared materials available across the academy</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search…" className="pl-8 h-9 w-48" />
          </div>
          {canUpload && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" /> Upload
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 lg:px-6 border-b border-border/60 flex items-center gap-1">
        {[
          { id: "all", label: "All Resources", icon: FolderOpen, count: resources.length },
          { id: "assigned", label: "My Assigned", icon: Star, count: assignedResources.length },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5",
              activeTab === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.count > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{t.count}</Badge>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center border border-border/60 rounded-md p-0.5 my-1.5">
          <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded", viewMode === "grid" ? "bg-muted" : "")}>
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded", viewMode === "list" ? "bg-muted" : "")}>
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {visibleResources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
            <FolderOpen className="h-10 w-10 mb-2" />
            <p className="text-sm">
              {activeTab === "assigned" ? "No assigned resources yet" : "No resources available"}
            </p>
          </div>
        ) : (
          <div className={cn(
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
              : "border border-border rounded-lg divide-y divide-border bg-card",
          )}>
            {visibleResources.map((file: any) => (
              <FileItem
                key={file.id}
                resource={file}
                viewMode={viewMode}
                canManage={canManage}
                onRename={(r) => { setRenameItem(r as Resource); setRenameOpen(true); }}
                onDelete={(r) => { setDeleteItem(r as Resource); setDeleteConfirmOpen(true); }}
                onSelect={setDetailResource}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <UploadFileDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadFiles={async (files, visibility) => { await uploadFilesMutation.mutateAsync({ files, visibility }); }}
        onAddLink={async (title, url, visibility) => { await addLinkMutation.mutateAsync({ title, url, visibility }); }}
        showVisibility={canManage}
      />

      <RenameDialog
        open={renameOpen}
        onOpenChange={(o) => { setRenameOpen(o); if (!o) setRenameItem(null); }}
        currentName={renameItem?.title || ""}
        onSubmit={async (newName) => {
          if (renameItem) await renameResourceMutation.mutateAsync({ id: renameItem.id, title: newName });
          setRenameItem(null);
        }}
        itemType="file"
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {detailResource && (
        <FileDetailPanel resource={detailResource} open={!!detailResource} onOpenChange={(o) => !o && setDetailResource(null)} />
      )}
    </div>
  );
}
