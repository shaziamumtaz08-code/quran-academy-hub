import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Check, Copy, KeyRound, ShieldCheck, Webhook } from 'lucide-react';
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
 * Server-to-Server OAuth credentials — all against that same selection.
 */
export function ZoomAccountCredentialsPanel({ zoomAccounts }: { zoomAccounts: ZoomAccountRow[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activeAccounts = React.useMemo(
    () =>
      (zoomAccounts || [])
        .filter((a) => a.is_active !== false)
        .sort((a, b) => accountLabel(a).localeCompare(accountLabel(b))),
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
             sdkClientId: (r.zoom_meeting_sdk_client_id as string | null) || null,
             s2sAccountId: (r.zoom_account_id_cred as string | null) || null,
             s2sClientId: (r.zoom_client_id as string | null) || null,
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
         sdkClientId: string | null;
         s2sAccountId: string | null;
         s2sClientId: string | null;
        s2sStatus: string | null;
        s2sError: string | null;
        hostId: string | null;
      }>;
    },
  });

  // Which classes this Zoom seat hosts — this link is what lets a class use the
  // in-app player (the signature function resolves credentials through it).
  const { data: classRows } = useQuery({
    queryKey: ['zoom-linkable-classes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('course_classes')
        .select('id, name, status, zoom_account_id, course:courses(name)')
        .order('name');
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        name: string | null;
        status: string | null;
        zoom_account_id: string | null;
        course?: { name?: string | null } | null;
      }>;
    },
  });

  const [linking, setLinking] = React.useState(false);
  const [pendingClassId, setPendingClassId] = React.useState('');

  const linkedClasses = React.useMemo(
    () => (classRows || []).filter((c) => c.zoom_account_id === accountId),
    [classRows, accountId],
  );
  const unlinkedClasses = React.useMemo(
    () => (classRows || []).filter((c) => c.zoom_account_id !== accountId),
    [classRows, accountId],
  );
  const classLabel = (c: { name: string | null; course?: { name?: string | null } | null }) =>
    [c.course?.name, c.name].filter(Boolean).join(' · ') || 'Untitled class';

  const setClassAccount = async (classId: string, nextAccountId: string | null) => {
    setLinking(true);
    try {
      const { error } = await (supabase as any)
        .from('course_classes')
        .update({ zoom_account_id: nextAccountId })
        .eq('id', classId);
      if (error) throw error;
      setPendingClassId('');
      queryClient.invalidateQueries({ queryKey: ['zoom-linkable-classes'] });
      toast({
        title: nextAccountId ? 'Class linked' : 'Class unlinked',
        description: nextAccountId
          ? 'This class will now host through the selected Zoom account.'
          : 'This class falls back to its embedded meeting link.',
      });
    } catch (e: any) {
      toast({ title: 'Could not update class', description: e.message, variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

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

  // Server-to-Server OAuth app credentials (the ones webhooks / attendance need)
  const [s2sAccountId, setS2sAccountId] = React.useState('');
  const [s2sClientId, setS2sClientId] = React.useState('');
  const [s2sClientSecret, setS2sClientSecret] = React.useState('');
  const [validating, setValidating] = React.useState(false);
  const [validateResult, setValidateResult] = React.useState<ZoomValidateResult | null>(null);

  // Show safe identifiers for the selected account while keeping every secret
  // write-only. This makes saved configuration visible without exposing keys.
  React.useEffect(() => {
    setWebhookToken('');
    setSdkClientId(status?.sdkClientId || '');
    setSdkClientSecret('');
    setCopied(false);
    setS2sAccountId(status?.s2sAccountId || '');
    setS2sClientId(status?.s2sClientId || '');
    setS2sClientSecret('');
    setValidateResult(null);
  }, [accountId, status?.sdkClientId, status?.s2sAccountId, status?.s2sClientId]);

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
        zoom_account_row_id: account.id,
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

  const s2sIdentifiersChanged = Boolean(
    status?.hasS2S &&
    (s2sAccountId.trim() !== (status.s2sAccountId || '') || s2sClientId.trim() !== (status.s2sClientId || '')),
  );
  const canValidateS2S = Boolean(
    s2sAccountId.trim() &&
    s2sClientId.trim() &&
    (s2sClientSecret.trim() || (status?.hasS2S && !s2sIdentifiersChanged)),
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
          </div>
        )}
      </div>

      {!account && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="zw-motif" />
          <p className="zw-body max-w-sm">
            Select a Zoom account above — its webhook, in-app player credentials, and S2S OAuth credentials all appear here.
          </p>
        </div>
      )}

      {account && (
        <>
          {/* Classes hosted by this account — the link the in-app player needs */}
          <div className="zw-card zw-accent-edge space-y-4 p-6 pl-7">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="h-4 w-4" style={{ color: 'hsl(var(--zw-sage))' }} />
              <h3 className="zw-h2">Classes hosted by this account</h3>
              <span className="zw-chip" data-tone={linkedClasses.length ? 'ok' : 'quiet'}>
                <span className="zw-dot" /> {linkedClasses.length} linked
              </span>
            </div>

            {linkedClasses.length === 0 ? (
              <p className="zw-meta">
                No class is hosted by this seat yet — link one below so it can use the in-app player.
              </p>
            ) : (
              <ul className="space-y-2">
                {linkedClasses.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                    <span className="zw-body min-w-0 truncate">{classLabel(c)}</span>
                    <button
                      type="button"
                      className="zw-btn-ghost shrink-0"
                      disabled={linking}
                      onClick={() => setClassAccount(c.id, null)}
                    >
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <p className="zw-eyebrow mb-1.5">Link another class to this account</p>
                <Select value={pendingClassId} onValueChange={setPendingClassId}>
                  <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {unlinkedClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {classLabel(c)}{c.zoom_account_id ? ' · linked elsewhere' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                className="zw-btn-secondary"
                disabled={!pendingClassId || linking}
                onClick={() => setClassAccount(pendingClassId, account.id)}
              >
                {linking ? 'Saving…' : 'Link class'}
              </button>
            </div>
            <p className="zw-meta">
              A class without a Zoom account keeps using its plain embedded meeting frame.
            </p>
          </div>

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
                  key={`s2s-account-${account.id}`}
                  name="zoom-s2s-account-id"
                  autoComplete="section-zoom-s2s off"
                  data-lpignore="true"
                  value={s2sAccountId}
                  onChange={(e) => setS2sAccountId(e.target.value)}
                  placeholder="Account ID from the S2S app"
                />
              </div>
              <div className="min-w-0">
                <p className="zw-eyebrow mb-1.5">Client ID</p>
                <Input
                  key={`s2s-client-${account.id}`}
                  name="zoom-s2s-client-id"
                  autoComplete="section-zoom-s2s off"
                  data-lpignore="true"
                  value={s2sClientId}
                  onChange={(e) => setS2sClientId(e.target.value)}
                  placeholder="Client ID"
                />
              </div>
              <div className="min-w-0">
                <p className="zw-eyebrow mb-1.5">Client Secret</p>
                <Input
                  key={`s2s-secret-${account.id}`}
                  type="password"
                  name="zoom-s2s-client-secret"
                  autoComplete="section-zoom-s2s new-password"
                  data-lpignore="true"
                  value={s2sClientSecret}
                  onChange={(e) => setS2sClientSecret(e.target.value)}
                  placeholder={status?.hasS2S ? 'Stored securely — leave blank to recheck' : 'Client Secret'}
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
                  !canValidateS2S
                }
                onClick={runValidateS2S}
              >
                {validating ? 'Validating…' : status?.hasS2S && !s2sClientSecret ? 'Recheck saved connection' : 'Validate & save'}
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
                <Input key={`sdk-client-${account.id}`} name="zoom-sdk-client-id" autoComplete="off" data-lpignore="true" value={sdkClientId} onChange={(e) => setSdkClientId(e.target.value)} placeholder="Client ID from the Zoom “Meeting SDK” app" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="zw-eyebrow mb-1.5">Meeting SDK Client Secret</p>
                <Input key={`sdk-secret-${account.id}`} type="password" name="zoom-sdk-client-secret" autoComplete="new-password" data-lpignore="true" value={sdkClientSecret} onChange={(e) => setSdkClientSecret(e.target.value)} placeholder={status?.hasSdkCreds ? 'Stored securely — type only to replace' : 'Client Secret'} />
              </div>
              <button type="button" className="zw-btn-primary" disabled={!sdkClientId || !sdkClientSecret || savingCreds} onClick={saveCreds}>
                {savingCreds ? 'Saving…' : 'Save'}
              </button>
            </div>
            <p className="zw-meta">
              These come from a separate <strong>Meeting SDK</strong> app in the Zoom Marketplace (not the Server-to-Server OAuth app). Accounts without them keep using the embedded frame.
            </p>
          </div>
        </>
      )}
    </div>

  );
}

export default ZoomAccountCredentialsPanel;
