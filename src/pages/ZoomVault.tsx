import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Eye, Plus, ShieldCheck, KeyRound, Download } from 'lucide-react';
import { format } from 'date-fns';

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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Zoom Vault
          </h1>
          <p className="text-sm text-muted-foreground">
            Encrypted credential store for every Zoom seat. Password reveals are logged.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={importing} onClick={runImport}>
            <Download className="h-4 w-4 mr-1" /> {importing ? 'Importing…' : 'Import Zoom accounts'}
          </Button>
          <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add account
          </Button>
        </div>
      </div>

      {accounts.length === 0 && (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            The vault is empty. Click <strong>Import Zoom accounts</strong> to pull every active Zoom seat already
            configured in the LMS — seats linked to a teacher become <em>dedicated</em>, and paid seats with no teacher
            join the <em>shared pool</em> with cloud recording on.
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="shared">Shared</TabsTrigger>
          <TabsTrigger value="dedicated">Dedicated</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
          <TabsTrigger value="log">Access log</TabsTrigger>
        </TabsList>

        {['all', 'shared', 'dedicated', 'unassigned'].map(t => (
          <TabsContent key={t} value={t}>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Zoom email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Pool</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
                    {!isLoading && filtered.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No accounts yet — add your first Zoom seat.</TableCell></TableRow>
                    )}
                    {filtered.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.label}</TableCell>
                        <TableCell>{a.zoom_email}</TableCell>
                        <TableCell>
                          <Badge variant={a.account_type === 'paid' ? 'default' : 'secondary'}>
                            {a.account_type === 'paid' ? 'Paid' : 'Free'}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{a.pool_assignment}</TableCell>
                        <TableCell>{teacherName(a.assigned_teacher_id)}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === 'active' ? 'outline' : 'destructive'} className="capitalize">
                            {a.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => setViewing(a)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(a)}>Edit</Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Delete vault account "${a.label}"? This cannot be undone.`)) remove.mutate(a.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="log">
          <Card>
            <CardHeader><CardTitle className="text-base">Credential access log</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
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
                      <TableCell>{format(new Date(l.viewed_at), 'dd MMM yyyy, HH:mm')}</TableCell>
                      <TableCell>{accounts.find(a => a.id === l.vault_account_id)?.label ?? '—'}</TableCell>
                      <TableCell className="capitalize">{String(l.viewed_field).replace('_', ' ')}</TableCell>
                      <TableCell>{teacherName(l.viewed_by_user_id)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
