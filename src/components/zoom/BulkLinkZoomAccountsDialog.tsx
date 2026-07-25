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
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface Teacher { id: string; full_name?: string | null; email?: string | null }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teachers: Teacher[];
}

type RowResult = { line: string; ok: boolean; detail: string };

/**
 * Bulk-link multiple teacher Zoom accounts in one pass.
 * Paste one line per teacher: lmsEmailOrName, zoomHostEmail[, tier]
 * S2S credentials are entered once and reused for every row.
 */
export function BulkLinkZoomAccountsDialog({ open, onOpenChange, teachers }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [creds, setCreds] = React.useState({ account_id: '', client_id: '', client_secret: '' });
  const [defaultTier, setDefaultTier] = React.useState<'free' | 'licensed'>('free');
  const [raw, setRaw] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const [results, setResults] = React.useState<RowResult[]>([]);

  const findTeacher = (key: string): Teacher | undefined => {
    const k = key.trim().toLowerCase();
    return teachers.find(
      (t) => (t.email || '').toLowerCase() === k || (t.full_name || '').toLowerCase() === k
    );
  };

  const run = async () => {
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setRunning(true);
    setResults([]);
    const out: RowResult[] = [];
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sienlnxwwdqnybugipdt';

      for (const line of lines) {
        const parts = line.split(/[,\t;]/).map((p) => p.trim());
        const [teacherKey, zoomEmail, tierRaw] = parts;
        const teacher = teacherKey ? findTeacher(teacherKey) : undefined;
        if (!teacher) {
          out.push({ line, ok: false, detail: `No LMS teacher matched "${teacherKey}"` });
          setResults([...out]);
          continue;
        }
        if (!zoomEmail) {
          out.push({ line, ok: false, detail: 'Missing Zoom host email' });
          setResults([...out]);
          continue;
        }
        const tier = tierRaw?.toLowerCase() === 'licensed' ? 'licensed' : tierRaw?.toLowerCase() === 'free' ? 'free' : defaultTier;
        try {
          const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/zoom-validate-account`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ ...creds, zoom_email: zoomEmail, teacher_id: teacher.id, tier, save: true }),
          });
          const body = await resp.json();
          out.push({
            line: `${teacher.full_name || teacher.email} → ${zoomEmail} (${tier})`,
            ok: !!(body?.ok && body?.saved),
            detail: body?.verdict || body?.error || 'Unknown response',
          });
        } catch (e: any) {
          out.push({ line, ok: false, detail: e.message });
        }
        setResults([...out]);
      }
      const okCount = out.filter((r) => r.ok).length;
      toast({ title: 'Bulk link finished', description: `${okCount} of ${out.length} accounts linked.` });
      qc.invalidateQueries({ queryKey: ['zoom-accounts-list'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const canRun = creds.account_id && creds.client_id && creds.client_secret && raw.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Link Zoom Accounts</DialogTitle>
          <DialogDescription>
            Enter your S2S credentials once, then paste one teacher per line. Each row is validated
            against Zoom and saved as that teacher's dedicated room.
          </DialogDescription>
        </DialogHeader>

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
            <Label className="text-xs">
              Teachers — one per line: LMS email or full name, Zoom host email, tier (optional)
            </Label>
            <Textarea
              rows={7}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="font-mono text-xs"
              placeholder={"shazia@aqta.test, shazia@zoomacct.com, free\nAyesha Salahuddin, ayesha@zoomacct.com"}
            />
          </div>

          {results.length > 0 && (
            <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-2 text-xs">
                  {r.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.line}</div>
                    <div className="text-muted-foreground">{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={run} disabled={!canRun || running}>
            {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Linking…</> : 'Validate & Link All'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
