import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Eye, Plus, KeyRound, Download, Trash2, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type Assignment = 'shared' | 'dedicated' | 'unassigned';

interface VaultAccount {
  id: string;
  label: string;
  zoom_email: string;
  google_email: string | null;
  pmi: string | null;
  passcode: string | null;
  host_key: string | null;
  account_type: 'paid' | 'free';
  pool_assignment: Assignment;
  assigned_teacher_id: string | null;
  auto_record: boolean;
  status: 'active' | 'disabled' | 'locked_out';
  zoom_password_secret_id: string | null;
  google_password_secret_id: string | null;
  zoom_account_id: string | null;
}

const emptyForm = {
  label: '',
  zoom_email: '',
  zoom_password: '',
  google_email: '',
  google_password: '',
  pmi: '',
  passcode: '',
  host_key: '',
  account_type: 'free' as 'paid' | 'free',
  pool_assignment: 'unassigned' as Assignment,
  assigned_teacher_id: '',
  auto_record: false,
  status: 'active' as VaultAccount['status'],
};

export default function ZoomVault() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VaultAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<VaultAccount | null>(null);
  const [importing, setImporting] = useState(false);

  const runImport = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.rpc('sync_vault_from_zoom_accounts' as any);
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      toast({
        title: 'Zoom accounts imported',
        description: `${row?.imported ?? 0} added, ${row?.updated ?? 0} updated.`,
      });
      qc.invalidateQueries({ queryKey: ['zoom-vault-accounts'] });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['zoom-vault-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_vault_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as VaultAccount[];
    },
  });

  const { data: zoomAccounts = [] } = useQuery({
    queryKey: ['zoom-vault-linked-accounts'],
    queryFn: async () => {
      const { data } = await supabase.from('zoom_accounts').select('id, teacher_id, zoom_account_email');
      return (data ?? []) as { id: string; teacher_id: string | null; zoom_account_email: string | null }[];
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['zoom-vault-teachers'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
      return (data ?? []) as { id: string; full_name: string | null }[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['zoom-vault-access-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_vault_access_log')
        .select('id, viewed_field, viewed_at, viewed_by_user_id, vault_account_id')
        .order('viewed_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  const teacherName = (id: string | null) =>
    teachers.find(t => t.id === id)?.full_name ?? '—';

  // Teacher shown for a vault row is driven by the FK link to zoom_accounts when present,
  // falling back to the legacy assigned_teacher_id text only for unlinked rows.
  const linkedTeacherId = (a: VaultAccount) => {
    if (!a.zoom_account_id) return null;
    return zoomAccounts.find(z => z.id === a.zoom_account_id)?.teacher_id ?? null;
  };
  const rowTeacherId = (a: VaultAccount) => linkedTeacherId(a) ?? a.assigned_teacher_id;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        label: form.label,
        zoom_email: form.zoom_email,
        google_email: form.google_email || null,
        pmi: form.pmi || null,
        passcode: form.passcode || null,
        host_key: form.host_key || null,
        account_type: form.account_type,
        pool_assignment: form.pool_assignment,
        assigned_teacher_id: form.assigned_teacher_id || null,
        auto_record: form.auto_record,
        status: form.status,
      };
      let id = editing?.id;
      if (editing) {
        const { error } = await supabase.from('zoom_vault_accounts').update(payload as any).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('zoom_vault_accounts').insert(payload as any).select('id').single();
        if (error) throw error;
        id = (data as any).id;
      }
      if (form.zoom_password) {
        const { error } = await supabase.rpc('set_vault_password' as any, {
          _account_id: id, _field: 'zoom_password', _password: form.zoom_password,
        });
        if (error) throw error;
      }
      if (form.google_password) {
        const { error } = await supabase.rpc('set_vault_password' as any, {
          _account_id: id, _field: 'google_password', _password: form.google_password,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? 'Account updated' : 'Account added' });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ['zoom-vault-accounts'] });
    },
    onError: (e: any) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('zoom_vault_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Vault account deleted' });
      setViewing(null);
      qc.invalidateQueries({ queryKey: ['zoom-vault-accounts'] });
    },
    onError: (e: any) => toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }),
  });

  const reveal = async (accountId: string, field: 'zoom_password' | 'google_password') => {
    const { data, error } = await supabase.rpc('reveal_vault_password' as any, { account_id: accountId, field });
    if (error) {
      toast({ title: 'Reveal blocked', description: error.message, variant: 'destructive' });
      return;
    }
    if (!data) {
      toast({ title: 'No password stored for this field' });
      return;
    }
    const key = `${accountId}:${field}`;
    setRevealed(prev => ({ ...prev, [key]: data as string }));
    qc.invalidateQueries({ queryKey: ['zoom-vault-access-log'] });
    setTimeout(() => {
      setRevealed(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 10000);
  };

  const startEdit = (a: VaultAccount) => {
    setEditing(a);
    setForm({
      ...emptyForm,
      label: a.label,
      zoom_email: a.zoom_email,
      google_email: a.google_email ?? '',
      pmi: a.pmi ?? '',
      passcode: a.passcode ?? '',
      host_key: a.host_key ?? '',
      account_type: a.account_type,
      pool_assignment: a.pool_assignment,
      assigned_teacher_id: a.assigned_teacher_id ?? '',
      auto_record: a.auto_record,
      status: a.status,
    });
    setOpen(true);
  };

  const filtered = accounts.filter(a =>
    ['all', 'log'].includes(tab) ? true : a.pool_assignment === tab
  );

  const FILTERS = [
    { id: 'all', label: 'All', count: accounts.length },
    { id: 'shared', label: 'Shared', count: accounts.filter(a => a.pool_assignment === 'shared').length },
    { id: 'dedicated', label: 'Dedicated', count: accounts.filter(a => a.pool_assignment === 'dedicated').length },
    { id: 'unassigned', label: 'Unassigned', count: accounts.filter(a => a.pool_assignment === 'unassigned').length },
    { id: 'log', label: 'Access log', count: logs.length },
  ];

  return (
    <div className="zoom-ws mx-auto max-w-[1400px] space-y-6 py-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="zw-eyebrow">Asset inventory</p>
          <h1 className="zw-h2 mt-1.5 text-xl">Zoom Vault</h1>
          <p className="zw-body mt-1">
            Encrypted credential store for every Zoom seat. Password reveals are logged.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="zw-btn-secondary" disabled={importing} onClick={runImport}>
            <Download className="h-4 w-4 mr-1" /> {importing ? 'Importing…' : 'Import Zoom accounts'}
          </Button>
          <Button className="zw-btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add account
          </Button>
        </div>
      </div>

      {accounts.length === 0 && !isLoading && (
        <div className="zw-card px-6 py-10 text-center zw-body">
          The vault is empty. Click <strong>Import Zoom accounts</strong> to pull every active Zoom seat already
          configured in the LMS — seats linked to a teacher become <em>dedicated</em>, and paid seats with no teacher
          join the <em>shared pool</em> with cloud recording on.
        </div>
      )}

      <div className="zw-nav w-fit max-w-full flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTab(f.id)}
            data-active={tab === f.id}
            className="zw-nav-item !px-3.5 !py-1.5 !text-xs"
          >
            {f.label} <span className="ml-1 tabular-nums opacity-60">{f.count}</span>
          </button>
        ))}
      </div>

      {tab !== 'log' && (
        <>
          <div className="zw-rail">
            {[
              { label: 'Seats in vault', value: accounts.length, tone: 'quiet' },
              { label: 'Active seats', value: accounts.filter(a => a.zoom_account_id).length, tone: 'sage' },
              { label: 'Spare seats', value: accounts.filter(a => !a.zoom_account_id && a.status === 'active').length, tone: 'brass' },
              { label: 'Needs attention', value: accounts.filter(a => a.status !== 'active').length, tone: 'warn' },
            ].map(m => (
              <div key={m.label} className="zw-rail-seg">
                <p className="zw-eyebrow">{m.label}</p>
                <p className="zw-rail-value mt-2">{m.value}</p>
                <span className="zw-metric-rule mt-3 block" data-tone={m.tone} />
              </div>
            ))}
          </div>

          {isLoading && <p className="zw-body">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <div className="zw-card flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="zw-motif" />
              <p className="zw-body">No accounts in this view — add your first Zoom seat.</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(a => (
              <article
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => setViewing(a)}
                onKeyDown={(e) => { if (e.key === 'Enter') setViewing(a); }}
                className="zw-card zw-interactive cursor-pointer p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="zw-avatar" data-muted={!a.zoom_account_id}>
                      {a.label.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.label}</p>
                      <p className="zw-meta truncate">{a.zoom_email}</p>
                    </div>
                  </div>
                  <span className="zw-chip shrink-0 capitalize" data-tone={a.status === 'active' ? 'ok' : 'live'}>
                    <span className="zw-dot" />{a.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <span className="zw-chip" data-tone={a.zoom_account_id ? 'ok' : 'brass'}>
                    <span className="zw-dot" />{a.zoom_account_id ? 'Active seat' : 'Spare'}
                  </span>
                  <span className="zw-chip" data-tone={a.account_type === 'paid' ? 'brass' : 'quiet'}>
                    {a.account_type === 'paid' ? 'Paid' : 'Free'}
                  </span>
                  <span className="zw-chip capitalize" data-tone="quiet">{a.pool_assignment}</span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: 'hsl(var(--zw-line-soft))' }}>
                  <p className="zw-meta truncate">{teacherName(rowTeacherId(a)) || 'Unassigned'}</p>
                  <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" className="zw-btn-ghost" onClick={() => setViewing(a)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="zw-btn-ghost" onClick={() => startEdit(a)}>Edit</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="zw-btn-ghost"
                      onClick={() => {
                        if (confirm(`Delete vault account "${a.label}"? This cannot be undone.`)) remove.mutate(a.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}


      {tab === 'log' && (
        <div className="zw-table-wrap overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Viewed by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No reveals recorded yet.</TableCell></TableRow>}
              {logs.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap">{format(new Date(l.viewed_at), 'dd MMM yyyy, HH:mm')}</TableCell>
                  <TableCell>{accounts.find(a => a.id === l.vault_account_id)?.label ?? '—'}</TableCell>
                  <TableCell className="capitalize">{String(l.viewed_field).replace('_', ' ')}</TableCell>
                  <TableCell>{teacherName(l.viewed_by_user_id)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(viewing)} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewing?.label}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              {([
                ['Zoom email', viewing.zoom_email],
                ['Google email', viewing.google_email || '—'],
                ['PMI', viewing.pmi || '—'],
                ['Passcode', viewing.passcode || '—'],
                ['Host key', viewing.host_key || '—'],
                ['Type', viewing.account_type],
                ['Pool', viewing.pool_assignment],
                ['Teacher', teacherName(rowTeacherId(viewing))],
                ['Auto record', viewing.auto_record ? 'On' : 'Off'],
                ['Status', viewing.status.replace('_', ' ')],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 border-b border-border/50 py-1">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="text-right font-medium break-all">{v}</span>
                </div>
              ))}
              {viewing.pmi && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://zoom.us/j/${String(viewing.pmi).replace(/\D/g, '')}`);
                    toast({ title: 'Join link copied' });
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy join link
                </Button>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => reveal(viewing.id, 'zoom_password')}>
                  <KeyRound className="h-4 w-4 mr-1" /> Reveal Zoom password
                </Button>
                <Button variant="outline" size="sm" onClick={() => reveal(viewing.id, 'google_password')}>
                  <KeyRound className="h-4 w-4 mr-1" /> Reveal Google password
                </Button>
              </div>
              {(['zoom_password', 'google_password'] as const).map(f => {
                const val = revealed[`${viewing.id}:${f}`];
                return val ? (
                  <p key={f} className="font-mono text-xs bg-muted rounded px-2 py-1">
                    {f.replace('_', ' ')}: {val} <span className="text-muted-foreground">(hides in 10s)</span>
                  </p>
                ) : null;
              })}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => viewing && confirm(`Delete "${viewing.label}"?`) && remove.mutate(viewing.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const a = viewing; setViewing(null); if (a) startEdit(a); }}>Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Zoom account' : 'Add Zoom account'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Label</Label>
              <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Pool Seat 1 - Paid" />
            </div>
            <div>
              <Label>Zoom email</Label>
              <Input value={form.zoom_email} onChange={e => setForm({ ...form, zoom_email: e.target.value })} />
            </div>
            <div>
              <Label>Zoom password</Label>
              <div className="flex gap-2">
                <Input
                  type={revealed[`${editing?.id}:zoom_password`] ? 'text' : 'password'}
                  value={revealed[`${editing?.id}:zoom_password`] ?? form.zoom_password}
                  onChange={e => setForm({ ...form, zoom_password: e.target.value })}
                  placeholder={editing?.zoom_password_secret_id ? '•••••••• stored' : 'Enter password'}
                />
                {editing && (
                  <Button type="button" variant="outline" size="icon" onClick={() => reveal(editing.id, 'zoom_password')}>
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label>Google email</Label>
              <Input value={form.google_email} onChange={e => setForm({ ...form, google_email: e.target.value })} />
            </div>
            <div>
              <Label>Google password</Label>
              <div className="flex gap-2">
                <Input
                  type={revealed[`${editing?.id}:google_password`] ? 'text' : 'password'}
                  value={revealed[`${editing?.id}:google_password`] ?? form.google_password}
                  onChange={e => setForm({ ...form, google_password: e.target.value })}
                  placeholder={editing?.google_password_secret_id ? '•••••••• stored' : 'Enter password'}
                />
                {editing && (
                  <Button type="button" variant="outline" size="icon" onClick={() => reveal(editing.id, 'google_password')}>
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div><Label>PMI</Label><Input value={form.pmi} onChange={e => setForm({ ...form, pmi: e.target.value })} /></div>
            <div><Label>Passcode</Label><Input value={form.passcode} onChange={e => setForm({ ...form, passcode: e.target.value })} /></div>
            <div><Label>Host key</Label><Input value={form.host_key} onChange={e => setForm({ ...form, host_key: e.target.value })} /></div>
            <div>
              <Label>Account type</Label>
              <Select value={form.account_type} onValueChange={(v: 'paid' | 'free') => setForm({ ...form, account_type: v, auto_record: v === 'paid' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="free">Free</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pool assignment</Label>
              <Select value={form.pool_assignment} onValueChange={(v: Assignment) => setForm({ ...form, pool_assignment: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="dedicated">Dedicated</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned teacher</Label>
              <Select value={form.assigned_teacher_id || 'none'} onValueChange={v => setForm({ ...form, assigned_teacher_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="none">None</SelectItem>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name ?? t.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: VaultAccount['status']) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="locked_out">Locked out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch checked={form.auto_record} onCheckedChange={v => setForm({ ...form, auto_record: v })} />
              <Label className="mb-0">Auto cloud recording</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.label || !form.zoom_email}>
              <KeyRound className="h-4 w-4 mr-1" /> {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
