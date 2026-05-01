import { useState, useCallback } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
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
      // Full profile fields template — see USER_TEMPLATE_COLUMNS for canonical order.
      // For users, prefer downloadUsersTemplateXLSX() which produces a 2-sheet workbook
      // with an Instructions tab. This CSV is kept as a fallback.
      return `full_name,email,password,role,gender,age,date_of_birth,phone_whatsapp,phone_alternate,country,city,timezone,nationality,first_language,arabic_level,division,branch,parent_email,guardian_type,special_needs,learning_goals,how_did_you_hear
John Doe,john.doe@example.com,SecurePass1,teacher,male,35,1989-04-12,+923001234567,,Pakistan,Karachi,Asia/Karachi,Pakistani,Urdu,advanced,one_to_one,Main,,none,,,
Jane Smith,jane.smith@example.com,,student,female,16,2009-09-01,+971564548951,,UAE,Dubai,Asia/Dubai,Emirati,Arabic,intermediate,group,Main,parent@example.com,parent,,Improve fluency,Friend referral
Ahmed Khan,parent@example.com,ParentPass1,parent,male,45,1980-01-15,+15108572790,,USA,New York,America/New_York,Pakistani-American,Urdu,beginner,one_to_one,Main,,none,,,Google search`;

    case "assignments":
      // student_name and teacher_name are REQUIRED (primary identity)
      // status, payout_amount, payout_type, effective_from are OPTIONAL (for partial updates)
      // guardian_email is OPTIONAL (hint only, not used for identity resolution)
      return `student_name,teacher_name,subject_name,status,payout_amount,payout_type,effective_from,guardian_email
Fatima Ali,Mohammad Hassan,Hifz,active,2500,monthly,2026-01-01,parent@example.com
Yusuf Malik,Mohammad Hassan,Hifz,active,3000,per_class,,parent@example.com
Ahmed Khan,Aisha Siddiqui,Tajweed,,,,,ahmed.parent@example.com`;

    case "schedules":
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

// Canonical user template column definitions (used for the XLSX template).
export const USER_TEMPLATE_COLUMNS: Array<{
  key: string;
  required: boolean;
  description: string;
  validValues?: string;
  example: string;
}> = [
  { key: "full_name", required: true, description: "User's full name", example: "John Doe" },
  { key: "email", required: true, description: "Unique email address (used for login)", example: "john.doe@example.com" },
  { key: "password", required: false, description: "Initial password. Leave blank to send an invite email instead.", example: "SecurePass1" },
  { key: "role", required: true, description: "Account role", validValues: "student | teacher | parent | examiner | admin_division | admin_admissions | admin_fees | admin_academic", example: "teacher" },
  { key: "gender", required: false, description: "Gender", validValues: "male | female", example: "male" },
  { key: "age", required: false, description: "Age in years (1–120)", example: "35" },
  { key: "date_of_birth", required: false, description: "Date of birth (YYYY-MM-DD)", example: "1989-04-12" },
  { key: "phone_whatsapp", required: false, description: "Primary WhatsApp number in E.164 format (+countrycode...)", example: "+923001234567" },
  { key: "phone_alternate", required: false, description: "Alternate phone number in E.164 format", example: "+923009876543" },
  { key: "country", required: false, description: "Country name", example: "Pakistan" },
  { key: "city", required: false, description: "City name", example: "Karachi" },
  { key: "timezone", required: false, description: "IANA timezone. If blank, derived from country.", example: "Asia/Karachi" },
  { key: "nationality", required: false, description: "Nationality", example: "Pakistani" },
  { key: "first_language", required: false, description: "First language", example: "Urdu" },
  { key: "arabic_level", required: false, description: "Self-reported Arabic level", validValues: "none | beginner | intermediate | advanced | native", example: "intermediate" },
  { key: "division", required: false, description: "Division to associate the user with", validValues: "one_to_one | group | recorded", example: "one_to_one" },
  { key: "branch", required: false, description: "Branch name (must match an existing branch)", example: "Main" },
  { key: "parent_email", required: false, description: "Parent email — required only when role=student AND guardian_type=parent. MUST be different from the student's own email.", example: "parent@example.com" },
  { key: "guardian_type", required: false, description: "Guardian relationship", validValues: "none | parent | guardian | emergency_contact", example: "parent" },
  { key: "special_needs", required: false, description: "Notes about special needs (free text)", example: "" },
  { key: "learning_goals", required: false, description: "Learning goals (free text)", example: "Improve fluency" },
  { key: "how_did_you_hear", required: false, description: "How they heard about us (free text)", example: "Friend referral" },
];

export function downloadUsersTemplateXLSX(): void {
  const cols = USER_TEMPLATE_COLUMNS;
  const headerRow = cols.map((c) => c.key);
  const exampleRows = [
    {
      full_name: "John Doe", email: "john.doe@example.com", password: "SecurePass1", role: "teacher",
      gender: "male", age: 35, date_of_birth: "1989-04-12", phone_whatsapp: "+923001234567",
      phone_alternate: "", country: "Pakistan", city: "Karachi", timezone: "Asia/Karachi",
      nationality: "Pakistani", first_language: "Urdu", arabic_level: "advanced",
      division: "one_to_one", branch: "Main", parent_email: "", guardian_type: "none",
      special_needs: "", learning_goals: "", how_did_you_hear: "",
    },
    {
      full_name: "Jane Smith", email: "jane.smith@example.com", password: "", role: "student",
      gender: "female", age: 16, date_of_birth: "2009-09-01", phone_whatsapp: "+971564548951",
      phone_alternate: "", country: "UAE", city: "Dubai", timezone: "Asia/Dubai",
      nationality: "Emirati", first_language: "Arabic", arabic_level: "intermediate",
      division: "group", branch: "Main", parent_email: "parent@example.com", guardian_type: "parent",
      special_needs: "", learning_goals: "Improve fluency", how_did_you_hear: "Friend referral",
    },
    {
      full_name: "Ahmed Khan", email: "parent@example.com", password: "ParentPass1", role: "parent",
      gender: "male", age: 45, date_of_birth: "1980-01-15", phone_whatsapp: "+15108572790",
      phone_alternate: "", country: "USA", city: "New York", timezone: "America/New_York",
      nationality: "Pakistani-American", first_language: "Urdu", arabic_level: "beginner",
      division: "one_to_one", branch: "Main", parent_email: "", guardian_type: "none",
      special_needs: "", learning_goals: "", how_did_you_hear: "Google search",
    },
  ];

  const dataSheet = XLSX.utils.json_to_sheet(exampleRows, { header: headerRow });

  const instructionRows: any[][] = [
    ["Column", "Required", "Valid Values", "Description", "Example"],
    ...cols.map((c) => [c.key, c.required ? "Yes" : "No", c.validValues || "—", c.description, c.example]),
    [],
    ["Notes", "", "", "", ""],
    ["• Email must be UNIQUE per user. To give an existing user an additional role, use 'Add Role' in the UI instead of re-importing.", "", "", "", ""],
    ["• Password is optional — if blank, the system will send an invite email so the user can set their own password.", "", "", "", ""],
    ["• parent_email is only required when role=student AND guardian_type=parent. It MUST be different from the student's email.", "", "", "", ""],
    ["• Phone numbers must be in E.164 format: +<country_code><number> (e.g. +923001234567).", "", "", "", ""],
    ["• If timezone is blank, it will be inferred from the country.", "", "", "", ""],
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionRows);
  // Widen Description column so it's readable
  (instructionsSheet as any)["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 38 }, { wch: 70 }, { wch: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, "Users");
  XLSX.utils.book_append_sheet(wb, instructionsSheet, "Instructions");

  XLSX.writeFile(wb, "users_import_template.xlsx");
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

    setStep("importing");
    setImportProgress(10);

    try {
      const rowsToImport = validationRows.filter(
        (r) => r.status === "new" || r.status === "update" || r.status === "warning"
      );

      if (rowsToImport.length === 0) {
        toast.error("No valid rows to import");
        setStep("preview");
        return;
      }

      setImportProgress(30);

      const { data, error } = await supabase.functions.invoke("bulk-import-execute", {
        body: { type, rows: rowsToImport },
      });

      if (error) throw error;

      setImportProgress(100);
      
      const failedRows = data.results?.filter((r: ImportResultRow) => !r.success) || [];
      
      setImportResults({
        ...data.summary,
        failedRows,
      });
      setStep("done");

      const skippedErrors = validationRows.filter((r) => r.status === "error").length;
      if (data.summary.failed > 0 || skippedErrors > 0) {
        toast.warning(
          `Import complete: ${data.summary.created} created, ${data.summary.updated} updated${skippedErrors > 0 ? `, ${skippedErrors} error rows skipped` : ""}`
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
    (validationSummary.new > 0 || validationSummary.updates > 0);

  const importCount = validationSummary
    ? validationSummary.new + validationSummary.updates
    : 0;

  const errorRows = validationRows.filter((r) => r.status === "error");

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
    errorRows,
    // Actions
    downloadTemplate,
    validateFile,
    executeImport,
    reset,
    goBack,
  };
}
