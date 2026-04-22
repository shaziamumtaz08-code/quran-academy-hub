import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { KpiStrip, type KpiStripItem } from "@/components/layout/KpiStrip";
import { HubTabs, type HubTabItem } from "@/components/layout/HubTabs";

interface HubPageShellProps {
  title: string;
  subtitle?: string;
  kpis?: KpiStripItem[];
  tabs?: HubTabItem[];
  defaultTab?: string;
  paramName?: string;
  banner?: ReactNode;
  content: Record<string, ReactNode>;
  singleView?: ReactNode;
}

export function HubPageShell({
  title,
  subtitle,
  kpis,
  tabs,
  defaultTab,
  paramName = "tab",
  banner,
  content,
  singleView,
}: HubPageShellProps) {
  const [searchParams] = useSearchParams();
  const activeTab = defaultTab && tabs?.some((item) => item.value === searchParams.get(paramName))
    ? (searchParams.get(paramName) as string)
    : defaultTab;

  return (
    <div className="space-y-5 animate-fade-in">
      <header>
        <h1 className="text-2xl font-serif font-bold text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>

      {banner}
      {kpis?.length ? <KpiStrip items={kpis} /> : null}
      {tabs?.length && defaultTab ? <HubTabs items={tabs} defaultValue={defaultTab} paramName={paramName} /> : null}

      <div className="min-h-[420px]">
        {singleView ?? (activeTab ? content[activeTab] : null)}
      </div>
    </div>
  );
}