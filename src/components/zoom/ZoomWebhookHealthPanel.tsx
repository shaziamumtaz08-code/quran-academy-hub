import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Wrench, Copy, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { StickyScrollTable } from '@/components/ui/sticky-scroll-table';

type SeatStatus =
  | 'healthy'
  | 'no_events'
  | 'missing_host_id'
  | 'no_credentials'
  | 'credentials_invalid';

interface SeatHealth {
  id: string;
  teacher_name: string;
  zoom_account_email: string;
  tier: string | null;
  plan_label: string | null;
  has_credentials: boolean;
  host_id: string | null;
  repaired: boolean;
  credential_error: string | null;
  event_count: number;
  last_event_at: string | null;
  status: SeatStatus;
}

interface HealthResponse {
  ok: boolean;
  webhook_url: string;
  repaired_count: number;
  summary: Record<string, number>;
  accounts: SeatHealth[];
}

const STATUS_META: Record<SeatStatus, { label: string; hint: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; Icon: typeof CheckCircle2 }> = {
  healthy: {
    label: 'Receiving events',
    hint: 'Zoom is delivering real attendance telemetry for this seat.',
    variant: 'default',
    Icon: CheckCircle2,
  },
  no_events: {
    label: 'No events yet',
    hint: 'Credentials and host ID are set, but Zoom has never posted an event. Check the Event Subscription URL in this account\u2019s Marketplace app.',
    variant: 'secondary',
    Icon: Clock,
  },
  missing_host_id: {
    label: 'Host ID missing',
    hint: 'Events cannot be matched to this teacher. Click Repair to fetch the host ID from Zoom.',
    variant: 'destructive',
    Icon: AlertTriangle,
  },
  no_credentials: {
    label: 'No app credentials',
    hint: 'This seat has no Server-to-Server OAuth app. Add one via Validate & Save, then subscribe it to the webhook URL.',
    variant: 'destructive',
    Icon: XCircle,
  },
  credentials_invalid: {
    label: 'Credentials rejected',
    hint: 'Zoom refused these credentials or the user lookup failed. See the error shown below the seat.',
    variant: 'destructive',
    Icon: XCircle,
  },
};

export function ZoomWebhookHealthPanel() {
  const { toast } = useToast();
  const [data, setData] = React.useState<HealthResponse | null>(null);

  const run = useMutation({
    mutationFn: async (repair: boolean) => {
      const { data: res, error } = await supabase.functions.invoke('zoom-webhook-health', {
        body: { repair },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      return res as HealthResponse;
    },
    onSuccess: (res, repair) => {
      setData(res);
      if (repair) {
        toast({
          title: res.repaired_count > 0 ? `Repaired ${res.repaired_count} seat(s)` : 'Nothing to repair',
          description:
            res.repaired_count > 0
              ? 'Host IDs were fetched from Zoom and saved, so incoming events can now be matched.'
              : 'All reachable seats already had a valid host ID.',
        });
      }
    },
    onError: (err: any) => {
      toast({ title: 'Health check failed', description: err.message, variant: 'destructive' });
    },
  });

  React.useEffect(() => {
    run.mutate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyWebhook = () => {
    if (!data?.webhook_url) return;
    navigator.clipboard.writeText(data.webhook_url);
    toast({ title: 'Webhook URL copied', description: 'Paste this as the Event Notification Endpoint in every Zoom app.' });
  };

  const summary = data?.summary;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Webhook health per seat
            </CardTitle>
            <CardDescription>
              Every teacher needs their own Server-to-Server OAuth app pointed at one shared webhook URL. Free Zoom
              accounts work fine \u2014 what breaks matching is a missing host ID.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => run.mutate(false)} disabled={run.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${run.isPending ? 'animate-spin' : ''}`} />
              Recheck
            </Button>
            <Button size="sm" onClick={() => run.mutate(true)} disabled={run.isPending}>
              <Wrench className="h-4 w-4 mr-2" />
              Repair host IDs
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data?.webhook_url && (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Event Notification Endpoint (same for all accounts)</p>
                <p className="truncate font-mono text-xs">{data.webhook_url}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={copyWebhook}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          )}

          {summary && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                { label: 'Seats', value: summary.total },
                { label: 'Receiving', value: summary.healthy },
                { label: 'Silent', value: summary.no_events },
                { label: 'No host ID', value: summary.missing_host_id },
                { label: 'No app', value: summary.no_credentials + summary.credentials_invalid },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-muted/50 p-3">
                  <p className="text-2xl font-semibold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <StickyScrollTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Zoom account</TableHead>
                  <TableHead>App keys</TableHead>
                  <TableHead>Host ID</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Last event</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.accounts || []).map((seat) => {
                  const meta = STATUS_META[seat.status];
                  return (
                    <React.Fragment key={seat.id}>
                      <TableRow>
                        <TableCell className="font-medium">{seat.teacher_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{seat.zoom_account_email}</TableCell>
                        <TableCell>
                          <Badge variant={seat.has_credentials ? 'secondary' : 'destructive'}>
                            {seat.has_credentials ? 'Present' : 'Missing'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{seat.host_id || '\u2014'}</TableCell>
                        <TableCell>{seat.event_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {seat.last_event_at
                            ? formatDistanceToNow(new Date(seat.last_event_at), { addSuffix: true })
                            : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.variant} className="gap-1">
                            <meta.Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {seat.status !== 'healthy' && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="pt-0 text-xs text-muted-foreground">
                            {seat.credential_error ? `${meta.hint} \u2014 ${seat.credential_error}` : meta.hint}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                {!run.isPending && (data?.accounts || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No active Zoom accounts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </StickyScrollTable>
        </CardContent>
      </Card>
    </div>
  );
}

export default ZoomWebhookHealthPanel;
