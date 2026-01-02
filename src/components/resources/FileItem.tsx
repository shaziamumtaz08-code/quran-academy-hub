import {
  FileText,
  Music,
  Video,
  Image,
  Archive,
  Link,
  File,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  ExternalLink,
  GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Resource = {
  id: string;
  title: string;
  type: string;
  url: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
};

interface FileItemProps {
  resource: Resource;
  viewMode: "grid" | "list";
  canManage: boolean;
  onRename: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
}

function getTypeIcon(type: string, size = "h-8 w-8") {
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
      return <Link className={`${iconClass} text-accent`} />;
    default:
      return <File className={`${iconClass} text-muted-foreground`} />;
  }
}

function getTypeBackground(type: string) {
  switch (type) {
    case "pdf":
      return "bg-red-500/10";
    case "audio":
      return "bg-purple-500/10";
    case "video":
      return "bg-blue-500/10";
    case "image":
      return "bg-green-500/10";
    case "zip":
      return "bg-amber-500/10";
    case "link":
      return "bg-accent/10";
    default:
      return "bg-muted";
  }
}

export function FileItem({
  resource,
  viewMode,
  canManage,
  onRename,
  onDelete,
}: FileItemProps) {
  const [isDragging, setIsDragging] = useState(false);

  const getSignedUrl = async (): Promise<string | null> => {
    if (resource.type === "link") {
      return resource.url;
    }
    
    const { data, error } = await supabase.storage
      .from("resources")
      .createSignedUrl(resource.url, 3600);
    
    if (error) {
      toast.error("Failed to access file");
      return null;
    }
    return data.signedUrl;
  };

  const handleOpen = async () => {
    const url = await getSignedUrl();
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleDownload = async () => {
    const url = await getSignedUrl();
    if (!url) return;
    
    const link = document.createElement("a");
    link.href = url;
    link.download = resource.title;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({
      id: resource.id,
      type: "file",
    }));
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  if (viewMode === "grid") {
    return (
      <div
        className={`group relative flex flex-col items-center p-5 rounded-xl bg-card shadow-md hover:shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
          isDragging ? "opacity-50" : ""
        }`}
        onClick={handleOpen}
        draggable={canManage}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {canManage && (
          <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 ${getTypeBackground(resource.type)}`}>
          {getTypeIcon(resource.type, "h-7 w-7")}
        </div>
        <span className="text-sm font-medium text-center line-clamp-2 text-foreground">
          {resource.title}
        </span>
        <span className="text-xs text-muted-foreground mt-1.5">
          {format(new Date(resource.updated_at), "MMM d, yyyy")}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted/80 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="shadow-lg rounded-xl">
            <DropdownMenuItem onClick={handleOpen} className="gap-2">
              <ExternalLink className="h-4 w-4 text-accent" />
              Open
            </DropdownMenuItem>
            {resource.type !== "link" && (
              <DropdownMenuItem onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4 text-accent" />
                Download
              </DropdownMenuItem>
            )}
            {canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onRename(resource)} className="gap-2">
                  <Pencil className="h-4 w-4 text-accent" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(resource)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // List view
  return (
    <div
      className={`group flex items-center gap-4 p-4 hover:bg-muted/30 cursor-pointer transition-all duration-200 ${
        isDragging ? "opacity-50" : ""
      }`}
      onClick={handleOpen}
      draggable={canManage}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {canManage && (
        <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getTypeBackground(resource.type)}`}>
        {getTypeIcon(resource.type, "h-5 w-5")}
      </div>
      <span className="flex-1 font-medium truncate text-foreground">{resource.title}</span>
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {format(new Date(resource.updated_at), "MMM d, yyyy")}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="shadow-lg rounded-xl">
          <DropdownMenuItem onClick={handleOpen} className="gap-2">
            <ExternalLink className="h-4 w-4 text-accent" />
            Open
          </DropdownMenuItem>
          {resource.type !== "link" && (
            <DropdownMenuItem onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4 text-accent" />
              Download
            </DropdownMenuItem>
          )}
          {canManage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRename(resource)} className="gap-2">
                <Pencil className="h-4 w-4 text-accent" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(resource)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}