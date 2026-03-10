import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Video } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get current wall-clock day/time in a given IANA timezone using Intl API.
 */
function getNowInTimezone(tz: string) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const weekday = get('weekday');
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    dayIndex: dayMap[weekday] ?? 0,
    hours: parseInt(get('hour'), 10),
    minutes: parseInt(get('minute'), 10),
    seconds: parseInt(get('second'), 10),
    absoluteMs: now.getTime(),
  };
}

function buildNextOccurrence(
  dayName: string,
  timeStr: string,
  durationMinutes: number,
  teacherTz: string,
): Date {
  const tz = getNowInTimezone(teacherTz);
  const targetDayIndex = DAY_NAMES.indexOf(dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase());
  if (targetDayIndex === -1) return new Date(tz.absoluteMs + 7 * 86400000);

  const [targetH, targetM] = (timeStr || '00:00').split(':').map(Number);

  let daysUntil = targetDayIndex - tz.dayIndex;
  if (daysUntil < 0) daysUntil += 7;

  // If today, check if class has ended
  if (daysUntil === 0) {
    const nowMins = tz.hours * 60 + tz.minutes;
    const classEndMins = targetH * 60 + targetM + durationMinutes;
    if (nowMins >= classEndMins) {
      daysUntil = 7;
    }
  }

  // Calculate ms from now to target:
  // daysUntil full days from start of today, then adjust for current vs target time
  const nowSecsOfDay = tz.hours * 3600 + tz.minutes * 60 + tz.seconds;
  const targetSecsOfDay = targetH * 3600 + targetM * 60;
  const totalSecsDiff = daysUntil * 86400 + (targetSecsOfDay - nowSecsOfDay);

  return new Date(tz.absoluteMs + totalSecsDiff * 1000);
}

function useCountdown(target: Date | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  useEffect(() => {
    if (!target) return;
    const calc = () => {
      const diff = Math.max(0, target.getTime() - Date.now());
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

      // Step 1: Get teacher timezone
      const { data: profile } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .single();

      const teacherTz = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Step 2: Get active assignments for this teacher
      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name), subject:subjects(name)')
        .eq('teacher_id', user.id)
        .eq('status', 'active');

      if (!assignments?.length) return null;

      const assignmentIds = assignments.map(a => a.id);

      // Step 3: Get active schedules for those assignments
      const { data: schedules } = await supabase
        .from('schedules')
        .select('id, day_of_week, teacher_local_time, duration_minutes, assignment_id')
        .in('assignment_id', assignmentIds)
        .eq('is_active', true);

      if (!schedules?.length) return null;

      // Step 4: Map schedules to assignment data and find nearest
      const assignmentMap = new Map(assignments.map(a => [a.id, a]));

      const upcoming = schedules.map(s => {
        const assignment = assignmentMap.get(s.assignment_id!);
        const student = assignment?.student as any;
        const subject = assignment?.subject as any;

        const dateTime = buildNextOccurrence(
          s.day_of_week,
          s.teacher_local_time || '00:00',
          s.duration_minutes,
          teacherTz,
        );

        return {
          studentName: student?.full_name || 'Student',
          subjectName: subject?.name || 'Quran',
          dateTime,
          scheduleTime: s.teacher_local_time || '00:00',
          dayOfWeek: s.day_of_week,
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
      <div className="bg-gradient-to-br from-[hsl(var(--navy-light))] to-primary rounded-2xl p-4 text-primary-foreground relative overflow-hidden">
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
            : 'bg-gradient-to-br from-[hsl(var(--navy-light))] to-primary'
        }`}
      >
        <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/[0.07]" />

        <p className="text-[11px] opacity-75 font-semibold uppercase tracking-wider mb-1">
          {isSameDay ? '🟢 Coming Up Soon' : '⏰ Next Class'}
        </p>
        <p className="text-lg font-bold mb-0.5">{nextClass.studentName}</p>
        <p className="text-sm opacity-80 mb-3">
          {nextClass.subjectName}
          <span className="ml-2 opacity-60 text-xs">
            {nextClass.dayOfWeek} · {nextClass.scheduleTime}
          </span>
        </p>

        <div className="flex items-center gap-2">
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
