import { useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ============= Types =============
export type ImportType = "users" | "assignments" | "schedules";
export type WizardStep = "upload" | "preview" | "importing" | "done";

export interface ValidationRow {
  rowNum: number;
  status: "new" | "update" | "warning" | "error";
  errors: string[];
  warnings: string[];
  data: Record<string, any>;
  diff: Record<string, { old: any; new: any }> | null;
  existingId: string | null;
}

export interface ValidationSummary {
  total: number;
  new: number;
  updates: number;
  warnings: number;
  errors: number;
}

export interface ImportResultRow {
  rowNum: number;
  success: boolean;
  action: "created" | "updated" | "skipped";
  id: string | null;
  error: string | null;
  userName: string | null;
}

export interface ImportResults {
  success: number;
  failed: number;
  created: number;
  updated: number;
  failedRows: ImportResultRow[];
}

// ============= CSV Parsing =============
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
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

// ============= Template Generation =============
export function generateTemplate(type: ImportType): string {
  switch (type) {
    case "users":
      // Phone must be E.164 format: +<country_code><number> (e.g., +923001234567)
      return `email,full_name,role,phone,password,age,gender
john.doe@example.com,John Doe,teacher,+923001234567,SecurePass123,35,male
jane.smith@example.com,Jane Smith,student,+971564548951,StudentPass1,16,female
parent@example.com,Ahmed Khan,parent,+15108572790,ParentPass1,45,male`;

    case "assignments":
      // student_name and teacher_name are REQUIRED (primary identity)
      // guardian_email is OPTIONAL (hint only, not used for identity resolution)
      return `student_name,teacher_name,subject_name,guardian_email
Fatima Ali,Mohammad Hassan,Hifz,parent@example.com
Yusuf Malik,Mohammad Hassan,Hifz,parent@example.com
Ahmed Khan,Aisha Siddiqui,Tajweed,ahmed.parent@example.com`;

    case "schedules":
      // Template with clear multi-day examples
      // Each row = one schedule slot. To schedule multiple days, add multiple rows for the same student.
      return `teacher_name,student_name,day_of_week,time,duration_minutes
Mohammad Hassan,Fatima Ali,Monday,09:00,30
Mohammad Hassan,Fatima Ali,Wednesday,09:00,30
Mohammad Hassan,Fatima Ali,Friday,09:00,30
Mohammad Hassan,Yusuf Malik,Monday,09:30,30
Mohammad Hassan,Yusuf Malik,Thursday,09:30,30
Aisha Siddiqui,Ahmed Khan,Tuesday,14:00,45
Aisha Siddiqui,Ahmed Khan,Saturday,14:00,45`;

    default:
      return "";
  }
}

// ============= Hook =============
export function useImportLogic(type: ImportType, onComplete?: () => void) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [isValidating, setIsValidating] = useState(false);
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);

  const downloadTemplate = useCallback(() => {
    const csv = generateTemplate(type);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_import_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  }, [type]);

  const validateFile = useCallback(
    async (file: File) => {
      setIsValidating(true);

      try {
        const text = await file.text();
        const rows = parseCSV(text);

        if (rows.length === 0) {
          toast.error("No valid rows found in CSV");
          setIsValidating(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke("bulk-validate-import", {
          body: { type, rows },
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
    [type]
  );

  const executeImport = useCallback(async () => {
    if (!validationRows.length) return;

    const hasErrors = validationRows.some((r) => r.status === "error");
    if (hasErrors) {
      toast.error("Cannot import: Please fix all errors first");
      return;
    }

    setStep("importing");
    setImportProgress(10);

    try {
      const rowsToImport = validationRows.filter(
        (r) => r.status === "new" || r.status === "update" || r.status === "warning"
      );

      setImportProgress(30);

      const { data, error } = await supabase.functions.invoke("bulk-import-execute", {
        body: { type, rows: rowsToImport },
      });

      if (error) throw error;

      setImportProgress(100);
      
      // Extract failed rows for detailed display
      const failedRows = data.results?.filter((r: ImportResultRow) => !r.success) || [];
      
      setImportResults({
        ...data.summary,
        failedRows,
      });
      setStep("done");

      if (data.summary.failed > 0) {
        toast.warning(
          `Import complete with errors: ${data.summary.created} created, ${data.summary.updated} updated, ${data.summary.failed} failed`
        );
      } else {
        toast.success(
          `Import complete: ${data.summary.created} created, ${data.summary.updated} updated`
        );
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Import failed");
      setStep("preview");
    }
  }, [type, validationRows]);

  const reset = useCallback(() => {
    setStep("upload");
    setValidationRows([]);
    setValidationSummary(null);
    setImportProgress(0);
    setImportResults(null);
  }, []);

  const goBack = useCallback(() => {
    setStep("upload");
    setValidationRows([]);
    setValidationSummary(null);
  }, []);

  const canImport =
    validationSummary &&
    validationSummary.errors === 0 &&
    (validationSummary.new > 0 || validationSummary.updates > 0);

  const importCount = validationSummary
    ? validationSummary.new + validationSummary.updates
    : 0;

  return {
    // State
    step,
    isValidating,
    validationRows,
    validationSummary,
    importProgress,
    importResults,
    canImport,
    importCount,
    // Actions
    downloadTemplate,
    validateFile,
    executeImport,
    reset,
    goBack,
  };
}
