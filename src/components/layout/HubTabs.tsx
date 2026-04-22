import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface HubTabItem {
  label: string;
  value: string;
}

interface HubTabsProps {
  items: HubTabItem[];
  defaultValue: string;
  paramName?: string;
  className?: string;
}

export function HubTabs({ items, defaultValue, paramName = "tab", className }: HubTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeValue = useMemo(() => {
    const current = searchParams.get(paramName);
    return items.some((item) => item.value === current) ? (current as string) : defaultValue;
  }, [defaultValue, items, paramName, searchParams]);

  return (
    <Tabs
      value={activeValue}
      onValueChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set(paramName, value);
        setSearchParams(next, { replace: true });
      }}
      className={className}
    >
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 text-foreground">
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className={cn(
              "h-11 rounded-none border-b-2 border-transparent bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none",
              "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
            )}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}