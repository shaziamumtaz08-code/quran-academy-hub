import { cn } from "@/lib/utils";

export interface ViewPillItem {
  label: string;
  value: string;
}

interface ViewPillBarProps {
  items: ViewPillItem[];
  activeValue: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ViewPillBar({ items, activeValue, onChange, className }: ViewPillBarProps) {
  return (
    <div className={cn("overflow-x-auto scrollbar-hide", className)}>
      <div className="flex min-w-max items-center gap-2 py-1">
        {items.map((item) => {
          const active = item.value === activeValue;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-medium transition-colors whitespace-nowrap",
                active
                  ? "bg-[hsl(var(--navy))] text-white dark:bg-primary dark:text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
