import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { fetchIslamicDate, type IslamicDateData } from '@/lib/islamicDate';

const PRAYERS = [
  { key: 'Fajr',    label: 'Fajr',    icon: '🌙' },
  { key: 'Dhuhr',   label: 'Dhuhr',   icon: '☀️' },
  { key: 'Asr',     label: 'Asr',     icon: '🌤️' },
  { key: 'Maghrib', label: 'Maghrib', icon: '🌅' },
  { key: 'Isha',    label: 'Isha',    icon: '🌃' },
] as const;

function parseTime(timeStr: string, refDate: Date): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(refDate);
  d.setHours(h, m, 0, 0);
  return d;
}

function getNextPrayer(prayers: IslamicDateData['prayers'], now: Date) {
  for (const p of PRAYERS) {
    if (!prayers[p.key]) continue;
    const t = parseTime(prayers[p.key], now);
    if (t > now) return { ...p, time: prayers[p.key], date: t };
  }
  if (!prayers.Fajr) return null;
  const fajrTomorrow = parseTime(prayers.Fajr, now);
  fajrTomorrow.setDate(fajrTomorrow.getDate() + 1);
  return { ...PRAYERS[0], time: prayers.Fajr, date: fajrTomorrow };
}

function getNowInTimezone(tz: string): Date {
  const str = new Date().toLocaleString('en-US', { timeZone: tz });
  return new Date(str);
}

/**
 * Single dark-navy banner consolidating greeting, Islamic date, Gregorian
 * date + clock, and the next-prayer countdown.
 */
export function UnifiedHeaderBanner() {
  const { user, profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] || 'User';

  const { data: tz = 'Asia/Karachi' } = useQuery({
    queryKey: ['unified-header-tz', user?.id],
    queryFn: async () => {
      if (!user?.id) return 'Asia/Karachi';
      const { data } = await supabase.from('profiles').select('timezone').eq('id', user.id).single();
      return (data as any)?.timezone || 'Asia/Karachi';
    },
    enabled: !!user?.id,
  });

  const { data: islamicDate } = useQuery({
    queryKey: ['unified-header-islamic', tz],
    queryFn: () => fetchIslamicDate(tz),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unified-header-unread', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('notification_queue').select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id).eq('status', 'pending');
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  // Live clock + countdown
  const [now, setNow] = useState<Date>(() => getNowInTimezone(tz));
  useEffect(() => {
    setNow(getNowInTimezone(tz));
    const t = setInterval(() => setNow(getNowInTimezone(tz)), 1000);
    return () => clearInterval(t);
  }, [tz]);

  const timeStr = new Date().toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
  const adDate = new Date().toLocaleDateString('en-US', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  const next = islamicDate?.prayers?.Fajr ? getNextPrayer(islamicDate.prayers, now) : null;
  let countdown = '';
  if (next) {
    const diff = Math.max(0, next.date.getTime() - now.getTime());
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    countdown = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${secs}s`;
  }

  return (
    <div className="bg-primary text-primary-foreground rounded-md px-3 py-2 shadow-navy">
      <div className="flex items-center gap-3">
        {/* Left: greeting */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-base">👋</span>
          <p className="text-[13px] font-bold truncate">
            Assalamu Alaikum, <span className="text-cyan-light">{firstName}</span>
          </p>
        </div>

        {/* Center: Islamic + Gregorian + time */}
        <div className="hidden md:flex items-center gap-2 text-center shrink-0">
          {islamicDate && (
            <span className="text-[12px] font-extrabold text-cyan-light tracking-wide">
              ☪️ {islamicDate.formatted}
            </span>
          )}
          <span className="text-[10px] text-cyan-light/60">·</span>
          <span className="text-[10px] text-cyan-light/80 font-semibold">{adDate}</span>
          <span className="text-[10px] font-mono font-bold text-teal-light tracking-wider">{timeStr}</span>
        </div>

        {/* Right: prayer countdown + bell */}
        <div className="flex items-center gap-2 shrink-0">
          {next && (
            <div className="flex items-center gap-1.5 bg-white/10 rounded-md px-2 py-1">
              <span className="text-[11px]">{next.icon}</span>
              <span className="text-[11px] font-bold text-cyan-light">{next.label}</span>
              <span className="text-[11px] font-mono font-extrabold text-teal-light">{countdown}</span>
            </div>
          )}
          <button className="relative bg-white/10 rounded-md w-8 h-8 flex items-center justify-center text-cyan-light">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile: stack islamic+date below */}
      <div className="md:hidden mt-1.5 flex items-center justify-between text-[10px] text-cyan-light/80">
        {islamicDate && <span className="font-extrabold text-cyan-light">☪️ {islamicDate.formatted}</span>}
        <span className="font-mono font-bold text-teal-light">{timeStr}</span>
      </div>
    </div>
  );
}
