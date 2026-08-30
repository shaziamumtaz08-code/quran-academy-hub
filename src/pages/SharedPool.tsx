import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, CheckCircle2, CircleDot, Circle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const PURPOSES = ['Demo class', 'Group class', 'Quick meeting', 'Other'];

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="zw-eyebrow">{children}</h2>
      {action}
    </div>
  );
}

const seatTier = (s: any) =>
  s.account_type === 'paid' && s.auto_record ? 'Paid + Recording' : s.account_type === 'paid' ? 'Paid' : 'Free';

export default function SharedPool() {
  const { toast } = useToast();
  const { user, activeRole } = useAuth();
  const qc = useQueryClient();

  const isAdmin = !!activeRole && (activeRole === 'super_admin' || activeRole.startsWith('admin'));

  const [start, setStart] = useState(toLocalInput(new Date(Date.now() + 30 * 60000)));
  const [end, setEnd] = useState(toLocalInput(new Date(Date.now() + 90 * 60000)));
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [seat, setSeat] = useState<string>('');
  const [created, setCreated] = useState<{ link: string; label: string; records: boolean } | null>(null);
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookingsView, setBookingsView] = useState<'mine' | 'all'>('mine');

  const { data: teacherBookingEnabled = false } = useQuery({
    queryKey: ['teacher-pool-booking-enabled'],
    queryFn: async () => {
      const { data } = await supabase.rpc('teacher_pool_booking_enabled' as any);
      return data === true;
    },
  });
  const canBook = isAdmin || teacherBookingEnabled;

  const { data: daySchedule = [], isFetching: dayLoading } = useQuery({
    queryKey: ['pool-day-schedule', day],
    enabled: canBook,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pool_day_schedule' as any, { _day: day });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const startIso = new Date(start).toISOString();
  const endIso = new Date(end).toISOString();

  const { data: seats = [], isFetching, refetch } = useQuery({
    queryKey: ['pool-availability', startIso, endIso],
    enabled: canBook,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pool_availability' as any, { _start: startIso, _end: endIso });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: myBookings = [] } = useQuery({
    queryKey: ['my-pool-bookings', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_pool_bookings')
        .select('*')
        .eq('booked_by_user_id', user!.id)
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-pool-bookings'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_pool_bookings')
        .select('*, seat:vault_account_id(label, account_type)')
        .order('start_time', { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as any[];
    },
  });

  const book = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('book_pool_seat' as any, {
        vault_account_id: seat, purpose, start_time: startIso, end_time: endIso,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as any;
    },
    onSuccess: (row) => {
      setCreated({ link: row.meeting_link, label: row.seat_label, records: row.records });
      toast({ title: 'Seat booked', description: row.records ? 'Cloud recording is on for this seat.' : 'This seat does not record.' });
      refetch();
      qc.invalidateQueries({ queryKey: ['my-pool-bookings'] });
      qc.invalidateQueries({ queryKey: ['all-pool-bookings'] });
      qc.invalidateQueries({ queryKey: ['pool-day-schedule'] });
    },
    onError: (e: any) => toast({ title: 'Booking failed', description: e.message, variant: 'destructive' }),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Link copied' });
  };

  const seatLabel = (id: string) =>
    seats.find((s: any) => s.vault_account_id === id)?.label ?? '—';

  const freeCount = seats.filter((s: any) => s.is_available).length;

  if (!canBook) {
    return (
      <div className="px-4 sm:px-6 py-10 max-w-2xl mx-auto">
        <div className="border border-dashed rounded-lg p-8 text-center">
          <p className="font-medium">Pool booking is not enabled yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            An administrator needs to switch on teacher booking before you can reserve a shared Zoom seat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-5 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pool booking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reserve a spare Zoom seat for demos, group classes or quick meetings.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
            <CircleDot className="h-3 w-3 text-primary" /> {freeCount} free in window
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
            {seats.length} spare seats
          </span>
        </div>
      </div>

      {/* Time window */}
      <section className="space-y-3">
        <SectionLabel
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {isFetching ? 'Checking…' : 'Check availability'}
            </Button>
          }
        >
          Time window
        </SectionLabel>
        <div className="grid gap-3 sm:grid-cols-3 rounded-lg border p-4">
          <div><Label className="text-xs">Start</Label><Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><Label className="text-xs">End</Label><Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Purpose</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PURPOSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Seat picker — flat list */}
      <section className="space-y-3">
        <SectionLabel>Pick a seat</SectionLabel>
        {seats.length === 0 && !isFetching && (
          <div className="border border-dashed rounded-lg py-10 text-center text-sm text-muted-foreground">
            No spare seats available. Spare seats are active Zoom Vault accounts with no teacher account linked to them.
          </div>
        )}
        <div className="rounded-lg border divide-y">
          {seats.map((s: any) => {
            const selected = seat === s.vault_account_id;
            return (
              <button
                key={s.vault_account_id}
                type="button"
                disabled={!s.is_available}
                onClick={() => setSeat(s.vault_account_id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  selected ? 'bg-accent' : 'hover:bg-accent/50',
                  !s.is_available && 'opacity-50 cursor-not-allowed'
                )}
              >
                {selected
                  ? <CircleDot className="h-4 w-4 text-primary shrink-0" />
                  : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.label}</p>
                  {(s.bookings ?? []).length > 0 && (
                    <p className="text-xs text-muted-foreground truncate">
                      {(s.bookings ?? []).map((b: any) =>
                        `${format(new Date(b.start_time), 'dd MMM HH:mm')}–${format(new Date(b.end_time), 'HH:mm')} · ${b.purpose}`
                      ).join('  ·  ')}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0">{seatTier(s)}</Badge>
                <Badge variant={s.is_available ? 'outline' : 'destructive'} className="shrink-0">
                  {s.is_available ? 'Free' : 'Busy'}
                </Badge>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button disabled={!seat || book.isPending} onClick={() => book.mutate()}>
            {book.isPending ? 'Booking…' : `Book ${seat ? seatLabel(seat) : 'seat'}`}
          </Button>
          {created && (
            <div className="flex items-center gap-2 text-sm min-w-0">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate max-w-md">{created.link}</span>
              <Button size="sm" variant="outline" onClick={() => copy(created.link)}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </div>
      </section>

      {/* Day schedule — flat rows */}
      <section className="space-y-3">
        <SectionLabel
          action={<Input type="date" className="w-auto h-8 text-xs" value={day} onChange={e => setDay(e.target.value)} />}
        >
          Day schedule
        </SectionLabel>
        <div className="rounded-lg border divide-y">
          {dayLoading && <p className="px-4 py-6 text-sm text-muted-foreground">Loading schedule…</p>}
          {!dayLoading && daySchedule.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No spare seats in the pool yet. Spare seats are Zoom Vault accounts that are not linked to a teacher's Zoom account.
            </p>
          )}
          {daySchedule.map((s: any) => (
            <div key={s.vault_account_id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{s.label}</span>
                <Badge variant="secondary">{seatTier(s)}</Badge>
              </div>
              {(s.bookings ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">Free all day</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(s.bookings ?? []).map((b: any) => (
                    <Badge key={b.id} variant={b.mine ? 'default' : 'outline'} className="font-normal">
                      {format(new Date(b.start_time), 'HH:mm')}–{format(new Date(b.end_time), 'HH:mm')} · {b.purpose} · {b.booked_by}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bookings */}
      <section className="space-y-3">
        <SectionLabel
          action={
            isAdmin ? (
              <div className="inline-flex rounded-full border p-0.5">
                {(['mine', 'all'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBookingsView(v)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      bookingsView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {v === 'mine' ? 'My bookings' : 'All bookings'}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          Bookings
        </SectionLabel>

        <div className="rounded-lg border overflow-x-auto">
          {(!isAdmin || bookingsView === 'mine') ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>When</TableHead><TableHead>Purpose</TableHead><TableHead>Status</TableHead>
                <TableHead>Link</TableHead><TableHead>Recording</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {myBookings.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No bookings yet.</TableCell></TableRow>}
                {myBookings.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(b.start_time), 'dd MMM, HH:mm')} – {format(new Date(b.end_time), 'HH:mm')}</TableCell>
                    <TableCell>{b.purpose}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{b.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell>{b.meeting_link ? <Button size="sm" variant="ghost" onClick={() => copy(b.meeting_link)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button> : '—'}</TableCell>
                    <TableCell>{b.recording_url ? <a className="text-primary underline" href={b.recording_url} target="_blank" rel="noreferrer">Watch</a> : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Seat</TableHead><TableHead>When</TableHead><TableHead>Purpose</TableHead>
                <TableHead>Status</TableHead><TableHead>Recording</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {allBookings.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No bookings recorded.</TableCell></TableRow>}
                {allBookings.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>{b.seat?.label ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{format(new Date(b.start_time), 'dd MMM, HH:mm')} – {format(new Date(b.end_time), 'HH:mm')}</TableCell>
                    <TableCell>{b.purpose}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{b.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell>{b.recording_url ? <a className="text-primary underline" href={b.recording_url} target="_blank" rel="noreferrer">Watch</a> : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
