import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Loader2, Eye, EyeOff, User, Sparkles, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { MinorLoginTab } from '@/components/auth/MinorLoginTab';
import { lovable } from '@/integrations/lovable';

const ALL_METHODS = ['email_password', 'uid_pin', 'google', 'magic_link', 'microsoft', 'whatsapp_otp'] as const;
type Method = typeof ALL_METHODS[number];

interface OrgConfig {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface MethodCfg {
  method: Method;
  enabled: boolean;
  is_default: boolean;
  is_supported: boolean;
}

const emailSchema = z.string().trim().email('Enter a valid email').max(255);
const passwordSchema = z.string().min(6, 'Min 6 characters').max(128);

export default function TenantLogin() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgConfig | null>(null);
  const [methods, setMethods] = useState<MethodCfg[]>([]);
  const [activeTab, setActiveTab] = useState<Method>('email_password');

  // form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        let orgRow: OrgConfig | null = null;
        if (slug) {
          const { data } = await supabase
            .from('organizations')
            .select('id, name, slug, logo_url')
            .eq('slug', slug)
            .maybeSingle();
          orgRow = data as OrgConfig | null;
        }

        let cfg: MethodCfg[] = [];
        if (orgRow) {
          const { data: cfgData } = await supabase
            .from('org_auth_config')
            .select('method, enabled, is_default, is_supported')
            .eq('org_id', orgRow.id);
          cfg = (cfgData || []) as MethodCfg[];
        }

        // Fallback: if no slug or no rows, allow all supported methods
        if (cfg.length === 0) {
          cfg = [
            { method: 'email_password', enabled: true, is_default: true, is_supported: true },
            { method: 'uid_pin', enabled: true, is_default: false, is_supported: true },
            { method: 'google', enabled: true, is_default: false, is_supported: true },
            { method: 'magic_link', enabled: true, is_default: false, is_supported: true },
          ];
        }

        if (!alive) return;
        setOrg(orgRow);
        setMethods(cfg);

        const enabled = cfg.filter((c) => c.enabled && c.is_supported);
        const def = enabled.find((c) => c.is_default) || enabled[0];
        if (def) setActiveTab(def.method);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const enabledMethods = methods.filter((m) => m.enabled && m.is_supported);
  const tabMethods = enabledMethods.filter((m) => m.method !== 'google'); // google is a button, not a tab

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const er = emailSchema.safeParse(email);
    const pr = passwordSchema.safeParse(password);
    if (!er.success || !pr.success) {
      toast({ title: 'Invalid input', description: er.error?.issues[0]?.message || pr.error?.issues[0]?.message, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await login(er.data, pr.data);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const er = emailSchema.safeParse(magicEmail);
    if (!er.success) {
      toast({ title: 'Invalid email', description: er.error.issues[0].message, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: er.data,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Could not send link', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Check your inbox', description: `Magic link sent to ${er.data}` });
      setMagicEmail('');
    }
  };

  const handleGoogle = async () => {
    try {
      setSubmitting(true);
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) {
        toast({ title: 'Google sign-in failed', description: String(result.error), variant: 'destructive' });
        setSubmitting(false);
      }
      // if redirected, browser handles it
    } catch (err: any) {
      toast({ title: 'Google sign-in failed', description: err.message, variant: 'destructive' });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (slug && !org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <h1 className="text-xl font-semibold">Organization not found</h1>
          <p className="text-sm text-muted-foreground">No organization with slug "{slug}".</p>
          <Link to="/login" className="text-primary hover:underline text-sm">Go to default login →</Link>
        </Card>
      </div>
    );
  }

  if (enabledMethods.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-3">
          <h1 className="text-xl font-semibold">Login disabled</h1>
          <p className="text-sm text-muted-foreground">No authentication methods are enabled for this organization. Please contact your administrator.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/40 p-4">
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-xl border-border/60 backdrop-blur">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          {org?.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-14 w-14 rounded-xl object-cover mb-3" />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight">{org?.name || 'Welcome back'}</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
        </div>

        {/* Google as prominent button if enabled */}
        {enabledMethods.some((m) => m.method === 'google') && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={handleGoogle}
              disabled={submitting}
            >
              <GoogleIcon />
              <span className="ml-2">Continue with Google</span>
            </Button>
            {tabMethods.length > 0 && (
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
              </div>
            )}
          </>
        )}

        {/* Tabs for the rest */}
        {tabMethods.length > 0 && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Method)}>
            {tabMethods.length > 1 && (
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabMethods.length}, minmax(0, 1fr))` }}>
                {tabMethods.map((m) => (
                  <TabsTrigger key={m.method} value={m.method} className="text-xs">
                    {labelFor(m.method)}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}

            {tabMethods.some((m) => m.method === 'email_password') && (
              <TabsContent value="email_password" className="mt-5">
                <form onSubmit={handleEmailPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" placeholder="you@example.com" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="password" type={showPwd ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" placeholder="••••••••" required />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Toggle password">
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
                  </Button>
                </form>
              </TabsContent>
            )}

            {tabMethods.some((m) => m.method === 'uid_pin') && (
              <TabsContent value="uid_pin" className="mt-5">
                <MinorLoginTab />
              </TabsContent>
            )}

            {tabMethods.some((m) => m.method === 'magic_link') && (
              <TabsContent value="magic_link" className="mt-5">
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="magic-email">Email</Label>
                    <div className="relative">
                      <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="magic-email" type="email" autoComplete="email" value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} className="pl-10" placeholder="you@example.com" required />
                    </div>
                    <p className="text-xs text-muted-foreground">We'll email you a one-time sign-in link.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send magic link'}
                  </Button>
                </form>
              </TabsContent>
            )}
          </Tabs>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Protected by {org?.name || 'your organization'}.
        </p>
      </Card>
    </div>
  );
}

function labelFor(m: Method): string {
  switch (m) {
    case 'email_password': return 'Email';
    case 'uid_pin': return 'UID + PIN';
    case 'magic_link': return 'Magic Link';
    case 'google': return 'Google';
    case 'microsoft': return 'Microsoft';
    case 'whatsapp_otp': return 'WhatsApp';
  }
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
