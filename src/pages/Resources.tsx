import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDivision } from "@/contexts/DivisionContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import {
  FolderPlus, Upload, Grid3X3, List, Search, Loader2, FolderOpen,
  Star, ChevronRight, ChevronDown, Folder as FolderIcon, MoreVertical,
  Pencil, Trash2, Settings2, Menu,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FileDetailPanel } from "@/components/resources/FileDetailPanel";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileItem } from "@/components/resources/FileItem";
import { UploadFileDialog } from "@/components/resources/UploadFileDialog";
import { RenameDialog } from "@/components/resources/RenameDialog";
import { FolderAccessDialog, ACCESS_META, type FolderAccess } from "@/components/resources/FolderAccessDialog";
import { cn } from "@/lib/utils";

type Folder = {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  visibility?: string;
  visible_to_roles?: string[];
  visible_to_user_ids?: string[];
  division_id?: string | null;
  is_system?: boolean;
  source_type?: string | null;
};

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

function FolderTreeNode({
  folder, allFolders, depth, currentId, onSelect,
}: {
  folder: Folder; allFolders: Folder[]; depth: number;
  currentId: string | null; onSelect: (id: string | null) => void;
}) {
  const children = allFolders.filter((f) => f.parent_id === folder.id);
  const [open, setOpen] = useState(depth < 1);
  const isActive = currentId === folder.id;
  const access = (folder.visibility as FolderAccess) || "all";
  const meta = ACCESS_META[access] || ACCESS_META.all;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1.5 pr-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
          isActive ? "bg-white/10 text-white border-l-2 border-accent" : "text-white/70 hover:bg-white/5 hover:text-white border-l-2 border-transparent",
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {children.length > 0 ? (
          <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} className="p-0.5 hover:bg-white/10 rounded">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <FolderIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate flex-1">{folder.name}</span>
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", meta.dot)} />
      </div>
      {open && children.map((c) => (
        <FolderTreeNode key={c.id} folder={c} allFolders={allFolders} depth={depth + 1} currentId={currentId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function FolderTree({
  folders, currentId, onSelect, divisionLabel,
}: {
  folders: Folder[]; currentId: string | null;
  onSelect: (id: string | null) => void; divisionLabel: string;
}) {
  const roots = folders.filter((f) => !f.parent_id);
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/10">
        <p className="text-[10px] uppercase tracking-wider text-white/40">Division</p>
        <p className="text-sm font-semibold text-white truncate">{divisionLabel}</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-1.5">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors",
            currentId === null ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
          )}
        >
          All folders
        </button>
        <div className="mt-1 space-y-0.5">
          {roots.map((r) => (
            <FolderTreeNode key={r.id} folder={r} allFolders={folders} depth={0} currentId={currentId} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Resources() {
  const { user, isSuperAdmin, profile } = useAuth();
  const { activeDivision } = useDivision();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentFolderId = searchParams.get("folder") || null;
  const tabParam = searchParams.get("tab");
  const divisionId = activeDivision?.id || null;

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<{ type: "file"; item: Resource } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ type: "folder" | "file"; item: Folder | Resource } | null>(null);
  const [detailResource, setDetailResource] = useState<any>(null);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  const isAdmin = isSuperAdmin || profile?.role === "admin";
  const isTeacher = profile?.role === "teacher";
  const canManage = isAdmin;
  const canUploadHere = isAdmin || isTeacher;
  const activeTab = tabParam || (canManage ? "browse" : "assigned");

  // Folders scoped by division
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["folders", divisionId],
    queryFn: async () => {
      let q = supabase.from("folders").select("*").is("deleted_at" as any, null).order("name");
      if (divisionId) q = q.or(`division_id.eq.${divisionId},division_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Folder[];
    },
  });

  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("resources").select("*").order("title");
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
    enabled: !!user?.id && activeTab === "assigned",
  });

  const isLoading = foldersLoading || resourcesLoading;

  const folderPath = useMemo(() => {
    if (!currentFolderId) return [] as Folder[];
    const path: Folder[] = [];
    let cur = folders.find((f) => f.id === currentFolderId);
    while (cur) { path.unshift(cur); cur = folders.find((f) => f.id === cur?.parent_id); }
    return path;
  }, [currentFolderId, folders]);

  const currentFolder = useMemo(() => folders.find((f) => f.id === currentFolderId) || null, [currentFolderId, folders]);

  const currentFolders = useMemo(() => {
    let r = folders.filter((f) => f.parent_id === currentFolderId);
    if (searchQuery.trim()) r = r.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return r;
  }, [folders, currentFolderId, searchQuery]);

  const currentFiles = useMemo(() => {
    let r = resources.filter((rr) => rr.folder_id === currentFolderId);
    if (searchQuery.trim()) r = r.filter((rr) => rr.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return r;
  }, [resources, currentFolderId, searchQuery]);

  const folderItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of folders) {
      const sub = folders.filter((x) => x.parent_id === f.id).length;
      const files = resources.filter((r) => r.folder_id === f.id).length;
      counts[f.id] = sub + files;
    }
    return counts;
  }, [folders, resources]);

  const navigateToFolder = useCallback(
    (folderId: string | null) => {
      const next: Record<string, string> = {};
      if (folderId) next.folder = folderId;
      if (tabParam) next.tab = tabParam;
      setSearchParams(next);
      setSearchQuery("");
    },
    [setSearchParams, tabParam],
  );

  const setActiveTab = (tab: string) => {
    const params: Record<string, string> = { tab };
    if (tab === "browse" && currentFolderId) params.folder = currentFolderId;
    setSearchParams(params);
  };

  // Mutations
  const saveFolderMutation = useMutation({
    mutationFn: async (v: { id?: string; name: string; visibility: FolderAccess; visible_to_user_ids: string[] }) => {
      if (v.id) {
        const { error } = await supabase.from("folders").update({
          name: v.name, visibility: v.visibility, visible_to_user_ids: v.visible_to_user_ids,
        }).eq("id", v.id);
        if (error) throw error;
      } else {
        // Teachers cannot create root folders
        if (!isAdmin && !currentFolderId) throw new Error("Only admins can create root folders");
        const { error } = await supabase.from("folders").insert({
          name: v.name,
          parent_id: currentFolderId,
          created_by: user?.id,
          visibility: v.visibility,
          visible_to_user_ids: v.visible_to_user_ids,
          division_id: divisionId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadFilesMutation = useMutation({
    mutationFn: async ({ files, visibility }: { files: FileList; visibility: string }) => {
      const records = await Promise.all(Array.from(files).map(async (file) => {
        const ext = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const folderPath = currentFolderId || "root";
        const filePath = `${folderPath}/${fileName}`;
        const { error } = await supabase.storage.from("resources").upload(filePath, file);
        if (error) throw error;
        return {
          title: file.name.replace(/\.[^/.]+$/, ""),
          type: getFileType(file.name),
          url: filePath,
          folder_id: currentFolderId,
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
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success(`${n} file(s) uploaded`);
    },
    onError: (e: Error) => toast.error("Upload failed: " + e.message),
  });

  const addLinkMutation = useMutation({
    mutationFn: async ({ title, url, visibility }: { title: string; url: string; visibility: string }) => {
      const { error } = await supabase.from("resources").insert({
        title, type: "link", url, folder_id: currentFolderId, folder: "Links",
        uploaded_by: user?.id, visibility,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Link added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameResourceMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("resources").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["resources"] }); toast.success("Renamed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["folders"] }); toast.success("Folder deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (resource: Resource) => {
      if (resource.type !== "link") await supabase.storage.from("resources").remove([resource.url]);
      const { error } = await supabase.from("resources").delete().eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["resources"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    if (deleteItem.type === "folder") await deleteFolderMutation.mutateAsync(deleteItem.item.id);
    else await deleteResourceMutation.mutateAsync(deleteItem.item as Resource);
    setDeleteItem(null);
    setDeleteConfirmOpen(false);
  };

  const divisionLabel = activeDivision?.name || "All Divisions";

  // Sidebar (left tree)
  const TreePanel = (
    <div className="h-full bg-lms-navy text-white">
      <FolderTree folders={folders} currentId={currentFolderId} onSelect={navigateToFolder} divisionLabel={divisionLabel} />
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-4 lg:-m-6 animate-fade-in">
      {/* Desktop tree */}
      <aside className="hidden md:flex w-[220px] shrink-0 border-r border-border">{TreePanel}</aside>

      {/* Mobile tree */}
      <Sheet open={mobileTreeOpen} onOpenChange={setMobileTreeOpen}>
        <SheetContent side="left" className="w-[260px] p-0 bg-lms-navy border-0">
          <SheetHeader className="sr-only"><SheetTitle>Folders</SheetTitle></SheetHeader>
          {TreePanel}
        </SheetContent>
      </Sheet>

      {/* Right content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top row */}
        <div className="px-4 lg:px-6 pt-4 pb-2 flex items-center gap-2 border-b border-border/60">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileTreeOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <nav className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <button onClick={() => navigateToFolder(null)} className="hover:text-foreground">Resources</button>
              {folderPath.map((f) => (
                <span key={f.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <button onClick={() => navigateToFolder(f.id)} className="hover:text-foreground truncate">{f.name}</button>
                </span>
              ))}
            </nav>
            {currentFolder && (
              <h1 className="text-lg font-semibold text-foreground mt-0.5 truncate">{currentFolder.name}</h1>
            )}
            {!currentFolder && <h1 className="text-lg font-semibold text-foreground mt-0.5">All folders</h1>}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search…" className="pl-8 h-9 w-48" />
            </div>
            {canUploadHere && currentFolderId && (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-1.5" /> Upload
              </Button>
            )}
            {(canManage || (isTeacher && currentFolderId)) && (
              <Button size="sm" variant="outline" onClick={() => { setEditFolder(null); setFolderDialogOpen(true); }}>
                <FolderPlus className="h-4 w-4 mr-1.5" /> New Folder
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 lg:px-6 border-b border-border/60 flex items-center gap-1">
          {[
            { id: "browse", label: "All Files", icon: FolderOpen },
            { id: "assigned", label: "My Assigned", icon: Star },
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
              {t.id === "assigned" && assignedResources.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{assignedResources.length}</Badge>
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
          {activeTab === "browse" && (
            <>
              {currentFolders.length === 0 && currentFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mb-2" />
                  <p className="text-sm">This folder is empty</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {currentFolders.length > 0 && (
                    <div>
                      <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                        Folders · {currentFolders.length}
                      </h3>
                      <div className={cn(
                        viewMode === "grid"
                          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                          : "space-y-1",
                      )}>
                        {currentFolders.map((f) => {
                          const access = (f.visibility as FolderAccess) || "all";
                          const meta = ACCESS_META[access] || ACCESS_META.all;
                          const count = folderItemCounts[f.id] ?? 0;
                          return (
                            <div
                              key={f.id}
                              onClick={() => navigateToFolder(f.id)}
                              className={cn(
                                "group relative flex items-center gap-3 bg-card border border-border rounded-lg cursor-pointer hover:shadow-sm hover:border-accent/40 transition-all overflow-hidden",
                                viewMode === "grid" ? "p-4" : "p-3",
                              )}
                            >
                              <span className={cn("absolute left-0 top-0 bottom-0 w-1", meta.stripe)} />
                              <div className="pl-1.5 flex items-center gap-3 flex-1 min-w-0">
                                <FolderIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-foreground truncate">{f.name}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {count} {count === 1 ? "item" : "items"} · {meta.label}
                                  </p>
                                </div>
                              </div>
                              {canManage && !f.is_system && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <button className="p-1 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                      <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditFolder(f); setFolderDialogOpen(true); }}>
                                      <Settings2 className="h-4 w-4 mr-2" /> Edit & Access
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={(e) => { e.stopPropagation(); setDeleteItem({ type: "folder", item: f }); setDeleteConfirmOpen(true); }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {currentFiles.length > 0 && (
                    <div>
                      <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                        Files · {currentFiles.length}
                      </h3>
                      <div className={cn(
                        viewMode === "grid"
                          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                          : "border border-border rounded-lg divide-y divide-border bg-card",
                      )}>
                        {currentFiles.map((file) => (
                          <FileItem
                            key={file.id}
                            resource={file}
                            viewMode={viewMode}
                            canManage={canManage}
                            onRename={(r) => { setRenameItem({ type: "file", item: r as Resource }); setRenameOpen(true); }}
                            onDelete={(r) => { setDeleteItem({ type: "file", item: r as Resource }); setDeleteConfirmOpen(true); }}
                            onSelect={setDetailResource}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "assigned" && (
            <div>
              {assignedResources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                  <Star className="h-10 w-10 mb-2" />
                  <p className="text-sm">No assigned resources yet</p>
                </div>
              ) : (
                <div className="border border-border rounded-lg divide-y divide-border bg-card">
                  {assignedResources.map((file: any) => (
                    <FileItem
                      key={file.id}
                      resource={file}
                      viewMode="list"
                      canManage={false}
                      onRename={() => {}}
                      onDelete={() => {}}
                      onSelect={setDetailResource}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <FolderAccessDialog
        open={folderDialogOpen}
        onOpenChange={(o) => { setFolderDialogOpen(o); if (!o) setEditFolder(null); }}
        title={editFolder ? "Edit Folder" : "New Folder"}
        initial={editFolder ? {
          name: editFolder.name,
          visibility: (editFolder.visibility as FolderAccess) || "all",
          visible_to_user_ids: editFolder.visible_to_user_ids || [],
        } : undefined}
        onSubmit={async (v) => {
          await saveFolderMutation.mutateAsync({ id: editFolder?.id, ...v });
        }}
      />

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
        currentName={renameItem ? (renameItem.item as Resource).title : ""}
        onSubmit={async (newName) => {
          if (renameItem) await renameResourceMutation.mutateAsync({ id: renameItem.item.id, title: newName });
          setRenameItem(null);
        }}
        itemType="file"
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteItem?.type}?</AlertDialogTitle>
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
