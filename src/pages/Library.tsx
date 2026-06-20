import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Grid3X3, List, Search, Loader2, Library as LibraryIcon,
  Pin, PinOff, Plus, FolderOpen, BookOpen, FileText, Music, Video, Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FileItem } from "@/components/resources/FileItem";
import { UploadFileDialog } from "@/components/resources/UploadFileDialog";
import { RenameDialog } from "@/components/resources/RenameDialog";
import { FileDetailPanel } from "@/components/resources/FileDetailPanel";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  visibility_default: string;
  sort_order: number;
};

type LibraryItem = {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  type: string;
  url: string | null;
  file_path: string | null;
  thumbnail: string | null;
  tags: string[];
  visibility: string;
  visible_to_roles: string[];
  uploaded_by: string | null;
  is_pinned: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

const ICON_MAP: Record<string, any> = {
  FolderOpen, BookOpen, FileText, Music, Video, Link: LinkIcon,
};

const EXT_TO_TYPE: Record<string, string> = {
  pdf: "pdf", mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio",
  mp4: "video", webm: "video", mov: "video",
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  zip: "zip", rar: "zip",
};
const getType = (n: string) => EXT_TO_TYPE[n.split(".").pop()?.toLowerCase() || ""] || "file";

export default function Library() {
  const { user, isSuperAdmin, profile } = useAuth();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<LibraryItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<LibraryItem | null>(null);
  const [detailResource, setDetailResource] = useState<any>(null);

  const isAdmin = isSuperAdmin || profile?.role === "admin";
  const isTeacher = profile?.role === "teacher";
  const canUpload = isAdmin || isTeacher;

  const { data: categories = [] } = useQuery({
    queryKey: ["library-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as Category[];
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["library-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_items")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LibraryItem[];
    },
    enabled: !!user?.id,
  });

  const filtered = useMemo(() => {
    let base = items;
    if (activeCategory) base = base.filter((i) => i.category_id === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return base;
  }, [items, activeCategory, searchQuery]);

  const pinned = filtered.filter((i) => i.is_pinned);
  const unpinned = filtered.filter((i) => !i.is_pinned);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of items) {
      if (i.category_id) counts[i.category_id] = (counts[i.category_id] || 0) + 1;
    }
    return counts;
  }, [items]);

  // Mutations
  const uploadFilesMutation = useMutation({
    mutationFn: async ({ files, visibility }: { files: FileList; visibility: string }) => {
      const targetCategory = activeCategory || categories[0]?.id || null;
      const records = await Promise.all(
        Array.from(files).map(async (file) => {
          const ext = file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          const filePath = `library/${fileName}`;
          const { error } = await supabase.storage.from("resources").upload(filePath, file);
          if (error) throw error;
          return {
            title: file.name.replace(/\.[^/.]+$/, ""),
            type: getType(file.name),
            file_path: filePath,
            category_id: targetCategory,
            uploaded_by: user?.id,
            visibility,
          };
        })
      );
      const { error } = await supabase.from("library_items").insert(records);
      if (error) throw error;
      return records.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["library-items"] });
      toast.success(`${n} file(s) uploaded`);
    },
    onError: (e: Error) => toast.error("Upload failed: " + e.message),
  });

  const addLinkMutation = useMutation({
    mutationFn: async ({ title, url, visibility }: { title: string; url: string; visibility: string }) => {
      const targetCategory = activeCategory || categories.find((c) => c.slug === "links")?.id || categories[0]?.id || null;
      const { error } = await supabase.from("library_items").insert({
        title, type: "link", url, category_id: targetCategory,
        uploaded_by: user?.id, visibility,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-items"] });
      toast.success("Link added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase.from("library_items").update({ title }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-items"] });
      toast.success("Renamed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePinMutation = useMutation({
    mutationFn: async (item: LibraryItem) => {
      const { error } = await supabase
        .from("library_items")
        .update({ is_pinned: !item.is_pinned })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library-items"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: LibraryItem) => {
      if (item.file_path) {
        await supabase.storage.from("resources").remove([item.file_path]);
      }
      const { error } = await supabase.from("library_items").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-items"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { error } = await supabase.from("library_categories").insert({
        name: name.trim(), slug, icon: "FolderOpen", color: "#64748b",
        visibility_default: "all",
        sort_order: (categories[categories.length - 1]?.sort_order ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-categories"] });
      toast.success("Category created");
      setNewCategoryOpen(false);
      setNewCategoryName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Adapt LibraryItem → FileItem expected shape
  const toResourceShape = (i: LibraryItem) => ({
    id: i.id,
    title: i.title,
    type: i.type,
    url: i.file_path || i.url || "",
    folder_id: i.category_id,
    created_at: i.created_at,
    updated_at: i.updated_at,
    visibility: i.visibility,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const renderGrid = (list: LibraryItem[]) => (
    <div
      className={cn(
        viewMode === "grid"
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
          : "border border-border rounded-lg divide-y divide-border bg-card"
      )}
    >
      {list.map((item) => {
        const canManageThis = isAdmin || item.uploaded_by === user?.id;
        return (
          <div key={item.id} className="relative group">
            <FileItem
              resource={toResourceShape(item)}
              viewMode={viewMode}
              canManage={canManageThis}
              onRename={() => { setRenameItem(item); setRenameOpen(true); }}
              onDelete={() => { setDeleteItem(item); setDeleteConfirmOpen(true); }}
              onSelect={(r) => setDetailResource(r)}
            />
            {canManageThis && (
              <button
                onClick={(e) => { e.stopPropagation(); togglePinMutation.mutate(item); }}
                className={cn(
                  "absolute z-20 p-1 rounded-md hover:bg-muted/80 transition-all",
                  viewMode === "grid" ? "top-2.5 right-9 opacity-0 group-hover:opacity-100" : "right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100",
                  item.is_pinned && "opacity-100 text-accent"
                )}
                title={item.is_pinned ? "Unpin" : "Pin"}
              >
                {item.is_pinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-4 lg:-m-6 animate-fade-in">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border/60 bg-card/30 flex flex-col">
        <div className="px-3 py-3 border-b border-border/60">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2">
            Categories
          </h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
              !activeCategory ? "bg-accent/10 text-accent font-medium" : "hover:bg-muted/60 text-foreground"
            )}
          >
            <LibraryIcon className="h-4 w-4" />
            <span className="flex-1 text-left">All Items</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{items.length}</Badge>
          </button>
          {categories.map((c) => {
            const Icon = ICON_MAP[c.icon || "FolderOpen"] || FolderOpen;
            const active = activeCategory === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                  active ? "bg-accent/10 text-accent font-medium" : "hover:bg-muted/60 text-foreground"
                )}
              >
                <Icon className="h-4 w-4" style={{ color: active ? undefined : c.color || undefined }} />
                <span className="flex-1 text-left truncate">{c.name}</span>
                {categoryCounts[c.id] > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{categoryCounts[c.id]}</Badge>
                )}
              </button>
            );
          })}
        </nav>
        {isAdmin && (
          <div className="p-2 border-t border-border/60">
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setNewCategoryOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Category
            </Button>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 lg:px-6 pt-4 pb-3 flex items-center gap-2 border-b border-border/60">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <LibraryIcon className="h-5 w-5 text-accent" />
              {activeCategory ? categories.find((c) => c.id === activeCategory)?.name : "Library"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {filtered.length} item{filtered.length === 1 ? "" : "s"}
              {pinned.length > 0 && ` • ${pinned.length} pinned`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title or tags…"
                className="pl-8 h-9 w-48 sm:w-64"
              />
            </div>
            <div className="flex items-center border border-border/60 rounded-md p-0.5">
              <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded", viewMode === "grid" && "bg-muted")}>
                <Grid3X3 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded", viewMode === "list" && "bg-muted")}>
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
            {canUpload && (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-1.5" /> Upload
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
              <LibraryIcon className="h-10 w-10 mb-2" />
              <p className="text-sm">
                {searchQuery ? "No items match your search" : "No items in this category yet"}
              </p>
              {canUpload && !searchQuery && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-1.5" /> Upload your first file
                </Button>
              )}
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Pin className="h-3 w-3" /> Pinned
                  </div>
                  {renderGrid(pinned)}
                </section>
              )}
              {unpinned.length > 0 && (
                <section>
                  {pinned.length > 0 && (
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      All Items
                    </div>
                  )}
                  {renderGrid(unpinned)}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <UploadFileDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadFiles={async (files, visibility) => { await uploadFilesMutation.mutateAsync({ files, visibility }); }}
        onAddLink={async (title, url, visibility) => { await addLinkMutation.mutateAsync({ title, url, visibility }); }}
        showVisibility={canUpload}
      />

      <RenameDialog
        open={renameOpen}
        onOpenChange={(o) => { setRenameOpen(o); if (!o) setRenameItem(null); }}
        currentName={renameItem?.title || ""}
        onSubmit={async (newName) => {
          if (renameItem) await renameMutation.mutateAsync({ id: renameItem.id, title: newName });
          setRenameItem(null);
        }}
        itemType="file"
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteItem) await deleteMutation.mutateAsync(deleteItem);
                setDeleteItem(null);
                setDeleteConfirmOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Name</Label>
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Tajweed"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCategoryOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCategoryMutation.mutate(newCategoryName)}
              disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detailResource && (
        <FileDetailPanel
          resource={detailResource}
          open={!!detailResource}
          onOpenChange={(o) => !o && setDetailResource(null)}
        />
      )}
    </div>
  );
}
