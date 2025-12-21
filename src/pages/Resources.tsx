import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  FileText, Music, Video, Image, Archive, Link, ExternalLink, Download, 
  FolderOpen, Upload, Trash2, Loader2, Search, MoreVertical, Pencil,
  Grid3X3, List, ArrowUpDown, Calendar, Type, File, Plus
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ResourceType = "pdf" | "audio" | "video" | "image" | "zip" | "link";

type Resource = {
  id: string;
  title: string;
  type: ResourceType;
  url: string;
  folder: string;
  sub_folder: string | null;
  tags: string | null;
  uploaded_by: string | null;
  created_at: string;
};

type SortOption = "name" | "date" | "type";
type ViewMode = "grid" | "list";

// Folder structure with sub-folders
const FOLDER_STRUCTURE: Record<string, string[]> = {
  "Hifz": ["Juz 1-10", "Juz 11-20", "Juz 21-30", "Revision", "Practice"],
  "Nazrah": ["Qaida", "Basic Reading", "Advanced", "Practice"],
  "Tajweed": ["Rules", "Practice", "Audio Lessons", "Assessments"],
  "Teacher Training": ["Onboarding", "Methods", "Resources", "Certification"],
  "General": ["Announcements", "Guidelines", "Templates", "Misc"],
  "Other": [],
};

const FOLDERS = Object.keys(FOLDER_STRUCTURE);

// File extension to type mapping for auto-detection
const EXTENSION_TO_TYPE: Record<string, ResourceType> = {
  ".pdf": "pdf",
  ".mp3": "audio", ".wav": "audio", ".m4a": "audio", ".ogg": "audio",
  ".mp4": "video", ".webm": "video", ".mov": "video", ".avi": "video",
  ".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image", ".webp": "image",
  ".zip": "zip", ".rar": "zip", ".7z": "zip",
};

const getFileType = (filename: string): Exclude<ResourceType, "link"> => {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return (EXTENSION_TO_TYPE[ext] as Exclude<ResourceType, "link">) || "pdf";
};

const getTypeIcon = (type: ResourceType, size = "h-8 w-8") => {
  const iconClass = size;
  switch (type) {
    case "pdf":
      return <FileText className={`${iconClass} text-red-500`} />;
    case "audio":
      return <Music className={`${iconClass} text-purple-500`} />;
    case "video":
      return <Video className={`${iconClass} text-blue-500`} />;
    case "image":
      return <Image className={`${iconClass} text-green-500`} />;
    case "zip":
      return <Archive className={`${iconClass} text-amber-500`} />;
    case "link":
      return <Link className={`${iconClass} text-cyan-500`} />;
    default:
      return <File className={iconClass} />;
  }
};

const getTypeLabel = (type: ResourceType): string => {
  const labels: Record<ResourceType, string> = {
    pdf: "PDF",
    audio: "Audio",
    video: "Video",
    image: "Image",
    zip: "Archive",
    link: "Link",
  };
  return labels[type] || "File";
};

export default function Resources() {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get filter values from URL params
  const urlFolder = searchParams.get('folder') || 'all';
  const urlSubFolder = searchParams.get('subfolder') || '';
  
  // View and sort state
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"file" | "link">("file");
  const [folder, setFolder] = useState("");
  const [subFolder, setSubFolder] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameResource, setRenameResource] = useState<Resource | null>(null);
  const [newTitle, setNewTitle] = useState("");

  // Access check - Super Admin only for now
  const canManage = isSuperAdmin;

  // Update URL params when folder changes
  const setFilterFolder = (value: string) => {
    if (value === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ folder: value });
    }
  };

  const setFilterSubFolder = (value: string) => {
    if (value && urlFolder !== 'all') {
      setSearchParams({ folder: urlFolder, subfolder: value });
    } else if (urlFolder !== 'all') {
      setSearchParams({ folder: urlFolder });
    }
  };

  // Get available sub-folders for upload form
  const availableSubFolders = useMemo(() => {
    if (!folder) return [];
    return FOLDER_STRUCTURE[folder] || [];
  }, [folder]);

  // Get available sub-folders for current filter
  const filterSubFolders = useMemo(() => {
    if (urlFolder === 'all') return [];
    return FOLDER_STRUCTURE[urlFolder] || [];
  }, [urlFolder]);

  // Fetch resources
  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Resource[];
    },
  });

  // Filter and sort resources
  const displayedResources = useMemo(() => {
    let result = [...resources];

    // Filter by folder
    if (urlFolder !== "all") {
      result = result.filter(r => r.folder === urlFolder);
    }

    // Filter by sub-folder
    if (urlSubFolder) {
      result = result.filter(r => r.sub_folder === urlSubFolder);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.title.toLowerCase().includes(query) ||
        r.folder.toLowerCase().includes(query) ||
        r.sub_folder?.toLowerCase().includes(query) ||
        r.tags?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.title.localeCompare(b.title);
          break;
        case "date":
          comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortAsc ? -comparison : comparison;
    });

    return result;
  }, [resources, urlFolder, urlSubFolder, searchQuery, sortBy, sortAsc]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (resource: Resource) => {
      if (resource.type !== "link") {
        const filePath = resource.url.split("/resources/")[1];
        if (filePath) {
          await supabase.storage.from("resources").remove([filePath]);
        }
      }
      
      const { error } = await supabase.from("resources").delete().eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Resource deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("resources")
        .update({ title })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Resource renamed");
      setRenameDialogOpen(false);
      setRenameResource(null);
    },
    onError: (error) => {
      toast.error("Failed to rename: " + error.message);
    },
  });

  const resetUploadForm = () => {
    setFolder("");
    setSubFolder("");
    setSelectedFiles(null);
    setLinkUrl("");
    setLinkTitle("");
    setUploadType("file");
  };

  const handleUpload = async () => {
    if (!folder) {
      toast.error("Please select a folder");
      return;
    }

    if (uploadType === "link") {
      if (!linkUrl.trim() || !linkTitle.trim()) {
        toast.error("Please enter both title and URL");
        return;
      }
    } else {
      if (!selectedFiles || selectedFiles.length === 0) {
        toast.error("Please select files to upload");
        return;
      }
    }

    setUploading(true);

    try {
      if (uploadType === "link") {
        // Add link
        const { error } = await supabase.from("resources").insert({
          title: linkTitle.trim(),
          type: "link",
          url: linkUrl.trim(),
          folder,
          sub_folder: subFolder || null,
          uploaded_by: user?.id,
        });
        if (error) throw error;
        toast.success("Link added successfully");
      } else {
        // Upload multiple files
        const uploadPromises = Array.from(selectedFiles!).map(async (file) => {
          const fileType = getFileType(file.name);
          const fileExt = file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${folder}/${subFolder || "root"}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("resources")
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("resources")
            .getPublicUrl(filePath);

          return {
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for title
            type: fileType,
            url: urlData.publicUrl,
            folder,
            sub_folder: subFolder || null,
            uploaded_by: user?.id,
          };
        });

        const uploadedResources = await Promise.all(uploadPromises);
        
        const { error: insertError } = await supabase
          .from("resources")
          .insert(uploadedResources);

        if (insertError) throw insertError;
        toast.success(`${uploadedResources.length} file(s) uploaded successfully`);
      }

      queryClient.invalidateQueries({ queryKey: ["resources"] });
      setUploadDialogOpen(false);
      resetUploadForm();
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRename = () => {
    if (!renameResource || !newTitle.trim()) return;
    renameMutation.mutate({ id: renameResource.id, title: newTitle.trim() });
  };

  const openRenameDialog = (resource: Resource) => {
    setRenameResource(resource);
    setNewTitle(resource.title);
    setRenameDialogOpen(true);
  };

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(option);
      setSortAsc(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Super Admin access check
  if (!isSuperAdmin) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Access Restricted</p>
            <p className="text-sm mt-1">Resources are currently available for Super Admins only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Resources</h1>
        
        {canManage && (
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Add Resources</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Upload type toggle */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={uploadType === "file" ? "default" : "outline"}
                    onClick={() => setUploadType("file")}
                    className="flex-1"
                    size="sm"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Files
                  </Button>
                  <Button
                    type="button"
                    variant={uploadType === "link" ? "default" : "outline"}
                    onClick={() => setUploadType("link")}
                    className="flex-1"
                    size="sm"
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Link
                  </Button>
                </div>

                {/* Folder selection */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Folder *</Label>
                    <Select value={folder} onValueChange={(v) => { setFolder(v); setSubFolder(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {FOLDERS.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sub-folder</Label>
                    <Select 
                      value={subFolder} 
                      onValueChange={setSubFolder}
                      disabled={!folder || availableSubFolders.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={availableSubFolders.length === 0 ? "None" : "Optional"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSubFolders.map((sf) => (
                          <SelectItem key={sf} value={sf}>{sf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {uploadType === "file" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Files *</Label>
                    <Input
                      type="file"
                      multiple
                      onChange={(e) => setSelectedFiles(e.target.files)}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground">
                      PDF, Audio, Video, Images, or Archives • Multiple files allowed
                    </p>
                    {selectedFiles && selectedFiles.length > 0 && (
                      <p className="text-xs text-primary font-medium">
                        {selectedFiles.length} file(s) selected
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Title *</Label>
                      <Input
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        placeholder="Link name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">URL *</Label>
                      <Input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap bg-muted/50 rounded-lg p-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources..."
            className="pl-9 bg-background"
          />
        </div>

        {/* Folder filter */}
        <Select value={urlFolder} onValueChange={setFilterFolder}>
          <SelectTrigger className="w-[140px] bg-background">
            <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Folder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Folders</SelectItem>
            {FOLDERS.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sub-folder filter */}
        {urlFolder !== 'all' && filterSubFolders.length > 0 && (
          <Select value={urlSubFolder || 'all'} onValueChange={(v) => setFilterSubFolder(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Sub-folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sub-folders</SelectItem>
              {filterSubFolders.map((sf) => (
                <SelectItem key={sf} value={sf}>{sf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Sort options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-background">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toggleSort("name")}>
              <Type className="h-4 w-4 mr-2" />
              Name {sortBy === "name" && (sortAsc ? "↑" : "↓")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleSort("date")}>
              <Calendar className="h-4 w-4 mr-2" />
              Date {sortBy === "date" && (sortAsc ? "↑" : "↓")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleSort("type")}>
              <File className="h-4 w-4 mr-2" />
              Type {sortBy === "type" && (sortAsc ? "↑" : "↓")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View toggle */}
        <div className="flex border rounded-md bg-background">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="rounded-r-none"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="rounded-l-none"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Resource count */}
      <p className="text-sm text-muted-foreground">
        {displayedResources.length} item{displayedResources.length !== 1 ? "s" : ""}
      </p>

      {/* Empty state */}
      {displayedResources.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-lg">No resources found</p>
            <p className="text-sm mt-1">
              {searchQuery || urlFolder !== "all" 
                ? "Try adjusting your search or filters" 
                : "Click 'New' to add your first resource"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {displayedResources.map((res) => (
            <Card 
              key={res.id} 
              className="group hover:shadow-lg transition-all cursor-pointer border-transparent hover:border-primary/20"
              onClick={() => window.open(res.url, "_blank")}
            >
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="mb-3 p-4 rounded-xl bg-muted/50 group-hover:bg-muted transition-colors">
                  {getTypeIcon(res.type as ResourceType, "h-10 w-10")}
                </div>
                <p className="font-medium text-sm truncate w-full" title={res.title}>
                  {res.title}
                </p>
                <p className="text-xs text-muted-foreground truncate w-full mt-1">
                  {res.folder}{res.sub_folder && ` / ${res.sub_folder}`}
                </p>
                
                {/* Actions menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => window.open(res.url, "_blank")}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </DropdownMenuItem>
                    {res.type !== "link" && (
                      <DropdownMenuItem asChild>
                        <a href={res.url} download onClick={(e) => e.stopPropagation()}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </DropdownMenuItem>
                    )}
                    {canManage && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openRenameDialog(res)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteMutation.mutate(res)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="border rounded-lg overflow-hidden bg-background">
          {displayedResources.map((res, index) => (
            <div 
              key={res.id}
              className={`flex items-center gap-4 p-3 hover:bg-muted/50 cursor-pointer transition-colors group ${
                index !== displayedResources.length - 1 ? "border-b" : ""
              }`}
              onClick={() => window.open(res.url, "_blank")}
            >
              <div className="p-2 rounded-lg bg-muted/50">
                {getTypeIcon(res.type as ResourceType, "h-6 w-6")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{res.title}</p>
                <p className="text-xs text-muted-foreground">
                  {res.folder}{res.sub_folder && ` / ${res.sub_folder}`}
                </p>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {getTypeLabel(res.type as ResourceType)}
              </p>
              <p className="text-xs text-muted-foreground hidden md:block w-24 text-right">
                {format(new Date(res.created_at), "MMM d, yyyy")}
              </p>
              
              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => window.open(res.url, "_blank")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                {res.type !== "link" && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                    <a href={res.url} download>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openRenameDialog(res)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteMutation.mutate(res)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename Resource</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">New name</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter new name"
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={renameMutation.isPending || !newTitle.trim()}>
              {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
