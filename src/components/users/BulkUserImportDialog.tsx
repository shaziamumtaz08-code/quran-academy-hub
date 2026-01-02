import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface BulkUserImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSVRow {
  email: string;
  full_name: string;
  password?: string;
  role: AppRole;
  whatsapp?: string;
  gender?: 'male' | 'female';
  age?: number;
}

interface ImportResult {
  email: string;
  success: boolean;
  message: string;
}

const VALID_ROLES: AppRole[] = [
  'super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic',
  'teacher', 'examiner', 'student', 'parent'
];

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Validate required fields
    const email = row.email || row.email_address || '';
    const fullName = row.full_name || row.fullname || row.name || '';
    const roleStr = (row.role || 'student').toLowerCase();
    const role = VALID_ROLES.includes(roleStr as AppRole) ? roleStr as AppRole : 'student';

    if (email && fullName) {
      rows.push({
        email: email.toLowerCase(),
        full_name: fullName,
        password: row.password || undefined,
        role,
        whatsapp: row.whatsapp || row.phone || row.whatsapp_number || undefined,
        gender: row.gender === 'male' || row.gender === 'female' ? row.gender : undefined,
        age: row.age ? parseInt(row.age, 10) : undefined,
      });
    }
  }

  return rows;
}

function generateSampleCSV(): string {
  return `email,full_name,password,role,whatsapp,gender,age
student1@example.com,Ahmed Khan,SecurePass1!,student,+923001234567,male,12
student2@example.com,Fatima Ali,SecurePass2!,student,+14165551234,female,10
student3@example.com,Yusuf Malik,SecurePass3!,student,+971501234567,male,14
teacher1@example.com,Mohammad Hassan,TeachPass1!,teacher,+923211234567,male,35
teacher2@example.com,Aisha Siddiqui,TeachPass2!,teacher,+12125551234,female,28
parent1@example.com,Zainab Ahmed,ParentPass1!,parent,+447911123456,female,40
parent2@example.com,Khalid Rahman,ParentPass2!,parent,+966501234567,male,45
admin1@example.com,Ibrahim Khan,AdminPass1!,admin,,male,32
examiner1@example.com,Mariam Yousuf,ExamPass1!,examiner,+923451234567,female,30`;
}

export function BulkUserImportDialog({ open, onOpenChange }: BulkUserImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      
      if (parsed.length === 0) {
        toast({
          title: 'Invalid CSV',
          description: 'No valid rows found. Ensure CSV has email, full_name columns.',
          variant: 'destructive',
        });
        return;
      }

      setCsvData(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setStep('importing');
    setImporting(true);
    setProgress(0);
    setResults([]);

    const importResults: ImportResult[] = [];
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      try {
        const { data, error } = await supabase.functions.invoke('admin-create-user', {
          body: {
            email: row.email,
            password: row.password || Math.random().toString(36).slice(-8) + 'A1!',
            fullName: row.full_name,
            role: row.role,
            whatsapp: row.whatsapp,
            gender: row.gender,
            age: row.age,
          },
        });

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        importResults.push({
          email: row.email,
          success: true,
          message: data?.roleAdded ? 'Role added to existing user' : 'User created',
        });
      } catch (err) {
        importResults.push({
          email: row.email,
          success: false,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      setProgress(((i + 1) / csvData.length) * 100);
      setResults([...importResults]);
    }

    setImporting(false);
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
  };

  const handleDownloadTemplate = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setCsvData([]);
    setResults([]);
    setProgress(0);
    setStep('upload');
    onOpenChange(false);
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk User Import
          </DialogTitle>
          <DialogDescription>
            Import multiple users from a CSV file
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                Drag and drop a CSV file, or click to browse
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                Select CSV File
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Need a template?</p>
                <p className="text-xs text-muted-foreground">
                  Download our sample CSV with the correct columns
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Required columns:</strong> email, full_name</p>
              <p><strong>Optional columns:</strong> password, role, whatsapp, gender, age</p>
              <p><strong>Valid roles:</strong> student, teacher, parent, admin, examiner</p>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Found <strong>{csvData.length}</strong> users to import
              </p>
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
                Choose Different File
              </Button>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-4 space-y-2">
                {csvData.map((row, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm p-2 bg-muted/30 rounded">
                    <span className="font-mono text-xs text-muted-foreground w-6">{i + 1}</span>
                    <span className="flex-1 truncate">{row.full_name}</span>
                    <span className="text-muted-foreground truncate max-w-[200px]">{row.email}</span>
                    <Badge variant="outline" className="text-xs">{row.role}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                Import {csvData.length} Users
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
              <p className="text-sm font-medium">Importing users...</p>
              <p className="text-xs text-muted-foreground">
                {results.length} of {csvData.length} processed
              </p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">{successCount} Successful</span>
              </div>
              {failCount > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-sm font-medium">{failCount} Failed</span>
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-4 space-y-2">
                {results.map((result, i) => (
                  <div 
                    key={i} 
                    className={`flex items-center gap-3 text-sm p-2 rounded ${
                      result.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="truncate flex-1">{result.email}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {result.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
