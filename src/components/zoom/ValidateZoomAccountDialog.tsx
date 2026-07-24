import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Copy, TestTube2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * "Step Zero" validation before adding a Zoom account to the license pool.
 *
 * Verifies: OAuth token minting, user lookup, account tier (Basic vs Licensed),
 * and surfaces the webhook URL the admin must paste into the Marketplace app.
 *
 * This is intentionally read-only — it does NOT insert into zoom_licenses.
 * Once an account passes this test AND a webhook test event arrives, the
 * admin can safely add it via the normal "Add License" flow.
 */
export function ValidateZoomAccountDialog() {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [creds, setCreds] = React.useState({ account_id: '', client_id: '', client_secret: '', zoom_email: '' });
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
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
        body: JSON.stringify(creds),
      });
      const body = await resp.json();
      setResult(body);
    } catch (e: any) {
      setResult({ ok: false, verdict: e.message });
    } finally {
      setLoading(false);
    }
  };

  const copyWebhook = () => {
    const url = result?.resolved?.webhook_url;
    if (url) {
      navigator.clipboard.writeText(url);
      toast({ title: 'Webhook URL copied' });
    }
  };

  const reset = () => {
    setResult(null);
    setCreds({ account_id: '', client_id: '', client_secret: '', zoom_email: '' });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <TestTube2 className="h-4 w-4" /> Test Account (Step 0)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Validate Zoom S2S Account</DialogTitle>
          <DialogDescription>
            Run this on ONE new free Zoom account before bulk-adding a pool. Confirms credentials, account tier,
            and webhook capability before you invest time in the other accounts.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle className="text-sm">Before running this test</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p>
                  In the account's Zoom Marketplace, create a <b>Server-to-Server OAuth</b> app. New apps use <b>Granular Scopes</b>; older apps may still show Classic scopes. Add whichever version you see:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>
                    <b>User lookup:</b>{' '}
                    <code>user:read:user:admin</code> (Granular) or <code>user:read:admin</code> (Classic)
                  </li>
                  <li>
                    <b>Create / update / delete meetings:</b>{' '}
                    <code>meeting:write:meeting:admin</code>, <code>meeting:update:meeting:admin</code>, <code>meeting:delete:meeting:admin</code> (Granular) or{' '}
                    <code>meeting:write:admin</code> (Classic)
                  </li>
                  <li>
                    <b>Read meetings & participants:</b>{' '}
                    <code>meeting:read:meeting:admin</code>, <code>meeting:read:list_past_participants:admin</code>, <code>meeting:read:list_meetings:admin</code> (Granular) or{' '}
                    <code>meeting:read:admin</code>, <code>report:read:admin</code> (Classic)
                  </li>
                </ul>
                <p>Activate it, then paste the credentials below.</p>
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Zoom Email (host)</Label>
                <Input value={creds.zoom_email} onChange={(e) => setCreds({ ...creds, zoom_email: e.target.value })} placeholder="account@gmail.com" />
              </div>
              <div>
                <Label className="text-xs">Account ID</Label>
                <Input value={creds.account_id} onChange={(e) => setCreds({ ...creds, account_id: e.target.value })} placeholder="abc123..." />
              </div>
              <div>
                <Label className="text-xs">Client ID</Label>
                <Input value={creds.client_id} onChange={(e) => setCreds({ ...creds, client_id: e.target.value })} placeholder="xyz..." />
              </div>
              <div>
                <Label className="text-xs">Client Secret</Label>
                <Input type="password" value={creds.client_secret} onChange={(e) => setCreds({ ...creds, client_secret: e.target.value })} placeholder="••••••" />
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <Alert variant={result.ok ? 'default' : 'destructive'}>
              {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertTitle className="text-sm">{result.ok ? 'PASS' : 'FAIL'}</AlertTitle>
              <AlertDescription className="text-xs whitespace-pre-wrap">{result.verdict || result.error}</AlertDescription>
            </Alert>

            {result.checks?.map((c: any, i: number) => (
              <div key={i} className="rounded-md border border-border p-3 text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                  <span>{c.step}</span>
                  {c.data?.plan_label && <Badge variant="outline" className="text-[10px]">{c.data.plan_label}</Badge>}
                </div>
                {c.detail && <p className="mt-1 text-muted-foreground break-all">{c.detail}</p>}
                {c.data?.scopes && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.data.scopes.slice(0, 8).map((s: string) => <Badge key={s} variant="secondary" className="text-[9px]">{s}</Badge>)}
                    {c.data.scopes.length > 8 && <Badge variant="secondary" className="text-[9px]">+{c.data.scopes.length - 8}</Badge>}
                  </div>
                )}
              </div>
            ))}

            {result.resolved?.webhook_url && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle className="text-sm">Next: configure the webhook</AlertTitle>
                <AlertDescription className="text-xs space-y-2">
                  <p>In the same Marketplace app → <b>Feature</b> → <b>Event Subscriptions</b>, add this endpoint URL:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-2 py-1 rounded text-[10px] break-all">{result.resolved.webhook_url}</code>
                    <Button size="sm" variant="ghost" onClick={copyWebhook} className="h-7 px-2"><Copy className="h-3 w-3" /></Button>
                  </div>
                  <p>Subscribe to <code>meeting.participant_joined</code>, <code>meeting.participant_left</code>, <code>meeting.ended</code>, then click <b>Validate</b> → <b>Send test event</b> in Zoom. Return to the <b>Join Logs</b> tab in ~30s to confirm it arrived.</p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button variant="outline" onClick={reset}>Test another account</Button>
          ) : (
            <Button onClick={runTest} disabled={loading || !creds.account_id || !creds.client_id || !creds.client_secret || !creds.zoom_email}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running checks…</> : 'Run Validation'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
