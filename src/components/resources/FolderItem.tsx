import { Folder, MoreVertical, Pencil, Trash2, GripVertical, Lock, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type FolderData = {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  visibility?: string;
};

interface FolderItemProps {
  folder: FolderData;
  viewMode: "grid" | "list";
  canManage: boolean;
  itemCount?: number;
  onOpen: (folderId: string) => void;
  onRename: (folder: FolderData) => void;
  onDelete: (folder: FolderData) => void;
  onDrop?: (itemId: string, itemType: "folder" | "file", targetFolderId: string) => void;
}

export function FolderItem({
  folder,
  viewMode,
  canManage,
  itemCount,
  onOpen,
  onRename,
  onDelete,
  onDrop,
}: FolderItemProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isRestricted = folder.visibility && folder.visibility !== "all";

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({
      id: folder.id,
      type: "folder",
    }));
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };

  const handleDragEnd = () => setIsDragging(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
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
      if (data.type === "folder" && data.id === folder.id) return;
      onDrop?.(data.id, data.type, folder.id);
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking the dropdown
    if ((e.target as HTMLElement).closest('[data-radix-dropdown-menu-trigger]')) return;
    onOpen(folder.id);
  };

  if (viewMode === "grid") {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`group relative flex flex-col items-center justify-center h-[160px] sm:h-[180px] p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 hover:border-accent/30 ${
                isDragOver ? "ring-2 ring-accent bg-accent/5 scale-[1.02]" : ""
              } ${isDragging ? "opacity-50" : ""}`}
              onClick={handleClick}
              draggable={canManage}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Drag handle */}
              {canManage && (
                <div className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}

              {/* Visibility indicator */}
              {isRestricted && (
                <div className="absolute top-2.5 left-2.5">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </div>
              )}

              {/* Dropdown menu */}
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-radix-dropdown-menu-trigger
                      className="absolute top-2.5 right-2.5 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted/80 transition-all z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
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

              {/* Icon area */}
              <div className="flex-1 flex items-center justify-center">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center transition-colors ${
                  isDragOver ? "bg-accent/20" : "bg-accent/10"
                }`}>
                  <Folder className="h-8 w-8 sm:h-9 sm:w-9 text-accent" />
                </div>
              </div>

              {/* Name + count */}
              <div className="w-full text-center mt-1 space-y-0.5">
                <p className="text-sm font-medium truncate text-foreground px-1">
                  {folder.name}
                </p>
                {typeof itemCount === "number" && (
                  <p className="text-[11px] text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </p>
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[250px]">
            <p className="font-medium">{folder.name}</p>
            {typeof itemCount === "number" && (
              <p className="text-xs text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // List view
  return (
    <div
      className={`group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-muted/30 cursor-pointer transition-all duration-200 min-h-[52px] ${
        isDragOver ? "ring-2 ring-accent bg-accent/5" : ""
      } ${isDragging ? "opacity-50" : ""}`}
      onClick={handleClick}
      draggable={canManage}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {canManage && (
        <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity hidden sm:block">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isDragOver ? "bg-accent/20" : "bg-accent/10"
      }`}>
        <Folder className="h-5 w-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-foreground text-sm sm:text-base">{folder.name}</p>
        {typeof itemCount === "number" && (
          <p className="text-xs text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}</p>
        )}
      </div>
      {isRestricted && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 flex-shrink-0 hidden sm:flex">
          <Eye className="h-3 w-3" />
          {folder.visibility === "admin_only" ? "Admin" : folder.visibility === "teachers" ? "Teachers" : "Custom"}
        </Badge>
      )}

      {canManage && (
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
