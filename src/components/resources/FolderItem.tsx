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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
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
        className={`group relative flex flex-col items-center p-5 rounded-xl bg-card shadow-md hover:shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
          isDragOver ? "ring-2 ring-accent bg-accent/10 scale-105" : ""
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
          <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 transition-colors ${
          isDragOver ? "bg-accent/20" : "bg-accent/10"
        }`}>
          <Folder className={`h-8 w-8 ${isDragOver ? "text-accent" : "text-accent"}`} />
        </div>
        <span className="text-sm font-medium text-center line-clamp-2 text-foreground">{folder.name}</span>
        <span className="text-xs text-muted-foreground mt-1.5">
          {format(new Date(folder.updated_at), "MMM d, yyyy")}
        </span>

        {canManage && (
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
              <DropdownMenuItem onClick={() => onRename(folder)} className="gap-2">
                <Pencil className="h-4 w-4 text-accent" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(folder)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
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
      className={`group flex items-center gap-4 p-4 hover:bg-muted/30 cursor-pointer transition-all duration-200 ${
        isDragOver ? "ring-2 ring-accent bg-accent/10" : ""
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
        <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        isDragOver ? "bg-accent/20" : "bg-accent/10"
      }`}>
        <Folder className={`h-5 w-5 ${isDragOver ? "text-accent" : "text-accent"}`} />
      </div>
      <span className="flex-1 font-medium truncate text-foreground">{folder.name}</span>
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {format(new Date(folder.updated_at), "MMM d, yyyy")}
      </span>

      {canManage && (
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
            <DropdownMenuItem onClick={() => onRename(folder)} className="gap-2">
              <Pencil className="h-4 w-4 text-accent" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(folder)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}