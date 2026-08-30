import React from 'react';
// Zoom Seats workspace — master/detail.
// LEFT: searchable seat list (one row per teacher seat).
// RIGHT: the selected seat is the main surface (identity, connection,
// meeting access, diagnostics). On mobile the detail opens as a full sheet.
// Backend calls, query keys, mutations and permissions are unchanged.
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Plus, Loader2, CheckCircle2, XCircle, Trash2, Video, Upload, RefreshCw,
  AlertTriangle, Copy, Pencil, Wrench, MoreHorizontal, ChevronRight, ChevronLeft, Search, Check,
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
    dot: 'bg-muted-foreground/40',
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

const STATUS_TONE: Record<SeatStatus, string> = {
  healthy: 'ok',
  no_events: 'quiet',
  missing_host_id: 'warn',
  no_credentials: 'live',
  credentials_invalid: 'live',
};

function StatusLabel({ status, className }: { status?: SeatStatus; className?: string }) {
  if (!status) return <span className="zw-meta">—</span>;
  const meta = STATUS_META[status];
  return (
    <span className={cn('zw-chip', className)} data-tone={STATUS_TONE[status]}>
      <span className="zw-dot" />
      {meta.label}
    </span>
  );
}

function initials(name: string) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

type HealthFilter = 'all' | 'healthy' | 'attention' | 'no_events' | 'no_credentials';

const FILTERS: { id: HealthFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'healthy', label: 'Healthy' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'no_events', label: 'No events' },
  { id: 'no_credentials', label: 'Missing credentials' },
];

/** Row of quiet label/value pairs used inside the detail sections. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <dt className="zw-body text-sm">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="zw-eyebrow">{children}</h4>;
}

/** One operational metric module. */
function RailSegment({ value, label, tone = 'quiet' }: { value: number; label: string; tone?: 'brass' | 'sage' | 'warn' | 'quiet' }) {
  return (
    <div className="zw-metric">
      <p className="zw-metric-value">{value}</p>
      <p className="zw-eyebrow mt-2">{label}</p>
      <div className="zw-metric-rule" data-tone={tone} />
    </div>
  );
}



export function TeacherZoomAccountsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [addOpen, setAddOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<HealthFilter>('all');
  const [step, setStep] = React.useState(1);

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

  // Spare (unlinked) vault seats — read-only count for the status bar.
  const { data: spareCount } = useQuery({
    queryKey: ['zoom-vault-spare-count'],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('zoom_vault_accounts')
        .select('id', { count: 'exact', head: true })
        .is('zoom_account_id', null)
        .eq('status', 'active');
      if (error) throw error;
      return count || 0;
    },
  });

  const [editingAccount, setEditingAccount] = React.useState<any>(null);
  const [linkForm, setLinkForm] = React.useState({ meeting_link: '', meeting_passcode: '' });

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
    setStep(1);
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
      const status = healthById.get(a.id)?.status;
      if (filter === 'healthy' && status !== 'healthy') return false;
      if (filter === 'attention' && (!status || status === 'healthy')) return false;
      if (filter === 'no_events' && status !== 'no_events') return false;
      if (filter === 'no_credentials' && status !== 'no_credentials' && status !== 'credentials_invalid') return false;
      if (!q) return true;
      return (
        (a.profile?.full_name || '').toLowerCase().includes(q) ||
        (a.zoom_account_email || '').toLowerCase().includes(q)
      );
    });
  }, [accounts, healthById, search, filter]);

  const totals = React.useMemo(() => {
    const list = (accounts || []) as any[];
    return {
      total: list.length,
      healthy: list.filter((a) => healthById.get(a.id)?.status === 'healthy').length,
      attention: list.filter((a) => {
        const s = healthById.get(a.id)?.status;
        return s && s !== 'healthy';
      }).length,
      disabled: list.filter((a) => !a.is_active).length,
    };
  }, [accounts, healthById]);

  // Keep a seat selected on desktop so the right pane is never empty.
  React.useEffect(() => {
    if (isMobile) return;
    if (!rows.length) { setDetailId(null); return; }
    if (!detailId || !rows.some((r: any) => r.id === detailId)) setDetailId(rows[0].id);
  }, [rows, detailId, isMobile]);

  const detail = React.useMemo(
    () => ((accounts || []) as any[]).find((a) => a.id === detailId) || null,
    [accounts, detailId],
  );
  const detailHealth = detail ? healthById.get(detail.id) : undefined;

  const openEditLink = (a: any) => {
    setEditingAccount(a);
    setLinkForm({ meeting_link: a.meeting_link || '', meeting_passcode: a.meeting_passcode || '' });
  };

  // ── Seat list row ───────────────────────────────────────────────────────
  const SeatRow = ({ a }: { a: any }) => {
    const seat = healthById.get(a.id);
    const selected = !isMobile && a.id === detailId;
    return (
      <button
        type="button"
        onClick={() => setDetailId(a.id)}
        data-selected={selected}
        aria-current={selected ? 'true' : undefined}
        className="zw-seat"
      >
        <span className="zw-avatar" data-muted={!a.is_active}>
          {initials(a.profile?.full_name || a.zoom_account_email || '?')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold">
              {a.profile?.full_name || 'Unassigned seat'}
            </span>
            <span className="zw-meta shrink-0 capitalize">{a.tier}</span>
          </span>
          <span className="zw-meta mt-0.5 block truncate">{a.zoom_account_email}</span>
          <span className="mt-1.5 flex items-center gap-2">
            <StatusLabel status={seat?.status} />
            <span className="zw-meta">
              {seat?.last_event_at
                ? formatDistanceToNow(new Date(seat.last_event_at), { addSuffix: true })
                : seat ? 'no activity' : ''}
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
      </button>
    );
  };

  // ── Detail surface ──────────────────────────────────────────────────────
  const DetailBody = ({ a }: { a: any }) => (
    <div className="space-y-6">
      {/* Identity header — anchors the workspace */}
      <div className="zw-card zw-inset-top zw-raised zw-accent-edge px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <span className="zw-avatar zw-avatar-lg" data-muted={!a.is_active}>
              {initials(a.profile?.full_name || a.zoom_account_email || '?')}
            </span>
            <div className="min-w-0">
              <p className="zw-eyebrow">Teacher seat</p>
              <h3 className="zw-h2 mt-1 truncate text-xl">
                {a.profile?.full_name || 'Unassigned seat'}
              </h3>
              <p className="zw-meta truncate">{a.zoom_account_email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusLabel status={detailHealth?.status} />
                <span className="zw-chip capitalize" data-tone="brass"><span className="zw-dot" />{a.tier} tier</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <Switch
                checked={Boolean(a.is_active)}
                onCheckedChange={(v) => toggleActiveMut.mutate({ id: a.id, is_active: v })}
                aria-label="Toggle seat active"
              />
              <span className={cn('text-sm font-medium', !a.is_active && 'opacity-60')}>
                {a.is_active ? 'Active' : 'Disabled'}
              </span>
            </label>
            {/* contextual primary action for this seat */}
            {a.meeting_link ? (
              <Button size="sm" asChild className="zw-btn-primary gap-2">
                <a href={a.meeting_link} target="_blank" rel="noreferrer"><Video className="h-4 w-4" /> Open room</a>
              </Button>
            ) : (
              <Button size="sm" className="zw-btn-primary gap-2" onClick={() => openEditLink(a)}>
                <Pencil className="h-4 w-4" /> Add join link
              </Button>
            )}
          </div>
        </div>
      </div>



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

      {/* Connection */}
      <section className="space-y-1">
        <SectionTitle>Connection</SectionTitle>
        <dl className="divide-y divide-border/60">
          <Field label="Server-to-Server app">
            {detailHealth ? (detailHealth.has_credentials ? 'Credentials stored' : 'Not set') : '—'}
          </Field>
          <Field label="Last validated">
            {a.last_validated_at ? format(new Date(a.last_validated_at), 'MMM d, HH:mm') : 'Never'}
          </Field>
          <Field label="Webhook events">
            {detailHealth ? `${detailHealth.event_count} received` : '—'}
          </Field>
          <Field label="Last event">
            {detailHealth?.last_event_at
              ? formatDistanceToNow(new Date(detailHealth.last_event_at), { addSuffix: true })
              : 'Never'}
          </Field>
        </dl>
      </section>

      {/* Meeting access */}
      <section className="space-y-3">
        <SectionTitle>Meeting access</SectionTitle>
        {a.meeting_link ? (
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted/60 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
              {a.meeting_link}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { navigator.clipboard.writeText(a.meeting_link); toast({ title: 'Join link copied' }); }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No shareable join link yet.</p>
        )}
        {a.meeting_passcode && (
          <p className="text-xs text-muted-foreground">Passcode · {a.meeting_passcode}</p>
        )}
        <Button variant="outline" size="sm" className="gap-2" onClick={() => openEditLink(a)}>
          <Pencil className="h-4 w-4" /> Edit join link
        </Button>
      </section>

      {/* Diagnostics — quiet, technical */}
      <section className="space-y-1">
        <SectionTitle>Diagnostics</SectionTitle>
        <dl className="divide-y divide-border/60">
          <Field label="Host ID">
            <span className="font-mono text-[11px] text-muted-foreground">
              {detailHealth?.host_id || a.zoom_user_id || '—'}
            </span>
          </Field>
          <Field label="Seat ID">
            <span className="font-mono text-[11px] text-muted-foreground">{a.id}</span>
          </Field>
        </dl>
      </section>

      {/* Action bar — frequent actions inline, destructive behind overflow */}
      <div className="flex items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => healthRun.mutate(false)} disabled={healthRun.isPending}>
          {healthRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Recheck
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => healthRun.mutate(true)} disabled={healthRun.isPending}>
          <Wrench className="h-4 w-4" /> Repair host ID
        </Button>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => openEditLink(a)}>
          <Pencil className="h-4 w-4" /> Edit link
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground" aria-label="More seat actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (confirm(`Remove dedicated Zoom account for ${a.profile?.full_name || 'this seat'}?`)) deleteMut.mutate(a.id);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Remove account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </div>
  );

  const wizardSteps = ['Teacher & tier', 'Zoom identity', 'App credentials', 'Verify & save'];

  return (
    <section className="space-y-5">
      {/* Header + toolbar hierarchy */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Zoom Accounts</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Every teacher’s dedicated Zoom seat — pick one to review its connection, room and diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                More <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={runSyncZoomUsers} disabled={syncing}>
                <RefreshCw className="mr-2 h-4 w-4" /> Sync Zoom users
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Bulk link accounts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => healthRun.mutate(true)} disabled={healthRun.isPending}>
                <Wrench className="mr-2 h-4 w-4" /> Repair host IDs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => healthRun.mutate(false)} disabled={healthRun.isPending}>
                <RefreshCw className="mr-2 h-4 w-4" /> Recheck all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Link account
          </Button>
        </div>
      </div>

      {/* Operational status rail — four segments, one line */}
      <div className="grid grid-cols-2 divide-border border-y border-border sm:grid-cols-4 sm:divide-x">
        {healthRun.isPending && !health ? (
          <div className="col-span-full py-4"><Skeleton className="h-6 w-72" /></div>
        ) : (
          <>
            <RailSegment value={totals.total} label="Seats" />
            <RailSegment value={totals.healthy} label="Healthy" dot="bg-emerald-500" />
            <RailSegment
              value={totals.attention}
              label="Needs attention"
              dot={totals.attention ? 'bg-amber-500' : 'bg-muted-foreground/40'}
            />
            <RailSegment value={spareCount ?? 0} label="Spares" />
          </>
        )}
      </div>


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

      {/* ── Master / detail ─────────────────────────────────────────────── */}
      {isError ? (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-destructive">We couldn’t load the Zoom seats</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{(error as any)?.message}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : (
        <div className="lg:grid lg:h-[calc(100vh-24rem)] lg:min-h-[560px] lg:grid-cols-[34%_66%] lg:gap-0">
          {/* LEFT — seat list (independent scroll) */}
          <div className="flex min-h-0 flex-col lg:border-r lg:border-border">
            <div className="space-y-3 px-0 pb-4 lg:pr-5">

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search teacher or Zoom email"
                  className="h-9 border-none bg-muted/50 pl-9 shadow-none focus-visible:ring-1"
                  aria-label="Search Zoom seats"
                />
              </div>
              <div className="-mx-1 flex flex-wrap gap-1" role="tablist" aria-label="Filter by health">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                      filter === f.id
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="-mx-4 min-h-0 flex-1 divide-y divide-border/60 lg:mx-0 lg:overflow-y-auto">
              {isLoading ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="px-4 py-3"><Skeleton className="h-12 w-full" /></div>
                ))
              ) : rows.length === 0 ? (
                <div className="px-4 py-14 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {(accounts || []).length === 0 ? 'No Zoom seats yet' : 'No seats match this view'}
                  </p>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
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
                rows.map((a: any) => <SeatRow key={a.id} a={a} />)
              )}
            </div>
          </div>

          {/* RIGHT — detail workspace (independent scroll) */}
          <div className="hidden min-h-0 lg:block lg:overflow-y-auto lg:pb-6 lg:pl-8">
            {detail ? (
              <DetailBody a={detail} />
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center">
                <p className="max-w-xs text-center text-sm text-muted-foreground">
                  Select a seat to see its connection, meeting access and diagnostics.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* System configuration — tiny inline row */}
      {health?.webhook_url && (
        <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          <span>System webhook configured</span>
          <code className="hidden min-w-0 flex-1 truncate font-mono text-[11px] sm:block">{health.webhook_url}</code>
          <button type="button" onClick={copyWebhook} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
      )}


      {/* Mobile — full-screen detail sheet */}
      <Sheet open={Boolean(isMobile && detail)} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-full">
          {detail && (
            <div className="p-4 pt-5">
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> All seats
              </button>
              <DetailBody a={detail} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Link account wizard ─────────────────────────────────────────── */}
      <BulkLinkZoomAccountsDialog open={bulkOpen} onOpenChange={setBulkOpen} teachers={(teachers || []) as any} />

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link a dedicated Zoom account</DialogTitle>
            <DialogDescription>
              We validate the Server-to-Server credentials with Zoom, resolve the host ID, and save the account as this
              teacher’s own room.
            </DialogDescription>
          </DialogHeader>

          {/* Step rail */}
          <ol className="flex items-center gap-2 border-y border-border py-3 text-xs">
            {wizardSteps.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              return (
                <li key={label} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(n)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors',
                      n === step ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                      n === step ? 'bg-foreground text-background' : done ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground',
                    )}>
                      {done ? <Check className="h-3 w-3" /> : n}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                  {n < wizardSteps.length && <span className="h-px w-3 bg-border" />}
                </li>
              );
            })}
          </ol>

          <div className="min-h-[220px] py-2">
            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
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
            )}

            {step === 2 && (
              <div className="space-y-4">
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
            )}

            {step === 3 && (
              <div className="grid gap-4 sm:grid-cols-2">
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
            )}

            {step === 4 && (
              <div className="space-y-4">
                <dl className="divide-y divide-border/60 text-sm">
                  <Field label="Teacher">
                    {(teachers || []).find((t: any) => t.id === form.teacher_id)?.full_name || '—'}
                  </Field>
                  <Field label="Tier"><span className="capitalize">{form.tier}</span></Field>
                  <Field label="Zoom host email">{form.zoom_email || '—'}</Field>
                  <Field label="Credentials">{form.client_secret ? 'Provided' : 'Missing'}</Field>
                </dl>

                {validateResult && (
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
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => (step === 1 ? setAddOpen(false) : setStep(step - 1))}
              disabled={validating}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)}>Continue</Button>
            ) : (
              <Button onClick={runValidateAndSave} disabled={!canSubmit || validating}>
                {validating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validating &amp; saving…</> : 'Validate & Save'}
              </Button>
            )}
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
