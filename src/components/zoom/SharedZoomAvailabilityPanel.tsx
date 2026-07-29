import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Loader2, Video, CheckCircle2, AlertTriangle, Copy, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TZ = 'Asia/Karachi';

function fmt(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: TZ,
  }).format(new Date(iso));
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: TZ,
  }).format(new Date(iso));
}

async function callShared(payload: Record<string, unknown>) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sienlnxwwdqnybugipdt';
  const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/zoom-shared-availability`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(payload),
  });
  return resp.json();
}

interface BusySlot {
  id: string;
  topic: string;
  start: string;
  end: string;
  duration: number;
  join_url: string | null;
}

export function SharedZoomAvailabilityPanel() {
  const { toast } = useToast();
  const [registerEmail, setRegisterEmail] = React.useState('alqurantimeacademy786@gmail.com');
  const [registering, setRegistering] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [created, setCreated] = React.useState<any>(null);

  const [slotDate, setSlotDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [slotTime, setSlotTime] = React.useState('18:00');
  const [duration, setDuration] = React.useState(40);
  const [topic, setTopic] = React.useState('Demo class — Al Quran Time Academy');

  const sharedQuery = useQuery({
    queryKey: ['zoom-shared-seat'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_accounts')
        .select('id, zoom_account_email, zoom_user_id, tier, shared_purposes, auto_record, display_label')
        .eq('is_shared', true)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const shared = sharedQuery.data;

  const proposedStartIso = React.useMemo(() => {
    if (!slotDate || !slotTime) return '';
    // Interpret the entered wall-clock time as Asia/Karachi (UTC+5, no DST).
    return `${slotDate}T${slotTime}:00+05:00`;
  }, [slotDate, slotTime]);

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const body = await callShared({ action: 'register_shared', email: registerEmail.trim() });
      if (body?.success) {
        toast({ title: 'Shared seat registered', description: `${body.account.email} (${body.account.tier})` });
        sharedQuery.refetch();
      } else {
        toast({ title: 'Could not register', description: body?.error || 'Unknown error', variant: 'destructive' });
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    setCreated(null);
    try {
      const body = await callShared({
        action: 'availability',
        check_start: proposedStartIso,
        check_duration: duration,
      });
      setResult(body);
      if (body?.error) {
        toast({ title: 'Availability check failed', description: body.error, variant: 'destructive' });
      }
    } finally {
      setChecking(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const body = await callShared({
        action: 'create_meeting',
        start_time: proposedStartIso,
        duration,
        topic,
        timezone: TZ,
      });
      if (body?.success) {
        setCreated(body.meeting);
        toast({ title: 'Demo link created', description: 'Cloud recording is on for this meeting.' });
        handleCheck();
      } else {
        toast({ title: 'Could not create meeting', description: body?.error || 'Unknown error', variant: 'destructive' });
      }
    } finally {
      setCreating(false);
    }
  };

  const busy: BusySlot[] = result?.busy || [];
  const dayBusy = busy.filter((b) => b.start.slice(0, 10) <= slotDate && b.end.slice(0, 10) >= slotDate);

  if (!sharedQuery.isLoading && !shared) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-4 w-4" /> Shared academy Zoom seat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Register the paid Zoom seat used for demo classes and Group Academy. It must already be a user
            inside your Zoom account. Cloud recording is enabled automatically for licensed seats.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} placeholder="zoom user email" />
            <Button onClick={handleRegister} disabled={registering || !registerEmail.trim()}>
              {registering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Register seat
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Video className="h-4 w-4" />
            {shared?.display_label || 'Shared academy seat'}
            <span className="text-sm font-normal text-muted-foreground">{shared?.zoom_account_email}</span>
            <Badge variant={shared?.tier === 'licensed' ? 'default' : 'secondary'}>{shared?.tier}</Badge>
            {shared?.auto_record && <Badge variant="outline">Cloud recording</Badge>}
            {(shared?.shared_purposes || []).map((p: string) => (
              <Badge key={p} variant="outline" className="capitalize">{p}</Badge>
            ))}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time (PKT)</Label>
              <Input type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Minutes</Label>
              <Input type="number" min={15} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 40)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCheck} disabled={checking}>
              {checking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarClock className="h-4 w-4 mr-2" />}
              Check availability
            </Button>
            <Button onClick={handleCreate} disabled={creating || !result || result?.available === false}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Generate demo link
            </Button>
          </div>

          {result?.available === true && (
            <Alert className="border-emerald-500/40">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription>
                Slot is free — {fmt(proposedStartIso)} for {duration} min.
              </AlertDescription>
            </Alert>
          )}
          {result?.conflict && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Conflicts with “{result.conflict.topic}” ({fmtTime(result.conflict.start)}–{fmtTime(result.conflict.end)}).
              </AlertDescription>
            </Alert>
          )}

          {created && (
            <div className="rounded-lg border p-3 space-y-2 bg-muted/40">
              <p className="text-sm font-medium">{created.topic}</p>
              <p className="text-xs text-muted-foreground">
                {fmt(created.start_time)} · {created.duration} min · recording: {created.recording}
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={created.join_url} className="text-xs" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(created.join_url);
                    toast({ title: 'Join link copied' });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Booked on this seat</CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-sm text-muted-foreground">Run a check to load the Zoom schedule.</p>
          ) : busy.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled meetings on this seat.</p>
          ) : (
            <div className="space-y-2">
              {busy.map((b) => (
                <div
                  key={b.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm',
                    dayBusy.some((d) => d.id === b.id) && 'border-primary/50 bg-primary/5',
                  )}
                >
                  <span className="font-medium">{b.topic}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmt(b.start)} → {fmtTime(b.end)} ({b.duration}m)
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
