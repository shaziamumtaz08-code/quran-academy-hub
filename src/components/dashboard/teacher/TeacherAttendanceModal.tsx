import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { StudentData } from './TeacherStudentCard';

interface TeacherAttendanceModalProps {
  student: StudentData;
  onClose: () => void;
}

function PlanReminderBanner({ studentName, planFilled }: { studentName: string; planFilled: boolean }) {
  const navigate = useNavigate();
  if (planFilled) return null;
  const monthName = format(new Date(), 'MMMM');
  return (
    <div className="bg-gradient-to-br from-gold-light/15 to-gold-light/5 border border-gold-light rounded-xl p-3 flex items-start gap-2.5 mb-3.5">
      <span className="text-lg flex-shrink-0">📋</span>
      <div className="flex-1">
        <p className="font-extrabold text-sm text-gold mb-0.5">{monthName} Plan Not Submitted</p>
        <p className="text-xs text-gold/70 leading-relaxed">
          {studentName}'s monthly planning form for {monthName} {format(new Date(), 'yyyy')} is pending. Should be filled by month-end.
        </p>
        <button
          onClick={() => navigate('/planning')}
          className="mt-2 bg-gold text-primary-foreground border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-gold/90 transition-colors"
        >
          Fill Plan Now →
        </button>
      </div>
    </div>
  );
}

function PlanContextPanel({ plan }: { plan: any }) {
  if (!plan) return null;
  return (
    <div className="bg-sky/5 border border-sky/30 rounded-xl p-3 mb-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">📖</span>
          <span className="font-extrabold text-sm text-foreground">
            Monthly Plan — {plan.month}/{plan.year}
          </span>
        </div>
        <span className="bg-teal/15 text-teal text-[11px] font-bold rounded-md px-2 py-0.5">
          ✓ {plan.status}
        </span>
      </div>

      {/* Position: from → to */}
      <div className="flex items-center gap-2 bg-card rounded-xl p-2.5 mb-2.5 border border-sky/20">
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">START</p>
          <p className="text-sm font-extrabold text-foreground">{plan.surah_from || plan.resource_name || 'N/A'}</p>
        </div>
        <span className="text-lg text-sky">→</span>
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">TARGET</p>
          <p className="text-sm font-extrabold text-teal">{plan.surah_to || 'N/A'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2 mb-2.5">
        <div className="flex-1 bg-card rounded-lg p-2 border border-sky/20">
          <p className="text-[10px] text-muted-foreground font-semibold">DAILY TARGET</p>
          <p className="text-sm font-extrabold text-sky mt-0.5">{plan.daily_target} {plan.primary_marker}</p>
        </div>
        <div className="flex-1 bg-card rounded-lg p-2 border border-sky/20">
          <p className="text-[10px] text-muted-foreground font-semibold">MONTHLY TARGET</p>
          <p className="text-sm font-extrabold text-gold mt-0.5">{plan.monthly_target} {plan.primary_marker}</p>
        </div>
      </div>

      {plan.notes && (
        <div className="bg-sky/10 rounded-lg p-2 text-xs text-muted-foreground italic border-l-[3px] border-sky">
          💬 "{plan.notes}"
        </div>
      )}
    </div>
  );
}

export function TeacherAttendanceModal({ student, onClose }: TeacherAttendanceModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'present' | 'absent' | 'late'>('present');
  const [lesson, setLesson] = useState('');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);

  // Fetch latest plan for this student
  const { data: latestPlan } = useQuery({
    queryKey: ['student-plan-modal', student.id, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('student_monthly_plans')
        .select('*')
        .eq('student_id', student.id)
        .eq('teacher_id', user.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Check if current month plan is submitted
  const { data: currentMonthPlanFilled } = useQuery({
    queryKey: ['student-plan-filled', student.id, user?.id],
    queryFn: async () => {
      if (!user?.id) return true;
      const now = new Date();
      const { count } = await supabase
        .from('student_monthly_plans')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', student.id)
        .eq('teacher_id', user.id)
        .eq('month', format(now, 'MM'))
        .eq('year', format(now, 'yyyy'))
        .in('status', ['pending', 'approved']);
      return (count || 0) > 0;
    },
    enabled: !!user?.id,
  });

  // Save attendance
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const now = new Date();
      const { error } = await supabase.from('attendance').insert({
        student_id: student.id,
        teacher_id: user.id,
        class_date: format(now, 'yyyy-MM-dd'),
        class_time: format(now, 'HH:mm'),
        status,
        lesson_covered: lesson || null,
        homework: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ['teacher-students'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-stats'] });
      queryClient.invalidateQueries({ queryKey: ['missed-attendance-banner'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save attendance');
    },
  });

  // Done confirmation screen
  if (done) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-5" onClick={onClose}>
        <div className="bg-card rounded-2xl p-8 text-center max-w-[320px] w-full" onClick={e => e.stopPropagation()}>
          <div className="text-5xl mb-3">✅</div>
          <p className="font-extrabold text-lg text-foreground mb-1.5">Attendance Marked!</p>
          <p className="text-sm text-muted-foreground mb-5">
            {student.name} — {format(new Date(), 'EEEE, MMM dd')}
          </p>
          {!currentMonthPlanFilled && (
            <div className="bg-gold-light/15 border border-gold-light rounded-xl p-3 mb-4 text-xs text-gold">
              📋 Don't forget — {format(new Date(), 'MMMM')} plan for {student.name} is still pending!
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full bg-teal text-primary-foreground border-none rounded-xl py-3 font-bold text-[15px] cursor-pointer hover:bg-teal-light transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Main modal (bottom sheet)
  return (
    <div
      className="fixed inset-0 bg-black/55 flex items-end z-[1000]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card rounded-t-2xl p-5 pb-9 w-full max-w-[480px] mx-auto max-h-[92vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

        {/* Student header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-primary-foreground font-extrabold text-[15px]"
            style={{ background: student.avatarColor }}
          >
            {student.initials}
          </div>
          <div>
            <p className="font-extrabold text-base text-foreground">Mark Attendance</p>
            <p className="text-sm text-muted-foreground">{student.name} · {student.course}</p>
          </div>
        </div>

        {/* Plan reminder */}
        <PlanReminderBanner studentName={student.name} planFilled={currentMonthPlanFilled ?? true} />

        {/* Plan context */}
        <PlanContextPanel plan={latestPlan} />

        {/* Divider */}
        <div className="h-px bg-border mb-3.5" />

        {/* Status toggle */}
        <p className="font-bold text-sm text-foreground mb-2">Today's Status</p>
        <div className="flex gap-2 mb-4">
          {(['present', 'absent', 'late'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm capitalize cursor-pointer border-2 transition-all ${
                status === s
                  ? s === 'present' ? 'border-teal bg-teal/10 text-teal'
                    : s === 'absent' ? 'border-alert-red bg-alert-red/10 text-alert-red'
                    : 'border-gold bg-gold/10 text-gold'
                  : 'border-border bg-card text-muted-foreground'
              }`}
            >
              {s === 'present' ? '✓ Present' : s === 'absent' ? '✗ Absent' : '⏱ Late'}
            </button>
          ))}
        </div>

        {/* Lesson */}
        <p className="font-bold text-sm text-foreground mb-1.5">Lesson Covered (optional)</p>
        <input
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
          placeholder={`e.g. ${student.currentPosition || student.course}`}
          className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm mb-3 outline-none focus:border-teal bg-card text-foreground"
        />

        {/* Notes */}
        <p className="font-bold text-sm text-foreground mb-1.5">Notes (optional)</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Student was struggling with tajweed..."
          rows={2}
          className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm mb-4 outline-none resize-none focus:border-teal bg-card text-foreground"
        />

        {/* Save */}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full bg-teal text-primary-foreground border-none rounded-xl py-3.5 font-extrabold text-[15px] cursor-pointer hover:bg-teal-light transition-colors disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>
    </div>
  );
}
