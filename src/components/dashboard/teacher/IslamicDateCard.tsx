import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchIslamicDate, type IslamicDateData } from '@/lib/islamicDate';

function useLiveClock(timezone: string) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
  const adDate = now.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });

  return { timeStr, adDate };
}

interface IslamicDateCardProps {
  onIslamicDateLoaded?: (data: IslamicDateData) => void;
}

export function IslamicDateCard({ onIslamicDateLoaded }: IslamicDateCardProps) {
  const { user } = useAuth();
  const [islamicDate, setIslamicDate] = useState<IslamicDateData | null>(null);
  const [dateLoading, setDateLoading] = useState(true);
  const [timezone, setTimezone] = useState('Asia/Karachi');

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('timezone').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.timezone) setTimezone(data.timezone);
      });
  }, [user?.id]);

  const { timeStr, adDate } = useLiveClock(timezone);

  useEffect(() => {
    fetchIslamicDate(timezone)
      .then(data => {
        setIslamicDate(data);
        setDateLoading(false);
        onIslamicDateLoaded?.(data);
      })
      .catch(() => setDateLoading(false));
  }, [timezone]);

  // Re-fetch every 30 minutes to catch Maghrib flip
  useEffect(() => {
    const interval = setInterval(() => {
      fetchIslamicDate(timezone).then(data => {
        setIslamicDate(data);
        onIslamicDateLoaded?.(data);
      }).catch(() => {});
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  return (
    <div className="bg-primary rounded-2xl px-3.5 py-2.5 shadow-navy">
      <div className="flex items-center justify-between gap-2">
        {/* Hijri date */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm shrink-0">☪️</span>
          {dateLoading ? (
            <span className="text-xs text-cyan-light opacity-50">Loading...</span>
          ) : islamicDate ? (
            <span className="text-xs font-bold text-cyan-light tracking-wide truncate">
              {islamicDate.formatted}
            </span>
          ) : (
            <span className="text-xs text-cyan-light opacity-50">—</span>
          )}
        </div>

        {/* Live clock */}
        <div className="bg-white/[0.08] rounded-lg px-2 py-0.5 font-mono text-xs font-bold text-teal-light tracking-wider text-center shrink-0">
          {timeStr}
        </div>
      </div>

      {/* Gregorian date — second line */}
      <p className="text-[10px] font-bold text-muted-foreground/50 mt-1 text-right">
        {adDate}
      </p>
    </div>
  );
}
