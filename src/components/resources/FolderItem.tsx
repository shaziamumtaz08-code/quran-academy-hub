import { Folder, MoreVertical, Pencil, Trash2, GripVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { useState } from "react";

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
  onDrop?: (itemId: string, itemType: "folder" | "file", targetFolderId: string) => void;
}

export function FolderItem({
  folder,
  viewMode,
  canManage,
  onOpen,
  onRename,
  onDelete,
  onDrop,
}: FolderItemProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({
      id: folder.id,
      type: "folder",
    }));
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    // Don't allow dropping on self
    try {
      const data = e.dataTransfer.types.includes("application/json");
      if (data) {
        setIsDragOver(true);
      }
    } catch {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only set false if we're actually leaving the element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      // Don't allow dropping folder on itself
      if (data.type === "folder" && data.id === folder.id) {
        return;
      }
      onDrop?.(data.id, data.type, folder.id);
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  if (viewMode === "grid") {
    return (
      <div
        className={`group relative flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-all ${
          isDragOver ? "ring-2 ring-primary bg-primary/10 scale-105" : ""
        } ${isDragging ? "opacity-50" : ""}`}
        onDoubleClick={() => onOpen(folder.id)}
        draggable={canManage}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {canManage && (
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <Folder className={`h-12 w-12 mb-2 ${isDragOver ? "text-primary" : "text-primary"}`} />
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
      className={`group flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-all ${
        isDragOver ? "ring-2 ring-primary bg-primary/10" : ""
      } ${isDragging ? "opacity-50" : ""}`}
      onDoubleClick={() => onOpen(folder.id)}
      draggable={canManage}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {canManage && (
        <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <Folder className={`h-6 w-6 flex-shrink-0 ${isDragOver ? "text-primary" : "text-primary"}`} />
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
