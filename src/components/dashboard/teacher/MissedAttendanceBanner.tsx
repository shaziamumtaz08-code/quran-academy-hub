import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { format, subDays, isAfter, isBefore, startOfDay } from 'date-fns';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const OPERATIONAL_CUTOFF = '2026-04-01';

interface MissedEntry {
  date: string;
  studentName: string;
  subject: string;
}

export function MissedAttendanceBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);

  const { data: missedEntries } = useQuery({
    queryKey: ['missed-attendance-banner', user?.id],
    queryFn: async (): Promise<MissedEntry[]> => {
      if (!user?.id) return [];

      // Get teacher's active assignments with schedules
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          student_id,
          student:profiles!student_teacher_assignments_student_id_fkey(full_name),
          subject:subjects(name),
          schedules(day_of_week, is_active)
        `)
        .eq('teacher_id', user.id)
        .eq('status', 'active');

      if (!assignments?.length) return [];

      // Get attendance records for last 14 days
      const twoWeeksAgoRaw = format(subDays(new Date(), 14), 'yyyy-MM-dd');
      const twoWeeksAgo = twoWeeksAgoRaw < OPERATIONAL_CUTOFF ? OPERATIONAL_CUTOFF : twoWeeksAgoRaw;
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('student_id, class_date')
        .eq('teacher_id', user.id)
        .gte('class_date', twoWeeksAgo)
        .lt('class_date', today);

      const attendedSet = new Set(
        (attendanceRecords || []).map(a => `${a.student_id}_${a.class_date}`)
      );

      const missed: MissedEntry[] = [];

      // For each assignment, check if scheduled days have attendance records
      for (const assignment of assignments) {
        const student = assignment.student as any;
        const subject = assignment.subject as any;
        const schedules = (assignment.schedules as any[]) || [];
        const activeDays = schedules
          .filter((s: any) => s.is_active)
          .map((s: any) => s.day_of_week);

        // Check last 14 days
        for (let i = 1; i <= 14; i++) {
          const checkDate = subDays(new Date(), i);
          const dayName = DAY_NAMES[checkDate.getDay()];
          const dateStr = format(checkDate, 'yyyy-MM-dd');

          if (activeDays.includes(dayName)) {
            const key = `${assignment.student_id}_${dateStr}`;
            if (!attendedSet.has(key)) {
              missed.push({
                date: format(checkDate, 'MMM dd'),
                studentName: student?.full_name || 'Unknown',
                subject: subject?.name || 'Quran',
              });
            }
          }
        }
      }

      return missed.slice(0, 10);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (!visible || !missedEntries?.length) return null;

  return (
    <div className="bg-gold-light/20 border border-gold-light rounded-xl p-3 flex items-start gap-2.5 relative">
      <span className="text-lg flex-shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-xs text-gold/90 mb-0.5">
          {missedEntries.length} Attendance{missedEntries.length > 1 ? 's' : ''} Not Marked
        </p>
        {missedEntries.slice(0, 2).map((m, i) => (
          <p key={i} className="text-xs text-gold/70">
            • {m.studentName} — {m.date} ({m.subject})
          </p>
        ))}
        {missedEntries.length > 2 && (
          <p className="text-xs font-semibold text-gold mt-0.5">
            +{missedEntries.length - 2} more
          </p>
        )}
        <button
          onClick={() => navigate('/attendance?tab=1on1')}
          className="mt-2 bg-gold text-primary-foreground border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-gold/90 transition-colors"
        >
          Mark Now →
        </button>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="absolute top-2 right-2 bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
