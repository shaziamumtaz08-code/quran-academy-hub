import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { TemplateStructure, StoredCriteriaEntry } from '@/types/reportCard';
import type { Database } from '@/integrations/supabase/types';

type ExamTenure = Database['public']['Enums']['exam_tenure'];

interface ReportTemplate {
  id: string;
  name: string;
  subject_id: string | null;
  tenure: ExamTenure;
  structure_json: TemplateStructure | null;
}

interface ParsedRow {
  rowNum: number;
  studentName: string;
  studentId?: string;
  examDate: string;
  criteriaMarks: Record<string, number>;
  examinerRemarks?: string;
  publicRemarks?: string;
  status: 'valid' | 'warning' | 'error';
  errors: string[];
}

interface BulkReportCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type Step = 'select-template' | 'upload' | 'preview' | 'importing' | 'done';

export function BulkReportCardDialog({
  open,
  onOpenChange,
  onComplete,
}: BulkReportCardDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('select-template');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    failedRows: { rowNum: number; studentName: string; error: string }[];
  } | null>(null);

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['active-report-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_templates')
        .select('id, name, subject_id, tenure, structure_json')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []).map((d) => ({
        ...d,
        structure_json: d.structure_json as unknown as TemplateStructure | null,
      })) as ReportTemplate[];
    },
  });

  // Fetch students for name matching
  const { data: students = [] } = useQuery({
    queryKey: ['all-students-for-bulk'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      if (error) throw error;

      const { data: studentRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      const studentIds = new Set((studentRoles || []).map((r) => r.user_id));
      return (profiles || []).filter((p) => studentIds.has(p.id));
    },
  });

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null;
  }, [selectedTemplateId, templates]);

  const flatCriteria = useMemo(() => {
    if (!selectedTemplate?.structure_json) return [];
    return selectedTemplate.structure_json.sections.flatMap((s) =>
      s.criteria.map((c) => ({ sectionId: s.id, sectionTitle: s.title, criteria: c }))
    );
  }, [selectedTemplate]);

  const validationSummary = useMemo(() => {
    return {
      total: parsedRows.length,
      valid: parsedRows.filter((r) => r.status === 'valid').length,
      warnings: parsedRows.filter((r) => r.status === 'warning').length,
      errors: parsedRows.filter((r) => r.status === 'error').length,
    };
  }, [parsedRows]);

  const canImport = validationSummary.valid > 0;

  const downloadTemplate = () => {
    if (!selectedTemplate || flatCriteria.length === 0) {
      toast({ title: 'Error', description: 'No template selected or template has no criteria', variant: 'destructive' });
      return;
    }

    // Build CSV headers
    const headers = [
      'student_name',
      'exam_date',
      ...flatCriteria.map((c) => `${c.criteria.criteria_name} (max: ${c.criteria.max_marks})`),
      'examiner_remarks',
      'public_remarks',
    ];

    // Sample row
    const sampleRow = [
      'Student Full Name',
      new Date().toISOString().split('T')[0],
      ...flatCriteria.map((c) => Math.floor(c.criteria.max_marks * 0.8).toString()),
      'Good performance',
      'Keep improving',
    ];

    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_card_template_${selectedTemplate.name.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  const validateFile = async (file: File) => {
    setIsValidating(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        toast({ title: 'Error', description: 'CSV must have header row and at least one data row', variant: 'destructive' });
        setIsValidating(false);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim());
      const rows: ParsedRow[] = [];

      // Map criteria names from headers (extract name without max info)
      const criteriaHeaders = headers.slice(2, -2).map((h) => {
        const match = h.match(/^(.+?)\s*\(max:/i);
        return match ? match[1].trim() : h;
      });

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 3) continue;

        const studentName = values[0]?.trim() || '';
        const examDate = values[1]?.trim() || '';
        const examinerRemarks = values[values.length - 2]?.trim() || '';
        const publicRemarks = values[values.length - 1]?.trim() || '';

        const errors: string[] = [];
        const criteriaMarks: Record<string, number> = {};

        // Find student
        const matchedStudent = students.find(
          (s) => s.full_name.toLowerCase() === studentName.toLowerCase()
        );
        if (!matchedStudent) {
          errors.push(`Student "${studentName}" not found`);
        }

        // Validate date
        if (!examDate || isNaN(Date.parse(examDate))) {
          errors.push('Invalid exam date');
        }

        // Parse criteria marks
        for (let j = 0; j < criteriaHeaders.length; j++) {
          const criteriaName = criteriaHeaders[j];
          const markValue = values[j + 2]?.trim();
          const mark = parseFloat(markValue || '0');

          const matchedCriteria = flatCriteria.find(
            (c) => c.criteria.criteria_name.toLowerCase() === criteriaName.toLowerCase()
          );

          if (!matchedCriteria) {
            errors.push(`Criteria "${criteriaName}" not found in template`);
          } else {
            if (isNaN(mark) || mark < 0) {
              errors.push(`Invalid marks for "${criteriaName}"`);
            } else if (mark > matchedCriteria.criteria.max_marks) {
              errors.push(`Marks for "${criteriaName}" exceed max (${matchedCriteria.criteria.max_marks})`);
            } else {
              criteriaMarks[matchedCriteria.criteria.id] = mark;
            }
          }
        }

        rows.push({
          rowNum: i + 1,
          studentName,
          studentId: matchedStudent?.id,
          examDate,
          criteriaMarks,
          examinerRemarks,
          publicRemarks,
          status: errors.length > 0 ? 'error' : 'valid',
          errors,
        });
      }

      setParsedRows(rows);
      setStep('preview');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to parse CSV', variant: 'destructive' });
    } finally {
      setIsValidating(false);
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const executeImport = async () => {
    if (!selectedTemplate) return;

    setStep('importing');
    setImportProgress(0);

    const validRows = parsedRows.filter((r) => r.status === 'valid');
    const results = { success: 0, failed: 0, failedRows: [] as { rowNum: number; studentName: string; error: string }[] };

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const entries: StoredCriteriaEntry[] = flatCriteria.map(({ criteria }) => ({
          criteria_name: criteria.criteria_name,
          max_marks: criteria.max_marks,
          obtained_marks: row.criteriaMarks[criteria.id] ?? 0,
        }));

        const { error } = await supabase.functions.invoke('submit-report-card', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: {
            template_id: selectedTemplateId,
            student_id: row.studentId,
            exam_date: row.examDate,
            criteria_entries: entries,
            examiner_remarks: row.examinerRemarks || null,
            public_remarks: row.publicRemarks || null,
          },
        });

        if (error) throw error;
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.failedRows.push({
          rowNum: row.rowNum,
          studentName: row.studentName,
          error: err.message || 'Unknown error',
        });
      }

      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setImportResults(results);
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['student-reports'] });
  };

  const reset = () => {
    setStep('select-template');
    setSelectedTemplateId('');
    setParsedRows([]);
    setImportProgress(0);
    setImportResults(null);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
    if (step === 'done' && onComplete) {
      onComplete();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateFile(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Generate Report Cards
          </DialogTitle>
          <DialogDescription>
            {step === 'select-template' && 'Select a template and download the sample CSV file.'}
            {step === 'upload' && 'Upload your filled CSV file.'}
            {step === 'preview' && 'Review the validation results before importing.'}
            {step === 'importing' && 'Import in progress...'}
            {step === 'done' && 'Import completed!'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {/* Step 1: Select Template */}
          {step === 'select-template' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Select Report Template</Label>
                {templatesLoading ? (
                  <div className="h-10 bg-muted animate-pulse rounded" />
                ) : (
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                          <Badge variant="secondary" className="ml-2 capitalize text-xs">
                            {template.tenure}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedTemplate && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {flatCriteria.length} criteria
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {selectedTemplate.tenure}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <h4 className="font-medium">Download Sample CSV</h4>
                      <p className="text-sm text-muted-foreground">
                        Get a CSV template with correct columns for this template
                      </p>
                    </div>
                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <h4 className="font-medium text-blue-800 dark:text-blue-300 text-sm">CSV Format</h4>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                      First column: <strong>student_name</strong> (must match exactly)<br />
                      Second column: <strong>exam_date</strong> (YYYY-MM-DD format)<br />
                      Middle columns: Marks for each criteria<br />
                      Last two columns: <strong>examiner_remarks</strong>, <strong>public_remarks</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isValidating}
                  className="hidden"
                  id="csv-upload-report"
                />
                <label
                  htmlFor="csv-upload-report"
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
                      <span className="text-sm text-muted-foreground">or drag and drop</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <div className="text-2xl font-bold">{validationSummary.total}</div>
                  <div className="text-xs text-muted-foreground">Total Rows</div>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-emerald-600">{validationSummary.valid}</div>
                  <div className="text-xs text-muted-foreground">Valid</div>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-600">{validationSummary.warnings}</div>
                  <div className="text-xs text-muted-foreground">Warnings</div>
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg text-center">
                  <div className="text-2xl font-bold text-destructive">{validationSummary.errors}</div>
                  <div className="text-xs text-muted-foreground">Errors</div>
                </div>
              </div>

              {validationSummary.errors > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                  <strong>⚠️ {validationSummary.errors} error(s) found.</strong> These rows will be skipped.
                </div>
              )}

              <ScrollArea className="h-64 border rounded-lg">
                <div className="p-3 space-y-2">
                  {parsedRows.map((row) => (
                    <div
                      key={row.rowNum}
                      className={`p-3 rounded-lg border ${
                        row.status === 'error'
                          ? 'bg-destructive/5 border-destructive/30'
                          : 'bg-muted/50 border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                            Row {row.rowNum}
                          </span>
                          <span className="font-medium">{row.studentName}</span>
                          <span className="text-sm text-muted-foreground">{row.examDate}</span>
                        </div>
                        {row.status === 'valid' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      {row.errors.length > 0 && (
                        <div className="mt-2 text-xs text-destructive">
                          {row.errors.map((err, idx) => (
                            <div key={idx}>• {err}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center">
                <h4 className="font-medium">Submitting report cards...</h4>
                <p className="text-sm text-muted-foreground">Please wait</p>
              </div>
              <Progress value={importProgress} className="w-64" />
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && importResults && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div
                className={`h-16 w-16 rounded-full flex items-center justify-center ${
                  importResults.failed > 0
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-emerald-100 dark:bg-emerald-900/30'
                }`}
              >
                {importResults.failed > 0 ? (
                  <AlertTriangle className="h-8 w-8 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                )}
              </div>
              <div className="text-center">
                <h4 className="text-xl font-medium">
                  {importResults.failed > 0 ? 'Import Completed with Errors' : 'Import Complete!'}
                </h4>
                <p className="text-muted-foreground mt-1">
                  Successfully created {importResults.success} report cards
                  {importResults.failed > 0 && `, ${importResults.failed} failed`}
                </p>
              </div>

              {importResults.failed > 0 && importResults.failedRows.length > 0 && (
                <ScrollArea className="h-48 w-full max-w-md rounded-md border border-destructive/30 bg-destructive/5">
                  <div className="p-3 space-y-2">
                    {importResults.failedRows.map((row) => (
                      <div
                        key={row.rowNum}
                        className="p-2 bg-background rounded border border-destructive/20 text-sm"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                            Row {row.rowNum}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{row.studentName}</span>
                            <p className="text-destructive text-xs mt-0.5 break-words">{row.error}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'select-template' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep('upload')}
                disabled={!selectedTemplateId || flatCriteria.length === 0}
              >
                Continue
              </Button>
            </>
          )}

          {step === 'upload' && (
            <Button variant="outline" onClick={() => setStep('select-template')}>
              Back
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={executeImport} disabled={!canImport}>
                {canImport ? `Import ${validationSummary.valid} Report Cards` : 'No Valid Rows'}
              </Button>
            </>
          )}

          {step === 'done' && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
