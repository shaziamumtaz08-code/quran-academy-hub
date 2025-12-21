import React, { useState, useMemo } from 'react';
import { Clock, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

type AttendanceStatus = 'present' | 'late' | 'student_absent';
type VarianceReason = 'slow_pace' | 'lack_of_revision' | 'technical_issues' | 'student_late' | 'short_verses';

const VARIANCE_REASONS: { value: VarianceReason; label: string }[] = [
  { value: 'slow_pace', label: 'Slow Pace' },
  { value: 'lack_of_revision', label: 'Lack of Revision' },
  { value: 'technical_issues', label: 'Technical Issues' },
  { value: 'student_late', label: 'Student Late' },
  { value: 'short_verses', label: 'Short Verses' },
];

interface ClassItem {
  id: string;
  studentId: string;
  studentName: string;
  time: string;
  duration: number;
  status?: 'pending' | 'present' | 'absent' | 'late';
  dailyTargetLines?: number;
}

interface TodayClassesProps {
  classes: ClassItem[];
  onMarkAttendance?: (classId: string, status: 'present' | 'absent' | 'late') => void;
  isTeacher?: boolean;
}

export function TodayClasses({ classes, onMarkAttendance, isTeacher = false }: TodayClassesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('present');

  // Form state
  const [lessonCovered, setLessonCovered] = useState('');
  const [homework, setHomework] = useState('');
  const [surahName, setSurahName] = useState('');
  const [ayahFrom, setAyahFrom] = useState('');
  const [ayahTo, setAyahTo] = useState('');
  const [linesCompleted, setLinesCompleted] = useState('');
  const [varianceReason, setVarianceReason] = useState<VarianceReason | ''>('');

  const dailyTarget = selectedClass?.dailyTargetLines || 10;
  const linesNum = parseInt(linesCompleted) || 0;
  const needsVarianceReason = linesNum > 0 && linesNum < dailyTarget;

  const isFormValid = useMemo(() => {
    if (needsVarianceReason && !varianceReason) return false;
    return true;
  }, [needsVarianceReason, varianceReason]);

  const resetForm = () => {
    setLessonCovered('');
    setHomework('');
    setSurahName('');
    setAyahFrom('');
    setAyahTo('');
    setLinesCompleted('');
    setVarianceReason('');
  };

  const handleOpenDialog = (classItem: ClassItem, status: AttendanceStatus) => {
    setSelectedClass(classItem);
    setSelectedStatus(status);
    resetForm();
    setDialogOpen(true);
  };

  // Mark attendance mutation
  const markAttendance = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedClass) throw new Error('Missing data');

      // Map status for database
      const dbStatus = selectedStatus === 'late' ? 'present' : selectedStatus === 'student_absent' ? 'student_absent' : 'present';

      // Build lesson_covered from structured fields
      let lessonCoveredText = '';
      if (surahName && ayahFrom && ayahTo) {
        lessonCoveredText = `${surahName}, Ayah ${ayahFrom}-${ayahTo}`;
      } else if (surahName && ayahFrom) {
        lessonCoveredText = `${surahName}, Ayah ${ayahFrom}`;
      } else if (surahName) {
        lessonCoveredText = surahName;
      } else if (lessonCovered) {
        lessonCoveredText = lessonCovered;
      }

      const { error } = await supabase.from('attendance').insert({
        student_id: selectedClass.studentId,
        teacher_id: user.id,
        class_date: format(new Date(), 'yyyy-MM-dd'),
        class_time: selectedClass.time,
        duration_minutes: selectedClass.duration,
        status: dbStatus,
        lesson_covered: lessonCoveredText || null,
        homework: homework || null,
        surah_name: surahName || null,
        ayah_from: ayahFrom ? parseInt(ayahFrom) : null,
        ayah_to: ayahTo ? parseInt(ayahTo) : null,
        lines_completed: linesCompleted ? parseInt(linesCompleted) : null,
        variance_reason: needsVarianceReason ? varianceReason : null,
        reason: selectedStatus === 'late' ? 'Student arrived late' : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Attendance Marked', description: `Marked ${selectedClass?.studentName} as ${selectedStatus}` });
      
      // Invalidate all relevant queries for immediate UI updates
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-progress'] });
      queryClient.invalidateQueries({ queryKey: ['detailed-progress'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      
      // Call the optional callback
      if (onMarkAttendance && selectedClass) {
        onMarkAttendance(selectedClass.id, selectedStatus === 'student_absent' ? 'absent' : selectedStatus);
      }
      
      resetForm();
      setDialogOpen(false);
      setSelectedClass(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark attendance',
        variant: 'destructive',
      });
    },
  });

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-serif text-xl font-bold text-foreground">Today's Classes</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="divide-y divide-border">
          {classes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No classes scheduled for today</p>
            </div>
          ) : (
            classes.map((classItem) => (
              <div key={classItem.id} className="p-4 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{classItem.studentName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{classItem.time}</span>
                        <span>•</span>
                        <span>{classItem.duration} min</span>
                      </div>
                    </div>
                  </div>
                  {isTeacher && classItem.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-light border-emerald-light hover:bg-emerald-light/10"
                        onClick={() => handleOpenDialog(classItem, 'present')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Present
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-accent border-accent hover:bg-accent/10"
                        onClick={() => handleOpenDialog(classItem, 'late')}
                      >
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Late
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive hover:bg-destructive/10"
                        onClick={() => handleOpenDialog(classItem, 'student_absent')}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Absent
                      </Button>
                    </div>
                  ) : (
                    <StatusBadge status={classItem.status || 'pending'} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mark Attendance Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">
              Mark {selectedClass?.studentName} as {selectedStatus === 'student_absent' ? 'Absent' : selectedStatus === 'late' ? 'Late' : 'Present'}
            </DialogTitle>
            <DialogDescription>
              Record lesson progress and homework for this class
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Only show progress fields for present/late */}
            {selectedStatus !== 'student_absent' && (
              <>
                {/* Quran Progress Section */}
                <div className="p-4 bg-secondary/30 rounded-lg space-y-4">
                  <h4 className="font-medium text-sm text-foreground">Quran Progress</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="surahName">Surah Name</Label>
                    <Input
                      id="surahName"
                      placeholder="e.g., Al-Baqarah"
                      value={surahName}
                      onChange={(e) => setSurahName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ayahFrom">Ayah From</Label>
                      <Input
                        id="ayahFrom"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={ayahFrom}
                        onChange={(e) => setAyahFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ayahTo">Ayah To</Label>
                      <Input
                        id="ayahTo"
                        type="number"
                        min="1"
                        placeholder="10"
                        value={ayahTo}
                        onChange={(e) => setAyahTo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="linesCompleted">
                      Lines Completed
                      <span className="text-muted-foreground ml-2 text-xs">
                        (Target: {dailyTarget} lines)
                      </span>
                    </Label>
                    <Input
                      id="linesCompleted"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={linesCompleted}
                      onChange={(e) => setLinesCompleted(e.target.value)}
                    />
                  </div>

                  {/* Variance Reason - only show if below target */}
                  {needsVarianceReason && (
                    <div className="space-y-2 p-3 bg-accent/10 rounded-lg border border-accent/20">
                      <Label htmlFor="varianceReason" className="flex items-center gap-2 text-accent">
                        <AlertCircle className="h-4 w-4" />
                        Variance Reason (Required)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Lines completed ({linesNum}) is below target ({dailyTarget}). Please select a reason.
                      </p>
                      <Select value={varianceReason} onValueChange={(v) => setVarianceReason(v as VarianceReason)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {VARIANCE_REASONS.map((reason) => (
                            <SelectItem key={reason.value} value={reason.value}>
                              {reason.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Lesson & Homework */}
                <div className="space-y-2">
                  <Label htmlFor="lessonCovered">Additional Lesson Notes (Optional)</Label>
                  <Textarea
                    id="lessonCovered"
                    placeholder="Any additional notes about the lesson..."
                    value={lessonCovered}
                    onChange={(e) => setLessonCovered(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="homework">Homework Assigned</Label>
                  <Textarea
                    id="homework"
                    placeholder="e.g., Revise Surah Al-Fatiha 3 times"
                    value={homework}
                    onChange={(e) => setHomework(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}

            {selectedStatus === 'student_absent' && (
              <div className="p-4 bg-destructive/10 rounded-lg text-center">
                <XCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-sm text-muted-foreground">
                  This will mark the student as absent for today's class.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => markAttendance.mutate()}
                disabled={!isFormValid || markAttendance.isPending}
              >
                {markAttendance.isPending ? 'Saving...' : 'Save Attendance'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
      status === 'present' && "bg-emerald-light/10 text-emerald-light",
      status === 'absent' && "bg-destructive/10 text-destructive",
      status === 'late' && "bg-accent/10 text-accent",
      status === 'pending' && "bg-muted text-muted-foreground"
    )}>
      {status === 'present' && <CheckCircle className="h-3 w-3" />}
      {status === 'absent' && <XCircle className="h-3 w-3" />}
      {status === 'late' && <AlertCircle className="h-3 w-3" />}
      {status === 'pending' && <Clock className="h-3 w-3" />}
      <span className="capitalize">{status}</span>
    </span>
  );
}
