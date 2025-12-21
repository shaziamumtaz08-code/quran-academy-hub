import { useState } from "react";
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
import { FileText, Music, Video, Image, Archive, Link, ExternalLink, Download, FolderOpen, Upload, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ResourceType = "pdf" | "audio" | "video" | "image" | "zip" | "link";

type Resource = {
  id: string;
  title: string;
  type: ResourceType;
  url: string;
  folder: string;
  tags: string | null;
  uploaded_by: string | null;
  created_at: string;
};

const FOLDERS = ["Hifz", "Nazrah", "Tajweed", "Teacher Training", "General", "Other"];

const FILE_TYPE_EXTENSIONS: Record<Exclude<ResourceType, "link">, string[]> = {
  pdf: [".pdf"],
  audio: [".mp3", ".wav", ".m4a", ".ogg"],
  video: [".mp4", ".webm", ".mov", ".avi"],
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  zip: [".zip", ".rar", ".7z"],
};

const getTypeIcon = (type: ResourceType) => {
  switch (type) {
    case "pdf":
      return <FileText className="h-5 w-5 text-destructive" />;
    case "audio":
      return <Music className="h-5 w-5 text-primary" />;
    case "video":
      return <Video className="h-5 w-5 text-chart-1" />;
    case "image":
      return <Image className="h-5 w-5 text-chart-2" />;
    case "zip":
      return <Archive className="h-5 w-5 text-chart-3" />;
    case "link":
      return <Link className="h-5 w-5 text-chart-4" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
};

export default function Resources() {
  const { profile, isSuperAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"file" | "link">("file");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [fileType, setFileType] = useState<Exclude<ResourceType, "link">>("pdf");
  const [tags, setTags] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterFolder, setFilterFolder] = useState<string>("all");

  // Check if user can upload (admin, super_admin, or teacher)
  const canUpload = isSuperAdmin || profile?.id;

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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (resource: Resource) => {
      // Delete file from storage if not a link
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
        const filePath = `${folder}/${fileName}`;

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

  const filteredResources = filterFolder === "all" 
    ? resources 
    : resources.filter(r => r.folder === filterFolder);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Resource Library</h1>
        <div className="flex items-center gap-3">
          <Select value={filterFolder} onValueChange={setFilterFolder}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Folders</SelectItem>
              {FOLDERS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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

                  <div className="space-y-2">
                    <Label htmlFor="folder">Folder *</Label>
                    <Select value={folder} onValueChange={setFolder}>
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
                            <SelectItem value="pdf">PDF Document</SelectItem>
                            <SelectItem value="audio">Audio</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="zip">Archive (ZIP)</SelectItem>
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
      </div>

      {filteredResources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No resources found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredResources.map((res) => (
            <Card key={res.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  {getTypeIcon(res.type as ResourceType)}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{res.title}</CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <FolderOpen className="h-3 w-3" />
                      <span>{res.folder}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {res.tags && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {res.tags.split(",").map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag.trim()}
                      </Badge>
                    ))}
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
