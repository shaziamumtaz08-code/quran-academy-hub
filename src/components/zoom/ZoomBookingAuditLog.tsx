import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollText, Download, Loader2 } from 'lucide-react';

const TZ = 'Asia/Karachi';

const typeStyles: Record<string, string> = {
  demo: 'bg-sky-600 hover:bg-sky-600',
  group: 'bg-violet-600 hover:bg-violet-600',
  class: 'bg-emerald-600 hover:bg-emerald-600',
  quick: 'bg-slate-600 hover:bg-slate-600',
};

function fmt(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

interface LogRow {
  id: string;
  seat_email: string | null;
  seat_label: string | null;
  seat_tier: string | null;
  booked_by_name: string | null;
  booked_by_role: string | null;
  booked_at: string;
  meeting_type: string;
  topic: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  zoom_meeting_id: string | null;
  auto_record: boolean;
  status: string;
  error_reason: string | null;
}

export function ZoomBookingAuditLog() {
  const [search, setSearch] = React.useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['zoom-booking-audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_booking_audit_log')
        .select(
          'id, seat_email, seat_label, seat_tier, booked_by_name, booked_by_role, booked_at, meeting_type, topic, start_time, duration_minutes, zoom_meeting_id, auto_record, status, error_reason',
        )
        .order('booked_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as LogRow[];
    },
  });

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) =>
      [r.seat_email, r.seat_label, r.booked_by_name, r.topic, r.meeting_type, r.zoom_meeting_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, search]);

  const exportCsv = () => {
    const header = ['Booked at', 'Booked by', 'Role', 'Seat', 'Tier', 'Type', 'Topic', 'Class start', 'Minutes', 'Meeting ID', 'Recording', 'Status'];
    const lines = rows.map((r) =>
      [
        fmt(r.booked_at),
        r.booked_by_name ?? '',
        r.booked_by_role ?? '',
        r.seat_email ?? '',
        r.seat_tier ?? '',
        r.meeting_type,
        r.topic ?? '',
        fmt(r.start_time),
        r.duration_minutes ?? '',
        r.zoom_meeting_id ?? '',
        r.auto_record ? 'cloud' : 'off',
        r.status === 'failed' ? `failed: ${r.error_reason ?? ''}` : r.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zoom-booking-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Booking audit log
            {!isLoading && <Badge variant="secondary">{rows.length}</Badge>}
          </CardTitle>
          <div className="ml-auto flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search seat, person, topic…"
              className="h-9 w-52"
            />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No bookings recorded yet. Every seat booked from the pool is logged here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Booked</th>
                  <th className="py-2 pr-4 font-medium">By</th>
                  <th className="py-2 pr-4 font-medium">Seat</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Class / meeting</th>
                  <th className="py-2 pr-4 font-medium">Starts</th>
                  <th className="py-2 pr-0 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{fmt(r.booked_at)}</td>
                    <td className="py-2 pr-4">
                      <div className="font-medium">{r.booked_by_name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground capitalize">{r.booked_by_role}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <div>{r.seat_label || r.seat_email}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.seat_tier}
                        {r.auto_record ? ' · recording' : ''}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge className={typeStyles[r.meeting_type] || typeStyles.quick}>{r.meeting_type}</Badge>
                    </td>
                    <td className="py-2 pr-4 max-w-[260px]">
                      <div className="truncate">{r.topic}</div>
                      {r.zoom_meeting_id && (
                        <div className="text-xs text-muted-foreground font-mono">#{r.zoom_meeting_id}</div>
                      )}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {fmt(r.start_time)}
                      {r.duration_minutes ? (
                        <span className="text-xs text-muted-foreground"> · {r.duration_minutes}m</span>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {r.status === 'failed' ? (
                        <span className="text-xs text-destructive">Failed — {r.error_reason}</span>
                      ) : (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-600/40">Created</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
