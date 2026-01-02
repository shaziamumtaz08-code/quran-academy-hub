import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ImportSummaryCards } from "./ImportSummaryCards";
import { ImportPreviewTable } from "./ImportPreviewTable";

type ImportType = "users" | "assignments" | "schedules";
type WizardStep = "upload" | "preview" | "importing" | "done";

interface ValidationRow {
  rowNum: number;
  status: "new" | "update" | "warning" | "error";
  errors: string[];
  warnings: string[];
  data: Record<string, any>;
  diff: Record<string, { old: any; new: any }> | null;
  existingId: string | null;
}

interface ValidationSummary {
  total: number;
  new: number;
  updates: number;
  warnings: number;
  errors: number;
}

interface ImportResult {
  rowNum: number;
  success: boolean;
  action: "created" | "updated" | "skipped";
  id: string | null;
  error: string | null;
}

interface BulkImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
  onComplete?: () => void;
}

const COUNTRY_OPTIONS = [
  { code: "PK", label: "Pakistan (+92)" },
  { code: "US", label: "United States (+1)" },
  { code: "GB", label: "United Kingdom (+44)" },
  { code: "AE", label: "UAE (+971)" },
  { code: "SA", label: "Saudi Arabia (+966)" },
  { code: "IN", label: "India (+91)" },
  { code: "BD", label: "Bangladesh (+880)" },
];

const TYPE_LABELS: Record<ImportType, string> = {
  users: "Users",
  assignments: "Assignments",
  schedules: "Schedules",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });
      rows.push(row);
    }
  }

  return rows;
}

function generateTemplate(type: ImportType): string {
  switch (type) {
    case "users":
      return `email,full_name,role,whatsapp_number,password,age,gender
john.doe@example.com,John Doe,teacher,+923001234567,SecurePass123,35,male
jane.smith@example.com,Jane Smith,student,+923009876543,StudentPass1,16,female
parent@example.com,Ahmed Khan,parent,+923331234567,ParentPass1,45,male`;

    case "assignments":
      return `teacher_name,student_name,subject_name
Mohammad Hassan,Fatima Ali,Hifz
Mohammad Hassan,Yusuf Malik,Hifz
Aisha Siddiqui,Ahmed Khan,Tajweed`;

    case "schedules":
      return `teacher_name,student_name,day_of_week,time,duration_minutes
Mohammad Hassan,Fatima Ali,Monday,09:00,30
Mohammad Hassan,Fatima Ali,Wednesday,09:00,30
Aisha Siddiqui,Ahmed Khan,Tuesday,14:00,45`;

    default:
      return "";
  }
}

export function BulkImportWizard({
  open,
  onOpenChange,
  type,
  onComplete,
}: BulkImportWizardProps) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [defaultCountry, setDefaultCountry] = useState("PK");
  const [isValidating, setIsValidating] = useState(false);
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    created: number;
    updated: number;
  } | null>(null);

  const handleDownloadTemplate = () => {
    const csv = generateTemplate(type);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_import_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsValidating(true);

      try {
        const text = await file.text();
        const rows = parseCSV(text);

        if (rows.length === 0) {
          toast.error("No valid rows found in CSV");
          setIsValidating(false);
          return;
        }

        // Call validation endpoint
        const { data, error } = await supabase.functions.invoke("bulk-validate-import", {
          body: { type, rows, defaultCountry },
        });

        if (error) throw error;

        setValidationRows(data.rows);
        setValidationSummary(data.summary);
        setStep("preview");
      } catch (error: any) {
        console.error("Validation error:", error);
        toast.error(error.message || "Failed to validate CSV");
      } finally {
        setIsValidating(false);
      }
    },
    [type, defaultCountry]
  );

  const handleImport = async () => {
    if (!validationRows.length) return;

    // Check for critical errors
    const hasErrors = validationRows.some((r) => r.status === "error");
    if (hasErrors) {
      toast.error("Cannot import: Please fix all errors first");
      return;
    }

    setStep("importing");
    setImportProgress(10);

    try {
      // Filter out rows that will be processed
      const rowsToImport = validationRows.filter(
        (r) => r.status === "new" || r.status === "update" || r.status === "warning"
      );

      setImportProgress(30);

      const { data, error } = await supabase.functions.invoke("bulk-import-execute", {
        body: { type, rows: rowsToImport },
      });

      if (error) throw error;

      setImportProgress(100);
      setImportResults(data.summary);
      setStep("done");

      toast.success(
        `Import complete: ${data.summary.created} created, ${data.summary.updated} updated`
      );
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Import failed");
      setStep("preview");
    }
  };

  const handleClose = () => {
    setStep("upload");
    setValidationRows([]);
    setValidationSummary(null);
    setImportProgress(0);
    setImportResults(null);
    onOpenChange(false);
    if (step === "done" && onComplete) {
      onComplete();
    }
  };

  const canImport =
    validationSummary &&
    validationSummary.errors === 0 &&
    (validationSummary.new > 0 || validationSummary.updates > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import {TYPE_LABELS[type]}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV file to import multiple records at once."}
            {step === "preview" && "Review the validation results before importing."}
            {step === "importing" && "Import in progress..."}
            {step === "done" && "Import completed!"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-6">
              {/* Template Download */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <h4 className="font-medium">Download Template</h4>
                  <p className="text-sm text-muted-foreground">
                    Get a CSV template with the correct format and example data
                  </p>
                </div>
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>

              {/* Country Selector for Phone Parsing */}
              {type === "users" && (
                <div className="space-y-2">
                  <Label>Default Country (for phone number parsing)</Label>
                  <Select value={defaultCountry} onValueChange={setDefaultCountry}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_OPTIONS.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Local phone numbers without country code will use this prefix
                  </p>
                </div>
              )}

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Upload CSV File</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isValidating}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
                        <span className="text-muted-foreground">Validating...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <span className="font-medium">Click to upload CSV</span>
                        <span className="text-sm text-muted-foreground">
                          or drag and drop
                        </span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && validationSummary && (
            <div className="space-y-4">
              <ImportSummaryCards summary={validationSummary} />

              {validationSummary.errors > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                  <strong>⚠️ {validationSummary.errors} error(s) found.</strong> Fix these
                  issues in your CSV and re-upload, or they will be skipped.
                </div>
              )}

              <ImportPreviewTable rows={validationRows} type={type} />
            </div>
          )}

          {/* Step 3: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center">
                <h4 className="font-medium">Importing records...</h4>
                <p className="text-sm text-muted-foreground">Please wait</p>
              </div>
              <Progress value={importProgress} className="w-64" />
            </div>
          )}

          {/* Step 4: Done */}
          {step === "done" && importResults && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <h4 className="text-xl font-medium">Import Complete!</h4>
                <p className="text-muted-foreground mt-1">
                  Successfully processed {importResults.success} records
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600">
                    {importResults.created}
                  </div>
                  <div className="text-sm text-muted-foreground">Created</div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {importResults.updated}
                  </div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                </div>
              </div>
              {importResults.failed > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span>{importResults.failed} failed</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setValidationRows([]);
                  setValidationSummary(null);
                }}
              >
                Back
              </Button>
              <Button onClick={handleImport} disabled={!canImport}>
                {canImport
                  ? `Import ${validationSummary.new + validationSummary.updates} Records`
                  : "Fix Errors to Import"}
              </Button>
            </>
          )}

          {step === "done" && (
            <Button onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
