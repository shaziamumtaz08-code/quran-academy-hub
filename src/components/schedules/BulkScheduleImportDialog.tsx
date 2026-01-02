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
import { Upload, FileText, AlertCircle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface BulkScheduleImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedSchedule {
  teacherName: string;
  studentName: string;
  dayOfWeek: string;
  studentTime: string;
  duration: number;
  assignmentId?: string;
  teacherTime?: string;
  error?: string;
  status: 'pending' | 'valid' | 'error' | 'success';
}

const DAYS_MAP: Record<string, string> = {
  'monday': 'monday',
  'mon': 'monday',
  'tuesday': 'tuesday',
  'tue': 'tuesday',
  'wednesday': 'wednesday',
  'wed': 'wednesday',
  'thursday': 'thursday',
  'thu': 'thursday',
  'friday': 'friday',
  'fri': 'friday',
  'saturday': 'saturday',
  'sat': 'saturday',
  'sunday': 'sunday',
  'sun': 'sunday',
};

const DAYS_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const TIMEZONES = [
  { value: 'America/Toronto', offset: -5 },
  { value: 'America/New_York', offset: -5 },
  { value: 'America/Los_Angeles', offset: -8 },
  { value: 'Europe/London', offset: 0 },
  { value: 'Asia/Karachi', offset: 5 },
  { value: 'Asia/Dubai', offset: 4 },
  { value: 'Asia/Riyadh', offset: 3 },
  { value: 'Asia/Kolkata', offset: 5.5 },
  { value: 'Australia/Sydney', offset: 10 },
];

function calculateTeacherTime(studentTime: string, studentTz: string | null, teacherTz: string | null): string {
  const studentOffset = TIMEZONES.find(tz => tz.value === studentTz)?.offset ?? 0;
  const teacherOffset = TIMEZONES.find(tz => tz.value === teacherTz)?.offset ?? 0;
  
  const [hours, minutes] = studentTime.split(':').map(Number);
  const studentMinutesFromMidnight = hours * 60 + minutes;
  
  const offsetDiffMinutes = (teacherOffset - studentOffset) * 60;
  let teacherMinutesFromMidnight = studentMinutesFromMidnight + offsetDiffMinutes;
  
  if (teacherMinutesFromMidnight < 0) teacherMinutesFromMidnight += 24 * 60;
  if (teacherMinutesFromMidnight >= 24 * 60) teacherMinutesFromMidnight -= 24 * 60;
  
  const teacherHours = Math.floor(teacherMinutesFromMidnight / 60);
  const teacherMins = teacherMinutesFromMidnight % 60;
  
  return `${teacherHours.toString().padStart(2, '0')}:${teacherMins.toString().padStart(2, '0')}`;
}

function formatTime12h(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function parseTimeString(timeStr: string): string | null {
  // Handle formats: "09:00", "9:00", "9:00 AM", "09:00 AM", "14:00", "2:00 PM"
  const cleanTime = timeStr.trim().toUpperCase();
  
  // Check for AM/PM format
  const ampmMatch = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1]);
    const minutes = parseInt(ampmMatch[2]);
    const period = ampmMatch[3];
    
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }
  
  return null;
}

export function BulkScheduleImportDialog({ open, onOpenChange }: BulkScheduleImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [schedules, setSchedules] = useState<ParsedSchedule[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);

  const downloadTemplate = () => {
    const csvContent = `teacher_name,student_name,day_of_week,time,duration_minutes
Mohammad Hassan,Ahmed Khan,Monday,09:00 AM,30
Mohammad Hassan,Ahmed Khan,Wednesday,09:00 AM,30
Mohammad Hassan,Fatima Ali,Tuesday,10:30 AM,45
Mohammad Hassan,Fatima Ali,Thursday,10:30 AM,45
Aisha Siddiqui,Yusuf Malik,Mon,14:00,30
Aisha Siddiqui,Yusuf Malik,Wed,14:00,30
Aisha Siddiqui,Sara Khan,Friday,3:00 PM,30
Teacher Name (exact),Student Name (exact),Day (Mon/Monday),Time (9:00 AM or 14:00),Duration (minutes)`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (content: string): ParsedSchedule[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    
    const header = lines[0].toLowerCase();
    if (!header.includes('teacher_name') || !header.includes('student_name') || !header.includes('day')) {
      toast({
        title: 'Invalid CSV format',
        description: 'CSV must have teacher_name, student_name, and day_of_week columns',
        variant: 'destructive',
      });
      return [];
    }

    const headerCols = lines[0].split(',').map(h => h.trim().toLowerCase());
    const teacherIdx = headerCols.indexOf('teacher_name');
    const studentIdx = headerCols.indexOf('student_name');
    const dayIdx = headerCols.findIndex(h => h.includes('day'));
    const timeIdx = headerCols.findIndex(h => h.includes('time'));
    const durationIdx = headerCols.findIndex(h => h.includes('duration'));

    const parsed: ParsedSchedule[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',').map(c => c.trim());
      const teacherName = cols[teacherIdx] || '';
      const studentName = cols[studentIdx] || '';
      const dayRaw = cols[dayIdx]?.toLowerCase() || '';
      const timeRaw = cols[timeIdx] || '';
      const durationRaw = cols[durationIdx] || '30';

      if (!teacherName || !studentName) {
        parsed.push({
          teacherName,
          studentName,
          dayOfWeek: '',
          studentTime: '',
          duration: 30,
          error: 'Missing teacher or student name',
          status: 'error',
        });
        continue;
      }

      const dayOfWeek = DAYS_MAP[dayRaw];
      if (!dayOfWeek) {
        parsed.push({
          teacherName,
          studentName,
          dayOfWeek: dayRaw,
          studentTime: '',
          duration: 30,
          error: `Invalid day: "${dayRaw}"`,
          status: 'error',
        });
        continue;
      }

      const studentTime = parseTimeString(timeRaw);
      if (!studentTime) {
        parsed.push({
          teacherName,
          studentName,
          dayOfWeek,
          studentTime: timeRaw,
          duration: 30,
          error: `Invalid time format: "${timeRaw}"`,
          status: 'error',
        });
        continue;
      }

      const duration = parseInt(durationRaw) || 30;

      parsed.push({
        teacherName,
        studentName,
        dayOfWeek,
        studentTime,
        duration,
        status: 'pending',
      });
    }

    return parsed;
  };

  const validateSchedules = async (parsedSchedules: ParsedSchedule[]) => {
    setIsValidating(true);
    
    try {
      // Fetch all assignments with teacher/student info
      const { data: assignmentsData } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          teacher_id,
          student_id,
          student_timezone,
          teacher_timezone,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
          student:profiles!student_teacher_assignments_student_id_fkey(full_name)
        `);

      const assignments = (assignmentsData ?? []).map((row: any) => ({
        id: row.id,
        teacherName: row.teacher?.full_name?.toLowerCase() || '',
        studentName: row.student?.full_name?.toLowerCase() || '',
        studentTimezone: row.student_timezone,
        teacherTimezone: row.teacher_timezone,
      }));

      // Fetch existing schedules
      const { data: existingSchedules } = await supabase
        .from('schedules')
        .select('assignment_id, day_of_week, student_local_time')
        .eq('is_active', true);

      const existingSet = new Set(
        (existingSchedules ?? []).map(s => `${s.assignment_id}-${s.day_of_week}-${s.student_local_time}`)
      );

      const validated = parsedSchedules.map(schedule => {
        if (schedule.status === 'error') return schedule;

        const assignment = assignments.find(
          a => a.teacherName === schedule.teacherName.toLowerCase() && 
               a.studentName === schedule.studentName.toLowerCase()
        );

        if (!assignment) {
          return { 
            ...schedule, 
            error: `No assignment found for ${schedule.teacherName} → ${schedule.studentName}`, 
            status: 'error' as const 
          };
        }

        if (!assignment.studentTimezone || !assignment.teacherTimezone) {
          return { 
            ...schedule, 
            error: 'Assignment missing timezone configuration', 
            status: 'error' as const 
          };
        }

        const teacherTime = calculateTeacherTime(
          schedule.studentTime, 
          assignment.studentTimezone, 
          assignment.teacherTimezone
        );

        const key = `${assignment.id}-${schedule.dayOfWeek}-${schedule.studentTime}`;
        if (existingSet.has(key)) {
          return { 
            ...schedule, 
            error: 'Schedule already exists', 
            status: 'error' as const 
          };
        }

        return {
          ...schedule,
          assignmentId: assignment.id,
          teacherTime,
          status: 'valid' as const,
        };
      });

      setSchedules(validated);
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
        await validateSchedules(parsed);
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    const validSchedules = schedules.filter(s => s.status === 'valid');
    if (validSchedules.length === 0) {
      toast({
        title: 'No valid schedules',
        description: 'Please fix errors before importing',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < validSchedules.length; i++) {
      const schedule = validSchedules[i];
      try {
        const { error } = await supabase
          .from('schedules')
          .insert({
            assignment_id: schedule.assignmentId!,
            day_of_week: schedule.dayOfWeek,
            student_local_time: schedule.studentTime,
            teacher_local_time: schedule.teacherTime!,
            duration_minutes: schedule.duration,
          });

        if (error) throw error;

        success++;
        setSchedules(prev => prev.map(s => 
          s === schedule ? { ...s, status: 'success' as const } : s
        ));
      } catch (error: any) {
        failed++;
        setSchedules(prev => prev.map(s => 
          s === schedule ? { ...s, status: 'error' as const, error: error.message } : s
        ));
      }

      setProgress(((i + 1) / validSchedules.length) * 100);
    }

    setIsImporting(false);
    setImportResults({ success, failed });

    queryClient.invalidateQueries({ queryKey: ['class-schedules'] });

    toast({
      title: 'Import Complete',
      description: `${success} schedules created, ${failed} failed`,
    });
  };

  const handleClose = () => {
    setSchedules([]);
    setProgress(0);
    setImportResults(null);
    onOpenChange(false);
  };

  const validCount = schedules.filter(s => s.status === 'valid').length;
  const errorCount = schedules.filter(s => s.status === 'error').length;
  const successCount = schedules.filter(s => s.status === 'success').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Import Schedules</DialogTitle>
          <DialogDescription>
            Upload a CSV file to create multiple class schedules at once
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
              Validating schedules...
            </div>
          )}

          {/* Results Summary */}
          {schedules.length > 0 && !isValidating && (
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
                <span>Importing schedules...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Schedules Preview */}
          {schedules.length > 0 && (
            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-2 space-y-1">
                {schedules.map((schedule, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      schedule.status === 'error' ? 'bg-destructive/10' :
                      schedule.status === 'success' ? 'bg-emerald-500/10' :
                      schedule.status === 'valid' ? 'bg-secondary/50' :
                      'bg-secondary/30'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {schedule.teacherName} → {schedule.studentName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {DAYS_LABELS[schedule.dayOfWeek] || schedule.dayOfWeek} at {formatTime12h(schedule.studentTime)} ({schedule.duration}min)
                      </div>
                      {schedule.error && (
                        <div className="text-xs text-destructive">{schedule.error}</div>
                      )}
                    </div>
                    <div>
                      {schedule.status === 'valid' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                      {schedule.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      {schedule.status === 'success' && (
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
                Import {validCount} Schedule{validCount !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
