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
import {
  CalendarClock, Loader2, Video, CheckCircle2, AlertTriangle, Copy, Link2, Plus, Play, X,
} from 'lucide-react';
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

interface Seat {
  id: string;
  zoom_account_email: string;
  zoom_user_id: string;
  tier: string;
  shared_purposes: string[] | null;
  auto_record: boolean | null;
  display_label: string | null;
}

interface SeatResult {
  seat: Seat;
  busy: BusySlot[];
  conflict: BusySlot | null;
  available: boolean | null;
}

export function SharedZoomAvailabilityPanel() {
  const { toast } = useToast();
  const [registerEmail, setRegisterEmail] = React.useState('');
  const [registering, setRegistering] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [results, setResults] = React.useState<SeatResult[] | null>(null);
  const [created, setCreated] = React.useState<any>(null);
  const [selectedSeat, setSelectedSeat] = React.useState<string>('');
  const [recordings, setRecordings] = React.useState<any[] | null>(null);
  const [loadingRec, setLoadingRec] = React.useState(false);

  const [slotDate, setSlotDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [slotTime, setSlotTime] = React.useState('18:00');
  const [duration, setDuration] = React.useState(40);
  const [topic, setTopic] = React.useState('Demo class — Al Quran Time Academy');

  const poolQuery = useQuery({
    queryKey: ['zoom-shared-pool'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_accounts')
        .select('id, zoom_account_email, zoom_user_id, tier, shared_purposes, auto_record, display_label')
        .eq('is_shared', true)
        .eq('is_active', true)
        .order('tier', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Seat[];
    },
  });

  const pool = poolQuery.data || [];

  const proposedStartIso = React.useMemo(() => {
    if (!slotDate || !slotTime) return '';
    return `${slotDate}T${slotTime}:00+05:00`;
  }, [slotDate, slotTime]);

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const body = await callShared({ action: 'register_shared', email: registerEmail.trim() });
      if (body?.success) {
        toast({ title: 'Seat added to pool', description: `${body.account.email} (${body.account.tier})` });
        setRegisterEmail('');
        poolQuery.refetch();
      } else {
        toast({ title: 'Could not add seat', description: body?.error || 'Unknown error', variant: 'destructive' });
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleRemove = async (id: string) => {
    const body = await callShared({ action: 'unregister_shared', account_id: id });
    if (body?.success) {
      toast({ title: 'Seat removed from pool' });
      poolQuery.refetch();
    } else {
      toast({ title: 'Could not remove seat', description: body?.error, variant: 'destructive' });
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    setCreated(null);
    try {
      const body = await callShared({
        action: 'pool_availability',
        check_start: proposedStartIso,
        check_duration: duration,
      });
      if (body?.seats) {
        setResults(body.seats);
        const firstFree = body.seats.find((s: SeatResult) => s.available);
        setSelectedSeat(firstFree?.seat.id || body.seats[0]?.seat.id || '');
      }
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
        account_id: selectedSeat,
        start_time: proposedStartIso,
        duration,
        topic,
        timezone: TZ,
      });
      if (body?.success) {
        setCreated(body.meeting);
        toast({ title: 'Meeting booked', description: body.meeting.recording === 'cloud' ? 'Cloud recording is on.' : 'No recording on this seat.' });
        handleCheck();
      } else {
        toast({ title: 'Could not create meeting', description: body?.error || 'Unknown error', variant: 'destructive' });
      }
    } finally {
      setCreating(false);
    }
  };

  const loadRecordings = async (accountId: string) => {
    setLoadingRec(true);
    setRecordings(null);
    try {
      const body = await callShared({ action: 'recordings', account_id: accountId });
      if (body?.success) setRecordings(body.recordings);
      else toast({ title: 'Could not load recordings', description: body?.error, variant: 'destructive' });
    } finally {
      setLoadingRec(false);
    }
  };

  const selected = results?.find((r) => r.seat.id === selectedSeat);
  const freeCount = results?.filter((r) => r.available).length ?? 0;

  return (
    <div className="space-y-4">
      {/* Pool roster */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-4 w-4" /> Shared pool seats
            <Badge variant="secondary">{pool.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Seats used for demo classes, group classes and quick meetings — no teacher owner. Paid seats
            record to the cloud automatically; free seats are capped at 40 minutes for group calls.
          </p>

          {pool.length > 0 && (
            <div className="space-y-2">
              {pool.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="font-medium">{s.display_label || s.zoom_account_email}</span>
                  <span className="text-xs text-muted-foreground">{s.zoom_account_email}</span>
                  <Badge variant={s.tier === 'licensed' ? 'default' : 'secondary'}>{s.tier}</Badge>
                  {s.auto_record && <Badge variant="outline">Cloud recording</Badge>}
                  {(s.shared_purposes || []).map((p) => (
                    <Badge key={p} variant="outline" className="capitalize">{p}</Badge>
                  ))}
                  <div className="ml-auto flex gap-1">
                    {s.auto_record && (
                      <Button size="sm" variant="ghost" onClick={() => loadRecordings(s.id)}>
                        <Play className="h-3.5 w-3.5 mr-1" /> Recordings
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => handleRemove(s.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              placeholder="zoom user email to add to pool"
            />
            <Button onClick={handleRegister} disabled={registering || !registerEmail.trim()}>
              {registering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add seat
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Booking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Book a slot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
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
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="demo">Demo class</option>
                <option value="group">Group class</option>
                <option value="class">Regular class</option>
                <option value="quick">Quick meeting</option>
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
          </div>


          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCheck} disabled={checking || pool.length === 0}>
              {checking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarClock className="h-4 w-4 mr-2" />}
              Check pool availability
            </Button>
            <Button onClick={handleCreate} disabled={creating || !selected || selected.available === false}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Book &amp; generate link
            </Button>
          </div>

          {results && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {freeCount} of {results.length} seats free at {fmt(proposedStartIso)} for {duration} min — pick one:
              </p>
              {results.map((r) => (
                <button
                  key={r.seat.id}
                  type="button"
                  onClick={() => setSelectedSeat(r.seat.id)}
                  className={cn(
                    'w-full text-left rounded-lg border p-3 transition',
                    selectedSeat === r.seat.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{r.seat.display_label || r.seat.zoom_account_email}</span>
                    <Badge variant={r.seat.tier === 'licensed' ? 'default' : 'secondary'}>{r.seat.tier}</Badge>
                    {r.seat.auto_record && <Badge variant="outline">Recording</Badge>}
                    {r.available ? (
                      <Badge className="ml-auto bg-emerald-600 hover:bg-emerald-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Free
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="ml-auto">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Busy
                      </Badge>
                    )}
                  </div>
                  {r.conflict && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      “{r.conflict.topic}” {fmtTime(r.conflict.start)}–{fmtTime(r.conflict.end)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{r.busy.length} meeting(s) on the calendar</p>
                </button>
              ))}
            </div>
          )}

          {results && freeCount === 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Every pool seat is busy at that time — try another slot.</AlertDescription>
            </Alert>
          )}

          {created && (
            <div className="rounded-lg border p-3 space-y-2 bg-muted/40">
              <p className="text-sm font-medium">{created.topic}</p>
              <p className="text-xs text-muted-foreground">
                {fmt(created.start_time)} · {created.duration} min · {created.seat} · recording: {created.recording}
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

      {/* Booked schedule for the selected seat */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selected ? `Booked on ${selected.seat.zoom_account_email}` : 'Booked meetings'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selected ? (
            <p className="text-sm text-muted-foreground">Run a check to load the pool schedule.</p>
          ) : selected.busy.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled meetings on this seat.</p>
          ) : (
            <div className="space-y-2">
              {selected.busy.map((b) => (
                <div
                  key={b.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm',
                    b.start.slice(0, 10) === slotDate && 'border-primary/50 bg-primary/5',
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

      {/* Recordings */}
      {(loadingRec || recordings) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cloud recordings (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRec ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : recordings && recordings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recordings on this seat yet.</p>
            ) : (
              <div className="space-y-2">
                {recordings?.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <span className="font-medium">{r.topic}</span>
                    <span className="text-xs text-muted-foreground">{fmt(r.start_time)} · {r.duration}m</span>
                    {(r.share_url || r.play_url) && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={r.share_url || r.play_url} target="_blank" rel="noreferrer">Open</a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
