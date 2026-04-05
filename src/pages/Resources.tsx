import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  FolderPlus,
  Upload,
  Grid3X3,
  List,
  Search,
  Loader2,
  FolderOpen,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FileDetailPanel } from "@/components/resources/FileDetailPanel";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { ResourcesBreadcrumb } from "@/components/resources/ResourcesBreadcrumb";
import { FolderItem } from "@/components/resources/FolderItem";
import { FileItem } from "@/components/resources/FileItem";
import { NewFolderDialog } from "@/components/resources/NewFolderDialog";
import { UploadFileDialog } from "@/components/resources/UploadFileDialog";
import { RenameDialog } from "@/components/resources/RenameDialog";

type Folder = {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  visibility?: string;
  visible_to_roles?: string[];
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
  visible_to_roles?: string[];
};

type ViewMode = "grid" | "list";

// Extension to type mapping
const EXTENSION_TO_TYPE: Record<string, string> = {
  ".pdf": "pdf",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".ogg": "audio",
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video",
  ".avi": "video",
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".gif": "image",
  ".webp": "image",
  ".zip": "zip",
  ".rar": "zip",
  ".7z": "zip",
};

function getFileType(filename: string): string {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return EXTENSION_TO_TYPE[ext] || "file";
}

export default function Resources() {
  const { user, isSuperAdmin, profile, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Current folder from URL
  const currentFolderId = searchParams.get("folder") || null;
  const activeTab = searchParams.get("tab") || "browse";

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<{ type: "folder" | "file"; item: Folder | Resource } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ type: "folder" | "file"; item: Folder | Resource } | null>(null);
  const [detailResource, setDetailResource] = useState<any>(null);

  // Permissions - Admin & Super Admin can manage, others can view
  const canManage = isSuperAdmin || profile?.role === "admin";

  // Fetch assigned resources for "My Assigned" tab
  const { data: assignedResources = [] } = useQuery({
    queryKey: ['my-assigned-resources', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: assignments } = await supabase
        .from('resource_assignments')
        .select('resource_id')
        .eq('assigned_to', user.id);
      const resourceIds = (assignments || []).map((a: any) => a.resource_id);
      if (!resourceIds.length) return [];
      const { data: res } = await supabase
        .from('resources')
        .select('*')
        .in('id', resourceIds);
      return (res || []).map((r: any) => ({ ...r, isAssigned: true }));
    },
    enabled: !!user?.id && activeTab === 'assigned',
  });

  const setActiveTab = (tab: string) => {
    const params: Record<string, string> = { tab };
    if (tab === 'browse' && currentFolderId) params.folder = currentFolderId;
    setSearchParams(params);
  };

  // Fetch all folders
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ["folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Folder[];
    },
  });

  // Fetch all resources
  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("title");
      if (error) throw error;
      return data as Resource[];
    },
  });

  const isLoading = foldersLoading || resourcesLoading;

  // Build folder path for breadcrumb
  const folderPath = useMemo(() => {
    if (!currentFolderId) return [];
    const path: Folder[] = [];
    let current = folders.find((f) => f.id === currentFolderId);
    while (current) {
      path.unshift(current);
      current = folders.find((f) => f.id === current?.parent_id);
    }
    return path;
  }, [currentFolderId, folders]);

  // Get current folder
  const currentFolder = useMemo(
    () => folders.find((f) => f.id === currentFolderId) || null,
    [currentFolderId, folders]
  );

  // Folders in current directory
  const currentFolders = useMemo(() => {
    let result = folders.filter((f) => f.parent_id === currentFolderId);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(query));
    }
    return result;
  }, [folders, currentFolderId, searchQuery]);

  // Files in current directory
  const currentFiles = useMemo(() => {
    let result = resources.filter((r) => r.folder_id === currentFolderId);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((r) => r.title.toLowerCase().includes(query));
    }
    return result;
  }, [resources, currentFolderId, searchQuery]);

  // Navigate to folder
  const navigateToFolder = useCallback(
    (folderId: string | null) => {
      if (folderId) {
        setSearchParams({ folder: folderId });
      } else {
        setSearchParams({});
      }
      setSearchQuery("");
    },
    [setSearchParams]
  );

  // Go back
  const goBack = useCallback(() => {
    if (currentFolder?.parent_id) {
      navigateToFolder(currentFolder.parent_id);
    } else {
      navigateToFolder(null);
    }
  }, [currentFolder, navigateToFolder]);

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async ({ name, visibility }: { name: string; visibility: string }) => {
      const { error } = await supabase.from("folders").insert({
        name,
        parent_id: currentFolderId,
        created_by: user?.id,
        visibility,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create folder: " + error.message);
    },
  });

  // Upload files mutation
  const uploadFilesMutation = useMutation({
    mutationFn: async ({ files, visibility }: { files: FileList; visibility: string }) => {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileType = getFileType(file.name);
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const folderPath = currentFolderId || "root";
        const filePath = `${folderPath}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("resources")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        return {
          title: file.name.replace(/\.[^/.]+$/, ""),
          type: fileType,
          url: filePath,
          folder_id: currentFolderId,
          folder: "Uploads",
          uploaded_by: user?.id,
          visibility,
        };
      });

      const uploadedResources = await Promise.all(uploadPromises);

      const { error: insertError } = await supabase
        .from("resources")
        .insert(uploadedResources);

      if (insertError) throw insertError;
      return uploadedResources.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success(`${count} file(s) uploaded`);
    },
    onError: (error: Error) => {
      toast.error("Upload failed: " + error.message);
    },
  });

  // Upload folder mutation
  const uploadFolderMutation = useMutation({
    mutationFn: async ({ files, paths }: { files: File[]; paths: string[] }) => {
      // Get root folder name from first path
      const rootFolderName = paths[0]?.split("/")[0] || "Uploaded Folder";
      
      // Create the root folder
      const { data: createdFolder, error: folderError } = await supabase
        .from("folders")
        .insert({
          name: rootFolderName,
          parent_id: currentFolderId,
          created_by: user?.id,
        })
        .select()
        .single();

      if (folderError) throw folderError;

      // Map to track created subfolders: relative path -> folder id
      const folderMap = new Map<string, string>();
      folderMap.set(rootFolderName, createdFolder.id);

      // Create subfolders and upload files
      const uploadPromises = files.map(async (file, index) => {
        const relativePath = paths[index];
        const pathParts = relativePath.split("/");
        const fileName = pathParts.pop()!;
        
        // Create any necessary subfolders
        let parentFolderId = createdFolder.id;
        let currentPath = rootFolderName;
        
        for (let i = 1; i < pathParts.length; i++) {
          currentPath = pathParts.slice(0, i + 1).join("/");
          
          if (!folderMap.has(currentPath)) {
            const { data: subfolder, error: subfolderError } = await supabase
              .from("folders")
              .insert({
                name: pathParts[i],
                parent_id: parentFolderId,
                created_by: user?.id,
              })
              .select()
              .single();

            if (subfolderError) throw subfolderError;
            folderMap.set(currentPath, subfolder.id);
          }
          parentFolderId = folderMap.get(currentPath)!;
        }

        // Upload the file
        const fileType = getFileType(file.name);
        const fileExt = file.name.split(".").pop();
        const storageName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const storagePath = `${parentFolderId}/${storageName}`;

        const { error: uploadError } = await supabase.storage
          .from("resources")
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        return {
          title: fileName.replace(/\.[^/.]+$/, ""),
          type: fileType,
          url: storagePath,
          folder_id: parentFolderId,
          folder: "Uploads",
          uploaded_by: user?.id,
        };
      });

      const uploadedResources = await Promise.all(uploadPromises);

      const { error: insertError } = await supabase
        .from("resources")
        .insert(uploadedResources);

      if (insertError) throw insertError;
      return uploadedResources.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success(`Folder uploaded with ${count} file(s)`);
    },
    onError: (error: Error) => {
      toast.error("Folder upload failed: " + error.message);
    },
  });

  // Add link mutation
  const addLinkMutation = useMutation({
    mutationFn: async ({ title, url, visibility }: { title: string; url: string; visibility: string }) => {
      const { error } = await supabase.from("resources").insert({
        title,
        type: "link",
        url,
        folder_id: currentFolderId,
        folder: "Links",
        uploaded_by: user?.id,
        visibility,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Link added");
    },
    onError: (error: Error) => {
      toast.error("Failed to add link: " + error.message);
    },
  });

  // Rename folder mutation
  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("folders")
        .update({ name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder renamed");
    },
    onError: (error: Error) => {
      toast.error("Failed to rename: " + error.message);
    },
  });

  // Rename resource mutation
  const renameResourceMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("resources")
        .update({ title })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("File renamed");
    },
    onError: (error: Error) => {
      toast.error("Failed to rename: " + error.message);
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete folder: " + error.message);
    },
  });

  // Delete resource mutation
  const deleteResourceMutation = useMutation({
    mutationFn: async (resource: Resource) => {
      if (resource.type !== "link") {
        // resource.url now stores the file path directly
        await supabase.storage.from("resources").remove([resource.url]);
      }
      const { error } = await supabase
        .from("resources")
        .delete()
        .eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("File deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  // Move folder mutation
  const moveFolderMutation = useMutation({
    mutationFn: async ({ folderId, newParentId }: { folderId: string; newParentId: string | null }) => {
      const { error } = await supabase
        .from("folders")
        .update({ parent_id: newParentId })
        .eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder moved");
    },
    onError: (error: Error) => {
      toast.error("Failed to move folder: " + error.message);
    },
  });

  // Move file mutation
  const moveFileMutation = useMutation({
    mutationFn: async ({ fileId, newFolderId }: { fileId: string; newFolderId: string | null }) => {
      const { error } = await supabase
        .from("resources")
        .update({ folder_id: newFolderId })
        .eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("File moved");
    },
    onError: (error: Error) => {
      toast.error("Failed to move file: " + error.message);
    },
  });

  // Handle drop on folder
  const handleDropOnFolder = useCallback(
    (itemId: string, itemType: "folder" | "file", targetFolderId: string) => {
      if (itemType === "folder") {
        // Prevent dropping folder into itself or its children
        const isDescendant = (parentId: string, childId: string): boolean => {
          const folder = folders.find((f) => f.id === childId);
          if (!folder) return false;
          if (folder.parent_id === parentId) return true;
          if (folder.parent_id) return isDescendant(parentId, folder.parent_id);
          return false;
        };
        
        if (itemId === targetFolderId || isDescendant(itemId, targetFolderId)) {
          toast.error("Cannot move folder into itself or its subfolder");
          return;
        }
        moveFolderMutation.mutate({ folderId: itemId, newParentId: targetFolderId });
      } else {
        moveFileMutation.mutate({ fileId: itemId, newFolderId: targetFolderId });
      }
    },
    [folders, moveFolderMutation, moveFileMutation]
  );

  // Handle drop on breadcrumb (move to folder in path or root)
  const handleDropOnBreadcrumb = useCallback(
    (itemId: string, itemType: "folder" | "file", targetFolderId: string | null) => {
      if (itemType === "folder") {
        // Prevent dropping folder into itself or its children
        if (targetFolderId) {
          const isDescendant = (parentId: string, childId: string): boolean => {
            const folder = folders.find((f) => f.id === childId);
            if (!folder) return false;
            if (folder.parent_id === parentId) return true;
            if (folder.parent_id) return isDescendant(parentId, folder.parent_id);
            return false;
          };
          
          if (itemId === targetFolderId || isDescendant(itemId, targetFolderId)) {
            toast.error("Cannot move folder into itself or its subfolder");
            return;
          }
        }
        moveFolderMutation.mutate({ folderId: itemId, newParentId: targetFolderId });
      } else {
        moveFileMutation.mutate({ fileId: itemId, newFolderId: targetFolderId });
      }
    },
    [folders, moveFolderMutation, moveFileMutation]
  );

  // Handle rename
  const handleRename = async (newName: string) => {
    if (!renameItem) return;
    if (renameItem.type === "folder") {
      await renameFolderMutation.mutateAsync({
        id: renameItem.item.id,
        name: newName,
      });
    } else {
      await renameResourceMutation.mutateAsync({
        id: renameItem.item.id,
        title: newName,
      });
    }
    setRenameItem(null);
  };

  // Handle delete confirm
  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;
    if (deleteItem.type === "folder") {
      await deleteFolderMutation.mutateAsync(deleteItem.item.id);
    } else {
      await deleteResourceMutation.mutateAsync(deleteItem.item as Resource);
    }
    setDeleteItem(null);
    setDeleteConfirmOpen(false);
  };

  // Open rename dialog
  const openRenameFolder = (folder: Folder) => {
    setRenameItem({ type: "folder", item: folder });
    setRenameOpen(true);
  };

  const openRenameFile = (resource: Resource) => {
    setRenameItem({ type: "file", item: resource });
    setRenameOpen(true);
  };

  // Open delete dialog
  const openDeleteFolder = (folder: Folder) => {
    setDeleteItem({ type: "folder", item: folder });
    setDeleteConfirmOpen(true);
  };

  const openDeleteFile = (resource: Resource) => {
    setDeleteItem({ type: "file", item: resource });
    setDeleteConfirmOpen(true);
  };

  // Compute item counts per folder (subfolders + files)
  const folderItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of currentFolders) {
      const subFolders = folders.filter((sf) => sf.parent_id === f.id).length;
      const files = resources.filter((r) => r.folder_id === f.id).length;
      counts[f.id] = subFolders + files;
    }
    return counts;
  }, [currentFolders, folders, resources]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const isEmpty = currentFolders.length === 0 && currentFiles.length === 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Premium Header */}
      <div className="page-header-premium rounded-xl p-6 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {currentFolderId && activeTab === 'browse' && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={goBack}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">Resources</h1>
              {activeTab === 'browse' && (
                <div className="mt-1">
                  <ResourcesBreadcrumb
                    folderPath={folderPath}
                    onNavigate={navigateToFolder}
                    onDrop={handleDropOnBreadcrumb}
                  />
                </div>
              )}
            </div>
          </div>

          {canManage && activeTab === 'browse' && (
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => setNewFolderOpen(true)}
                className="bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-md"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
              <Button 
                onClick={() => setUploadOpen(true)}
                className="bg-accent hover:bg-accent/90 text-white shadow-lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeTab === 'browse'
                ? 'bg-white text-primary shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5 inline mr-1.5" />
            Browse
          </button>
          <button
            onClick={() => setActiveTab('assigned')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeTab === 'assigned'
                ? 'bg-white text-primary shadow-md'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Star className="h-3.5 w-3.5 inline mr-1.5" />
            My Assigned
            {assignedResources.length > 0 && (
              <Badge className="ml-1.5 text-[10px] px-1.5 py-0 h-4 bg-accent/20 text-white border-0">
                {assignedResources.length}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Browse Tab */}
      {activeTab === 'browse' && (
        <>
          {/* Toolbar Card */}
          <div className="premium-card p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search in folder..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 premium-input"
                />
              </div>

              <div className="flex items-center border border-border/50 rounded-xl p-1 bg-muted/30">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    viewMode === "grid"
                      ? "bg-accent text-white shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    viewMode === "list"
                      ? "bg-accent text-white shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          {isEmpty ? (
            <div className="premium-card p-12 flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <FolderOpen className="h-10 w-10 text-accent" />
              </div>
              <p className="font-semibold text-lg text-foreground">This folder is empty</p>
              {canManage && (
                <p className="text-sm mt-2 text-muted-foreground">
                  Create a folder or upload files to get started
                </p>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="space-y-6">
              {currentFolders.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                    Folders ({currentFolders.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {currentFolders.map((folder, index) => (
                      <div key={folder.id} className="animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
                        <FolderItem
                          folder={folder}
                          viewMode="grid"
                          canManage={canManage}
                          itemCount={folderItemCounts[folder.id] ?? 0}
                          onOpen={navigateToFolder}
                          onRename={openRenameFolder}
                          onDelete={openDeleteFolder}
                          onDrop={handleDropOnFolder}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                    Files ({currentFiles.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {currentFiles.map((file, index) => (
                      <div key={file.id} className="animate-fade-in" style={{ animationDelay: `${index * 30}ms` }}>
                        <FileItem
                          resource={file}
                          viewMode="grid"
                          canManage={canManage}
                          onRename={openRenameFile}
                          onDelete={openDeleteFile}
                          onSelect={setDetailResource}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {currentFolders.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    Folders ({currentFolders.length})
                  </h3>
                  <div className="premium-card divide-y divide-border/50">
                    {currentFolders.map((folder) => (
                      <FolderItem
                        key={folder.id}
                        folder={folder}
                        viewMode="list"
                        canManage={canManage}
                        itemCount={folderItemCounts[folder.id] ?? 0}
                        onOpen={navigateToFolder}
                        onRename={openRenameFolder}
                        onDelete={openDeleteFolder}
                        onDrop={handleDropOnFolder}
                      />
                    ))}
                  </div>
                </div>
              )}

              {currentFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    Files ({currentFiles.length})
                  </h3>
                  <div className="premium-card divide-y divide-border/50">
                    {currentFiles.map((file) => (
                      <FileItem
                        key={file.id}
                        resource={file}
                        viewMode="list"
                        canManage={canManage}
                        onRename={openRenameFile}
                        onDelete={openDeleteFile}
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

      {/* My Assigned Tab */}
      {activeTab === 'assigned' && (
        <div className="space-y-4">
          {assignedResources.length === 0 ? (
            <div className="premium-card p-12 flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Star className="h-10 w-10 text-primary" />
              </div>
              <p className="font-semibold text-lg text-foreground">No assigned resources</p>
              <p className="text-sm mt-2 text-muted-foreground">
                Resources assigned to you by admins will appear here
              </p>
            </div>
          ) : (
            <div className="premium-card divide-y divide-border/50">
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

      {/* Dialogs */}
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onSubmit={async (name, visibility) => {
          await createFolderMutation.mutateAsync({ name, visibility });
        }}
        showVisibility={canManage}
      />

      <UploadFileDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadFiles={async (files, visibility) => {
          await uploadFilesMutation.mutateAsync({ files, visibility });
        }}
        onUploadFolder={async (files, paths, visibility) => {
          await uploadFolderMutation.mutateAsync({ files, paths });
        }}
        onAddLink={async (title, url, visibility) => {
          await addLinkMutation.mutateAsync({ title, url, visibility });
        }}
        showVisibility={canManage}
      />

      <RenameDialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) setRenameItem(null);
        }}
        currentName={
          renameItem?.type === "folder"
            ? (renameItem.item as Folder).name
            : renameItem?.type === "file"
            ? (renameItem.item as Resource).title
            : ""
        }
        onSubmit={handleRename}
        itemType={renameItem?.type || "file"}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteItem?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteItem?.type === "folder"
                ? "This will permanently delete this folder and all its contents."
                : "This will permanently delete this file."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Detail Panel */}
      <FileDetailPanel
        open={!!detailResource}
        onOpenChange={(open) => !open && setDetailResource(null)}
        resource={detailResource}
      />
    </div>
  );
}
