import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { ImportDiffModal } from "./ImportDiffModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ValidationRow {
  rowNum: number;
  status: "new" | "update" | "warning" | "error";
  errors: string[];
  warnings: string[];
  data: Record<string, any>;
  diff: Record<string, { old: any; new: any }> | null;
  existingId: string | null;
}

interface ImportPreviewTableProps {
  rows: ValidationRow[];
  type: "users" | "assignments" | "schedules";
}

const statusConfig = {
  new: {
    icon: CheckCircle2,
    label: "NEW",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  update: {
    icon: RefreshCw,
    label: "UPDATE",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  warning: {
    icon: AlertTriangle,
    label: "WARNING",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  error: {
    icon: AlertCircle,
    label: "ERROR",
    className: "bg-destructive/20 text-destructive",
  },
};

export function ImportPreviewTable({ rows, type }: ImportPreviewTableProps) {
  const [selectedRow, setSelectedRow] = useState<ValidationRow | null>(null);
  const [diffModalOpen, setDiffModalOpen] = useState(false);

  const getColumns = () => {
    switch (type) {
      case "users":
        return ["Row", "Status", "Email", "Name", "Role", "Phone", "Issues"];
      case "assignments":
        return ["Row", "Status", "Teacher", "Student", "Subject", "Issues"];
      case "schedules":
        return ["Row", "Status", "Teacher", "Student", "Day", "Time", "Duration", "Issues"];
      default:
        return [];
    }
  };

  const getCellValue = (row: ValidationRow, column: string) => {
    switch (column) {
      case "Row":
        return row.rowNum;
      case "Status":
        return null; // Handled separately
      case "Email":
        return row.data.email || "-";
      case "Name":
        return row.data.full_name || "-";
      case "Role":
        return row.data.role || "-";
      case "Phone":
        return row.data.whatsapp_number || "-";
      case "Teacher":
        return row.data.teacher_name || "-";
      case "Student":
        return row.data.student_name || "-";
      case "Subject":
        return row.data.subject_name || "-";
      case "Day":
        return row.data.day_of_week || "-";
      case "Time":
        return row.data.student_local_time || "-";
      case "Duration":
        return row.data.duration_minutes ? `${row.data.duration_minutes}m` : "-";
      case "Issues":
        return null; // Handled separately
      default:
        return "-";
    }
  };

  const handleViewDiff = (row: ValidationRow) => {
    setSelectedRow(row);
    setDiffModalOpen(true);
  };

  const columns = getColumns();

  return (
    <>
      <ScrollArea className="h-[400px] rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col} className="whitespace-nowrap">
                  {col}
                </TableHead>
              ))}
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const StatusIcon = statusConfig[row.status].icon;
              const hasIssues = row.errors.length > 0 || row.warnings.length > 0;

              return (
                <TableRow
                  key={row.rowNum}
                  className={
                    row.status === "error"
                      ? "bg-destructive/5"
                      : row.status === "update"
                      ? "bg-blue-50/50 dark:bg-blue-950/20"
                      : row.status === "warning"
                      ? "bg-amber-50/50 dark:bg-amber-950/20"
                      : ""
                  }
                >
                  {columns.map((col) => (
                    <TableCell key={col} className="py-2">
                      {col === "Status" ? (
                        <Badge
                          variant="secondary"
                          className={`${statusConfig[row.status].className} gap-1`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig[row.status].label}
                        </Badge>
                      ) : col === "Issues" ? (
                        hasIssues ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  {row.errors.length > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                      {row.errors.length}
                                    </Badge>
                                  )}
                                  {row.warnings.length > 0 && (
                                    <Badge
                                      variant="secondary"
                                      className="bg-amber-100 text-amber-700 text-xs"
                                    >
                                      {row.warnings.length}
                                    </Badge>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <div className="space-y-1">
                                  {row.errors.map((e, i) => (
                                    <div key={i} className="text-destructive text-xs">
                                      ❌ {e}
                                    </div>
                                  ))}
                                  {row.warnings.map((w, i) => (
                                    <div key={i} className="text-amber-600 text-xs">
                                      ⚠️ {w}
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )
                      ) : (
                        <span
                          className={
                            row.diff && row.diff[col.toLowerCase()]
                              ? "font-medium"
                              : ""
                          }
                        >
                          {getCellValue(row, col)}
                        </span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="py-2">
                    {row.status === "update" && row.diff && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleViewDiff(row)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Diff
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <ImportDiffModal
        open={diffModalOpen}
        onOpenChange={setDiffModalOpen}
        rowData={
          selectedRow
            ? {
                rowNum: selectedRow.rowNum,
                email: selectedRow.data.email,
                name: selectedRow.data.full_name || selectedRow.data.teacher_name,
                diff: selectedRow.diff,
              }
            : null
        }
      />
    </>
  );
}
