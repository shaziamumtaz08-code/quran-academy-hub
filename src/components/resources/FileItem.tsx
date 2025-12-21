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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

type ResourceType = "pdf" | "audio" | "video" | "image" | "zip" | "link" | "file";

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
      return <Link className={`${iconClass} text-cyan-500`} />;
    default:
      return <File className={`${iconClass} text-muted-foreground`} />;
  }
}

export function FileItem({
  resource,
  viewMode,
  canManage,
  onRename,
  onDelete,
}: FileItemProps) {
  const handleOpen = () => {
    window.open(resource.url, "_blank");
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = resource.url;
    link.download = resource.title;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (viewMode === "grid") {
    return (
      <div
        className="group relative flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={handleOpen}
      >
        {getTypeIcon(resource.type, "h-12 w-12")}
        <span className="text-sm font-medium text-center line-clamp-2 mt-2">
          {resource.title}
        </span>
        <span className="text-xs text-muted-foreground mt-1">
          {format(new Date(resource.updated_at), "MMM d, yyyy")}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleOpen}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </DropdownMenuItem>
            {resource.type !== "link" && (
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
            )}
            {canManage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onRename(resource)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(resource)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
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
      className="group flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={handleOpen}
    >
      {getTypeIcon(resource.type, "h-6 w-6")}
      <span className="flex-1 font-medium truncate">{resource.title}</span>
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {format(new Date(resource.updated_at), "MMM d, yyyy")}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleOpen}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open
          </DropdownMenuItem>
          {resource.type !== "link" && (
            <DropdownMenuItem onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </DropdownMenuItem>
          )}
          {canManage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRename(resource)}>
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(resource)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
