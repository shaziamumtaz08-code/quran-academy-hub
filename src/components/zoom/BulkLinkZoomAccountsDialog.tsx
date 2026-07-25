import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';

interface Teacher { id: string; full_name?: string | null; email?: string | null }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teachers: Teacher[];
}

interface Row {
  zoomEmail: string;
  teacherId: string;
  tier: 'free' | 'licensed';
  status?: 'ok' | 'fail';
  detail?: string;
}

/**
 * Bulk-link multiple teacher Zoom accounts.
 * Step 1: S2S credentials + paste Zoom host emails (one per line).
 * Step 2: map each Zoom email to an LMS teacher (auto-matched where possible), then link.
 */
export function BulkLinkZoomAccountsDialog({ open, onOpenChange, teachers }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [creds, setCreds] = React.useState({ account_id: '', client_id: '', client_secret: '' });
  const [defaultTier, setDefaultTier] = React.useState<'free' | 'licensed'>('free');
  const [raw, setRaw] = React.useState('');
  const [rows, setRows] = React.useState<Row[]>([]);
  const [running, setRunning] = React.useState(false);

  const autoMatch = (zoomEmail: string, hint?: string): string => {
    const keys = [hint, zoomEmail].filter(Boolean).map((k) => String(k).trim().toLowerCase());
    for (const k of keys) {
      const exact = teachers.find(
        (t) => (t.email || '').toLowerCase() === k || (t.full_name || '').toLowerCase() === k
      );
      if (exact) return exact.id;
    }
    // loose: compare the email local-part against teacher name/email local-part
    const local = zoomEmail.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
    if (local.length >= 4) {
      const loose = teachers.find((t) => {
        const name = (t.full_name || '').toLowerCase().replace(/[^a-z]/g, '');
        const mail = (t.email || '').split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
        return (name && (name.includes(local) || local.includes(name))) || (mail && mail === local);
      });
      if (loose) return loose.id;
    }
    return '';
  };

  const parse = () => {
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed: Row[] = lines.map((line) => {
      const parts = line.split(/[,\t;]/).map((p) => p.trim()).filter(Boolean);
      const emails = parts.filter((p) => p.includes('@'));
      const zoomEmail = emails.length > 1 ? emails[1] : emails[0] || parts[0] || '';
      const hint = emails.length > 1 ? emails[0] : parts.find((p) => !p.includes('@') && !/^(free|licensed)$/i.test(p));
      const tierPart = parts.find((p) => /^(free|licensed)$/i.test(p));
      return {
        zoomEmail,
        teacherId: autoMatch(zoomEmail, hint),
        tier: (tierPart?.toLowerCase() as 'free' | 'licensed') || defaultTier,
      };
    });
    setRows(parsed);
    setStep(2);
  };

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const run = async () => {
    setRunning(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sienlnxwwdqnybugipdt';

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.teacherId) {
          updateRow(i, { status: 'fail', detail: 'Pick an LMS teacher for this Zoom email' });
          continue;
        }
        try {
          const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/zoom-validate-account`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              ...creds,
              zoom_email: row.zoomEmail,
              teacher_id: row.teacherId,
              tier: row.tier,
              save: true,
            }),
          });
          const body = await resp.json();
          updateRow(i, {
            status: body?.ok && body?.saved ? 'ok' : 'fail',
            detail: body?.verdict || body?.error || 'Unknown response',
          });
        } catch (e: any) {
          updateRow(i, { status: 'fail', detail: e.message });
        }
      }
      qc.invalidateQueries({ queryKey: ['zoom-accounts-list'] });
      toast({ title: 'Bulk link finished', description: 'Check each row for its result.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setStep(1);
    setRows([]);
    setRaw('');
  };

  const canParse = creds.account_id && creds.client_id && creds.client_secret && raw.trim().length > 0;
  const canRun = rows.length > 0 && rows.every((r) => r.teacherId && r.zoomEmail);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Link Zoom Accounts</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Enter your S2S credentials once, then paste one Zoom host email per line.'
              : 'Confirm which LMS teacher owns each Zoom email, then link them all.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Account ID</Label>
                <Input value={creds.account_id} onChange={(e) => setCreds({ ...creds, account_id: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Client ID</Label>
                <Input value={creds.client_id} onChange={(e) => setCreds({ ...creds, client_id: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Client Secret</Label>
                <Input type="password" value={creds.client_secret} onChange={(e) => setCreds({ ...creds, client_secret: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Default Tier</Label>
                <Select value={defaultTier} onValueChange={(v: 'free' | 'licensed') => setDefaultTier(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free (1:1)</SelectItem>
                    <SelectItem value="licensed">Licensed (Group)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Zoom host emails — one per line</Label>
              <Textarea
                rows={7}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className="font-mono text-xs"
                placeholder={"alqurantime111@gmail.com\nalqurantimeexam1@gmail.com"}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                You'll pick the LMS teacher for each email on the next step. Optionally add the teacher
                and tier on the same line: <code>Shazia Mumtaz, zoomhost@gmail.com, free</code>
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 py-2">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center border rounded-md p-2">
                <div className="text-xs font-mono truncate">{row.zoomEmail}</div>
                <Select value={row.teacherId} onValueChange={(v) => updateRow(i, { teacherId: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select LMS teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name || t.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={row.tier} onValueChange={(v: 'free' | 'licensed') => updateRow(i, { tier: v })}>
                  <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="licensed">Licensed</SelectItem>
                  </SelectContent>
                </Select>
                {row.status && (
                  <div className="sm:col-span-3 flex items-start gap-2 text-xs">
                    {row.status === 'ok'
                      ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                    <span className="text-muted-foreground">{row.detail}</span>
                  </div>
                )}
              </div>
            ))}
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">No emails found — go back and paste at least one.</p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="ghost" onClick={() => setStep(1)} disabled={running} className="mr-auto gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {step === 1 ? (
            <Button onClick={parse} disabled={!canParse}>Continue</Button>
          ) : (
            <Button onClick={run} disabled={!canRun || running}>
              {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Linking…</> : 'Validate & Link All'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
