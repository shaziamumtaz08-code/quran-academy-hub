import { Card, CardContent } from "@/components/ui/card";
import { Users, RefreshCw, AlertTriangle, XCircle, FileText } from "lucide-react";

interface ImportSummary {
  total: number;
  new: number;
  updates: number;
  warnings: number;
  errors: number;
}

interface ImportSummaryCardsProps {
  summary: ImportSummary;
}

export function ImportSummaryCards({ summary }: ImportSummaryCardsProps) {
  const cards = [
    {
      label: "Total Rows",
      value: summary.total,
      icon: FileText,
      color: "text-muted-foreground",
      bgColor: "bg-muted/50",
    },
    {
      label: "New",
      value: summary.new,
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "Updates",
      value: summary.updates,
      icon: RefreshCw,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Warnings",
      value: summary.warnings,
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      label: "Errors",
      value: summary.errors,
      icon: XCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className={`${card.bgColor} border-0`}>
          <CardContent className="p-3 flex flex-col items-center justify-center text-center">
            <card.icon className={`h-5 w-5 ${card.color} mb-1`} />
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-muted-foreground">{card.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
