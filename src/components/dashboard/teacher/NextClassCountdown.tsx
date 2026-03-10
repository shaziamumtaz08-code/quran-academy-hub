import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Video } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  if (daysUntil === 0) {
    const nowMins = tz.hours * 60 + tz.minutes;
    const classEndMins = targetH * 60 + targetM + durationMinutes;
    if (nowMins >= classEndMins) daysUntil = 7;
  }

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

// Short day labels
const SHORT_DAYS: Record<string, string> = {
  Sunday: 'Sun', Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
};

export function NextClassCountdown() {
  const { user } = useAuth();

  const { data: nextClass, isLoading } = useQuery({
    queryKey: ['teacher-next-class-countdown', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .single();

      const teacherTz = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name), subject:subjects(name)')
        .eq('teacher_id', user.id)
        .eq('status', 'active');

      if (!assignments?.length) return null;

      const assignmentIds = assignments.map(a => a.id);

      const { data: schedules } = await supabase
        .from('schedules')
        .select('id, day_of_week, teacher_local_time, duration_minutes, assignment_id')
        .in('assignment_id', assignmentIds)
        .eq('is_active', true);

      if (!schedules?.length) return null;

      const assignmentMap = new Map(assignments.map(a => [a.id, a]));

      const upcoming = schedules.map(s => {
        const assignment = assignmentMap.get(s.assignment_id!);
        const student = assignment?.student as any;
        const subject = assignment?.subject as any;
        const normalizedDay = s.day_of_week ? s.day_of_week.charAt(0).toUpperCase() + s.day_of_week.slice(1).toLowerCase() : '';

        return {
          studentName: student?.full_name || 'Student',
          subjectName: subject?.name || 'Quran',
          dateTime: buildNextOccurrence(s.day_of_week, s.teacher_local_time || '00:00', s.duration_minutes, teacherTz),
          scheduleTime: s.teacher_local_time || '00:00',
          dayOfWeek: normalizedDay,
        };
      }).sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

      return upcoming[0] || null;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const t = useCountdown(nextClass?.dateTime || null);

  if (isLoading) return <Skeleton className="h-14 rounded-xl" />;

  if (!nextClass) {
    return (
      <div className="bg-card rounded-xl border border-border px-3.5 py-2.5">
        <p className="text-xs text-muted-foreground font-semibold">No upcoming classes</p>
      </div>
    );
  }

  // Format time to 12h
  const [hh, mm] = nextClass.scheduleTime.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  const timeDisplay = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;

  const shortDay = SHORT_DAYS[nextClass.dayOfWeek] || nextClass.dayOfWeek;

  // Countdown text
  const parts: string[] = [];
  if (t.days > 0) parts.push(`${t.days}d`);
  parts.push(`${t.hours}h`);
  parts.push(`${String(t.mins).padStart(2, '0')}m`);
  const countdownText = parts.join('  ');

  return (
    <div className="bg-gradient-to-br from-primary to-[hsl(var(--navy-light))] rounded-2xl px-3.5 py-3 text-primary-foreground shadow-card">
      <p className="text-[10px] opacity-80 font-extrabold tracking-wide uppercase mb-1.5 flex items-center gap-1.5">
        <span aria-hidden="true">⏰</span>
        Next Class
      </p>

      <p className="text-[18px] leading-tight font-extrabold truncate">{nextClass.studentName}</p>
      <p className="text-[12px] text-primary-foreground/75 font-semibold truncate mt-0.5">
        {nextClass.subjectName} · {shortDay.toLowerCase()} · {timeDisplay}
      </p>

      <div className="mt-2.5 flex items-center gap-2">
        <div className="grid grid-cols-3 gap-1.5 flex-1 min-w-0">
          <div className="bg-primary-foreground/15 rounded-lg py-1.5 text-center">
            <p className="text-[22px] leading-none font-extrabold">{t.days}</p>
            <p className="text-[9px] text-primary-foreground/70 font-bold tracking-wide">DAYS</p>
          </div>
          <div className="bg-primary-foreground/15 rounded-lg py-1.5 text-center">
            <p className="text-[22px] leading-none font-extrabold">{t.hours}</p>
            <p className="text-[9px] text-primary-foreground/70 font-bold tracking-wide">HRS</p>
          </div>
          <div className="bg-primary-foreground/15 rounded-lg py-1.5 text-center">
            <p className="text-[22px] leading-none font-extrabold">{String(t.mins).padStart(2, '0')}</p>
            <p className="text-[9px] text-primary-foreground/70 font-bold tracking-wide">MINS</p>
          </div>
        </div>

        <button className="bg-primary-foreground text-primary border-none rounded-xl px-3 py-2 font-extrabold text-sm cursor-pointer flex items-center gap-1.5 hover:opacity-90 transition-opacity shrink-0">
          <Video className="h-4 w-4" />
          Start
        </button>
      </div>
    </div>
  );
}
