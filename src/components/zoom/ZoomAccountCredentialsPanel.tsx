import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Check, Copy, KeyRound, Link2, Webhook } from 'lucide-react';

interface ZoomAccountRow {
  id: string;
  teacher_id: string | null;
  zoom_account_email: string | null;
  tier: string | null;
  is_active: boolean | null;
  profile?: { full_name?: string | null } | null;
}

const accountLabel = (a: ZoomAccountRow) =>
  `${a.profile?.full_name || a.zoom_account_email || 'Zoom account'}${a.tier ? ` · ${a.tier}` : ''}`;

const zoomSlug = (a: ZoomAccountRow) => {
  const name = a?.profile?.full_name || a?.zoom_account_email || '';
  return String(name).trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'app';
};

/**
 * Account-scoped credentials screen: pick ONE Zoom account at the top, then
 * manage its webhook endpoint + Secret Token, Meeting SDK credentials, and
 * class links — all against that same selection. UI consolidation only; every
 * write still goes through the existing RPCs / table updates.
 */
export function ZoomAccountCredentialsPanel({ zoomAccounts }: { zoomAccounts: ZoomAccountRow[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activeAccounts = React.useMemo(
    () => (zoomAccounts || []).filter((a) => a.is_active !== false),
    [zoomAccounts],
  );

  const [accountId, setAccountId] = React.useState<string>('');
  const account = React.useMemo(
    () => activeAccounts.find((a) => a.id === accountId) || null,
    [activeAccounts, accountId],
  );

  // Per-account credential presence (never the secret values themselves).
  const { data: credStatus } = useQuery({
    queryKey: ['zoom-account-cred-status'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zoom_accounts')
        .select('id, webhook_app_slug, webhook_secret_token, zoom_meeting_sdk_client_id');
      if (error) throw error;
      return Object.fromEntries(
        (data || []).map((r: any) => [
          r.id,
          {
            slug: r.webhook_app_slug as string | null,
            hasWebhookToken: !!r.webhook_secret_token,
            hasSdkCreds: !!r.zoom_meeting_sdk_client_id,
          },
        ]),
      ) as Record<string, { slug: string | null; hasWebhookToken: boolean; hasSdkCreds: boolean }>;
    },
  });

  const { data: classes } = useQuery({
    queryKey: ['course-classes-zoom-link'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('course_classes')
        .select('id, name, meeting_link, zoom_account_id, course:courses(title)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'sienlnxwwdqnybugipdt';
  const webhookBase = `https://${projectId}.supabase.co/functions/v1/zoom-webhook`;

  const status = accountId ? credStatus?.[accountId] : undefined;
  // Prefer the slug the token was actually saved under; otherwise derive it.
  const slug = account ? status?.slug || zoomSlug(account) : '';
  const webhookUrl = account ? `${webhookBase}?app=${slug}` : webhookBase;

  const [copied, setCopied] = React.useState(false);
  const [webhookToken, setWebhookToken] = React.useState('');
  const [savingToken, setSavingToken] = React.useState(false);

  const [sdkClientId, setSdkClientId] = React.useState('');
  const [sdkClientSecret, setSdkClientSecret] = React.useState('');
  const [savingCreds, setSavingCreds] = React.useState(false);

  const [classId, setClassId] = React.useState<string>('');
  const [savingLink, setSavingLink] = React.useState(false);

  // Reset transient input state when the admin switches accounts so values
  // typed for one account never bleed into another.
  React.useEffect(() => {
    setWebhookToken('');
    setSdkClientId('');
    setSdkClientSecret('');
    setCopied(false);
    setClassId('');
  }, [accountId]);

  const linkedClasses = React.useMemo(
    () => (classes || []).filter((c: any) => c.zoom_account_id === accountId),
    [classes, accountId],
  );
  const selectedClass = React.useMemo(
    () => (classes || []).find((c: any) => c.id === classId),
    [classes, classId],
  );

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Webhook URL copied', description: 'Paste it into this account’s Zoom app under Event Subscriptions.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the URL manually.', variant: 'destructive' });
    }
  };

  const saveWebhookToken = async () => {
    if (!account) return;
    setSavingToken(true);
    try {
      const { error } = await (supabase as any).rpc('admin_set_zoom_webhook_token', {
        _account_id: account.id,
        _app_slug: slug,
        _secret_token: webhookToken,
      });
      if (error) throw error;
      setWebhookToken('');
      queryClient.invalidateQueries({ queryKey: ['zoom-account-cred-status'] });
      toast({ title: 'Secret Token saved', description: `Zoom can now validate ${webhookUrl}` });
    } catch (e: any) {
      toast({ title: 'Could not save token', description: e.message, variant: 'destructive' });
    } finally {
      setSavingToken(false);
    }
  };

  const saveCreds = async () => {
    if (!account) return;
    setSavingCreds(true);
    try {
      const { error } = await (supabase as any).rpc('admin_set_zoom_meeting_sdk_creds', {
        _account_id: account.id,
        _client_id: sdkClientId,
        _client_secret: sdkClientSecret,
      });
      if (error) throw error;
      setSdkClientId('');
      setSdkClientSecret('');
      queryClient.invalidateQueries({ queryKey: ['zoom-account-cred-status'] });
      toast({ title: 'Meeting SDK credentials saved', description: 'Classes linked to this account can now use the in-app player.' });
    } catch (e: any) {
      toast({ title: 'Could not save credentials', description: e.message, variant: 'destructive' });
    } finally {
      setSavingCreds(false);
    }
  };

  const saveLink = async () => {
    if (!account || !classId) return;
    setSavingLink(true);
    try {
      const { error } = await (supabase as any)
        .from('course_classes')
        .update({ zoom_account_id: account.id })
        .eq('id', classId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['course-classes-zoom-link'] });
      toast({ title: 'Class linked', description: 'This class will use this account’s Meeting SDK app.' });
    } catch (e: any) {
      toast({ title: 'Could not update class', description: e.message, variant: 'destructive' });
    } finally {
      setSavingLink(false);
    }
  };

  const unlinkClass = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('course_classes')
        .update({ zoom_account_id: null })
        .eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['course-classes-zoom-link'] });
      toast({ title: 'Link cleared', description: 'This class falls back to the embedded frame.' });
    } catch (e: any) {
      toast({ title: 'Could not update class', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardContent className="p-4 space-y-5">
        {/* Single account selector */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="sm:w-80">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Zoom account</p>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {activeAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {account && status && (
            <div className="flex flex-wrap gap-2 pb-1">
              <Badge variant={status.hasWebhookToken ? 'secondary' : 'outline'} className="text-[10px]">
                Webhook token {status.hasWebhookToken ? '✓ saved' : 'not set'}
              </Badge>
              <Badge variant={status.hasSdkCreds ? 'secondary' : 'outline'} className="text-[10px]">
                Meeting SDK {status.hasSdkCreds ? '✓ saved' : 'not set'}
              </Badge>
              <Badge variant={linkedClasses.length > 0 ? 'secondary' : 'outline'} className="text-[10px]">
                {linkedClasses.length} class{linkedClasses.length === 1 ? '' : 'es'} linked
              </Badge>
            </div>
          )}
        </div>

        {!account && (
          <p className="text-xs text-muted-foreground">
            Select a Zoom account above — its webhook, in-app player credentials, and class links all appear here.
          </p>
        )}

        {account && (
          <>
            {/* Webhook */}
            <div className="space-y-3 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wide">Webhook (Event Subscriptions)</h3>
                {status?.hasWebhookToken && (
                  <Badge variant="secondary" className="text-[10px]">Token already stored — saving replaces it</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 block rounded-md bg-muted px-3 py-2 text-sm font-mono text-foreground break-all">
                  {webhookUrl}
                </code>
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={copyWebhook}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Secret Token for this app
                  </p>
                  <Input
                    type="password"
                    value={webhookToken}
                    onChange={(e) => setWebhookToken(e.target.value)}
                    placeholder="Paste the Secret Token from Zoom → Feature → Event Subscriptions"
                  />
                </div>
                <Button size="sm" disabled={!webhookToken || savingToken} onClick={saveWebhookToken}>
                  {savingToken ? 'Saving…' : 'Save token'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste this URL as the <strong>Event Notification Endpoint</strong> in this account’s Zoom app, then save its Secret Token above <em>before</em> pressing “Validate” in Zoom.
              </p>
            </div>

            {/* Meeting SDK credentials */}
            <div className="space-y-3 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wide">In-app player credentials</h3>
                {status?.hasSdkCreds && (
                  <Badge variant="secondary" className="text-[10px]">Credentials already stored — saving replaces them</Badge>
                )}
              </div>
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Meeting SDK Client ID</p>
                  <Input value={sdkClientId} onChange={(e) => setSdkClientId(e.target.value)} placeholder="Client ID from the Zoom “Meeting SDK” app" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Meeting SDK Client Secret</p>
                  <Input type="password" value={sdkClientSecret} onChange={(e) => setSdkClientSecret(e.target.value)} placeholder="Client Secret" />
                </div>
                <Button size="sm" disabled={!sdkClientId || !sdkClientSecret || savingCreds} onClick={saveCreds}>
                  {savingCreds ? 'Saving…' : 'Save'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                These come from a separate <strong>Meeting SDK</strong> app in the Zoom Marketplace (not the Server-to-Server OAuth app). Accounts without them keep using the embedded frame.
              </p>
            </div>

            {/* Class links */}
            <div className="space-y-3 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wide">Classes hosted by this account</h3>
              </div>
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Class</p>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger><SelectValue placeholder="Select class to link" /></SelectTrigger>
                    <SelectContent>
                      {(classes || []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {(c.course?.title ? `${c.course.title} — ` : '') + (c.name || 'Class')}
                          {c.zoom_account_id === accountId ? ' ✓' : c.zoom_account_id ? ' (linked elsewhere)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" disabled={!classId || savingLink} onClick={saveLink}>
                  {savingLink ? 'Saving…' : 'Link to this account'}
                </Button>
              </div>
              {selectedClass?.meeting_link && (
                <p className="text-xs text-muted-foreground break-all">
                  Class meeting link: <code className="font-mono">{selectedClass.meeting_link}</code>
                </p>
              )}
              {linkedClasses.length > 0 && (
                <div className="space-y-1">
                  {linkedClasses.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                      <span className="truncate">{(c.course?.title ? `${c.course.title} — ` : '') + (c.name || 'Class')}</span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => unlinkClass(c.id)}>
                        Unlink
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ZoomAccountCredentialsPanel;
