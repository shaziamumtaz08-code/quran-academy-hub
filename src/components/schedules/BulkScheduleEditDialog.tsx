import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { CalendarDays, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DAYS_LABELS, nextDateOnWeekday, previousDateOnWeekday } from '@/lib/scheduleWeekdays';

export interface BulkEditableSchedule {
  id: string;
  assignment_id: string;
  day_of_week: string;
  student_local_time: string;
  teacher_local_time: string;
  duration_minutes: number;
}

export interface BulkEditAssignmentOption {
  id: string;
  label: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignments: BulkEditAssignmentOption[];
  schedules: BulkEditableSchedule[];
  /** Reuses the page's existing conflict detection so there is only one code path. */
  checkConflict: (input: {
    day: string;
    studentTime: string;
    duration: number;
    assignmentId: string;
    scheduleId: string;
  }) => { hasConflict: boolean; conflictDetails: string };
  /** Converts a student local time into the teacher's local time for an assignment. */
  toTeacherTime: (assignmentId: string, studentTime: string) => string;
}

const DURATIONS = ['15', '20', '30', '45', '60', '90'];

export function BulkScheduleEditDialog({
  open,
  onOpenChange,
  assignments,
  schedules,
  checkConflict,
  toTeacherTime,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [assignmentId, setAssignmentId] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [studentTime, setStudentTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [periodType, setPeriodType] = useState<'permanent' | 'temporary'>('permanent');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const daySchedules = useMemo(
    () => schedules.filter((s) => s.assignment_id === assignmentId),
    [schedules, assignmentId],
  );

  const reset = () => {
    setAssignmentId('');
    setSelectedDays([]);
    setStudentTime('');
    setDuration('30');
    setPeriodType('permanent');
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const close = () => {
    if (saving) return;
    reset();
    onOpenChange(false);
  };

  /** Per-day dates: start snaps forward to that weekday, end snaps backward. */
  const resolveDates = (day: string) => {
    const from = startDate ? nextDateOnWeekday(day, new Date(`${startDate}T12:00:00`)) : '';
    const to = endDate ? previousDateOnWeekday(day, new Date(`${endDate}T12:00:00`)) : '';
    return { from, to, invalid: Boolean(from && to && to < from) };
  };

  const handleSave = async () => {
    if (!assignmentId || selectedDays.length === 0) {
      toast({ title: 'Nothing selected', description: 'Pick a student and at least one day to change.', variant: 'destructive' });
      return;
    }
    if (!studentTime) {
      toast({ title: 'Time missing', description: 'Enter the new student time.', variant: 'destructive' });
      return;
    }
    if (!startDate) {
      toast({ title: 'Start date missing', description: 'Choose the date the new timing starts from.', variant: 'destructive' });
      return;
    }
    if (periodType === 'temporary' && !endDate) {
      toast({ title: 'End date missing', description: 'A temporary timing needs an end date.', variant: 'destructive' });
      return;
    }
    if (reason.trim().length < 4) {
      toast({ title: 'Reason too short', description: 'Enter at least 4 characters explaining the change.', variant: 'destructive' });
      return;
    }

    const durationMinutes = parseInt(duration, 10);
    const batchId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) as string;

    setSaving(true);
    const saved: string[] = [];
    const failed: string[] = [];

    // Every day is attempted on its own: a clash, a backwards snapped range or a
    // rejected save is recorded and the remaining days still go through.
    for (const day of selectedDays) {
      const row = daySchedules.find((s) => s.day_of_week === day);
      const label = DAYS_LABELS[day] || day;
      if (!row) {
        failed.push(`${label}: no existing schedule`);
        continue;
      }
      const { from, to, invalid } = resolveDates(day);
      if (invalid) {
        failed.push(`${label}: the date range ends before it starts for this day`);
        continue;
      }
      const conflict = checkConflict({ day, studentTime, duration: durationMinutes, assignmentId, scheduleId: row.id });
      if (conflict.hasConflict) {
        failed.push(`${label}: ${conflict.conflictDetails}`);
        continue;
      }
      try {
        const { error } = await (supabase as any).rpc('apply_schedule_period', {
          _schedule_id: row.id,
          _student_local_time: studentTime,
          _teacher_local_time: toTeacherTime(assignmentId, studentTime),
          _duration_minutes: durationMinutes,
          _period_type: periodType,
          _effective_from: from,
          _effective_to: to || null,
          _change_reason: reason.trim(),
          _batch_id: batchId,
        });
        if (error) throw error;
        saved.push(label);
      } catch (err: any) {
        failed.push(`${label}: ${err?.message || 'could not be saved'}`);
      }
    }

    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ['class-schedules'] });
    queryClient.invalidateQueries({ queryKey: ['schedule-periods'] });

    if (failed.length === 0) {
      toast({ title: `${saved.length} day${saved.length === 1 ? '' : 's'} updated`, description: saved.join(', ') });
      close();
      return;
    }
    toast({
      title: saved.length ? `${saved.length} saved, ${failed.length} skipped` : 'Nothing could be saved',
      description: `${saved.length ? `Saved: ${saved.join(', ')}. ` : ''}Skipped — ${failed.join(' · ')}`,
      variant: saved.length ? 'default' : 'destructive',
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit multiple days</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Student / assignment *</Label>
            <Select value={assignmentId} onValueChange={(v) => { setAssignmentId(v); setSelectedDays([]); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Choose an assignment" /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {assignments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assignmentId && (
            <div className="space-y-1.5">
              <Label className="text-xs">Days to change *</Label>
              {daySchedules.length === 0 ? (
                <p className="text-xs text-muted-foreground">This assignment has no weekly classes yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {daySchedules.map((row) => {
                    const checked = selectedDays.includes(row.day_of_week);
                    const { from, to, invalid } = resolveDates(row.day_of_week);
                    return (
                      <label key={row.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => setSelectedDays((prev) =>
                            prev.includes(row.day_of_week) ? prev.filter((d) => d !== row.day_of_week) : [...prev, row.day_of_week])}
                        />
                        <span className="font-medium w-24">{DAYS_LABELS[row.day_of_week] || row.day_of_week}</span>
                        <span className="text-xs text-muted-foreground">
                          {from ? `from ${format(new Date(`${from}T12:00:00`), 'dd MMM yyyy')}` : 'pick a start date'}
                          {to ? ` to ${format(new Date(`${to}T12:00:00`), 'dd MMM yyyy')}` : ''}
                        </span>
                        {invalid && (
                          <span className="ml-auto flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="h-3 w-3" /> range too short
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-xs">New student time *</Label>
              <Input type="time" className="h-9" value={studentTime} onChange={(e) => setStudentTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {DURATIONS.map((d) => <SelectItem key={d} value={d}>{d} min</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant={periodType === 'permanent' ? 'default' : 'outline'} onClick={() => { setPeriodType('permanent'); setEndDate(''); }}>
              Permanent change
            </Button>
            <Button type="button" size="sm" variant={periodType === 'temporary' ? 'default' : 'outline'} onClick={() => setPeriodType('temporary')}>
              Temporary period
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs">Starts on *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-full justify-start font-normal">
                    <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                    {startDate ? format(new Date(`${startDate}T12:00:00`), 'dd MMM yyyy') : 'Pick start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                  <DateCalendar
                    mode="single"
                    selected={startDate ? new Date(`${startDate}T12:00:00`) : undefined}
                    onSelect={(date) => date && setStartDate(format(date, 'yyyy-MM-dd'))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{periodType === 'temporary' ? 'Ends on *' : 'Ends after (optional)'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-full justify-start font-normal">
                    <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                    {endDate ? format(new Date(`${endDate}T12:00:00`), 'dd MMM yyyy') : 'Pick end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                  <DateCalendar
                    mode="single"
                    selected={endDate ? new Date(`${endDate}T12:00:00`) : undefined}
                    onSelect={(date) => date && setEndDate(format(date, 'yyyy-MM-dd'))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Each day saves on its own weekly date: the start moves forward to that day, the end moves back to it. Past dates are allowed.
          </p>

          <div className="space-y-1">
            <Label className="text-xs">Reason *</Label>
            <Input className="h-9" value={reason} maxLength={240} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Term timing revision" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={close} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save {selectedDays.length || ''} day{selectedDays.length === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
