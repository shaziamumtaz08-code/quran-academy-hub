import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Check, Copy, Link2, Mail, Phone, Search, Users, X } from 'lucide-react';

type Status = 'pending' | 'approved' | 'rejected';

export default function FamilyRegistrations() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('pending');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['family-registrations', status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_registrations')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: Status }) => {
      const { data: session } = await supabase.auth.getUser();
      const { error } = await supabase.from('family_registrations').update({
        status: next,
        review_notes: notes[id] || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.user?.id ?? null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      toast({ title: variables.next === 'approved' ? 'Registration approved' : 'Registration rejected' });
      queryClient.invalidateQueries({ queryKey: ['family-registrations'] });
    },
    onError: (error: any) => toast({ title: 'Could not update', description: error.message, variant: 'destructive' }),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter(row =>
      `${row.parent_name} ${row.email} ${row.phone}`.toLowerCase().includes(term) ||
      JSON.stringify(row.children ?? []).toLowerCase().includes(term));
  }, [data, search]);

  const publicLink = `${window.location.origin}/register/family`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Family registrations</h1>
          <p className="text-sm text-muted-foreground">Registrations submitted through the public family form. Nothing is created until you approve.</p>
        </div>
        <Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicLink); toast({ title: 'Link copied', description: publicLink }); }}>
          <Copy className="h-4 w-4 mr-1" />Copy public form link
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={value => setStatus(value as Status)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, email, child…" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
      </div>

      {isLoading ? <Skeleton className="h-40 w-full" /> : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-60" />
          No {status} registrations yet. Share the public form link with families to get started.
        </Card>
      ) : rows.map(row => {
        const children = Array.isArray(row.children) ? (row.children as any[]) : [];
        return (
          <Card key={row.id} className="p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.parent_name} <span className="text-xs text-muted-foreground">· {row.relationship}</span></p>
                <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{row.email}</span>
                  <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{row.phone}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[row.city, row.country, row.timezone].filter(Boolean).join(' · ')} · submitted {format(new Date(row.created_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.lead_id && <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" />Linked to enquiry</Badge>}
                <Badge variant={row.status === 'pending' ? 'outline' : row.status === 'approved' ? 'default' : 'destructive'}>{row.status}</Badge>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {children.map((child, index) => (
                <div key={index} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">{child.name}{child.age ? `, ${child.age}` : ''} {child.gender ? <span className="text-xs text-muted-foreground">({child.gender})</span> : null}</p>
                  <p className="text-muted-foreground text-xs">{(child.subjects ?? []).join(', ')}</p>
                  <p className="text-muted-foreground text-xs">{[child.preferred_time_1, child.preferred_time_2].filter(Boolean).join(' / ')} {child.preferred_days ?? ''}</p>
                  <p className="text-muted-foreground text-xs">{child.email}{child.uses_parent_email ? ' (parent email)' : ''}</p>
                  {child.level && <p className="text-muted-foreground text-xs">Level: {child.level}</p>}
                  {child.goals && <p className="text-muted-foreground text-xs">Goals: {child.goals}</p>}
                </div>
              ))}
            </div>

            {(() => {
              const bank = (row.applicant_data as any)?.banking;
              if (!bank) return null;
              return (
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Salary account (self-declared)</p>
                  <div className="mt-1 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>Method: <span className="text-foreground">{bank.payout_method ?? '—'}</span></span>
                    <span>Bank / wallet: <span className="text-foreground">{bank.bank_name ?? '—'}</span></span>
                    <span>Title: <span className="text-foreground">{bank.bank_account_title ?? '—'}</span></span>
                    <span>Account: <span className="font-mono text-foreground">{bank.bank_account_number ?? '—'}</span></span>
                    <span>IBAN: <span className="font-mono text-foreground">{bank.bank_iban ?? '—'}</span></span>
                    <span>Branch: <span className="text-foreground">{bank.branch ?? '—'}</span></span>
                  </div>
                </div>
              );
            })()}

            {row.notes && <p className="text-sm"><span className="text-muted-foreground">Family note:</span> {row.notes}</p>}
            {row.review_notes && row.status !== 'pending' && <p className="text-sm"><span className="text-muted-foreground">Review note:</span> {row.review_notes}</p>}

            {row.status === 'pending' && (
              <div className="space-y-2">
                <Textarea rows={2} placeholder="Review note (optional)" value={notes[row.id] ?? ''} onChange={event => setNotes(current => ({ ...current, [row.id]: event.target.value }))} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: row.id, next: 'approved' })}><Check className="h-4 w-4 mr-1" />Approve</Button>
                  <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: row.id, next: 'rejected' })}><X className="h-4 w-4 mr-1" />Reject</Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
