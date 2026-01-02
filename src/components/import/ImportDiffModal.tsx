import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

interface DiffEntry {
  old: any;
  new: any;
}

interface ImportDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowData: {
    rowNum: number;
    email?: string;
    name?: string;
    diff: Record<string, DiffEntry> | null;
  } | null;
}

export function ImportDiffModal({ open, onOpenChange, rowData }: ImportDiffModalProps) {
  if (!rowData || !rowData.diff) return null;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "(empty)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };

  const fieldLabels: Record<string, string> = {
    full_name: "Full Name",
    whatsapp_number: "WhatsApp Number",
    age: "Age",
    gender: "Gender",
    subject: "Subject",
    duration_minutes: "Duration",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              UPDATE
            </Badge>
            Row {rowData.rowNum}
            {rowData.email && (
              <span className="text-muted-foreground font-normal text-sm">
                ({rowData.email})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <p className="text-sm text-muted-foreground">
            The following fields will be updated:
          </p>
          
          <div className="rounded-lg border divide-y">
            {Object.entries(rowData.diff).map(([field, values]) => (
              <div key={field} className="p-3 flex items-center gap-3">
                <div className="w-28 text-sm font-medium text-muted-foreground">
                  {fieldLabels[field] || field}
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm line-through text-muted-foreground bg-destructive/10 px-2 py-0.5 rounded">
                    {formatValue(values.old)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
                    {formatValue(values.new)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
