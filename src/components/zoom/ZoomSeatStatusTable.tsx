import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StickyScrollTable } from '@/components/ui/sticky-scroll-table';
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, Clock, Activity } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export type SeatStatus =
  | 'healthy'
  | 'no_events_yet'
  | 'missing_host_id'
  | 'no_credentials'
  | 'failed';

const STATUS_META: Record<SeatStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; Icon: typeof CheckCircle2 }> = {
  healthy: { label: 'Healthy', variant: 'default', Icon: CheckCircle2 },
  no_events_yet: { label: 'No events yet', variant: 'secondary', Icon: Clock },
  missing_host_id: { label: 'Missing host ID', variant: 'destructive', Icon: AlertTriangle },
  no_credentials: { label: 'No credentials', variant: 'outline', Icon: XCircle },
  failed: { label: 'Failed', variant: 'destructive', Icon: XCircle },
};

interface Seat {
  id: string;
  teacher_name: string;
  zoom_account_email: string;
  tier: string;
  has_credentials: boolean;
  host_id: string | null;
  last_validated_at: string | null;
  credential_error: string | null;
  event_count: number;
  last_event_at: string | null;
  status: SeatStatus;
}

/**
 * Live per-seat rollout status, read straight from the database on every
 * refetch (no cache, no Zoom API calls) so admins can track credential rollout
 * across every teacher without running a manual query.
 */
export function ZoomSeatStatusTable() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['zoom-seat-status'],
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30000,
    queryFn: async (): Promise<Seat[]> => {
      const { data: accounts, error } = await (supabase as any)
        .from('zoom_accounts')
        .select(
          'id, teacher_id, zoom_account_email, zoom_user_id, tier, is_active, last_validated_at, credential_status, credential_error, zoom_account_id_cred, zoom_client_id, zoom_client_secret, profile:profiles!zoom_accounts_teacher_id_fkey(id, full_name)'
        )
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const rows = (accounts || []) as any[];
      const hostIds = rows.map((r) => r.zoom_user_id).filter(Boolean);

      let logs: any[] = [];
      if (hostIds.length) {
        const { data: logRows } = await (supabase as any)
          .from('zoom_attendance_logs')
          .select('host_id, created_at')
          .in('host_id', hostIds);
        logs = logRows || [];
      }

      const stats = new Map<string, { count: number; last: string | null }>();
      for (const l of logs) {
        const s = stats.get(l.host_id) || { count: 0, last: null };
        s.count += 1;
        if (!s.last || l.created_at > s.last) s.last = l.created_at;
        stats.set(l.host_id, s);
      }

      return rows.map((r) => {
        const hasCreds = Boolean(r.zoom_account_id_cred && r.zoom_client_id && r.zoom_client_secret);
        const st = r.zoom_user_id ? stats.get(r.zoom_user_id) : undefined;
        const eventCount = st?.count || 0;

        let status: SeatStatus;
        if (!hasCreds) status = 'no_credentials';
        else if (r.credential_status === 'failed') status = 'failed';
        else if (!r.zoom_user_id) status = 'missing_host_id';
        else if (eventCount === 0) status = 'no_events_yet';
        else status = 'healthy';

        return {
          id: r.id,
          teacher_name: r.profile?.full_name || 'Unassigned seat',
          zoom_account_email: r.zoom_account_email,
          tier: r.tier,
          has_credentials: hasCreds,
          host_id: r.zoom_user_id,
          last_validated_at: r.last_validated_at,
          credential_error: r.credential_error,
          event_count: eventCount,
          last_event_at: st?.last || null,
          status,
        };
      });
    },
  });

  const seats = data || [];
  const counts = seats.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Seat rollout status
          </CardTitle>
          <CardDescription>
            Live view of every dedicated Zoom seat — credentials, host ID, and webhook events received.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(Object.keys(STATUS_META) as SeatStatus[]).map((k) => (
            <div key={k} className="rounded-lg bg-muted/50 p-3">
              <p className="text-2xl font-semibold">{counts[k] || 0}</p>
              <p className="text-xs text-muted-foreground">{STATUS_META[k].label}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading seats…
          </div>
        ) : (
          <StickyScrollTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Zoom email</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Credentials</TableHead>
                  <TableHead>Host ID</TableHead>
                  <TableHead>Last validated</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seats.map((s) => {
                  const meta = STATUS_META[s.status];
                  return (
                    <React.Fragment key={s.id}>
                      <TableRow>
                        <TableCell className="font-medium">{s.teacher_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.zoom_account_email}</TableCell>
                        <TableCell>
                          <Badge variant={s.tier === 'licensed' ? 'default' : 'secondary'}>{s.tier}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.has_credentials ? 'secondary' : 'outline'}>
                            {s.has_credentials ? 'Present' : 'Missing'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">{s.host_id || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.last_validated_at ? format(new Date(s.last_validated_at), 'MMM d, HH:mm') : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {s.event_count}
                          {s.last_event_at && (
                            <span className="block text-muted-foreground">
                              {formatDistanceToNow(new Date(s.last_event_at), { addSuffix: true })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.variant} className="gap-1">
                            <meta.Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {s.status === 'failed' && s.credential_error && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={8} className="pt-0 text-xs text-destructive">
                            {s.credential_error}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                {seats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No active Zoom seats yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </StickyScrollTable>
        )}
      </CardContent>
    </Card>
  );
}

export default ZoomSeatStatusTable;
