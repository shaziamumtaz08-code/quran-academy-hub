import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import type { IslamicDateData } from '@/lib/islamicDate';

const PRAYERS = [
  { key: 'Fajr',    label: 'Fajr' },
  { key: 'Sunrise', label: 'Sunrise' },
  { key: 'Dhuhr',   label: 'Dhuhr' },
  { key: 'Asr',     label: 'Asr' },
  { key: 'Maghrib', label: 'Maghrib' },
  { key: 'Isha',    label: 'Isha' },
] as const;

const FALLBACK: Record<string, string> = {
  Fajr: '04:15', Sunrise: '05:52', Dhuhr: '12:22',
  Asr: '15:44', Maghrib: '19:12', Isha: '20:42',
};

function parseHM(hm: string, ref: Date): Date {
  const [h, m] = hm.split(':').map(Number);
  const d = new Date(ref);
  d.setHours(h, m, 0, 0);
  return d;
}

function nowInTz(tz: string): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
}

interface Props {
  firstName: string;
  islamicDate: IslamicDateData | null;
  timezone?: string;
  unreadCount?: number;
  onBellClick?: () => void;
}

export function PrayerBar({ firstName, islamicDate, timezone, unreadCount = 0, onBellClick }: Props) {
  const tz = timezone || 'Asia/Karachi';
  const [now, setNow] = useState(() => nowInTz(tz));

  useEffect(() => {
    const t = setInterval(() => setNow(nowInTz(tz)), 60000);
    return () => clearInterval(t);
  }, [tz]);

  const prayers: Record<string, string> = { ...FALLBACK, ...(islamicDate?.prayers as any || {}) };

  // Find next upcoming prayer today; fallback to Fajr
  let nextKey: string = 'Fajr';
  for (const p of PRAYERS) {
    const t = parseHM(prayers[p.key], now);
    if (t > now) { nextKey = p.key; break; }
  }

  const hijri = islamicDate?.formatted;

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 md:px-4 md:py-2.5 flex items-center justify-between gap-3">
      {/* Left — greeting + Islamic date */}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] md:text-sm font-medium text-foreground truncate">
          Assalamu Alaikum, {firstName} <span aria-hidden>🌙</span>
        </p>
        {hijri && (
          <p className="text-[10px] md:text-[11px] text-muted-foreground truncate mt-0.5">
            ☪️ {hijri}
          </p>
        )}
      </div>

      {/* Prayer pills — desktop only */}
      <div className="hidden md:flex items-center gap-1.5">
        {PRAYERS.map((p) => {
          const isNext = p.key === nextKey;
          return (
            <div
              key={p.key}
              className={[
                'text-[11px] leading-none px-2.5 py-1.5 rounded-full border whitespace-nowrap',
                isNext
                  ? 'bg-teal/15 text-teal border-teal/40 font-semibold'
                  : 'bg-transparent border-border text-muted-foreground',
              ].join(' ')}
              title={isNext ? `Next prayer · ${p.label}` : p.label}
            >
              <span className="font-medium">{p.label}</span>
              <span className="mx-1 opacity-50">·</span>
              <span className="font-mono">{prayers[p.key]}</span>
            </div>
          );
        })}
      </div>

      {/* Bell */}
      <button
        onClick={onBellClick}
        className="relative bg-secondary border border-border rounded-lg w-9 h-9 flex items-center justify-center text-foreground shrink-0"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
