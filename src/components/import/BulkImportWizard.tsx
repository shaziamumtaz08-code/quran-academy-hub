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
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { ImportSummaryCards } from "./ImportSummaryCards";
import { ImportPreviewTable } from "./ImportPreviewTable";
import { useImportLogic, type ImportType } from "@/hooks/useImportLogic";

// ============= Constants =============
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
    defaultCountry,
    isValidating,
    validationRows,
    validationSummary,
    importProgress,
    importResults,
    canImport,
    importCount,
    setDefaultCountry,
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
              defaultCountry={defaultCountry}
              setDefaultCountry={setDefaultCountry}
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
  defaultCountry: string;
  setDefaultCountry: (country: string) => void;
  isValidating: boolean;
  onDownloadTemplate: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function UploadStep({
  type,
  defaultCountry,
  setDefaultCountry,
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
  results: { success: number; failed: number; created: number; updated: number };
}

function DoneStep({ results }: DoneStepProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <div className="text-center">
        <h4 className="text-xl font-medium">Import Complete!</h4>
        <p className="text-muted-foreground mt-1">
          Successfully processed {results.success} records
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
      {results.failed > 0 && (
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-4 w-4" />
          <span>{results.failed} failed</span>
        </div>
      )}
    </div>
  );
}
