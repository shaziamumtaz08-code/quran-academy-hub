import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Loader2, BookOpen, HandHelping, Brain } from 'lucide-react';
import { SurahSearchSelect } from '@/components/attendance/SurahSearchSelect';

type AttendanceStatus = 'present' | 'student_absent' | 'teacher_absent' | 'teacher_leave' | 'rescheduled' | 'student_rescheduled' | 'holiday';
type LessonType = 'qaida' | 'nazra' | 'hifz';

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

const LESSON_TYPES: { value: LessonType; label: string; icon: React.ReactNode }[] = [
  { value: 'qaida', label: 'Qaida', icon: <BookOpen className="h-4 w-4" /> },
  { value: 'nazra', label: 'Nazra', icon: <HandHelping className="h-4 w-4" /> },
  { value: 'hifz', label: 'Hifz', icon: <Brain className="h-4 w-4" /> },
];

export function QuickAttendanceDialog({ open, onOpenChange, student, teacherId }: QuickAttendanceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [classTime, setClassTime] = useState(format(new Date(), 'HH:mm'));
  const [duration, setDuration] = useState('30');
  const [lessonType, setLessonType] = useState<LessonType>('nazra');
  
  // Qaida fields
  const [sabaqPages, setSabaqPages] = useState('');
  
  // Nazra fields
  const [surahName, setSurahName] = useState('');
  const [ayahFrom, setAyahFrom] = useState('');
  const [ayahTo, setAyahTo] = useState('');
  const [linesCompleted, setLinesCompleted] = useState('');
  
  // Hifz fields
  const [hifzSurahName, setHifzSurahName] = useState('');
  const [hifzAyahFrom, setHifzAyahFrom] = useState('');
  const [hifzAyahTo, setHifzAyahTo] = useState('');
  const [sabqiNotes, setSabqiNotes] = useState('');
  const [manzilNotes, setManzilNotes] = useState('');
  const [manzilCompleted, setManzilCompleted] = useState(false);
  
  // Common fields
  const [homework, setHomework] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  
  const dailyTarget = student?.daily_target_lines || 10;
  const linesNum = parseInt(linesCompleted) || 0;
  const needsVarianceReason = status === 'present' && lessonType === 'nazra' && linesNum > 0 && linesNum < dailyTarget;

  const isFormValid = useMemo(() => {
    if (status === 'student_absent') return true;
    if (needsVarianceReason && !varianceReason) return false;
    return true;
  }, [status, needsVarianceReason, varianceReason]);

  const resetForm = () => {
    setStatus('present');
    setClassTime(format(new Date(), 'HH:mm'));
    setDuration('30');
    setLessonType('nazra');
    setSabaqPages('');
    setSurahName('');
    setAyahFrom('');
    setAyahTo('');
    setLinesCompleted('');
    setHifzSurahName('');
    setHifzAyahFrom('');
    setHifzAyahTo('');
    setSabqiNotes('');
    setManzilNotes('');
    setManzilCompleted(false);
    setHomework('');
    setVarianceReason('');
    setAbsenceReason('');
  };

  const markAttendance = useMutation({
    mutationFn: async () => {
      if (!student || !teacherId) throw new Error('Missing data');

      // Build lesson_covered text based on lesson type
      let lessonCoveredText = '';
      let finalSurahName = '';
      let finalAyahFrom: number | null = null;
      let finalAyahTo: number | null = null;

      if (lessonType === 'qaida') {
        lessonCoveredText = sabaqPages ? `Qaida Page/Lesson: ${sabaqPages}` : '';
      } else if (lessonType === 'nazra') {
        finalSurahName = surahName;
        finalAyahFrom = ayahFrom ? parseInt(ayahFrom) : null;
        finalAyahTo = ayahTo ? parseInt(ayahTo) : null;
        if (surahName && ayahFrom && ayahTo) {
          lessonCoveredText = `${surahName}, Ayah ${ayahFrom}-${ayahTo}`;
        } else if (surahName && ayahFrom) {
          lessonCoveredText = `${surahName}, Ayah ${ayahFrom}`;
        } else if (surahName) {
          lessonCoveredText = surahName;
        }
      } else if (lessonType === 'hifz') {
        finalSurahName = hifzSurahName;
        finalAyahFrom = hifzAyahFrom ? parseInt(hifzAyahFrom) : null;
        finalAyahTo = hifzAyahTo ? parseInt(hifzAyahTo) : null;
        if (hifzSurahName && hifzAyahFrom && hifzAyahTo) {
          lessonCoveredText = `Sabaq: ${hifzSurahName}, Ayah ${hifzAyahFrom}-${hifzAyahTo}`;
        } else if (hifzSurahName) {
          lessonCoveredText = `Sabaq: ${hifzSurahName}`;
        }
      }

      const { error } = await supabase.from('attendance').insert({
        student_id: student.id,
        teacher_id: teacherId,
        class_date: format(new Date(), 'yyyy-MM-dd'),
        class_time: classTime,
        duration_minutes: parseInt(duration),
        status: status,
        lesson_type: lessonType,
        lesson_covered: lessonCoveredText || null,
        homework: homework || null,
        surah_name: finalSurahName || null,
        ayah_from: finalAyahFrom,
        ayah_to: finalAyahTo,
        lines_completed: lessonType === 'nazra' && linesNum > 0 ? linesNum : null,
        variance_reason: needsVarianceReason ? varianceReason : null,
        reason: status === 'student_absent' ? absenceReason : null,
        input_unit: student.preferred_unit || 'lines',
        sabaq_pages: lessonType === 'qaida' ? sabaqPages : null,
        sabqi_notes: lessonType === 'hifz' ? sabqiNotes : null,
        manzil_notes: lessonType === 'hifz' ? manzilNotes : null,
        manzil_completed: lessonType === 'hifz' ? manzilCompleted : false,
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

              {/* Lesson Type Toggle */}
              <div className="space-y-2">
                <Label>Lesson Type</Label>
                <div className="flex gap-2">
                  {LESSON_TYPES.map((type) => (
                    <Button
                      key={type.value}
                      type="button"
                      variant={lessonType === type.value ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setLessonType(type.value)}
                    >
                      {type.icon}
                      <span className="ml-1.5">{type.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Dynamic Lesson Details Box */}
              <div className="p-4 rounded-lg border-2 border-sky/50 bg-sky/10 space-y-4">
                <h4 className="font-medium text-navy text-sm flex items-center gap-2">
                  {LESSON_TYPES.find(t => t.value === lessonType)?.icon}
                  {lessonType === 'qaida' && 'Qaida Progress'}
                  {lessonType === 'nazra' && 'Nazra Progress'}
                  {lessonType === 'hifz' && 'Hifz Progress'}
                </h4>

                {/* Qaida Fields */}
                {lessonType === 'qaida' && (
                  <div className="space-y-2">
                    <Label>Current Page / Lesson No.</Label>
                    <Input 
                      placeholder="e.g. Page 15 or Lesson 7"
                      value={sabaqPages}
                      onChange={(e) => setSabaqPages(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                )}

                {/* Nazra Fields */}
                {lessonType === 'nazra' && (
                  <>
                    <div className="space-y-2">
                      <Label>Surah</Label>
                      <SurahSearchSelect value={surahName} onChange={setSurahName} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Ayah From</Label>
                        <Input 
                          type="number" 
                          placeholder="e.g. 1" 
                          value={ayahFrom} 
                          onChange={(e) => setAyahFrom(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ayah To</Label>
                        <Input 
                          type="number" 
                          placeholder="e.g. 10" 
                          value={ayahTo} 
                          onChange={(e) => setAyahTo(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Lines Completed</Label>
                      <Input 
                        type="number" 
                        placeholder={`Target: ${dailyTarget} ${student.preferred_unit}`}
                        value={linesCompleted} 
                        onChange={(e) => setLinesCompleted(e.target.value)}
                        className="bg-background"
                      />
                      {needsVarianceReason && (
                        <p className="text-xs text-amber-600">Below daily target - variance reason required</p>
                      )}
                    </div>

                    {needsVarianceReason && (
                      <div className="space-y-2">
                        <Label>Variance Reason *</Label>
                        <Select value={varianceReason} onValueChange={setVarianceReason}>
                          <SelectTrigger className="bg-background">
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
                  </>
                )}

                {/* Hifz Fields */}
                {lessonType === 'hifz' && (
                  <>
                    {/* Sabaq (New Lesson) */}
                    <div className="space-y-3 p-3 bg-background rounded-md border">
                      <Label className="text-navy font-medium">📖 New Lesson (Sabaq)</Label>
                      <div className="space-y-2">
                        <SurahSearchSelect value={hifzSurahName} onChange={setHifzSurahName} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Ayah From</Label>
                          <Input 
                            type="number" 
                            placeholder="1" 
                            value={hifzAyahFrom} 
                            onChange={(e) => setHifzAyahFrom(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Ayah To</Label>
                          <Input 
                            type="number" 
                            placeholder="5" 
                            value={hifzAyahTo} 
                            onChange={(e) => setHifzAyahTo(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sabqi (Recent Revision) */}
                    <div className="space-y-2 p-3 bg-background rounded-md border">
                      <Label className="text-navy font-medium">🔄 Recent Revision (Sabqi)</Label>
                      <Textarea 
                        placeholder="e.g. Surah Al-Mulk, Ayah 1-15"
                        value={sabqiNotes}
                        onChange={(e) => setSabqiNotes(e.target.value)}
                        className="min-h-[60px]"
                      />
                    </div>

                    {/* Manzil (Old Revision) */}
                    <div className="space-y-2 p-3 bg-background rounded-md border">
                      <Label className="text-navy font-medium">📚 Old Revision (Manzil)</Label>
                      <Textarea 
                        placeholder="e.g. Juz 29, Para 1"
                        value={manzilNotes}
                        onChange={(e) => setManzilNotes(e.target.value)}
                        className="min-h-[60px]"
                      />
                      <div className="flex items-center space-x-2 pt-2">
                        <Checkbox 
                          id="manzilCompleted" 
                          checked={manzilCompleted}
                          onCheckedChange={(checked) => setManzilCompleted(checked === true)}
                        />
                        <label 
                          htmlFor="manzilCompleted" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Manzil Heard / Completed ✓
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>

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
