import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface InlineStatTile {
  label: string;
  value: ReactNode;
  loading?: boolean;
  tone?: "default" | "success" | "warning" | "danger";
}

interface InlineStatTilesProps {
  items: InlineStatTile[];
  className?: string;
}

const toneClasses = {
  default: "text-foreground",
  success: "text-[hsl(var(--success))]",
  warning: "text-[hsl(var(--warning))]",
  danger: "text-destructive",
};

export function InlineStatTiles({ items, className }: InlineStatTilesProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          {item.loading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className={cn("mt-1 text-xl font-bold", toneClasses[item.tone || "default"])}>{item.value ?? "—"}</p>
          )}
        </div>
      ))}
    </div>
  );
}
