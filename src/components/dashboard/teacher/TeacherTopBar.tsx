import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

function toHijri(date: Date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  let jd = Math.floor((14 - month) / 12);
  let y = year + 4800 - jd;
  let m = month + 12 * jd - 3;
  let jdn =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  let l = jdn - 1948440 + 10632;
  let n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  let j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  let hMonth = Math.floor((24 * l) / 709);
  let hDay = l - Math.floor((709 * hMonth) / 24);
  let hYear = 30 * n + j - 30;

  const HIJRI_MONTHS = [
    "Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani",
    "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
    "Ramadan", "Shawwal", "Dhul Qi'dah", "Dhul Hijjah",
  ];
  return { day: hDay, month: hMonth, year: hYear, monthName: HIJRI_MONTHS[hMonth - 1] };
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function TeacherTopBar() {
  const { profile, user } = useAuth();
  const now = useLiveClock();
  const hijri = toHijri(now);

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
  const adDate = now.toLocaleDateString("en-US", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });

  const firstName = profile?.full_name?.split(' ')[0] || 'Teacher';

  // Fetch unread notification count
  const { data: unreadCount } = useQuery({
    queryKey: ['teacher-unread-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('notification_queue')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('status', 'pending');
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'T';

  return (
    <div className="bg-primary sticky top-0 z-50 rounded-b-2xl shadow-navy">
      {/* Row 1: Date/Time Strip */}
      <div className="border-b border-white/[0.07] px-4 py-2 flex items-center justify-between gap-2">
        {/* Islamic date */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm">☪️</span>
          <span className="text-xs font-bold text-cyan-light tracking-wide">
            {hijri.day} {hijri.monthName} {hijri.year} AH
          </span>
        </div>

        {/* Live clock */}
        <div className="bg-white/[0.08] rounded-lg px-2.5 py-1 font-mono text-xs font-bold text-teal-light tracking-wider text-center min-w-[100px]">
          {timeStr}
        </div>

        {/* AD date */}
        <span className="text-[11px] font-bold text-muted-foreground/60 text-right">
          {adDate}
        </span>
      </div>

      {/* Row 2: Main Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-sky/60 font-bold tracking-[1.5px] uppercase mb-0.5">
            Al-Quran Academy
          </p>
          <p className="text-base font-bold text-primary-foreground">
            Assalamu Alaikum, {firstName} 👋
          </p>
        </div>
        <div className="flex gap-2">
          <button className="relative bg-white/[0.08] border-none rounded-xl w-10 h-10 flex items-center justify-center text-primary-foreground">
            <Bell className="h-4 w-4" />
            {(unreadCount ?? 0) > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-alert-red rounded-full border-2 border-primary" />
            )}
          </button>
          <div className="bg-teal rounded-xl w-10 h-10 flex items-center justify-center text-primary-foreground text-xs font-bold">
            {initials}
          </div>
        </div>
      </div>
    </div>
  );
}
