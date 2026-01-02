import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home, FolderOpen } from "lucide-react";

type Folder = {
  id: string;
  name: string;
  parent_id: string | null;
};

interface ResourcesBreadcrumbProps {
  folderPath: Folder[];
  onNavigate: (folderId: string | null) => void;
  onDrop?: (itemId: string, itemType: "folder" | "file", targetFolderId: string | null) => void;
}

export function ResourcesBreadcrumb({ folderPath, onNavigate, onDrop }: ResourcesBreadcrumbProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, id: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id === null ? "root" : id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDragOverId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      onDrop?.(data.id, data.type, targetFolderId);
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto">
      {/* Back to Dashboard */}
      <Link 
        to="/dashboard"
        className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        title="Back to Dashboard"
      >
        <Home className="h-4 w-4" />
      </Link>

      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

      {/* Resources root */}
      <button
        onClick={() => onNavigate(null)}
        onDragOver={(e) => handleDragOver(e, null)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted transition-colors font-medium whitespace-nowrap ${
          dragOverId === "root" ? "ring-2 ring-primary bg-primary/10" : ""
        } ${
          folderPath.length === 0
            ? "text-foreground font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <FolderOpen className="h-4 w-4" />
        Resources
      </button>

      {folderPath.map((folder, index) => (
        <div key={folder.id} className="flex items-center">
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <button
            onClick={() => onNavigate(folder.id)}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder.id)}
            className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
              dragOverId === folder.id ? "ring-2 ring-primary bg-primary/10" : ""
            } ${
              index === folderPath.length - 1
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
            }`}
          >
            {folder.name}
          </button>
        </div>
      ))}
    </nav>
  );
}
