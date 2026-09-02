import React from 'react';
import { format } from 'date-fns';
import { ClipboardList, Clock, LogOut, UserX, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useZoomSessionAttendance, type Punctuality } from '@/hooks/useZoomSessionAttendance';

const PUNCTUALITY: Record<Punctuality, { label: string; tone: string; Icon: React.ElementType }> = {
  on_time: { label: 'On time', tone: 'hsl(var(--zw-sage))', Icon: CheckCircle2 },
  late: { label: 'Late', tone: 'hsl(var(--zw-warn))', Icon: Clock },
  left_early: { label: 'Left early', tone: 'hsl(var(--zw-warn))', Icon: LogOut },
  no_show: { label: 'No show', tone: 'hsl(var(--zw-live))', Icon: UserX },
};

const time = (v?: string | null) => (v ? format(new Date(v), 'HH:mm') : '—');

/**
 * Attendance report built from the Zoom Server-to-Server webhook stream.
 * Reference data only: teachers and admins still mark attendance by hand.
 */
export function ZoomSessionAttendanceReport() {
  const [days, setDays] = React.useState('7');
  const { data, isLoading } = useZoomSessionAttendance(Number(days));

  const sessions = data || [];

  return (
    <div className="zw-card zw-accent-edge space-y-4 p-6 pl-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4" style={{ color: 'hsl(var(--zw-sage))' }} />
          <h3 className="zw-h2">Session attendance report</h3>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="zw-meta">
        Built from Zoom webhook telemetry per account. Reference only — attendance is still marked manually.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : sessions.length === 0 ? (
        <p className="zw-meta">No Zoom telemetry captured in this window yet.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.sessionId} className="rounded-lg border border-border/60">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="zw-body truncate font-medium">{s.teacherName}</p>
                  <p className="zw-meta truncate">
                    {s.scheduledStart ? format(new Date(s.scheduledStart), 'EEE d MMM · HH:mm') : 'Unscheduled'}
                    {s.scheduledMinutes ? ` – ${time(s.scheduledEnd)} (${s.scheduledMinutes}m)` : ''} · {s.zoomAccountLabel}
                  </p>
                </div>
                <span className="zw-meta shrink-0">
                  Actual {time(s.actualStart)}–{time(s.actualEnd)}
                </span>
              </div>

              {s.participants.length === 0 ? (
                <p className="zw-meta px-3 py-2">No participants recorded.</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {s.participants.map((p) => {
                    const meta = PUNCTUALITY[(p.punctuality || 'no_show') as Punctuality];
                    return (
                      <div key={`${p.session_id}-${p.participant_email || p.participant_name}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="zw-body truncate">
                            {p.participant_name || p.participant_email}
                            {p.zoom_role === 'host' && <span className="zw-meta"> · host</span>}
                          </p>
                          <p className="zw-meta">
                            {time(p.join_time)} → {time(p.leave_time)} · {p.duration_minutes ?? 0} min
                            {p.late_minutes && p.late_minutes > 0 ? ` · ${p.late_minutes}m late` : ''}
                            {p.early_leave_minutes && p.early_leave_minutes > 0
                              ? ` · left ${p.early_leave_minutes}m early`
                              : ''}
                          </p>
                        </div>
                        <span
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{ color: meta.tone, background: `color-mix(in srgb, ${meta.tone} 14%, transparent)` }}
                        >
                          <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ZoomSessionAttendanceReport;
