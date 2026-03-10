import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { IslamicDateData } from '@/lib/islamicDate';

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
  // All done — next is Fajr tomorrow
  if (!prayers.Fajr) return null;
  const fajrTomorrow = parseTime(prayers.Fajr, now);
  fajrTomorrow.setDate(fajrTomorrow.getDate() + 1);
  return { ...PRAYERS[0], time: prayers.Fajr, date: fajrTomorrow };
}

function getCurrentPrayerKey(prayers: IslamicDateData['prayers'], now: Date): string | null {
  let current: string | null = null;
  for (const p of PRAYERS) {
    if (!prayers[p.key]) continue;
    const t = parseTime(prayers[p.key], now);
    if (t <= now) current = p.key;
  }
  return current;
}

interface PrayerTimesWidgetProps {
  islamicDate: IslamicDateData | null;
}

export function PrayerTimesWidget({ islamicDate }: PrayerTimesWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!islamicDate?.prayers?.Fajr) return null;

  const prayers = islamicDate.prayers;
  const next = getNextPrayer(prayers, now);
  const currentKey = getCurrentPrayerKey(prayers, now);

  if (!next) return null;

  const diff = Math.max(0, next.date.getTime() - now.getTime());
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const countdownStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${secs}s`;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-card mb-3.5">
      {/* Collapsed header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="px-4 py-3 flex items-center gap-2.5 cursor-pointer"
      >
        {/* Mosque icon */}
        <div className="bg-gradient-to-br from-[hsl(var(--navy-light))] to-primary rounded-[10px] w-[38px] h-[38px] flex items-center justify-center text-lg shrink-0">
          🕌
        </div>

        <div className="flex-1">
          <div className="text-[11px] text-muted-foreground font-bold tracking-wider">NEXT PRAYER</div>
          <div className="text-[15px] font-extrabold text-foreground">
            {next.icon} {next.label}
            <span className="font-medium text-muted-foreground text-[13px]"> · {next.time}</span>
          </div>
        </div>

        {/* Countdown pill */}
        <div className="bg-sky/10 rounded-[10px] px-2.5 py-1 text-center min-w-[68px]">
          <div className="text-[13px] font-extrabold text-sky font-mono">{countdownStr}</div>
          <div className="text-[9px] text-muted-foreground font-semibold">remaining</div>
        </div>

        <div className="text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Ramadan Imsak strip */}
      {islamicDate.isRamadan && prayers.Imsak && (
        <div className="mx-4 bg-gradient-to-r from-primary to-[hsl(var(--navy-light))] rounded-lg px-3 py-1.5 flex justify-between items-center mb-3">
          <span className="text-[11px] text-[#8AACCC] font-semibold">
            ☪️ Ramadan · Imsak (Suhoor ends)
          </span>
          <span className="text-xs font-extrabold text-gold-light">{prayers.Imsak}</span>
        </div>
      )}

      {/* Expanded — all 5 prayers */}
      {expanded && (
        <div className="border-t border-border px-4 py-2.5 pb-3.5 bg-secondary/30">
          <div className="flex gap-1.5">
            {PRAYERS.map((p) => {
              const isNext = p.key === next.key;
              const isCurrent = p.key === currentKey;
              return (
                <div
                  key={p.key}
                  className={`flex-1 text-center rounded-[10px] py-2 px-1 border-[1.5px] ${
                    isNext
                      ? 'bg-gradient-to-br from-[hsl(var(--navy-light))] to-primary border-transparent'
                      : isCurrent
                      ? 'bg-teal/10 border-teal'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="text-sm">{p.icon}</div>
                  <div className={`text-[10px] font-bold mt-0.5 ${
                    isNext ? 'text-[#8AACCC]' : isCurrent ? 'text-teal' : 'text-muted-foreground'
                  }`}>
                    {p.label}
                  </div>
                  <div className={`text-xs font-extrabold mt-0.5 ${
                    isNext ? 'text-primary-foreground' : isCurrent ? 'text-teal' : 'text-foreground'
                  }`}>
                    {prayers[p.key]}
                  </div>
                  {isNext && <div className="text-[8px] text-teal-light font-semibold mt-0.5">NEXT</div>}
                  {isCurrent && <div className="text-[8px] text-teal font-semibold mt-0.5">NOW</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
