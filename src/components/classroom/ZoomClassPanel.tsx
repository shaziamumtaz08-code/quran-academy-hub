import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Video, Clock, ExternalLink, Lock, Radio, CheckCircle2,
  CalendarPlus, X, MonitorUp,
} from 'lucide-react';

// ─── Types ───
interface ClassInfo {
  name: string;
  scheduleTime: string;
  scheduleDays: string[];
  timezone: string;
  sessionDuration: number;
}

interface ZoomClassPanelProps {
  meetingLink: string;
  classInfo: ClassInfo;
  userRole: 'teacher' | 'student';
  onSessionEnd?: () => void;
  courseId?: string;
  classId?: string;
}

// ─── Time helpers ───
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getNowInTimezone(tz: string) {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
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
  } catch {
    return { dayIndex: now.getDay(), hours: now.getHours(), minutes: now.getMinutes(), seconds: now.getSeconds(), absoluteMs: now.getTime() };
  }
}

function getNextOccurrence(scheduleDays: string[], scheduleTime: string, sessionDuration: number, tz: string) {
  const tzNow = getNowInTimezone(tz);
  const [targetH, targetM] = (scheduleTime || '00:00').split(':').map(Number);
  const nowMinsOfDay = tzNow.hours * 60 + tzNow.minutes;
  const classStartMins = targetH * 60 + targetM;
  const classEndMins = classStartMins + sessionDuration;

  // Normalize day names
  const normalizedDays = scheduleDays.map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase());

  let bestDaysUntil = Infinity;

  for (const dayName of normalizedDays) {
    const targetDayIndex = DAY_NAMES.indexOf(dayName);
    if (targetDayIndex === -1) continue;

    let daysUntil = targetDayIndex - tzNow.dayIndex;
    if (daysUntil < 0) daysUntil += 7;

    // If today: check if class hasn't ended yet
    if (daysUntil === 0 && nowMinsOfDay >= classEndMins) {
      daysUntil = 7;
    }

    if (daysUntil < bestDaysUntil) bestDaysUntil = daysUntil;
  }

  if (bestDaysUntil === Infinity) bestDaysUntil = 1;

  const nowSecsOfDay = tzNow.hours * 3600 + tzNow.minutes * 60 + tzNow.seconds;
  const targetSecsOfDay = targetH * 3600 + targetM * 60;
  const totalSecsDiff = bestDaysUntil * 86400 + (targetSecsOfDay - nowSecsOfDay);

  return {
    nextDate: new Date(tzNow.absoluteMs + totalSecsDiff * 1000),
    isToday: bestDaysUntil === 0,
    isLiveNow: bestDaysUntil === 0 && nowMinsOfDay >= classStartMins && nowMinsOfDay < classEndMins,
    minutesUntilStart: bestDaysUntil === 0 ? classStartMins - nowMinsOfDay : bestDaysUntil * 1440 + (classStartMins - nowMinsOfDay),
  };
}

function useCountdown(target: Date | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0, totalMs: 0 });
  useEffect(() => {
    if (!target) return;
    const calc = () => {
      const diff = Math.max(0, target.getTime() - Date.now());
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
        totalMs: diff,
      });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [target]);
  return timeLeft;
}

function formatTime12(time: string) {
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function generateIcsUrl(classInfo: ClassInfo, nextDate: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = nextDate;
  const start = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const endDate = new Date(d.getTime() + classInfo.sessionDuration * 60000);
  const end = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}00Z`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${classInfo.name}`,
    `DESCRIPTION:${classInfo.scheduleDays.join(', ')} at ${formatTime12(classInfo.scheduleTime)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

// ─── State enum ───
type PanelState = 'upcoming' | 'starting-soon' | 'live' | 'ended';

// ═══ COMPONENT ═══
export function ZoomClassPanel({ meetingLink, classInfo, userRole, onSessionEnd }: ZoomClassPanelProps) {
  const [showIframe, setShowIframe] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Recalculate every second via the countdown
  const occurrence = useMemo(
    () => getNextOccurrence(classInfo.scheduleDays, classInfo.scheduleTime, classInfo.sessionDuration, classInfo.timezone),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classInfo.scheduleDays.join(','), classInfo.scheduleTime, classInfo.sessionDuration, classInfo.timezone],
  );

  const countdown = useCountdown(occurrence.nextDate);
  const minutesUntil = Math.floor(countdown.totalMs / 60000);

  const panelState: PanelState = sessionEnded
    ? 'ended'
    : occurrence.isLiveNow
      ? 'live'
      : minutesUntil <= 15 && minutesUntil >= 0
        ? 'starting-soon'
        : 'upcoming';

  const handleEndSession = () => {
    setShowIframe(false);
    setSessionEnded(true);
    onSessionEnd?.();
  };

  const icsUrl = useMemo(() => generateIcsUrl(classInfo, occurrence.nextDate), [classInfo, occurrence.nextDate]);

  // Border / background styles per state
  const stateStyles = {
    upcoming: 'border-border',
    'starting-soon': 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
    live: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20',
    ended: 'border-border bg-muted/30',
  };

  return (
    <div className="space-y-3">
      <Card className={cn('border-2 transition-colors', stateStyles[panelState])}>
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center',
                panelState === 'live' ? 'bg-emerald-100 dark:bg-emerald-900/50' :
                panelState === 'starting-soon' ? 'bg-amber-100 dark:bg-amber-900/50' :
                panelState === 'ended' ? 'bg-muted' : 'bg-primary/10',
              )}>
                {panelState === 'ended'
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <Video className={cn('h-5 w-5',
                      panelState === 'live' ? 'text-emerald-600' :
                      panelState === 'starting-soon' ? 'text-amber-600' : 'text-primary'
                    )} />
                }
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{classInfo.name}</p>
                  {panelState === 'live' && (
                    <Badge className="bg-emerald-500 text-white animate-pulse text-[9px]">
                      <Radio className="h-3 w-3 mr-0.5" /> LIVE
                    </Badge>
                  )}
                  {panelState === 'starting-soon' && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 text-[9px]">
                      Starting soon
                    </Badge>
                  )}
                  {panelState === 'ended' && (
                    <Badge variant="secondary" className="text-[9px]">Session Complete</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {classInfo.scheduleDays.join(', ')} · {formatTime12(classInfo.scheduleTime)} · {classInfo.sessionDuration} min
                </p>
              </div>
            </div>
          </div>

          {/* STATE: Ended */}
          {panelState === 'ended' && (
            <div className="text-center py-2">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-1 text-emerald-500" />
              <p className="text-sm font-medium text-foreground">Session Complete</p>
              {userRole === 'teacher' && (
                <Button variant="outline" size="sm" className="mt-2" onClick={onSessionEnd}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Attendance
                </Button>
              )}
            </div>
          )}

          {/* STATE: Upcoming — countdown */}
          {panelState === 'upcoming' && (
            <>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="flex gap-1">
                  {countdown.days > 0 && <span className="bg-muted rounded px-2 py-0.5 text-xs font-bold">{countdown.days}d</span>}
                  <span className="bg-muted rounded px-2 py-0.5 text-xs font-bold">{countdown.hours}h</span>
                  <span className="bg-muted rounded px-2 py-0.5 text-xs font-bold">{String(countdown.mins).padStart(2, '0')}m</span>
                  <span className="bg-muted rounded px-2 py-0.5 text-xs font-bold">{String(countdown.secs).padStart(2, '0')}s</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" disabled>
                  <Lock className="h-4 w-4 mr-2" /> Class Not Started Yet
                </Button>
                <a href={icsUrl} download={`${classInfo.name}.ics`}>
                  <Button variant="outline" size="icon" title="Add to Calendar">
                    <CalendarPlus className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </>
          )}

          {/* STATE: Starting soon — minutes countdown */}
          {panelState === 'starting-soon' && (
            <>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Class starts in {minutesUntil} minute{minutesUntil !== 1 ? 's' : ''}
                </p>
              </div>
              <Button
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => { setShowIframe(true); setIframeError(false); }}
              >
                <Video className="h-4 w-4 mr-2" /> Prepare to Join
              </Button>
            </>
          )}

          {/* STATE: Live — action buttons */}
          {panelState === 'live' && !showIframe && (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { setShowIframe(true); setIframeError(false); }}
            >
              <Video className="h-4 w-4 mr-2" />
              {userRole === 'teacher' ? 'Launch Class' : 'Join Live Class'}
            </Button>
          )}

          {/* Live + iframe open: End/Open buttons */}
          {(panelState === 'live' || panelState === 'starting-soon') && showIframe && (
            <div className="flex gap-2">
              <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open in Browser
                </Button>
              </a>
              {userRole === 'teacher' && (
                <Button variant="destructive" size="sm" className="flex-1 text-xs" onClick={handleEndSession}>
                  <X className="h-3.5 w-3.5 mr-1" /> End Session
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Iframe */}
      {showIframe && (panelState === 'live' || panelState === 'starting-soon') && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <p className="text-sm font-medium">{classInfo.name} — Live Session</p>
              <Button variant="ghost" size="sm" onClick={() => setShowIframe(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {iframeError ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Unable to embed meeting in browser</p>
                <a href={meetingLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">
                    <ExternalLink className="h-4 w-4 mr-1" /> Open Zoom in browser
                  </Button>
                </a>
              </div>
            ) : (
              <iframe
                src={meetingLink}
                className="w-full border-0"
                style={{ height: '580px' }}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                onError={() => setIframeError(true)}
                title="Zoom Meeting"
              />
            )}
            <div className="px-3 py-2 border-t text-center">
              <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Open in browser instead
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
