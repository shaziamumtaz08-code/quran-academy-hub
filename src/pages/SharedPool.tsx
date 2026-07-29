import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Video, CalendarClock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

const PURPOSES = ['Demo class', 'Group class', 'Quick meeting', 'Other'];

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

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
    },
    onError: (e: any) => toast({ title: 'Booking failed', description: e.message, variant: 'destructive' }),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Link copied' });
  };

  const seatLabel = (id: string) =>
    seats.find((s: any) => s.vault_account_id === id)?.label ?? '—';

  if (!canBook) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader><CardTitle className="text-base">Shared pool booking is not enabled yet</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            An administrator needs to switch on teacher booking before you can reserve a shared Zoom seat.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Video className="h-6 w-6 text-primary" /> Shared Zoom Pool
        </h1>
        <p className="text-sm text-muted-foreground">Check seat availability and book a room for demos, group classes or quick meetings.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Day schedule</CardTitle>
          <Input type="date" className="w-auto" value={day} onChange={e => setDay(e.target.value)} />
        </CardHeader>
        <CardContent className="space-y-3">
          {dayLoading && <p className="text-sm text-muted-foreground">Loading schedule…</p>}
          {!dayLoading && daySchedule.length === 0 && (
            <p className="text-sm text-muted-foreground">No shared seats in the pool yet. Add or import them in Zoom Vault.</p>
          )}
          {daySchedule.map((s: any) => (
            <div key={s.vault_account_id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-medium text-sm">{s.label}</span>
                <Badge variant="secondary">{s.account_type === 'paid' && s.auto_record ? 'Paid + Recording' : s.account_type === 'paid' ? 'Paid' : 'Free'}</Badge>
              </div>
              {(s.bookings ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Free all day</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(s.bookings ?? []).map((b: any) => (
                    <Badge key={b.id} variant={b.mine ? 'default' : 'outline'} className="font-normal">
                      {format(new Date(b.start_time), 'HH:mm')}–{format(new Date(b.end_time), 'HH:mm')} · {b.purpose} · {b.booked_by}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Time window</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <div><Label>Start</Label><Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><Label>End</Label><Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></div>
          <div>
            <Label>Purpose</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PURPOSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button variant="outline" className="w-full" onClick={() => refetch()}>{isFetching ? 'Checking…' : 'Check availability'}</Button></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seats.length === 0 && !isFetching && (
          <Card className="sm:col-span-2 lg:col-span-3"><CardContent className="py-10 text-center text-muted-foreground">
            No shared seats configured yet. Add accounts in Zoom Vault and set their pool to “Shared”.
          </CardContent></Card>
        )}
        {seats.map((s: any) => {
          const selected = seat === s.vault_account_id;
          return (
            <Card
              key={s.vault_account_id}
              onClick={() => s.is_available && setSeat(s.vault_account_id)}
              className={`cursor-pointer transition ${selected ? 'ring-2 ring-primary' : ''} ${s.is_available ? 'hover:shadow-md' : 'opacity-60'}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{s.label}</CardTitle>
                  <Badge variant={s.is_available ? 'default' : 'destructive'}>{s.is_available ? 'Free' : 'Busy'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Badge variant="secondary">{s.account_type === 'paid' && s.auto_record ? 'Paid + Recording' : s.account_type === 'paid' ? 'Paid' : 'Free'}</Badge>
                {(s.bookings ?? []).map((b: any) => (
                  <div key={b.id} className="text-xs text-muted-foreground">
                    {format(new Date(b.start_time), 'dd MMM HH:mm')}–{format(new Date(b.end_time), 'HH:mm')} · {b.purpose}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={!seat || book.isPending} onClick={() => book.mutate()}>
          {book.isPending ? 'Booking…' : `Book ${seat ? seatLabel(seat) : 'seat'}`}
        </Button>
        {created && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="truncate max-w-md">{created.link}</span>
            <Button size="sm" variant="outline" onClick={() => copy(created.link)}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My bookings</TabsTrigger>
          {isAdmin && <TabsTrigger value="all">All bookings</TabsTrigger>}
        </TabsList>

        <TabsContent value="mine">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>When</TableHead><TableHead>Purpose</TableHead><TableHead>Status</TableHead>
                <TableHead>Link</TableHead><TableHead>Recording</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {myBookings.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No bookings yet.</TableCell></TableRow>}
                {myBookings.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>{format(new Date(b.start_time), 'dd MMM, HH:mm')} – {format(new Date(b.end_time), 'HH:mm')}</TableCell>
                    <TableCell>{b.purpose}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{b.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell>{b.meeting_link ? <Button size="sm" variant="ghost" onClick={() => copy(b.meeting_link)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button> : '—'}</TableCell>
                    <TableCell>{b.recording_url ? <a className="text-primary underline" href={b.recording_url} target="_blank" rel="noreferrer">Watch</a> : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="all">
            <Card><CardContent className="p-0 overflow-x-auto">
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
                      <TableCell>{format(new Date(b.start_time), 'dd MMM, HH:mm')} – {format(new Date(b.end_time), 'HH:mm')}</TableCell>
                      <TableCell>{b.purpose}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{b.status.replace('_', ' ')}</Badge></TableCell>
                      <TableCell>{b.recording_url ? <a className="text-primary underline" href={b.recording_url} target="_blank" rel="noreferrer">Watch</a> : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
