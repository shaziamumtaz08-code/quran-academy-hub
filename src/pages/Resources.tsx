import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Music, Video, Image, Archive, Link, ExternalLink, Download, FolderOpen, Upload, Plus, Trash2, Loader2, Search, Filter, X } from "lucide-react";
import { toast } from "sonner";

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

const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: "pdf", label: "PDF Document" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "zip", label: "Archive (ZIP)" },
  { value: "link", label: "Link" },
];

const FILE_TYPE_EXTENSIONS: Record<Exclude<ResourceType, "link">, string[]> = {
  pdf: [".pdf"],
  audio: [".mp3", ".wav", ".m4a", ".ogg"],
  video: [".mp4", ".webm", ".mov", ".avi"],
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  zip: [".zip", ".rar", ".7z"],
};

const getTypeIcon = (type: ResourceType, className = "h-5 w-5") => {
  switch (type) {
    case "pdf":
      return <FileText className={`${className} text-destructive`} />;
    case "audio":
      return <Music className={`${className} text-primary`} />;
    case "video":
      return <Video className={`${className} text-chart-1`} />;
    case "image":
      return <Image className={`${className} text-chart-2`} />;
    case "zip":
      return <Archive className={`${className} text-chart-3`} />;
    case "link":
      return <Link className={`${className} text-chart-4`} />;
    default:
      return <FileText className={className} />;
  }
};

export default function Resources() {
  const { profile, isSuperAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  
  // Upload dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"file" | "link">("file");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [subFolder, setSubFolder] = useState("");
  const [fileType, setFileType] = useState<Exclude<ResourceType, "link">>("pdf");
  const [tags, setTags] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Filter state
  const [filterFolder, setFilterFolder] = useState<string>("all");
  const [filterSubFolder, setFilterSubFolder] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Check if user can upload (admin, super_admin, or teacher)
  const canUpload = isSuperAdmin || profile?.id;

  // Get available sub-folders based on selected filter folder
  const availableSubFolders = useMemo(() => {
    if (filterFolder === "all") return [];
    return FOLDER_STRUCTURE[filterFolder] || [];
  }, [filterFolder]);

  // Get available sub-folders for upload based on selected folder
  const uploadSubFolders = useMemo(() => {
    if (!folder) return [];
    return FOLDER_STRUCTURE[folder] || [];
  }, [folder]);

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

  // Filter resources based on all criteria
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      // Folder filter
      if (filterFolder !== "all" && res.folder !== filterFolder) return false;
      
      // Sub-folder filter
      if (filterSubFolder !== "all" && res.sub_folder !== filterSubFolder) return false;
      
      // Type filter
      if (filterType !== "all" && res.type !== filterType) return false;
      
      // Search filter (title and tags)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = res.title.toLowerCase().includes(query);
        const matchesTags = res.tags?.toLowerCase().includes(query) || false;
        if (!matchesTitle && !matchesTags) return false;
      }
      
      return true;
    });
  }, [resources, filterFolder, filterSubFolder, filterType, searchQuery]);

  // Check if any filters are active
  const hasActiveFilters = filterFolder !== "all" || filterSubFolder !== "all" || filterType !== "all" || searchQuery.trim() !== "";

  // Clear all filters
  const clearFilters = () => {
    setFilterFolder("all");
    setFilterSubFolder("all");
    setFilterType("all");
    setSearchQuery("");
  };

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
      toast.success("Resource deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete resource: " + error.message);
    },
  });

  const resetForm = () => {
    setTitle("");
    setFolder("");
    setSubFolder("");
    setFileType("pdf");
    setTags("");
    setLinkUrl("");
    setSelectedFile(null);
    setUploadType("file");
  };

  const handleUpload = async () => {
    if (!title.trim() || !folder) {
      toast.error("Please fill in title and folder");
      return;
    }

    if (uploadType === "link" && !linkUrl.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    if (uploadType === "file" && !selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setUploading(true);

    try {
      let resourceUrl = linkUrl;
      let resourceType: ResourceType = "link";

      if (uploadType === "file" && selectedFile) {
        resourceType = fileType;
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${folder}/${subFolder || "root"}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("resources")
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("resources")
          .getPublicUrl(filePath);

        resourceUrl = urlData.publicUrl;
      }

      const { error: insertError } = await supabase.from("resources").insert({
        title: title.trim(),
        type: resourceType,
        url: resourceUrl,
        folder,
        sub_folder: subFolder || null,
        tags: tags.trim() || null,
        uploaded_by: user?.id,
      });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Resource uploaded successfully");
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error("Failed to upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const getAcceptedExtensions = () => {
    return FILE_TYPE_EXTENSIONS[fileType].join(",");
  };

  // Reset sub-folder when folder changes in filters
  const handleFilterFolderChange = (value: string) => {
    setFilterFolder(value);
    setFilterSubFolder("all");
  };

  // Reset sub-folder when folder changes in upload
  const handleUploadFolderChange = (value: string) => {
    setFolder(value);
    setSubFolder("");
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Resource Library</h1>
        {canUpload && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Upload Resource
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Upload Resource</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={uploadType === "file" ? "default" : "outline"}
                    onClick={() => setUploadType("file")}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </Button>
                  <Button
                    type="button"
                    variant={uploadType === "link" ? "default" : "outline"}
                    onClick={() => setUploadType("link")}
                    className="flex-1"
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Add Link
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter resource title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="folder">Folder *</Label>
                    <Select value={folder} onValueChange={handleUploadFolderChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select folder" />
                      </SelectTrigger>
                      <SelectContent>
                        {FOLDERS.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subFolder">Sub-folder</Label>
                    <Select 
                      value={subFolder} 
                      onValueChange={setSubFolder}
                      disabled={!folder || uploadSubFolders.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={uploadSubFolders.length === 0 ? "None available" : "Select sub-folder"} />
                      </SelectTrigger>
                      <SelectContent>
                        {uploadSubFolders.map((sf) => (
                          <SelectItem key={sf} value={sf}>{sf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {uploadType === "file" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fileType">File Type *</Label>
                      <Select value={fileType} onValueChange={(v) => {
                        setFileType(v as Exclude<ResourceType, "link">);
                        setSelectedFile(null);
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESOURCE_TYPES.filter(t => t.value !== "link").map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="file">File *</Label>
                      <Input
                        id="file"
                        type="file"
                        accept={getAcceptedExtensions()}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Accepted: {getAcceptedExtensions()}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="linkUrl">URL *</Label>
                    <Input
                      id="linkUrl"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="e.g. syllabus, level-1, practice"
                  />
                </div>

                <Button 
                  onClick={handleUpload} 
                  disabled={uploading}
                  className="w-full"
                >
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
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Filters</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-8">
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Folder Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Folder</Label>
              <Select value={filterFolder} onValueChange={handleFilterFolderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All folders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Folders</SelectItem>
                  {FOLDERS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub-folder Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sub-folder</Label>
              <Select 
                value={filterSubFolder} 
                onValueChange={setFilterSubFolder}
                disabled={filterFolder === "all" || availableSubFolders.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filterFolder === "all" ? "Select folder first" : "All sub-folders"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub-folders</SelectItem>
                  {availableSubFolders.map((sf) => (
                    <SelectItem key={sf} value={sf}>{sf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Resource Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {RESOURCE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(t.value, "h-4 w-4")}
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Title or tags..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredResources.length} {filteredResources.length === 1 ? "resource" : "resources"} found
        {hasActiveFilters && ` (filtered from ${resources.length})`}
      </div>

      {/* Resource Grid */}
      {filteredResources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No resources found</p>
            <p className="text-sm mt-1">
              {hasActiveFilters 
                ? "Try adjusting your filters" 
                : "Upload a resource to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredResources.map((res) => (
            <Card key={res.id} className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    {getTypeIcon(res.type as ResourceType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate" title={res.title}>
                      {res.title}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <FolderOpen className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">
                        {res.folder}
                        {res.sub_folder && ` / ${res.sub_folder}`}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {res.tags && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {res.tags.split(",").slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag.trim()}
                      </Badge>
                    ))}
                    {res.tags.split(",").length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{res.tags.split(",").length - 4}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(res.url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  {res.type !== "link" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      asChild
                    >
                      <a href={res.url} download>
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </a>
                    </Button>
                  )}
                  {(isSuperAdmin || res.uploaded_by === user?.id) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(res)}
                      disabled={deleteMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
