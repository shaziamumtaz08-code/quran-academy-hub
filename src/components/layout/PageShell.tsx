import type { ReactNode } from "react";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";

interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-12 md:py-10 lg:px-16">
      <PageBreadcrumb />
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground md:text-3xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}