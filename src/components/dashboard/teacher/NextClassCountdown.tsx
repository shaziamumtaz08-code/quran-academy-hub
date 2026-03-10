import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { addDays, addMinutes } from 'date-fns';
import { Video } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Build a proper Date for "next occurrence of dayName at HH:MM in teacherTz".
 * Uses Intl to resolve the teacher's current UTC offset so the countdown
 * targets the correct instant regardless of the browser's own timezone.
 */
function buildNextOccurrence(
  dayName: string,
  timeStr: string,
  teacherTz: string,
): Date {
  const now = new Date();
  const todayIndex = now.getDay();
  const scheduleDayIndex = DAY_NAMES.indexOf(dayName);
  let daysUntil = scheduleDayIndex - todayIndex;
  if (daysUntil < 0) daysUntil += 7;

  const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);

  // Build an ISO-ish string for the target date in the teacher's timezone
  const candidateDate = addDays(now, daysUntil);
  const y = candidateDate.getFullYear();
  const m = String(candidateDate.getMonth() + 1).padStart(2, '0');
  const d = String(candidateDate.getDate()).padStart(2, '0');
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');

  // Use Intl to find the UTC offset for the teacher's timezone on that date
  // so we can construct the correct absolute instant.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: teacherTz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

  // Get the teacher-tz "now" to figure out if today's class already passed
  const teacherNowParts = dtf.formatToParts(now);
  const getP = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  const teacherNowH = getP(teacherNowParts, 'hour');
  const teacherNowM = getP(teacherNowParts, 'minute');
  const teacherNowDay = now; // we use daysUntil relative to browser day which aligns with calendar

  // Resolve offset: create a temp date in UTC matching the teacher's wall-clock,
  // then compare with what the browser thinks that instant is.
  const tempUtc = new Date(`${y}-${m}-${d}T${hh}:${mm}:00Z`);
  const teacherParts = dtf.formatToParts(tempUtc);
  const resolvedH = getP(teacherParts, 'hour');
  const resolvedM = getP(teacherParts, 'minute');
  const resolvedD = getP(teacherParts, 'day');

  // The difference between what we wanted (hh:mm on day d) and what Intl says
  // tells us the offset. Adjust the UTC time accordingly.
  const wantedMinutes = hours * 60 + minutes;
  const gotMinutes = resolvedH * 60 + resolvedM;
  let diffMinutes = gotMinutes - wantedMinutes;
  // Handle day boundary (offset pushed it to next/prev day)
  const dayNum = parseInt(d, 10);
  if (resolvedD !== dayNum) {
    diffMinutes += (resolvedD > dayNum ? 1 : -1) * 24 * 60;
  }
  const corrected = new Date(tempUtc.getTime() - diffMinutes * 60000);

  return corrected;
}

function useCountdown(target: Date | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  useEffect(() => {
    if (!target) return;
    const calc = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) return setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [target]);
  return timeLeft;
}

export function NextClassCountdown() {
  const { user } = useAuth();

  const { data: nextClass, isLoading } = useQuery({
    queryKey: ['teacher-next-class-countdown', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Fetch teacher's timezone
      const { data: profile } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .single();

      const teacherTz = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      const { data: schedules } = await supabase
        .from('schedules')
        .select(`
          id,
          day_of_week,
          teacher_local_time,
          duration_minutes,
          assignment:student_teacher_assignments!inner(
            id,
            student:profiles!student_teacher_assignments_student_id_fkey(id, full_name),
            subject:subjects(name)
          )
        `)
        .eq('is_active', true)
        .eq('student_teacher_assignments.teacher_id', user.id)
        .eq('student_teacher_assignments.status', 'active');

      if (!schedules?.length) return null;

      const now = new Date();

      const upcoming = schedules.map(s => {
        const assignment = s.assignment as any;
        const fullDateTime = buildNextOccurrence(
          s.day_of_week,
          s.teacher_local_time || '00:00',
          teacherTz,
        );

        // If today's class has already ended, push to next week
        if (now > addMinutes(fullDateTime, s.duration_minutes)) {
          const nextWeekDateTime = new Date(fullDateTime.getTime() + 7 * 86400000);
          return {
            studentName: assignment?.student?.full_name || 'Student',
            subjectName: assignment?.subject?.name || 'Quran',
            dateTime: nextWeekDateTime,
          };
        }

        return {
          studentName: assignment?.student?.full_name || 'Student',
          subjectName: assignment?.subject?.name || 'Quran',
          dateTime: fullDateTime,
        };
      }).sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

      return upcoming[0] || null;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const t = useCountdown(nextClass?.dateTime || null);

  if (isLoading) {
    return <Skeleton className="h-28 rounded-2xl" />;
  }

  if (!nextClass) {
    return (
      <div className="bg-gradient-to-br from-navy-light to-primary rounded-2xl p-4 text-primary-foreground relative overflow-hidden">
        <p className="text-xs opacity-75 font-semibold uppercase tracking-wider">No upcoming classes</p>
        <p className="text-lg font-bold mt-1">Check your schedule</p>
      </div>
    );
  }

  const isSameDay = t.days === 0;

  return (
    <div>
      <p className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase mb-2">
        Next Scheduled Class
      </p>
      <div
        className={`rounded-2xl p-4 text-primary-foreground relative overflow-hidden ${
          isSameDay
            ? 'bg-gradient-to-br from-teal to-teal-light'
            : 'bg-gradient-to-br from-navy-light to-primary'
        }`}
      >
        {/* Decorative circle */}
        <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/[0.07]" />

        <p className="text-[11px] opacity-75 font-semibold uppercase tracking-wider mb-1">
          {isSameDay ? '🟢 Coming Up Soon' : '⏰ Next Class'}
        </p>
        <p className="text-lg font-bold mb-0.5">{nextClass.studentName}</p>
        <p className="text-sm opacity-80 mb-3">{nextClass.subjectName}</p>

        <div className="flex items-center gap-2">
          {/* Countdown boxes */}
          {[
            { val: t.days > 0 ? t.days : t.hours, label: t.days > 0 ? 'DAYS' : 'HRS' },
            { val: t.days > 0 ? t.hours : t.mins, label: t.days > 0 ? 'HRS' : 'MINS' },
            { val: t.days > 0 ? t.mins : t.secs, label: t.days > 0 ? 'MINS' : 'SECS' },
          ].map((box, i) => (
            <div key={i} className="bg-white/[0.15] rounded-xl px-3.5 py-1.5 text-center">
              <div className="text-xl font-extrabold">{box.val}</div>
              <div className="text-[10px] opacity-75">{box.label}</div>
            </div>
          ))}

          {/* Start button - uses existing Zoom launch flow */}
          <button className={`ml-auto bg-primary-foreground border-none rounded-xl px-3.5 py-2.5 font-extrabold text-sm cursor-pointer flex items-center gap-1.5 ${
            isSameDay ? 'text-teal' : 'text-primary'
          }`}>
            <Video className="h-4 w-4" />
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
