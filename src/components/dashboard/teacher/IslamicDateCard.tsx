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
  onTimezoneResolved?: (tz: string) => void;
}

export function IslamicDateCard({ onIslamicDateLoaded, onTimezoneResolved }: IslamicDateCardProps) {
  const { user } = useAuth();
  const [islamicDate, setIslamicDate] = useState<IslamicDateData | null>(null);
  const [dateLoading, setDateLoading] = useState(true);
  const [timezone, setTimezone] = useState('Asia/Karachi');

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('timezone').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.timezone) {
          setTimezone(data.timezone);
          onTimezoneResolved?.(data.timezone);
        } else {
          onTimezoneResolved?.('Asia/Karachi');
        }
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
    <div className="bg-primary rounded-2xl px-3 py-1.5 shadow-navy text-center">
      {/* Hijri date — centered, prominent */}
      {dateLoading ? (
        <span className="text-xs text-cyan-light opacity-50">Loading...</span>
      ) : islamicDate ? (
        <p className="text-sm font-extrabold text-cyan-light tracking-wide">
          ☪️ {islamicDate.formatted}
        </p>
      ) : (
        <span className="text-xs text-cyan-light opacity-50">—</span>
      )}

      {/* Gregorian + clock on one line */}
      <div className="flex items-center justify-center gap-2 mt-0.5">
        <span className="text-[10px] text-cyan-light/70 font-semibold">{adDate}</span>
        <span className="text-[10px] font-mono font-bold text-teal-light tracking-wider">{timeStr}</span>
      </div>
    </div>
  );
}
