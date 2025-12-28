import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { SurahSearchSelect } from '@/components/attendance/SurahSearchSelect';

type AttendanceStatus = 'present' | 'student_absent';

interface QuickAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    full_name: string;
    daily_target_lines: number;
    preferred_unit: string;
  } | null;
  teacherId: string;
}

const VARIANCE_REASONS = [
  { value: 'slow_pace', label: 'Slow Pace' },
  { value: 'lack_of_revision', label: 'Lack of Revision' },
  { value: 'technical_issues', label: 'Technical Issues' },
  { value: 'student_late', label: 'Student Late' },
  { value: 'short_verses', label: 'Short Verses' },
];

export function QuickAttendanceDialog({ open, onOpenChange, student, teacherId }: QuickAttendanceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [classTime, setClassTime] = useState(format(new Date(), 'HH:mm'));
  const [duration, setDuration] = useState('30');
  const [surahName, setSurahName] = useState('');
  const [ayahFrom, setAyahFrom] = useState('');
  const [ayahTo, setAyahTo] = useState('');
  const [linesCompleted, setLinesCompleted] = useState('');
  const [homework, setHomework] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [manzilNotes, setManzilNotes] = useState('');
  const dailyTarget = student?.daily_target_lines || 10;
  const linesNum = parseInt(linesCompleted) || 0;
  const needsVarianceReason = status === 'present' && linesNum > 0 && linesNum < dailyTarget;

  const isFormValid = useMemo(() => {
    if (status === 'student_absent') return true;
    if (needsVarianceReason && !varianceReason) return false;
    return true;
  }, [status, needsVarianceReason, varianceReason]);

  const resetForm = () => {
    setStatus('present');
    setClassTime(format(new Date(), 'HH:mm'));
    setDuration('30');
    setSurahName('');
    setAyahFrom('');
    setAyahTo('');
    setLinesCompleted('');
    setHomework('');
    setVarianceReason('');
    setAbsenceReason('');
    setManzilNotes('');
  };

  const markAttendance = useMutation({
    mutationFn: async () => {
      if (!student || !teacherId) throw new Error('Missing data');

      // Build lesson_covered text
      let lessonCoveredText = '';
      if (surahName && ayahFrom && ayahTo) {
        lessonCoveredText = `${surahName}, Ayah ${ayahFrom}-${ayahTo}`;
      } else if (surahName && ayahFrom) {
        lessonCoveredText = `${surahName}, Ayah ${ayahFrom}`;
      } else if (surahName) {
        lessonCoveredText = surahName;
      }

      const { error } = await supabase.from('attendance').insert({
        student_id: student.id,
        teacher_id: teacherId,
        class_date: format(new Date(), 'yyyy-MM-dd'),
        class_time: classTime,
        duration_minutes: parseInt(duration),
        status: status,
        lesson_covered: lessonCoveredText || null,
        homework: homework || null,
        surah_name: surahName || null,
        ayah_from: ayahFrom ? parseInt(ayahFrom) : null,
        ayah_to: ayahTo ? parseInt(ayahTo) : null,
        lines_completed: linesNum > 0 ? linesNum : null,
        variance_reason: needsVarianceReason ? varianceReason : null,
        reason: status === 'student_absent' ? absenceReason : null,
        input_unit: student.preferred_unit || 'lines',
        manzil_notes: manzilNotes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Attendance Marked', description: `Marked ${student?.full_name} as ${status === 'present' ? 'present' : 'absent'}.` });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-students-detailed'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to mark attendance',
        variant: 'destructive',
      });
    },
  });

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Quick Attendance - {student.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={status === 'present' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setStatus('present')}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Present
            </Button>
            <Button
              type="button"
              variant={status === 'student_absent' ? 'destructive' : 'outline'}
              className="flex-1"
              onClick={() => setStatus('student_absent')}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Absent
            </Button>
          </div>

          {status === 'student_absent' ? (
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea 
                placeholder="Enter reason for absence..."
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
              />
            </div>
          ) : (
            <>
              {/* Time & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={classTime} onChange={(e) => setClassTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
              </div>

              {/* Surah & Ayah */}
              <div className="space-y-2">
                <Label>Surah</Label>
                <SurahSearchSelect value={surahName} onChange={setSurahName} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Ayah From</Label>
                  <Input type="number" placeholder="e.g. 1" value={ayahFrom} onChange={(e) => setAyahFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ayah To</Label>
                  <Input type="number" placeholder="e.g. 10" value={ayahTo} onChange={(e) => setAyahTo(e.target.value)} />
                </div>
              </div>

              {/* Lines Completed */}
              <div className="space-y-2">
                <Label>Lines Completed</Label>
                <Input 
                  type="number" 
                  placeholder={`Target: ${dailyTarget} ${student.preferred_unit}`}
                  value={linesCompleted} 
                  onChange={(e) => setLinesCompleted(e.target.value)} 
                />
                {needsVarianceReason && (
                  <p className="text-xs text-amber-600">Below daily target - variance reason required</p>
                )}
              </div>

              {/* Variance Reason */}
              {needsVarianceReason && (
                <div className="space-y-2">
                  <Label>Variance Reason *</Label>
                  <Select value={varianceReason} onValueChange={setVarianceReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {VARIANCE_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Homework */}
              <div className="space-y-2">
                <Label>Homework</Label>
                <Textarea 
                  placeholder="Enter homework assignment..."
                  value={homework}
                  onChange={(e) => setHomework(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>

              {/* Manzil Notes */}
              <div className="space-y-2">
                <Label>Manzil Notes</Label>
                <Textarea 
                  placeholder="Enter manzil/revision notes..."
                  value={manzilNotes}
                  onChange={(e) => setManzilNotes(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </>
          )}

          {/* Submit Button */}
          <Button 
            className="w-full" 
            onClick={() => markAttendance.mutate()}
            disabled={!isFormValid || markAttendance.isPending}
          >
            {markAttendance.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Mark Attendance'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}