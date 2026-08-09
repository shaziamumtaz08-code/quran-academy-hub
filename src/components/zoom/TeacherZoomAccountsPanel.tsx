import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, CheckCircle2, XCircle, Trash2, Video, UserCheck, ShieldCheck, Upload, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { BulkLinkZoomAccountsDialog } from './BulkLinkZoomAccountsDialog';
import { ZoomSeatStatusTable } from './ZoomSeatStatusTable';


/**
 * Dedicated Zoom Accounts (per-teacher).
 * Replaces the shared Room 1/Room 2 pool. Admin validates + saves one Zoom
 * account per teacher per tier (free for 1:1, licensed for Group Academy).
 * Once saved, the teacher's own account handles all live sessions natively.
 */
export function TeacherZoomAccountsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);

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

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['zoom-accounts-list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zoom_accounts')
        .select('id, teacher_id, zoom_account_email, zoom_user_id, tier, meeting_link, is_active, last_validated_at, created_at, profile:profiles!zoom_accounts_teacher_id_fkey(id, full_name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('zoom_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Zoom account removed' });
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
          title: '✅ Verified — host ID resolved',
          description: `Host ID ${body.resolved?.host_id} saved for this teacher's ${form.tier} seat.`,
        });
      } else {
        toast({
          title: '❌ Save failed verification',
          description: body?.failure_reason || body?.verdict || body?.error || 'Zoom rejected this setup.',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      setValidateResult({ ok: false, verdict: e.message, failure_reason: e.message });
      toast({ title: '❌ Save failed', description: e.message, variant: 'destructive' });
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


  return (
    <div className="space-y-6">
    <ZoomSeatStatusTable />
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Teacher Zoom Accounts
          </CardTitle>
          <CardDescription>
            Dedicated per-teacher Zoom accounts. Replaces the shared Room 1/Room 2 pool.
            Each teacher can have one Free (1:1) and one Licensed (Group) account.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={runSyncZoomUsers} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync Zoom Users
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setBulkOpen(true)}>
          <Upload className="h-4 w-4" /> Bulk Link
        </Button>
        <BulkLinkZoomAccountsDialog open={bulkOpen} onOpenChange={setBulkOpen} teachers={(teachers || []) as any} />
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Link Account</Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Link Dedicated Zoom Account</DialogTitle>
              <DialogDescription>
                Validates the S2S credentials against Zoom, resolves the host ID, and saves the account
                as the teacher's dedicated room. No pool assignment needed.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
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
                <div>
                  <Label className="text-xs">Tier</Label>
                  <Select value={form.tier} onValueChange={(v: 'free' | 'licensed') => setForm({ ...form, tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free (1:1 Mentorship — 40 min cap for 3+)</SelectItem>
                      <SelectItem value="licensed">Licensed (Group Academy — no time cap)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Zoom Host Email</Label>
                  <Input value={form.zoom_email} onChange={(e) => setForm({ ...form, zoom_email: e.target.value })} placeholder="teacher@aqta.example" />
                </div>
                <div>
                  <Label className="text-xs">Account ID</Label>
                  <Input value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Client ID</Label>
                  <Input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Client Secret</Label>
                  <Input type="password" value={form.client_secret} onChange={(e) => setForm({ ...form, client_secret: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Personal Meeting Link (optional — defaults to Zoom user's PMI)</Label>
                  <Input value={form.personal_meeting_link} onChange={(e) => setForm({ ...form, personal_meeting_link: e.target.value })} placeholder="https://zoom.us/j/1234567890" />
                </div>
              </div>

              {validateResult && (
                <Alert variant={validateResult.ok ? 'default' : 'destructive'}>
                  {validateResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <AlertTitle className="text-sm">
                    {validateResult.ok
                      ? `✅ Verified — host ID ${validateResult.resolved?.host_id || 'resolved'}`
                      : '❌ Failed — credentials were NOT verified'}
                  </AlertTitle>
                  <AlertDescription className="text-xs whitespace-pre-wrap space-y-1">
                    <p>{validateResult.failure_reason || validateResult.verdict || validateResult.error}</p>
                    {!validateResult.ok && validateResult.stored_unverified && (
                      <p className="font-medium">
                        The credentials you typed were stored and flagged as “Failed” so you don't have to retype them —
                        fix the Zoom app, then press Validate &amp; Save again.
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Close</Button>
              <Button onClick={runValidateAndSave} disabled={!canSubmit || validating}>
                {validating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating &amp; Saving…</> : 'Validate & Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>

      </CardHeader>
      <CardContent className="space-y-4">
        {syncResult && (
          <Alert variant={syncResult.success ? 'default' : 'destructive'}>
            {syncResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <AlertTitle className="text-sm">
              {syncResult.success
                ? `Synced ${syncResult.zoom_user_count} Zoom users`
                : 'Zoom sync failed'}
            </AlertTitle>
            <AlertDescription className="text-xs space-y-2">
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

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
          </div>
        ) : (accounts || []).length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No dedicated Zoom accounts yet. Link one to migrate a teacher off the shared pool.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Zoom Email</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Host ID</TableHead>
                <TableHead>Last Validated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(accounts || []).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    {a.profile?.full_name || 'Unknown teacher'}
                  </TableCell>
                  <TableCell className="text-xs">{a.zoom_account_email}</TableCell>
                  <TableCell>
                    <Badge variant={a.tier === 'licensed' ? 'default' : 'secondary'}>{a.tier}</Badge>
                  </TableCell>
                  <TableCell className="text-[10px] font-mono truncate max-w-[120px]">{a.zoom_user_id}</TableCell>
                  <TableCell className="text-xs">
                    {a.last_validated_at ? format(new Date(a.last_validated_at), 'MMM d, HH:mm') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={a.is_active ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleActiveMut.mutate({ id: a.id, is_active: !a.is_active })}
                    >
                      {a.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {a.meeting_link && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={a.meeting_link} target="_blank" rel="noreferrer"><Video className="h-4 w-4" /></a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Remove dedicated Zoom account for ${a.profile?.full_name}?`)) deleteMut.mutate(a.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
