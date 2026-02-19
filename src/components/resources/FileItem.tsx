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
  Lock,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
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
  visibility?: string;
};

interface FileItemProps {
  resource: Resource;
  viewMode: "grid" | "list";
  canManage: boolean;
  onRename: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
}

const TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; bg: string; label: string }> = {
  pdf: { icon: FileText, color: "text-red-500", bg: "bg-red-500/10", label: "PDF" },
  audio: { icon: Music, color: "text-purple-500", bg: "bg-purple-500/10", label: "AUDIO" },
  video: { icon: Video, color: "text-blue-500", bg: "bg-blue-500/10", label: "VIDEO" },
  image: { icon: Image, color: "text-green-500", bg: "bg-green-500/10", label: "IMAGE" },
  zip: { icon: Archive, color: "text-amber-500", bg: "bg-amber-500/10", label: "ZIP" },
  link: { icon: Link, color: "text-accent", bg: "bg-accent/10", label: "LINK" },
  file: { icon: File, color: "text-muted-foreground", bg: "bg-muted", label: "FILE" },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.file;
}

export function FileItem({
  resource,
  viewMode,
  canManage,
  onRename,
  onDelete,
}: FileItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const config = getConfig(resource.type);
  const Icon = config.icon;
  const isRestricted = resource.visibility && resource.visibility !== "all";

  const getSignedUrl = async (): Promise<string | null> => {
    if (resource.type === "link") return resource.url;
    const { data, error } = await supabase.storage
      .from("resources")
      .createSignedUrl(resource.url, 3600);
    if (error) {
      toast.error("Failed to access file");
      return null;
    }
    return data.signedUrl;
  };

  const handleOpen = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const url = await getSignedUrl();
    if (url) window.open(url, "_blank");
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

  const handleDragEnd = () => setIsDragging(false);

  if (viewMode === "grid") {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`group relative flex flex-col items-center justify-center h-[160px] sm:h-[180px] p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 hover:border-accent/30 ${
                isDragging ? "opacity-50" : ""
              }`}
              onClick={handleOpen}
              draggable={canManage}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {/* Type badge */}
              <Badge
                variant="secondary"
                className="absolute top-2.5 left-2.5 text-[10px] px-1.5 py-0 h-5 font-semibold tracking-wide"
              >
                {config.label}
              </Badge>

              {/* Visibility indicator */}
              {isRestricted && (
                <div className="absolute top-2.5 left-[calc(100%-2rem)] sm:left-auto sm:right-10">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </div>
              )}

              {/* Drag handle */}
              {canManage && (
                <div className="absolute top-9 left-2.5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}

              {/* Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="absolute top-2.5 right-2.5 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted/80 transition-all z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="shadow-lg rounded-xl">
                  <DropdownMenuItem onClick={() => handleOpen()} className="gap-2">
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

              {/* Icon area */}
              <div className="flex-1 flex items-center justify-center">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center ${config.bg}`}>
                  <Icon className={`h-7 w-7 sm:h-8 sm:w-8 ${config.color}`} />
                </div>
              </div>

              {/* Name */}
              <div className="w-full text-center mt-1">
                <p className="text-sm font-medium truncate text-foreground px-1">
                  {resource.title}
                </p>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[250px]">
            <p className="font-medium">{resource.title}</p>
            <p className="text-xs text-muted-foreground capitalize">{resource.type}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // List view
  return (
    <div
      className={`group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-muted/30 cursor-pointer transition-all duration-200 min-h-[52px] ${
        isDragging ? "opacity-50" : ""
      }`}
      onClick={handleOpen}
      draggable={canManage}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {canManage && (
        <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity hidden sm:block">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}>
        <Icon className={`h-5 w-5 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-foreground text-sm sm:text-base">{resource.title}</p>
      </div>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0 hidden sm:flex">
        {config.label}
      </Badge>
      {isRestricted && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 flex-shrink-0 hidden sm:flex">
          <Eye className="h-3 w-3" />
          {resource.visibility === "admin_only" ? "Admin" : resource.visibility === "teachers" ? "Teachers" : "Custom"}
        </Badge>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition-all flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="shadow-lg rounded-xl">
          <DropdownMenuItem onClick={() => handleOpen()} className="gap-2">
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
