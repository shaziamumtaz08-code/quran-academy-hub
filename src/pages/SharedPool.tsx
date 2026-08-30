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
      <div className="zoom-ws zw-canvas px-4 sm:px-6 py-10 max-w-2xl mx-auto">
        <div className="zw-card zw-motif p-8 text-center">
          <p className="zw-h2">Pool booking is not enabled yet</p>
          <p className="zw-meta mt-1.5">
            An administrator needs to switch on teacher booking before you can reserve a shared Zoom seat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="zoom-ws mx-auto max-w-[1400px] space-y-8 py-1">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="zw-eyebrow">Spare capacity</p>
          <h1 className="zw-h2 mt-1.5 text-xl">Pool booking</h1>
          <p className="zw-body mt-1">
            Reserve a spare Zoom seat for demos, group classes or quick meetings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="zw-chip" data-tone="ok"><span className="zw-dot" />{freeCount} free in window</span>
          <span className="zw-chip" data-tone="quiet"><span className="zw-dot" />{seats.length} spare seats</span>
        </div>
      </div>

      {/* Time window */}
      <section className="space-y-3">
        <SectionLabel
          action={
            <Button variant="outline" size="sm" className="zw-btn-secondary" onClick={() => refetch()}>
              {isFetching ? 'Checking…' : 'Check availability'}
            </Button>
          }
        >
          Time window
        </SectionLabel>
        <div className="zw-card grid gap-4 p-5 sm:grid-cols-3">
          <div><Label className="zw-meta">Start</Label><Input type="datetime-local" className="mt-1.5 rounded-xl" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><Label className="zw-meta">End</Label><Input type="datetime-local" className="mt-1.5 rounded-xl" value={end} onChange={e => setEnd(e.target.value)} /></div>
          <div>
            <Label className="zw-meta">Purpose</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{PURPOSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Seat inventory */}
      <section className="space-y-3">
        <SectionLabel>Pick a seat</SectionLabel>
        {seats.length === 0 && !isFetching && (
          <div className="zw-card px-6 py-12 text-center">
            <div className="zw-motif" />
            <p className="zw-body mx-auto mt-5 max-w-sm">
              No spare seats available. Spare seats are active Zoom Vault accounts with no teacher account linked to them.
            </p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {seats.map((s: any) => {
            const selected = seat === s.vault_account_id;
            return (
              <button
                key={s.vault_account_id}
                type="button"
                disabled={!s.is_available}
                onClick={() => setSeat(s.vault_account_id)}
                data-state={!s.is_available ? 'busy' : selected ? 'selected' : 'free'}
                className="zw-tile"
              >
                <div className="flex items-start gap-3">
                  {selected
                    ? <CircleDot className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'hsl(var(--zw-brass))' }} />
                    : <Circle className="mt-0.5 h-4 w-4 shrink-0 opacity-30" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.label}</p>
                    <p className="zw-meta mt-0.5">{seatTier(s)}</p>
                  </div>
                  <span className="zw-chip" data-tone={s.is_available ? 'ok' : 'warn'}>
                    <span className="zw-dot" />{s.is_available ? 'Free' : 'Busy'}
                  </span>
                </div>
                {(s.bookings ?? []).length > 0 && (
                  <p className="zw-meta mt-3 truncate border-t border-border/40 pt-2.5">
                    {(s.bookings ?? []).map((b: any) =>
                      `${format(new Date(b.start_time), 'dd MMM HH:mm')}–${format(new Date(b.end_time), 'HH:mm')} · ${b.purpose}`
                    ).join('  ·  ')}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button disabled={!seat || book.isPending} className="zw-btn-primary" onClick={() => book.mutate()}>
            {book.isPending ? 'Booking…' : `Book ${seat ? seatLabel(seat) : 'seat'}`}
          </Button>
          {created && (
            <div className="zw-linkbox min-w-0 max-w-xl flex-1">
              <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--zw-sage))' }} />
              <span className="zw-linkbox-text font-mono">{created.link}</span>
              <Button size="sm" variant="ghost" className="zw-btn-ghost h-8 px-2" onClick={() => copy(created.link)}><Copy className="h-3.5 w-3.5" /></Button>
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
        <div className="zw-card divide-y divide-border/40 overflow-hidden">
          {dayLoading && <p className="zw-body px-5 py-6">Loading schedule…</p>}
          {!dayLoading && daySchedule.length === 0 && (
            <p className="zw-body px-5 py-6">
              No spare seats in the pool yet. Spare seats are Zoom Vault accounts that are not linked to a teacher's Zoom account.
            </p>
          )}
          {daySchedule.map((s: any) => (
            <div key={s.vault_account_id} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{s.label}</span>
                <span className="zw-chip" data-tone="brass"><span className="zw-dot" />{seatTier(s)}</span>
              </div>
              {(s.bookings ?? []).length === 0 ? (
                <p className="zw-meta mt-1">Free all day</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(s.bookings ?? []).map((b: any) => (
                    <span key={b.id} className="zw-chip" data-tone={b.mine ? 'brass' : 'quiet'}>
                      {format(new Date(b.start_time), 'HH:mm')}–{format(new Date(b.end_time), 'HH:mm')} · {b.purpose} · {b.booked_by}
                    </span>
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
              <div className="zw-nav">
                {(['mine', 'all'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBookingsView(v)}
                    data-active={bookingsView === v}
                    className="zw-nav-item !px-3 !py-1 !text-xs"
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

        <div className="zw-table-wrap overflow-x-auto">
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
                    <TableCell><span className="zw-chip capitalize" data-tone={b.status === 'cancelled' ? 'quiet' : b.status === 'in_progress' ? 'live' : 'ok'}><span className="zw-dot" />{b.status.replace('_', ' ')}</span></TableCell>
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
                    <TableCell><span className="zw-chip capitalize" data-tone={b.status === 'cancelled' ? 'quiet' : b.status === 'in_progress' ? 'live' : 'ok'}><span className="zw-dot" />{b.status.replace('_', ' ')}</span></TableCell>
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
