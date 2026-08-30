import React from 'react';
// Single "Zoom seats" workspace: per-teacher accounts + per-seat webhook health.
// Technical fields (host ID, event counts, credential errors) live in the row
// detail drawer — the table itself stays deliberately narrow and scannable.
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Loader2, CheckCircle2, XCircle, Trash2, Video, Upload, RefreshCw,
  AlertTriangle, Copy, Pencil, Wrench, Clock, MoreHorizontal, ChevronRight, Search,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { BulkLinkZoomAccountsDialog } from './BulkLinkZoomAccountsDialog';

// ── Webhook health ─────────────────────────────────────────────────────────
type SeatStatus = 'healthy' | 'no_events' | 'missing_host_id' | 'no_credentials' | 'credentials_invalid';

interface SeatHealth {
  id: string;
  teacher_name: string;
  zoom_account_email: string;
  tier: string | null;
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

const STATUS_META: Record<SeatStatus, { label: string; hint: string; dot: string; text: string }> = {
  healthy: {
    label: 'Healthy',
    hint: 'Zoom is delivering real attendance telemetry for this seat.',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  no_events: {
    label: 'No events yet',
    hint: 'Credentials and host ID are set, but Zoom has never posted an event. Check the Event Subscription URL in this account’s Marketplace app.',
    dot: 'bg-muted-foreground/50',
    text: 'text-muted-foreground',
  },
  missing_host_id: {
    label: 'Missing host ID',
    hint: 'Events cannot be matched to this teacher. Use Repair host IDs to fetch it from Zoom.',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
  },
  no_credentials: {
    label: 'Credentials missing',
    hint: 'This seat has no Server-to-Server OAuth app. Add one via Link account, then subscribe it to the webhook URL.',
    dot: 'bg-destructive',
    text: 'text-destructive',
  },
  credentials_invalid: {
    label: 'Credentials failed',
    hint: 'Zoom refused these credentials or the user lookup failed.',
    dot: 'bg-destructive',
    text: 'text-destructive',
  },
};

function StatusDot({ status }: { status?: SeatStatus }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const meta = STATUS_META[status];
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', meta.text)}>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

type HealthFilter = 'all' | 'healthy' | 'attention';

/**
 * Dedicated Zoom Accounts (per-teacher).
 * Admin validates + saves one Zoom account per teacher per tier (free for 1:1,
 * licensed for Group Academy). Once saved, the teacher's own account handles
 * all live sessions natively.
 */
export function TeacherZoomAccountsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<HealthFilter>('all');

  const [form, setForm] = React.useState({
    teacher_id: '',
    tier: 'free' as 'free' | 'licensed',
    account_id: '',
    client_id: '',
    client_secret: '',
    zoom_email: '',
    personal_meeting_link: '',
  });
  const [validating, setValidating] = React.useState(false);
  const [validateResult, setValidateResult] = React.useState<any>(null);

  const { data: teachers } = useQuery({
    queryKey: ['zoom-accounts-teacher-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, profile:profiles!user_roles_user_id_fkey(id, full_name, email)')
        .eq('role', 'teacher');
      const rows = (data || []) as any[];
      const seen = new Set<string>();
      return rows
        .map((r) => r.profile)
        .filter((p: any) => p && !seen.has(p.id) && (seen.add(p.id), true))
        .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''));
    },
  });

  const { data: accounts, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['zoom-accounts-list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zoom_accounts')
        .select('id, teacher_id, zoom_account_email, zoom_user_id, tier, meeting_link, meeting_passcode, is_active, last_validated_at, created_at, profile:profiles!zoom_accounts_teacher_id_fkey(id, full_name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const [editingAccount, setEditingAccount] = React.useState<any>(null);
  const [linkForm, setLinkForm] = React.useState({ meeting_link: '', meeting_passcode: '' });

  // Webhook health check — same edge function as before.
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const healthRun = useMutation({
    mutationFn: async (repair: boolean) => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Your session expired — sign in again to run the health check.');
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sienlnxwwdqnybugipdt';
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/zoom-webhook-health`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ repair }),
      });
      const res = await resp.json().catch(() => ({}));
      if (!resp.ok || res?.error) throw new Error(res?.error || `Health check failed (HTTP ${resp.status})`);
      return res as HealthResponse;
    },
    onSuccess: (res, repair) => {
      setHealth(res);
      if (repair) {
        toast({
          title: res.repaired_count > 0 ? `Repaired ${res.repaired_count} seat(s)` : 'Nothing to repair',
          description: res.repaired_count > 0
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
    healthRun.mutate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const healthById = React.useMemo(
    () => new Map((health?.accounts || []).map((s) => [s.id, s])),
    [health],
  );

  const copyWebhook = () => {
    if (!health?.webhook_url) return;
    navigator.clipboard.writeText(health.webhook_url);
    toast({ title: 'Webhook URL copied', description: 'Paste this as the Event Notification Endpoint in every Zoom app.' });
  };

  const saveLinkMut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('zoom_accounts')
        .update({
          meeting_link: linkForm.meeting_link.trim() || null,
          meeting_passcode: linkForm.meeting_passcode.trim() || null,
        })
        .eq('id', editingAccount.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Join link saved' });
      setEditingAccount(null);
      qc.invalidateQueries({ queryKey: ['zoom-accounts-list'] });
    },
    onError: (e: any) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('zoom_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Zoom account removed' });
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ['zoom-accounts-list'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from('zoom_accounts').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zoom-accounts-list'] }),
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const resetForm = () => {
    setForm({
      teacher_id: '',
      tier: 'free',
      account_id: '',
      client_id: '',
      client_secret: '',
      zoom_email: '',
      personal_meeting_link: '',
    });
    setValidateResult(null);
  };

  const runValidateAndSave = async () => {
    setValidating(true);
    setValidateResult(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sienlnxwwdqnybugipdt';
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/zoom-validate-account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ ...form, save: true }),
      });
      const body = await resp.json();
      setValidateResult(body);
      qc.invalidateQueries({ queryKey: ['zoom-accounts-list'] });
      qc.invalidateQueries({ queryKey: ['zoom-seat-status'] });
      if (body?.ok && body?.saved) {
        toast({
          title: 'Verified — host ID resolved',
          description: `Host ID ${body.resolved?.host_id} saved for this teacher's ${form.tier} seat.`,
        });
      } else {
        toast({
          title: 'Save failed verification',
          description: body?.failure_reason || body?.verdict || body?.error || 'Zoom rejected this setup.',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      setValidateResult({ ok: false, verdict: e.message, failure_reason: e.message });
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };

  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<any>(null);

  const runSyncZoomUsers = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sienlnxwwdqnybugipdt';
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/zoom-sync-account-users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ apply: true }),
      });
      const body = await resp.json();
      setSyncResult(body);
      if (body?.success) {
        const s = body.summary || {};
        toast({
          title: 'Zoom users synced',
          description: `${body.zoom_user_count} Zoom users • ${s.created || 0} created, ${s.updated || 0} updated, ${s.already_mapped || 0} already mapped`,
        });
        qc.invalidateQueries({ queryKey: ['zoom-accounts-list'] });
      } else {
        toast({ title: 'Sync failed', description: body?.error || body?.hint || 'See details', variant: 'destructive' });
      }
    } catch (e: any) {
      setSyncResult({ error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const canSubmit = form.teacher_id && form.account_id && form.client_id && form.client_secret && form.zoom_email;

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return ((accounts || []) as any[]).filter((a) => {
      const seat = healthById.get(a.id);
      if (filter === 'healthy' && seat?.status !== 'healthy') return false;
      if (filter === 'attention' && (!seat || seat.status === 'healthy')) return false;
      if (!q) return true;
      return (
        (a.profile?.full_name || '').toLowerCase().includes(q) ||
        (a.zoom_account_email || '').toLowerCase().includes(q)
      );
    });
  }, [accounts, healthById, search, filter]);

  const totals = React.useMemo(() => {
    const list = (accounts || []) as any[];
    const healthy = list.filter((a) => healthById.get(a.id)?.status === 'healthy').length;
    const attention = list.filter((a) => {
      const s = healthById.get(a.id)?.status;
      return s && s !== 'healthy';
    }).length;
    return {
      total: list.length,
      healthy,
      attention,
      disabled: list.filter((a) => !a.is_active).length,
    };
  }, [accounts, healthById]);

  const detail = React.useMemo(
    () => ((accounts || []) as any[]).find((a) => a.id === detailId) || null,
    [accounts, detailId],
  );
  const detailHealth = detail ? healthById.get(detail.id) : undefined;

  const openEditLink = (a: any) => {
    setEditingAccount(a);
    setLinkForm({ meeting_link: a.meeting_link || '', meeting_passcode: a.meeting_passcode || '' });
  };

  const summary: { label: string; value: number; tone?: string }[] = [
    { label: 'Total seats', value: totals.total },
    { label: 'Healthy', value: totals.healthy, tone: 'text-emerald-700 dark:text-emerald-400' },
    { label: 'Needs attention', value: totals.attention, tone: totals.attention ? 'text-amber-700 dark:text-amber-400' : undefined },
    { label: 'Disabled', value: totals.disabled },
  ];

  return (
    <section className="space-y-6">
      {/* Section header + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Zoom seats</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            One dedicated Zoom account per teacher, per tier. Select a seat to see its full setup.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                More actions <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => healthRun.mutate(false)} disabled={healthRun.isPending}>
                <RefreshCw className="mr-2 h-4 w-4" /> Recheck health
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => healthRun.mutate(true)} disabled={healthRun.isPending}>
                <Wrench className="mr-2 h-4 w-4" /> Repair host IDs
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={runSyncZoomUsers} disabled={syncing}>
                <RefreshCw className="mr-2 h-4 w-4" /> Sync Zoom users
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Bulk link accounts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Link account
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 divide-border rounded-lg border border-border bg-card sm:grid-cols-4 sm:divide-x">
        {summary.map((s) => (
          <div key={s.label} className="px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
            {healthRun.isPending && !health ? (
              <Skeleton className="mt-2 h-7 w-12" />
            ) : (
              <p className={cn('mt-1 text-2xl font-semibold tabular-nums', s.tone)}>{s.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* System webhook — secondary information */}
      {health?.webhook_url && (
        <div className="flex flex-col gap-2 rounded-md bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">System webhook</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{health.webhook_url}</p>
          </div>
          <Button variant="ghost" size="sm" className="self-start sm:self-auto" onClick={copyWebhook}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
        </div>
      )}

      {syncResult && (
        <Alert variant={syncResult.success ? 'default' : 'destructive'}>
          {syncResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <AlertTitle className="text-sm">
            {syncResult.success ? `Synced ${syncResult.zoom_user_count} Zoom users` : 'Zoom sync failed'}
          </AlertTitle>
          <AlertDescription className="space-y-2 text-xs">
            {!syncResult.success && (
              <p className="whitespace-pre-wrap">{syncResult.error}{syncResult.hint ? ` — ${syncResult.hint}` : ''}</p>
            )}
            {syncResult.success && (
              <>
                <p>
                  Created {syncResult.summary?.created ?? 0} • Updated {syncResult.summary?.updated ?? 0} •
                  Already mapped {syncResult.summary?.already_mapped ?? 0} • Failed {syncResult.summary?.failed ?? 0}
                </p>
                {(syncResult.teachers_without_zoom || []).length > 0 && (
                  <p>
                    <span className="font-medium">Teachers not in your Zoom account:</span>{' '}
                    {(syncResult.teachers_without_zoom || []).map((t: any) => t.full_name || t.email).join(', ')} — add them
                    in Zoom → User Management, then sync again.
                  </p>
                )}
                {(syncResult.unmatched_zoom_users || []).length > 0 && (
                  <p>
                    <span className="font-medium">Zoom users with no matching teacher email:</span>{' '}
                    {(syncResult.unmatched_zoom_users || []).map((u: any) => u.email).join(', ')}
                  </p>
                )}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teacher or Zoom email"
            className="pl-9"
            aria-label="Search Zoom seats"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md bg-muted/60 p-1" role="tablist" aria-label="Filter by health">
          {([
            { id: 'all' as const, label: 'All' },
            { id: 'healthy' as const, label: 'Healthy' },
            { id: 'attention' as const, label: 'Needs attention' },
          ]).map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                filter === f.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Seats */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
          <p className="text-sm font-medium text-destructive">We couldn’t load the Zoom seats</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{(error as any)?.message}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">
            {(accounts || []).length === 0 ? 'No Zoom seats yet' : 'No seats match this view'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {(accounts || []).length === 0
              ? 'Link a teacher’s dedicated Zoom account to start hosting classes from their own room.'
              : 'Try a different search term or switch back to All.'}
          </p>
          {(accounts || []).length === 0 && (
            <Button size="sm" className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Link account
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-11">Teacher</TableHead>
                  <TableHead className="h-11">Tier</TableHead>
                  <TableHead className="h-11">Health</TableHead>
                  <TableHead className="h-11">Last activity</TableHead>
                  <TableHead className="h-11">State</TableHead>
                  <TableHead className="h-11 w-[1%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a: any) => {
                  const seat = healthById.get(a.id);
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => setDetailId(a.id)}
                    >
                      <TableCell className="py-4">
                        <p className="font-medium leading-tight text-foreground">{a.profile?.full_name || 'Unassigned seat'}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.zoom_account_email}</p>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant={a.tier === 'licensed' ? 'default' : 'secondary'} className="font-normal capitalize">
                          {a.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        {seat ? <StatusDot status={seat.status} /> : (
                          <span className="text-sm text-muted-foreground">{healthRun.isPending ? 'Checking…' : '—'}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-sm text-muted-foreground">
                        {seat?.last_event_at
                          ? formatDistanceToNow(new Date(seat.last_event_at), { addSuffix: true })
                          : seat ? 'No activity' : '—'}
                      </TableCell>
                      <TableCell className="py-4">
                        <span className={cn('text-sm', a.is_active ? 'text-foreground' : 'text-muted-foreground')}>
                          {a.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {a.meeting_link && (
                            <Button variant="ghost" size="sm" asChild title="Open Zoom room">
                              <a href={a.meeting_link} target="_blank" rel="noreferrer"><Video className="h-4 w-4" /></a>
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setDetailId(a.id)}>
                            Details <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((a: any) => {
              const seat = healthById.get(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setDetailId(a.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{a.profile?.full_name || 'Unassigned seat'}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.zoom_account_email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Badge variant={a.tier === 'licensed' ? 'default' : 'secondary'} className="font-normal capitalize">{a.tier}</Badge>
                      {seat && <StatusDot status={seat.status} />}
                      {!a.is_active && <span className="text-xs text-muted-foreground">Disabled</span>}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Seat detail drawer ─────────────────────────────────────────── */}
      <Sheet open={Boolean(detail)} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {detail && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{detail.profile?.full_name || 'Unassigned seat'}</SheetTitle>
                <SheetDescription>{detail.zoom_account_email}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Seat active</p>
                    <p className="text-xs text-muted-foreground">Disabled seats are skipped when allocating rooms.</p>
                  </div>
                  <Switch
                    checked={Boolean(detail.is_active)}
                    onCheckedChange={(v) => toggleActiveMut.mutate({ id: detail.id, is_active: v })}
                    aria-label="Toggle seat active"
                  />
                </div>

                <Separator />

                <dl className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Tier</dt>
                    <dd className="capitalize">{detail.tier}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Health</dt>
                    <dd>{detailHealth ? <StatusDot status={detailHealth.status} /> : '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Credentials</dt>
                    <dd>{detailHealth ? (detailHealth.has_credentials ? 'Stored' : 'Not set') : '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Host ID</dt>
                    <dd className="font-mono text-xs">{detailHealth?.host_id || detail.zoom_user_id || '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Webhook events</dt>
                    <dd className="tabular-nums">{detailHealth ? detailHealth.event_count : '—'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Last event</dt>
                    <dd>
                      {detailHealth?.last_event_at
                        ? formatDistanceToNow(new Date(detailHealth.last_event_at), { addSuffix: true })
                        : 'Never'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">Last validated</dt>
                    <dd>{detail.last_validated_at ? format(new Date(detail.last_validated_at), 'MMM d, HH:mm') : '—'}</dd>
                  </div>
                </dl>

                {detailHealth && detailHealth.status !== 'healthy' && (
                  <Alert variant={detailHealth.status === 'no_events' ? 'default' : 'destructive'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">{STATUS_META[detailHealth.status].label}</AlertTitle>
                    <AlertDescription className="text-xs">
                      {detailHealth.credential_error
                        ? `${STATUS_META[detailHealth.status].hint} — ${detailHealth.credential_error}`
                        : STATUS_META[detailHealth.status].hint}
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Shareable join link</p>
                  {detail.meeting_link ? (
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-[11px]">{detail.meeting_link}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { navigator.clipboard.writeText(detail.meeting_link); toast({ title: 'Join link copied' }); }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not set yet.</p>
                  )}
                  {detail.meeting_passcode && (
                    <p className="text-xs text-muted-foreground">Passcode: {detail.meeting_passcode}</p>
                  )}
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => openEditLink(detail)}>
                    <Pencil className="h-4 w-4" /> Edit join link
                  </Button>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => healthRun.mutate(false)} disabled={healthRun.isPending}>
                    {healthRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Recheck
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => healthRun.mutate(true)} disabled={healthRun.isPending}>
                    <Wrench className="h-4 w-4" /> Repair host ID
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Remove dedicated Zoom account for ${detail.profile?.full_name || 'this seat'}?`)) deleteMut.mutate(detail.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Remove seat
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Link account dialog (grouped steps) ─────────────────────────── */}
      <BulkLinkZoomAccountsDialog open={bulkOpen} onOpenChange={setBulkOpen} teachers={(teachers || []) as any} />

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link a dedicated Zoom account</DialogTitle>
            <DialogDescription>
              We validate the Server-to-Server credentials with Zoom, resolve the host ID, and save the account as this
              teacher’s own room.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1 · Who is this seat for</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Teacher</Label>
                  <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      {(teachers || []).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name || t.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tier</Label>
                  <Select value={form.tier} onValueChange={(v: 'free' | 'licensed') => setForm({ ...form, tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free — 1:1 Mentorship (40 min cap for 3+)</SelectItem>
                      <SelectItem value="licensed">Licensed — Group Academy (no time cap)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2 · Zoom identity</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Zoom host email</Label>
                <Input value={form.zoom_email} onChange={(e) => setForm({ ...form, zoom_email: e.target.value })} placeholder="teacher@aqta.example" />
                <p className="text-[11px] text-muted-foreground">The academy-owned Zoom login that hosts this teacher’s classes.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Personal meeting link (optional)</Label>
                <Input value={form.personal_meeting_link} onChange={(e) => setForm({ ...form, personal_meeting_link: e.target.value })} placeholder="https://zoom.us/j/1234567890" />
                <p className="text-[11px] text-muted-foreground">Leave blank to use the Zoom user’s own PMI.</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3 · Server-to-Server app credentials</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Account ID</Label>
                  <Input value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client ID</Label>
                  <Input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Client secret</Label>
                  <Input type="password" value={form.client_secret} onChange={(e) => setForm({ ...form, client_secret: e.target.value })} />
                </div>
              </div>
            </div>

            {validateResult && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">4 · Verification</p>
                  <Alert variant={validateResult.ok ? 'default' : 'destructive'}>
                    {validateResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <AlertTitle className="text-sm">
                      {validateResult.ok
                        ? `Verified — host ID ${validateResult.resolved?.host_id || 'resolved'}`
                        : 'Failed — credentials were not verified'}
                    </AlertTitle>
                    <AlertDescription className="space-y-1 whitespace-pre-wrap text-xs">
                      <p>{validateResult.failure_reason || validateResult.verdict || validateResult.error}</p>
                      {!validateResult.ok && validateResult.stored_unverified && (
                        <p className="font-medium">
                          The credentials you typed were stored and flagged as “Failed” so you don’t have to retype them —
                          fix the Zoom app, then press Validate &amp; Save again.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Close</Button>
            <Button onClick={runValidateAndSave} disabled={!canSubmit || validating}>
              {validating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating &amp; saving…</> : 'Validate & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit join link */}
      <Dialog open={Boolean(editingAccount)} onOpenChange={(o) => !o && setEditingAccount(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Shareable Zoom join link</DialogTitle>
            <DialogDescription>
              Paste the Zoom “Copy invite link” (quick link) for {editingAccount?.profile?.full_name || 'this teacher'}.
              A link that ends with an encrypted <code>?pwd=…</code> token lets students join in one click without typing a passcode.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Join link</Label>
              <Input
                value={linkForm.meeting_link}
                onChange={(e) => setLinkForm({ ...linkForm, meeting_link: e.target.value })}
                placeholder="https://us05web.zoom.us/j/8640987589?pwd=…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Passcode (only if the link has no encrypted token)</Label>
              <Input
                value={linkForm.meeting_passcode}
                onChange={(e) => setLinkForm({ ...linkForm, meeting_passcode: e.target.value })}
                placeholder="e.g. 125125"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAccount(null)}>Cancel</Button>
            <Button onClick={() => saveLinkMut.mutate()} disabled={saveLinkMut.isPending}>
              {saveLinkMut.isPending ? 'Saving…' : 'Save link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
