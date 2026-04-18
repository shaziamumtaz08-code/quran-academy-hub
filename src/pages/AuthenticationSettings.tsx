import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { trackActivity } from '@/lib/activityLogger';
import { Loader2, AlertTriangle, ShieldCheck, Mail, Sparkles, Hash, MessageSquare } from 'lucide-react';

interface MethodRow {
  id: string;
  org_id: string;
  method: string;
  enabled: boolean;
  is_default: boolean;
  is_supported: boolean;
}

const META: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  email_password: { label: 'Email + Password', description: 'Standard email and password sign-in.', icon: <Mail className="h-5 w-5" /> },
  uid_pin: { label: 'UID / Roll No + PIN', description: 'Username and 4-digit PIN — ideal for students and minors.', icon: <Hash className="h-5 w-5" /> },
  google: { label: 'Google', description: 'One-click sign-in with a Google account.', icon: <ShieldCheck className="h-5 w-5" /> },
  magic_link: { label: 'Magic Link', description: 'Passwordless sign-in via emailed link.', icon: <Sparkles className="h-5 w-5" /> },
  microsoft: { label: 'Microsoft', description: 'Coming soon — requires custom OAuth setup.', icon: <ShieldCheck className="h-5 w-5" /> },
  whatsapp_otp: { label: 'WhatsApp OTP', description: 'Coming soon — 6-digit one-time code via WhatsApp.', icon: <MessageSquare className="h-5 w-5" /> },
};

const ORDER = ['email_password', 'uid_pin', 'google', 'magic_link', 'microsoft', 'whatsapp_otp'];

export default function AuthenticationSettings() {
  const { profile, hasRole, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<MethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const canManage = isSuperAdmin || hasRole('admin');

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Pick the user's first org via branches → use single org for now
      const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
      const orgId = orgs?.[0]?.id;
      if (!orgId) { setLoading(false); return; }
      const { data } = await supabase
        .from('org_auth_config')
        .select('*')
        .eq('org_id', orgId);
      const sorted = (data || []).sort((a, b) => ORDER.indexOf(a.method) - ORDER.indexOf(b.method));
      setRows(sorted as MethodRow[]);
      setLoading(false);
    })();
  }, []);

  const updateRow = (idx: number, patch: Partial<MethodRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const setDefault = (method: string) => {
    setRows((prev) => prev.map((r) => ({ ...r, is_default: r.method === method })));
    setDirty(true);
  };

  const enabledCount = rows.filter((r) => r.enabled && r.is_supported).length;
  const allDisabled = rows.length > 0 && enabledCount === 0;

  const save = async () => {
    if (allDisabled) {
      toast({ title: 'At least one method required', description: 'Enable at least one method before saving.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Update each row
      for (const r of rows) {
        await supabase
          .from('org_auth_config')
          .update({
            enabled: r.enabled,
            is_default: r.is_default,
            updated_by: profile?.id || null,
          })
          .eq('id', r.id);
      }
      await trackActivity({
        action: 'login' as any, // reuse existing enum-friendly action; details capture the change
        entityType: 'user' as any,
        details: {
          event: 'auth_config_updated',
          methods: rows.map((r) => ({ method: r.method, enabled: r.enabled, is_default: r.is_default })),
        },
      });
      toast({ title: 'Saved', description: 'Authentication methods updated.' });
      setDirty(false);
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">You don't have permission to manage authentication settings.</p>
      </Card>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Authentication Methods</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which sign-in options appear on your organization's login page.
        </p>
      </div>

      {allDisabled && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>All methods are disabled — users won't be able to sign in. Enable at least one.</AlertDescription>
        </Alert>
      )}

      <RadioGroup value={rows.find((r) => r.is_default)?.method || ''} onValueChange={setDefault}>
        <div className="grid gap-3">
          {rows.map((r, idx) => {
            const meta = META[r.method];
            if (!meta) return null;
            const disabled = !r.is_supported;
            return (
              <Card key={r.id} className={`p-4 ${disabled ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{meta.label}</h3>
                      {!r.is_supported && (
                        <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Coming soon</span>
                      )}
                      {r.is_default && r.enabled && r.is_supported && (
                        <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">Default</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>

                    {r.is_supported && r.enabled && (
                      <div className="flex items-center gap-2 mt-3">
                        <RadioGroupItem value={r.method} id={`def-${r.method}`} />
                        <Label htmlFor={`def-${r.method}`} className="text-xs font-normal text-muted-foreground cursor-pointer">
                          Set as default tab on login page
                        </Label>
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={r.enabled}
                    disabled={disabled}
                    onCheckedChange={(v) => updateRow(idx, { enabled: v, ...(v ? {} : { is_default: false }) })}
                    aria-label={`Toggle ${meta.label}`}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </RadioGroup>

      <div className="flex items-center justify-end gap-2 pt-2 sticky bottom-4">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save changes
        </Button>
      </div>
    </div>
  );
}
