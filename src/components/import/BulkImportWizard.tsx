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
import { Progress } from "@/components/ui/progress";
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { ImportSummaryCards } from "./ImportSummaryCards";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { useImportLogic, type ImportType, type ImportResultRow } from "@/hooks/useImportLogic";
import { ScrollArea } from "@/components/ui/scroll-area";

// E.164 format is required for all phone numbers (no country selector needed)

const TYPE_LABELS: Record<ImportType, string> = {
  users: "Users",
  assignments: "Assignments",
  schedules: "Schedules",
};

// ============= Props =============
interface BulkImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
  onComplete?: () => void;
}

// ============= Component =============
export function BulkImportWizard({
  open,
  onOpenChange,
  type,
  onComplete,
}: BulkImportWizardProps) {
  const {
    step,
    isValidating,
    validationRows,
    validationSummary,
    importProgress,
    importResults,
    canImport,
    importCount,
    downloadTemplate,
    validateFile,
    executeImport,
    reset,
    goBack,
  } = useImportLogic(type, onComplete);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateFile(file);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
    if (step === "done" && onComplete) {
      onComplete();
    }
  };

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
            <UploadStep
              type={type}
              isValidating={isValidating}
              onDownloadTemplate={downloadTemplate}
              onFileChange={handleFileChange}
            />
          )}

          {/* Step 2: Preview */}
          {step === "preview" && validationSummary && (
            <PreviewStep
              type={type}
              validationSummary={validationSummary}
              validationRows={validationRows}
            />
          )}

          {/* Step 3: Importing */}
          {step === "importing" && (
            <ImportingStep progress={importProgress} />
          )}

          {/* Step 4: Done */}
          {step === "done" && importResults && (
            <DoneStep results={importResults} />
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
              <Button variant="outline" onClick={goBack}>
                Back
              </Button>
              <Button onClick={executeImport} disabled={!canImport}>
                {canImport
                  ? `Import ${importCount} Records`
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

// ============= Sub-Components =============

interface UploadStepProps {
  type: ImportType;
  isValidating: boolean;
  onDownloadTemplate: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function UploadStep({
  type,
  isValidating,
  onDownloadTemplate,
  onFileChange,
}: UploadStepProps) {
  return (
    <div className="space-y-6">
      {/* Template Download */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <h4 className="font-medium">Download Template</h4>
          <p className="text-sm text-muted-foreground">
            Get a CSV template with the correct format and example data
          </p>
        </div>
        <Button variant="outline" onClick={onDownloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Template
        </Button>
      </div>

      {/* E.164 Phone Format Info */}
      {type === "users" && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <h4 className="font-medium text-blue-800 dark:text-blue-300 text-sm">Phone Number Format (E.164)</h4>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
            All phone numbers must include the country code with a + prefix.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs font-mono bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">+923001234567</span>
            <span className="text-xs font-mono bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">+971564548951</span>
            <span className="text-xs font-mono bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">+15108572790</span>
          </div>
        </div>
      )}

      {/* Schedule Import Instructions */}
      {type === "schedules" && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-3">
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-300 text-sm">How to Add Multiple Days</h4>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
              Add <strong>one row per schedule slot</strong>. For multiple days, repeat the student with different days.
            </p>
          </div>
          
          <div className="bg-blue-100/50 dark:bg-blue-800/30 rounded p-2">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">Example: Schedule Fatima for Mon, Wed, Fri</p>
            <div className="font-mono text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
              <div>Mohammad Hassan,Fatima Ali,<strong>Monday</strong>,09:00,30</div>
              <div>Mohammad Hassan,Fatima Ali,<strong>Wednesday</strong>,09:00,30</div>
              <div>Mohammad Hassan,Fatima Ali,<strong>Friday</strong>,09:00,30</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-300">Valid Days:</p>
              <p className="text-blue-700 dark:text-blue-400">Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday</p>
            </div>
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-300">Time Format:</p>
              <p className="text-blue-700 dark:text-blue-400">24-hour format (e.g., 09:00, 14:30)</p>
            </div>
          </div>

          <div className="bg-amber-100/50 dark:bg-amber-800/30 rounded p-2 text-xs">
            <p className="font-medium text-amber-800 dark:text-amber-300">⚠️ Student Conflict Rule:</p>
            <p className="text-amber-700 dark:text-amber-400">A student cannot be scheduled with different teachers at the same day and time. Such conflicts will be flagged.</p>
          </div>
        </div>
      )}

      {/* File Upload */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Upload CSV File</p>
        <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
          <Input
            type="file"
            accept=".csv"
            onChange={onFileChange}
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
  );
}

interface PreviewStepProps {
  type: ImportType;
  validationSummary: { total: number; new: number; updates: number; warnings: number; errors: number };
  validationRows: any[];
}

function PreviewStep({ type, validationSummary, validationRows }: PreviewStepProps) {
  return (
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
  );
}

interface ImportingStepProps {
  progress: number;
}

function ImportingStep({ progress }: ImportingStepProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-12 w-12 text-primary animate-spin" />
      <div className="text-center">
        <h4 className="font-medium">Importing records...</h4>
        <p className="text-sm text-muted-foreground">Please wait</p>
      </div>
      <Progress value={progress} className="w-64" />
    </div>
  );
}

interface DoneStepProps {
  results: { success: number; failed: number; created: number; updated: number; failedRows?: ImportResultRow[] };
}

function DoneStep({ results }: DoneStepProps) {
  const hasFailures = results.failed > 0 && results.failedRows && results.failedRows.length > 0;
  
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
        hasFailures 
          ? "bg-amber-100 dark:bg-amber-900/30" 
          : "bg-emerald-100 dark:bg-emerald-900/30"
      }`}>
        {hasFailures ? (
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        ) : (
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        )}
      </div>
      <div className="text-center">
        <h4 className="text-xl font-medium">
          {hasFailures ? "Import Completed with Errors" : "Import Complete!"}
        </h4>
        <p className="text-muted-foreground mt-1">
          Successfully processed {results.success} records
          {hasFailures && `, ${results.failed} failed`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <div className="text-2xl font-bold text-emerald-600">
            {results.created}
          </div>
          <div className="text-sm text-muted-foreground">Created</div>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {results.updated}
          </div>
          <div className="text-sm text-muted-foreground">Updated</div>
        </div>
      </div>
      
      {/* Detailed Failed Rows List */}
      {hasFailures && results.failedRows && (
        <div className="w-full max-w-xl">
          <div className="flex items-center gap-2 text-destructive mb-3">
            <XCircle className="h-4 w-4" />
            <span className="font-medium">{results.failed} Failed Records</span>
          </div>
          <ScrollArea className="h-48 w-full rounded-md border border-destructive/30 bg-destructive/5">
            <div className="p-3 space-y-2">
              {results.failedRows.map((row) => (
                <div 
                  key={row.rowNum} 
                  className="p-2 bg-background rounded border border-destructive/20 text-sm"
                >
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                      Row {row.rowNum}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">
                        {row.userName || "Unknown"}
                      </span>
                      <p className="text-destructive text-xs mt-0.5 break-words">
                        {row.error || "Unknown error"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
