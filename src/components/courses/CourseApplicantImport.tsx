import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, ArrowRight, Download } from 'lucide-react';

const SYSTEM_FIELDS = [
  { value: 'full_name', label: 'Full Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'gender', label: 'Gender' },
  { value: 'date_of_birth', label: 'Date of Birth' },
  { value: 'city', label: 'City' },
  { value: 'source', label: 'Source' },
  { value: '__skip', label: '— Skip —' },
];

const HEADER_ALIASES: Record<string, string> = {
  name: 'full_name', 'full name': 'full_name', 'student name': 'full_name', 'first name': 'full_name',
  email: 'email', 'e-mail': 'email', 'email address': 'email',
  phone: 'phone', mobile: 'phone', 'phone number': 'phone', 'contact': 'phone', whatsapp: 'phone',
  gender: 'gender', sex: 'gender',
  dob: 'date_of_birth', 'date of birth': 'date_of_birth', birthday: 'date_of_birth',
  city: 'city', location: 'city', town: 'city',
  source: 'source', 'how did you hear': 'source', referral: 'source',
};

function autoSuggestMapping(header: string): string {
  const normalized = header.toLowerCase().trim().replace(/[_\-]/g, ' ');
  return HEADER_ALIASES[normalized] || '__skip';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  formId?: string;
  onComplete?: () => void;
}

type Step = 'upload' | 'mapping' | 'importing' | 'done';

export function CourseApplicantImport({ open, onOpenChange, courseId, formId, onComplete }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);
  const [allRows, setAllRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any>(null);

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setPreviewRows([]);
    setAllRows([]);
    setMapping({});
    setResults(null);
  };

  const handleFile = useCallback(async (file: File) => {
    try {
      const isXls = file.name.match(/\.xlsx?$/i);
      let rows: Record<string, any>[] = [];

      if (isXls) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      } else {
        const text = await file.text();
        const lines = text.trim().split('\n');
        if (lines.length < 2) { toast({ title: 'Empty file', variant: 'destructive' }); return; }
        const hdrs = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          if (vals.length === hdrs.length) {
            const row: Record<string, any> = {};
            hdrs.forEach((h, idx) => { row[h] = vals[idx]; });
            rows.push(row);
          }
        }
      }

      if (rows.length === 0) { toast({ title: 'No rows found', variant: 'destructive' }); return; }

      const hdrs = Object.keys(rows[0]);
      setHeaders(hdrs);
      setPreviewRows(rows.slice(0, 5));
      setAllRows(rows);

      // Auto-suggest mapping
      const autoMap: Record<string, string> = {};
      hdrs.forEach(h => { autoMap[h] = autoSuggestMapping(h); });
      setMapping(autoMap);
      setStep('mapping');
    } catch (err: any) {
      toast({ title: 'Parse error', description: err.message, variant: 'destructive' });
    }
  }, []);

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    try {
      const { data, error } = await supabase.functions.invoke('course-applicant-import', {
        body: { rows: allRows, courseId, formId, fieldMapping: mapping },
      });
      if (error) throw error;
      setResults(data);
      setStep('done');
      toast({ title: `Import complete: ${data.summary.total} processed` });
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
      setStep('mapping');
    } finally {
      setImporting(false);
    }
  };

  const mappedCount = Object.values(mapping).filter(v => v && v !== '__skip').length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import Applicants from CSV/XLS
          </DialogTitle>
          <DialogDescription>
            Upload a spreadsheet, map columns to system fields, and import applicants.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-8">
            <label className="flex flex-col items-center gap-3 border-2 border-dashed border-border rounded-xl p-10 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Drop CSV or XLS file here, or click to browse</span>
              <span className="text-xs text-muted-foreground/60">Supports .csv, .xlsx, .xls</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            {/* Mapping UI */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Map your columns ({mappedCount} mapped)</p>
              <div className="grid gap-2">
                {headers.map(h => (
                  <div key={h} className="flex items-center gap-3">
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded w-40 truncate">{h}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select value={mapping[h] || '__skip'} onValueChange={v => setMapping(prev => ({ ...prev, [h]: v }))}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SYSTEM_FIELDS.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping[h] && mapping[h] !== '__skip' && (
                      <Badge variant="outline" className="text-[10px] text-emerald-600">✓</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <p className="text-sm font-medium mb-2">Preview (first {previewRows.length} rows)</p>
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map(h => (
                        <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        {headers.map(h => (
                          <TableCell key={h} className="text-xs">{String(row[h] || '')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">{allRows.length} total rows</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>Back</Button>
                <Button onClick={handleImport} disabled={mappedCount === 0}>
                  Import {allRows.length} Rows
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importing {allRows.length} rows…</p>
            <Progress value={50} className="w-64" />
          </div>
        )}

        {step === 'done' && results && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{results.summary.new}</p>
                <p className="text-xs text-muted-foreground">New Applicants</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{results.summary.matched}</p>
                <p className="text-xs text-muted-foreground">Matched Existing</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{results.summary.errors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </CardContent></Card>
            </div>

            {results.results?.filter((r: any) => r.status === 'error').length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Error Details</p>
                {results.results.filter((r: any) => r.status === 'error').map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-destructive">
                    <XCircle className="h-3 w-3" />
                    Row {r.rowNum}: {r.error}
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
