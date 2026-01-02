import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, AlertCircle, CheckCircle2, Download, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface BulkAssignmentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedAssignment {
  teacherName: string;
  studentName: string;
  subjectName: string;
  teacherId?: string;
  studentId?: string;
  subjectId?: string | null;
  error?: string;
  status: 'pending' | 'valid' | 'error' | 'success';
}

export function BulkAssignmentImportDialog({ open, onOpenChange }: BulkAssignmentImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assignments, setAssignments] = useState<ParsedAssignment[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);

  const downloadTemplate = () => {
    const csvContent = `teacher_name,student_name,subject_name
Mohammad Hassan,Ahmed Khan,Nazra
Mohammad Hassan,Fatima Ali,Nazra
Mohammad Hassan,Yusuf Malik,Hifz
Aisha Siddiqui,Ahmed Khan,Tajweed
Aisha Siddiqui,Ibrahim Ahmed,Hifz
Aisha Siddiqui,Sara Khan,Nazra`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'assignment_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (content: string): ParsedAssignment[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    
    const header = lines[0].toLowerCase();
    if (!header.includes('teacher_name') || !header.includes('student_name')) {
      toast({
        title: 'Invalid CSV format',
        description: 'CSV must have teacher_name and student_name columns',
        variant: 'destructive',
      });
      return [];
    }

    const headerCols = lines[0].split(',').map(h => h.trim().toLowerCase());
    const teacherIdx = headerCols.indexOf('teacher_name');
    const studentIdx = headerCols.indexOf('student_name');
    const subjectIdx = headerCols.indexOf('subject_name');

    const parsed: ParsedAssignment[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',').map(c => c.trim());
      const teacherName = cols[teacherIdx] || '';
      const studentName = cols[studentIdx] || '';
      const subjectName = subjectIdx >= 0 ? (cols[subjectIdx] || '') : '';

      if (!teacherName || !studentName) {
        parsed.push({
          teacherName,
          studentName,
          subjectName,
          error: 'Missing teacher or student name',
          status: 'error',
        });
        continue;
      }

      parsed.push({
        teacherName,
        studentName,
        subjectName,
        status: 'pending',
      });
    }

    return parsed;
  };

  const validateAssignments = async (parsedAssignments: ParsedAssignment[]) => {
    setIsValidating(true);
    
    try {
      // Fetch all teachers
      const { data: teacherRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher');
      
      const teacherIds = (teacherRoles ?? []).map(r => r.user_id);
      const { data: teachers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds);

      // Fetch all students
      const { data: studentRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      
      const studentIds = (studentRoles ?? []).map(r => r.user_id);
      const { data: students } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds);

      // Fetch all subjects
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('is_active', true);

      // Fetch existing assignments
      const { data: existingAssignments } = await supabase
        .from('student_teacher_assignments')
        .select('teacher_id, student_id');

      const existingSet = new Set(
        (existingAssignments ?? []).map(a => `${a.teacher_id}-${a.student_id}`)
      );

      const teacherMap = new Map((teachers ?? []).map(t => [t.full_name.toLowerCase(), t.id]));
      const studentMap = new Map((students ?? []).map(s => [s.full_name.toLowerCase(), s.id]));
      const subjectMap = new Map((subjects ?? []).map(s => [s.name.toLowerCase(), s.id]));

      const validated = parsedAssignments.map(assignment => {
        if (assignment.status === 'error') return assignment;

        const teacherId = teacherMap.get(assignment.teacherName.toLowerCase());
        const studentId = studentMap.get(assignment.studentName.toLowerCase());
        const subjectId = assignment.subjectName 
          ? subjectMap.get(assignment.subjectName.toLowerCase()) 
          : null;

        if (!teacherId) {
          return { ...assignment, error: `Teacher "${assignment.teacherName}" not found`, status: 'error' as const };
        }

        if (!studentId) {
          return { ...assignment, error: `Student "${assignment.studentName}" not found`, status: 'error' as const };
        }

        if (assignment.subjectName && !subjectId) {
          return { ...assignment, error: `Subject "${assignment.subjectName}" not found`, status: 'error' as const };
        }

        if (existingSet.has(`${teacherId}-${studentId}`)) {
          return { ...assignment, error: 'Assignment already exists', status: 'error' as const };
        }

        return {
          ...assignment,
          teacherId,
          studentId,
          subjectId,
          status: 'valid' as const,
        };
      });

      setAssignments(validated);
    } catch (error: any) {
      toast({
        title: 'Validation Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      if (parsed.length > 0) {
        await validateAssignments(parsed);
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    const validAssignments = assignments.filter(a => a.status === 'valid');
    if (validAssignments.length === 0) {
      toast({
        title: 'No valid assignments',
        description: 'Please fix errors before importing',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < validAssignments.length; i++) {
      const assignment = validAssignments[i];
      try {
        const { error } = await supabase
          .from('student_teacher_assignments')
          .insert({
            teacher_id: assignment.teacherId!,
            student_id: assignment.studentId!,
            subject_id: assignment.subjectId,
          });

        if (error) throw error;

        success++;
        setAssignments(prev => prev.map(a => 
          a === assignment ? { ...a, status: 'success' as const } : a
        ));
      } catch (error: any) {
        failed++;
        setAssignments(prev => prev.map(a => 
          a === assignment ? { ...a, status: 'error' as const, error: error.message } : a
        ));
      }

      setProgress(((i + 1) / validAssignments.length) * 100);
    }

    setIsImporting(false);
    setImportResults({ success, failed });

    queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });

    toast({
      title: 'Import Complete',
      description: `${success} assignments created, ${failed} failed`,
    });
  };

  const handleClose = () => {
    setAssignments([]);
    setProgress(0);
    setImportResults(null);
    onOpenChange(false);
  };

  const validCount = assignments.filter(a => a.status === 'valid').length;
  const errorCount = assignments.filter(a => a.status === 'error').length;
  const successCount = assignments.filter(a => a.status === 'success').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Import Assignments</DialogTitle>
          <DialogDescription>
            Upload a CSV file to create multiple student-teacher assignments at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Download CSV template</span>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload CSV File</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isValidating || isImporting}
            />
          </div>

          {/* Validation Progress */}
          {isValidating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validating assignments...
            </div>
          )}

          {/* Results Summary */}
          {assignments.length > 0 && !isValidating && (
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {validCount} valid
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-destructive" />
                {errorCount} errors
              </span>
              {successCount > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {successCount} imported
                </span>
              )}
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importing assignments...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Assignments Preview */}
          {assignments.length > 0 && (
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-2 space-y-1">
                {assignments.map((assignment, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      assignment.status === 'error' ? 'bg-destructive/10' :
                      assignment.status === 'success' ? 'bg-emerald-500/10' :
                      assignment.status === 'valid' ? 'bg-secondary/50' :
                      'bg-secondary/30'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {assignment.teacherName} → {assignment.studentName}
                      </div>
                      {assignment.subjectName && (
                        <div className="text-xs text-muted-foreground">
                          Subject: {assignment.subjectName}
                        </div>
                      )}
                      {assignment.error && (
                        <div className="text-xs text-destructive">{assignment.error}</div>
                      )}
                    </div>
                    <div>
                      {assignment.status === 'valid' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                      {assignment.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      {assignment.status === 'success' && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              {importResults ? 'Close' : 'Cancel'}
            </Button>
            {validCount > 0 && !importResults && (
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Upload className="h-4 w-4 mr-2" />
                Import {validCount} Assignment{validCount !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
