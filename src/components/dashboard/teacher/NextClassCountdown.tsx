import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { StartClassButton } from '@/components/zoom/StartClassButton';
import { NextClassBanner } from '@/components/dashboard/shared/NextClassBanner';
import { useHolidayOn } from '@/hooks/useHolidayToday';

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
  const { data: holiday } = useHolidayOn();


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

      // Base `schedules` rows go stale after a reschedule — the current time for
      // each weekly slot lives in schedule_periods. Overlay them so the banner
      // matches the My Schedule page.
      const scheduleIds = schedules.map(s => s.id);
      const { data: periodRows } = await supabase
        .from('schedule_periods')
        .select('id, schedule_id, day_of_week, teacher_local_time, duration_minutes, period_type, effective_from, effective_to, created_at')
        .in('schedule_id', scheduleIds);

      const periodsBySchedule = new Map<string, any[]>();
      (periodRows || []).forEach((p: any) => {
        const list = periodsBySchedule.get(p.schedule_id) || [];
        list.push(p);
        periodsBySchedule.set(p.schedule_id, list);
      });

      const assignmentMap = new Map(assignments.map(a => [a.id, a]));
      const tzNow = getNowInTimezone(teacherTz);
      const nowSecsOfDay = tzNow.hours * 3600 + tzNow.minutes * 60 + tzNow.seconds;

      const isoInTz = (offsetDays: number) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: teacherTz }).format(
          new Date(tzNow.absoluteMs + offsetDays * 86400000),
        );

      type Candidate = {
        studentName: string;
        subjectName: string;
        dateTime: Date;
        scheduleTime: string;
        dayOfWeek: string;
      };

      const candidates: Candidate[] = [];

      for (let offset = 0; offset <= 7; offset++) {
        const iso = isoInTz(offset);
        const weekdayIndex = (tzNow.dayIndex + offset) % 7;
        const weekday = DAY_NAMES[weekdayIndex].toLowerCase();

        for (const s of schedules) {
          const slotPeriods = periodsBySchedule.get(s.id) || [];
          const active = slotPeriods
            .filter(p => p.effective_from <= iso && (!p.effective_to || p.effective_to >= iso))
            .sort((a, b) => {
              if (a.period_type !== b.period_type) return a.period_type === 'temporary' ? -1 : 1;
              return (
                String(b.effective_from).localeCompare(String(a.effective_from)) ||
                String(b.created_at).localeCompare(String(a.created_at))
              );
            })[0];

          if (!active) {
            // A permanent period that ended with nothing replacing it means the
            // weekly slot was dismantled — skip it entirely.
            const lastPermanent = slotPeriods
              .filter(p => p.period_type === 'permanent' && p.effective_from <= iso)
              .sort((a, b) =>
                String(b.effective_from).localeCompare(String(a.effective_from)) ||
                String(b.created_at).localeCompare(String(a.created_at)),
              )[0];
            if (lastPermanent?.effective_to && lastPermanent.effective_to < iso) continue;
          }

          const day = String(active?.day_of_week || s.day_of_week || '').toLowerCase();
          if (day !== weekday) continue;

          const time = (active?.teacher_local_time || s.teacher_local_time || '00:00').slice(0, 5);
          const duration = active?.duration_minutes ?? s.duration_minutes ?? 30;
          const [th, tm] = time.split(':').map(Number);
          const targetSecsOfDay = th * 3600 + tm * 60;
          const diffSecs = offset * 86400 + (targetSecsOfDay - nowSecsOfDay);
          // Skip slots that already finished (a live class still counts as next).
          if (diffSecs + duration * 60 <= 0) continue;

          const assignment = assignmentMap.get(s.assignment_id!);
          const student = assignment?.student as any;
          const subject = assignment?.subject as any;

          candidates.push({
            studentName: student?.full_name || 'Student',
            subjectName: subject?.name || 'Quran',
            dateTime: new Date(tzNow.absoluteMs + diffSecs * 1000),
            scheduleTime: time,
            dayOfWeek: DAY_NAMES[weekdayIndex],
          });
        }

        if (candidates.length) break;
      }

      candidates.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

      return candidates[0] || null;
    },

    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const t = useCountdown(nextClass?.dateTime || null);

  if (isLoading) return <Skeleton className="h-14 rounded-xl" />;

  const isToday =
    !!nextClass && nextClass.dateTime.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');

  if (!nextClass || (holiday && isToday)) {
    return (
      <NextClassBanner
        empty
        emptyMessage={
          holiday
            ? `Academy holiday today${holiday.name ? ` — ${holiday.name}` : ''}. Classes are off.`
            : undefined
        }
        studentName=""
        scheduleLabel=""
        countdownLabel=""
        action={null}
      />
    );
  }

  // Format time to 12h
  const [hh, mm] = nextClass.scheduleTime.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  const timeDisplay = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;

  const shortDay = SHORT_DAYS[nextClass.dayOfWeek] || nextClass.dayOfWeek;

  const countdownLabel = t.days > 0
    ? `${t.days}d ${t.hours}h ${String(t.mins).padStart(2, '0')}m remaining`
    : `${t.hours}h ${String(t.mins).padStart(2, '0')}m remaining`;

  return (
    <NextClassBanner
      studentName={nextClass.studentName}
      scheduleLabel={`${nextClass.subjectName} · ${shortDay} ${timeDisplay}`}
      countdownLabel={countdownLabel}
      platform="Online class"
      action={<StartClassButton className="w-full md:w-auto" />}
    />
  );
}

