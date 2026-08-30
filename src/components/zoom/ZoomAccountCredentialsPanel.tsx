import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Check, Copy, KeyRound, Link2, ShieldCheck, Webhook } from 'lucide-react';
import { validateAndSaveZoomAccount, type ZoomValidateResult } from '@/lib/zoomAccountValidation';
import { STATUS_META, StatusLabel, type SeatStatus } from './seatStatus';

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
        .select('id, webhook_app_slug, webhook_secret_token, zoom_meeting_sdk_client_id, zoom_account_id_cred, zoom_client_id, credential_status, credential_error, zoom_user_id');
      if (error) throw error;
      return Object.fromEntries(
        (data || []).map((r: any) => [
          r.id,
          {
            slug: r.webhook_app_slug as string | null,
            hasWebhookToken: !!r.webhook_secret_token,
            hasSdkCreds: !!r.zoom_meeting_sdk_client_id,
            hasS2S: !!(r.zoom_account_id_cred && r.zoom_client_id),
            s2sStatus: (r.credential_status as string | null) || null,
            s2sError: (r.credential_error as string | null) || null,
            hostId: (r.zoom_user_id as string | null) || null,
          },
        ]),
      ) as Record<string, {
        slug: string | null;
        hasWebhookToken: boolean;
        hasSdkCreds: boolean;
        hasS2S: boolean;
        s2sStatus: string | null;
        s2sError: string | null;
        hostId: string | null;
      }>;
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

  // Server-to-Server OAuth app credentials (the ones webhooks / attendance need)
  const [s2sAccountId, setS2sAccountId] = React.useState('');
  const [s2sClientId, setS2sClientId] = React.useState('');
  const [s2sClientSecret, setS2sClientSecret] = React.useState('');
  const [validating, setValidating] = React.useState(false);
  const [validateResult, setValidateResult] = React.useState<ZoomValidateResult | null>(null);

  // Reset transient input state when the admin switches accounts so values
  // typed for one account never bleed into another.
  React.useEffect(() => {
    setWebhookToken('');
    setSdkClientId('');
    setSdkClientSecret('');
    setCopied(false);
    setClassId('');
    setS2sAccountId('');
    setS2sClientId('');
    setS2sClientSecret('');
    setValidateResult(null);
  }, [accountId]);

  // Live badge state for the S2S block: local validation result wins, then the
  // persisted credential_status on the row.
  const s2sSeatStatus: SeatStatus | undefined = React.useMemo(() => {
    if (!account) return undefined;
    if (validating) return undefined;
    if (validateResult) return validateResult.ok ? (status?.hostId ? 'healthy' : 'no_events') : 'credentials_invalid';
    if (!status?.hasS2S) return 'no_credentials';
    if (status.s2sStatus === 'failed') return 'credentials_invalid';
    if (!status.hostId) return 'missing_host_id';
    return 'no_events';
  }, [account, validating, validateResult, status]);

  const runValidateS2S = async () => {
    if (!account?.teacher_id || !account.zoom_account_email) return;
    setValidating(true);
    setValidateResult(null);
    try {
      const body = await validateAndSaveZoomAccount({
        teacher_id: account.teacher_id,
        tier: (account.tier as any) || 'free',
        account_id: s2sAccountId.trim(),
        client_id: s2sClientId.trim(),
        client_secret: s2sClientSecret.trim(),
        zoom_email: account.zoom_account_email,
      });
      setValidateResult(body);
      queryClient.invalidateQueries({ queryKey: ['zoom-account-cred-status'] });
      queryClient.invalidateQueries({ queryKey: ['zoom-accounts-list'] });
      queryClient.invalidateQueries({ queryKey: ['zoom-seat-status'] });
      if (body?.ok && body?.saved) {
        setS2sClientSecret('');
        toast({
          title: 'Verified — host ID resolved',
          description: `Host ID ${body.resolved?.host_id} saved for this seat.`,
        });
      } else {
        toast({
          title: 'Zoom rejected these credentials',
          description: body?.failure_reason || body?.verdict || body?.error || 'Validation failed.',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      setValidateResult({ ok: false, failure_reason: e.message });
      toast({ title: 'Validation failed', description: e.message, variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };


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
    <div className="zoom-ws zw-card zw-inset-top space-y-6 p-6">
      {/* Single account selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:w-96">
          <p className="zw-eyebrow">Zoom account</p>
          <p className="zw-h2 mt-1.5">Credentials &amp; hosting</p>
          <div className="mt-3">
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
        </div>
        {account && status && (
          <div className="flex flex-wrap gap-2 pb-1">
            <span className="zw-chip" data-tone={status.hasWebhookToken ? 'ok' : 'quiet'}>
              <span className="zw-dot" /> Webhook token {status.hasWebhookToken ? 'saved' : 'not set'}
            </span>
            <span className="zw-chip" data-tone={status.hasSdkCreds ? 'ok' : 'quiet'}>
              <span className="zw-dot" /> Meeting SDK {status.hasSdkCreds ? 'saved' : 'not set'}
            </span>
            <span className="zw-chip" data-tone={linkedClasses.length > 0 ? 'brass' : 'quiet'}>
              <span className="zw-dot" /> {linkedClasses.length} class{linkedClasses.length === 1 ? '' : 'es'} linked
            </span>
          </div>
        )}
      </div>

      {!account && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="zw-motif" />
          <p className="zw-body max-w-sm">
            Select a Zoom account above — its webhook, in-app player credentials, and class links all appear here.
          </p>
        </div>
      )}

      {account && (
        <>
          {/* Server-to-Server OAuth app — powers webhooks, attendance telemetry, host ID */}
          <div className="zw-card zw-accent-edge space-y-4 p-6 pl-7">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: 'hsl(var(--zw-sage))' }} />
              <h3 className="zw-h2">Server-to-Server OAuth app</h3>
              {validating ? (
                <span className="zw-chip" data-tone="quiet"><span className="zw-dot" /> Validating…</span>
              ) : (
                <StatusLabel status={s2sSeatStatus} />
              )}
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="min-w-0">
                <p className="zw-eyebrow mb-1.5">Account ID</p>
                <Input
                  name="zoom-s2s-account-id"
                  autoComplete="off"
                  data-lpignore="true"
                  value={s2sAccountId}
                  onChange={(e) => setS2sAccountId(e.target.value)}
                  placeholder={status?.hasS2S ? 'Stored — type to replace' : 'Account ID from the S2S app'}
                />
              </div>
              <div className="min-w-0">
                <p className="zw-eyebrow mb-1.5">Client ID</p>
                <Input
                  name="zoom-s2s-client-id"
                  autoComplete="off"
                  data-lpignore="true"
                  value={s2sClientId}
                  onChange={(e) => setS2sClientId(e.target.value)}
                  placeholder={status?.hasS2S ? 'Stored — type to replace' : 'Client ID'}
                />
              </div>
              <div className="min-w-0">
                <p className="zw-eyebrow mb-1.5">Client Secret</p>
                <Input
                  type="password"
                  name="zoom-s2s-client-secret"
                  autoComplete="new-password"
                  data-lpignore="true"
                  value={s2sClientSecret}
                  onChange={(e) => setS2sClientSecret(e.target.value)}
                  placeholder="Client Secret"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="zw-btn-primary"
                disabled={
                  validating ||
                  !account.teacher_id ||
                  !account.zoom_account_email ||
                  !s2sAccountId.trim() ||
                  !s2sClientId.trim() ||
                  !s2sClientSecret.trim()
                }
                onClick={runValidateS2S}
              >
                {validating ? 'Validating…' : 'Validate & save'}
              </button>
              {!account.teacher_id && (
                <span className="zw-meta">This seat has no teacher attached — attach one in Zoom Accounts first.</span>
              )}
            </div>
            {(validateResult || (s2sSeatStatus && s2sSeatStatus !== 'healthy')) && (
              <p className="zw-meta">
                {validateResult?.failure_reason ||
                  validateResult?.verdict ||
                  status?.s2sError ||
                  (s2sSeatStatus ? STATUS_META[s2sSeatStatus].hint : '')}
              </p>
            )}
            <p className="zw-meta">
              These three come from this account’s <strong>Server-to-Server OAuth</strong> app in the Zoom Marketplace.
              They power webhooks and attendance telemetry — they are <em>not</em> the login password (that lives in Zoom Vault)
              and not the Meeting SDK app below.
            </p>
          </div>

          {/* Webhook — deliberately quiet, system-level */}

          <div className="zw-drawer space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Webhook className="h-3.5 w-3.5" style={{ color: 'hsl(var(--zw-ink-3))' }} />
              <h3 className="zw-eyebrow">Webhook · event subscriptions</h3>
              {status?.hasWebhookToken && (
                <span className="zw-chip" data-tone="quiet">Token stored — saving replaces it</span>
              )}
            </div>
            <div className="zw-linkbox">
              <code className="zw-linkbox-text">{webhookUrl}</code>
              <button type="button" className="zw-btn-ghost shrink-0" onClick={copyWebhook}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <p className="zw-eyebrow mb-1.5">Secret Token for this app</p>
                <Input
                  type="password"
                  name="zoom-webhook-secret-token"
                  autoComplete="new-password"
                  data-lpignore="true"
                  value={webhookToken}
                  onChange={(e) => setWebhookToken(e.target.value)}
                  placeholder="Paste the Secret Token from Zoom → Feature → Event Subscriptions"
                />
              </div>
              <button type="button" className="zw-btn-secondary" disabled={!webhookToken || savingToken} onClick={saveWebhookToken}>
                {savingToken ? 'Saving…' : 'Save token'}
              </button>
            </div>
            <p className="zw-meta">
              Paste this URL as the <strong>Event Notification Endpoint</strong> in this account’s Zoom app, then save its Secret Token above <em>before</em> pressing “Validate” in Zoom.
            </p>
          </div>

          {/* Meeting SDK credentials */}
          <div className="zw-card zw-accent-edge space-y-4 p-6 pl-7">
            <div className="flex flex-wrap items-center gap-2">
              <KeyRound className="h-4 w-4" style={{ color: 'hsl(var(--zw-brass))' }} />
              <h3 className="zw-h2">In-app player credentials</h3>
              {status?.hasSdkCreds && (
                <span className="zw-chip" data-tone="ok"><span className="zw-dot" /> Stored — saving replaces</span>
              )}
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <p className="zw-eyebrow mb-1.5">Meeting SDK Client ID</p>
                <Input name="zoom-sdk-client-id" autoComplete="off" data-lpignore="true" value={sdkClientId} onChange={(e) => setSdkClientId(e.target.value)} placeholder="Client ID from the Zoom “Meeting SDK” app" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="zw-eyebrow mb-1.5">Meeting SDK Client Secret</p>
                <Input type="password" name="zoom-sdk-client-secret" autoComplete="new-password" data-lpignore="true" value={sdkClientSecret} onChange={(e) => setSdkClientSecret(e.target.value)} placeholder="Client Secret" />
              </div>
              <button type="button" className="zw-btn-primary" disabled={!sdkClientId || !sdkClientSecret || savingCreds} onClick={saveCreds}>
                {savingCreds ? 'Saving…' : 'Save'}
              </button>
            </div>
            <p className="zw-meta">
              These come from a separate <strong>Meeting SDK</strong> app in the Zoom Marketplace (not the Server-to-Server OAuth app). Accounts without them keep using the embedded frame.
            </p>
          </div>

          {/* Class links */}
          <div className="zw-card space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4" style={{ color: 'hsl(var(--zw-sage))' }} />
              <h3 className="zw-h2">Classes hosted by this account</h3>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <p className="zw-eyebrow mb-1.5">Class</p>
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
              <button type="button" className="zw-btn-secondary" disabled={!classId || savingLink} onClick={saveLink}>
                {savingLink ? 'Saving…' : 'Link to this account'}
              </button>
            </div>
            {selectedClass?.meeting_link && (
              <div className="zw-linkbox">
                <code className="zw-linkbox-text">{selectedClass.meeting_link}</code>
              </div>
            )}
            {linkedClasses.length > 0 ? (
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'hsl(var(--zw-line-soft))' }}>
                {linkedClasses.map((c: any) => (
                  <div key={c.id} className="zw-row">
                    <span className="truncate text-sm font-medium">
                      {(c.course?.title ? `${c.course.title} — ` : '') + (c.name || 'Class')}
                    </span>
                    <button type="button" className="zw-btn-ghost shrink-0" onClick={() => unlinkClass(c.id)}>
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="zw-meta">No classes are linked to this account yet — they stay on the embedded frame.</p>
            )}
          </div>
        </>
      )}
    </div>

  );
}

export default ZoomAccountCredentialsPanel;
