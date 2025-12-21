import { ChevronRight, Home } from "lucide-react";

type Folder = {
  id: string;
  name: string;
  parent_id: string | null;
};

interface ResourcesBreadcrumbProps {
  folderPath: Folder[];
  onNavigate: (folderId: string | null) => void;
}

export function ResourcesBreadcrumb({ folderPath, onNavigate }: ResourcesBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground font-medium whitespace-nowrap"
      >
        <Home className="h-4 w-4" />
        Resources
      </button>

      {folderPath.map((folder, index) => (
        <div key={folder.id} className="flex items-center">
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <button
            onClick={() => onNavigate(folder.id)}
            className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
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
