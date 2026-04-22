import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type KpiTone = "default" | "success" | "warning" | "danger";

export interface KpiStripItem {
  label: string;
  value: string | number | null | undefined;
  tone?: KpiTone;
  loading?: boolean;
}

interface KpiStripProps {
  items: KpiStripItem[];
  className?: string;
}

const toneClasses: Record<KpiTone, string> = {
  default: "text-white",
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
};

export function KpiStrip({ items, className }: KpiStripProps) {
  return (
    <section
      className={cn(
        "overflow-x-auto rounded-lg bg-[hsl(var(--navy))] text-white shadow-card",
        className,
      )}
      aria-label="Key performance indicators"
    >
      <div className="flex min-w-max divide-x divide-white/10 md:min-w-0">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-w-[170px] flex-1 flex-col justify-center px-4 py-3 md:min-w-0"
          >
            <span className="text-[11px] font-medium text-white/70">{item.label}</span>
            {item.loading ? (
              <Skeleton className="mt-2 h-7 w-20 bg-white/10" />
            ) : (
              <span className={cn("mt-1 text-2xl font-bold tracking-normal", toneClasses[item.tone || "default"])}>
                {item.value ?? "—"}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}