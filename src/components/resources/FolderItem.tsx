import { Folder, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

type FolderData = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

interface FolderItemProps {
  folder: FolderData;
  viewMode: "grid" | "list";
  canManage: boolean;
  onOpen: (folderId: string) => void;
  onRename: (folder: FolderData) => void;
  onDelete: (folder: FolderData) => void;
}

export function FolderItem({
  folder,
  viewMode,
  canManage,
  onOpen,
  onRename,
  onDelete,
}: FolderItemProps) {
  if (viewMode === "grid") {
    return (
      <div
        className="group relative flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
        onDoubleClick={() => onOpen(folder.id)}
      >
        <Folder className="h-12 w-12 text-primary mb-2" />
        <span className="text-sm font-medium text-center line-clamp-2">{folder.name}</span>
        <span className="text-xs text-muted-foreground mt-1">
          {format(new Date(folder.updated_at), "MMM d, yyyy")}
        </span>

        {canManage && (
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
              <DropdownMenuItem onClick={() => onRename(folder)}>
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(folder)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  // List view
  return (
    <div
      className="group flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onDoubleClick={() => onOpen(folder.id)}
    >
      <Folder className="h-6 w-6 text-primary flex-shrink-0" />
      <span className="flex-1 font-medium truncate">{folder.name}</span>
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {format(new Date(folder.updated_at), "MMM d, yyyy")}
      </span>

      {canManage && (
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
            <DropdownMenuItem onClick={() => onRename(folder)}>
              <Pencil className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(folder)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
