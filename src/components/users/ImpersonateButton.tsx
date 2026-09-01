import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';

interface ImpersonateButtonProps {
  userId: string;
  userLabel?: string;
  /** Render as icon-only ghost button (default) or as a labeled button */
  variant?: 'icon' | 'labeled' | 'menu-item';
  className?: string;
  /** Where to land after sign-in. Defaults to /dashboard */
  redirectTo?: string;
}

/**
 * "Log in as user" — super_admin & admin only.
 * Calls the impersonate-user edge function, signs the current user out,
 * then redirects the browser through the generated magic link.
 */
export function ImpersonateButton({
  userId,
  userLabel,
  variant = 'icon',
  className,
  redirectTo,
}: ImpersonateButtonProps) {
  const { activeRole, user: currentUser } = useAuth();
  const { activeDivision } = useDivision();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const canImpersonate =
    (activeRole === 'super_admin' || activeRole === 'admin') &&
    userId !== currentUser?.id;
  if (!canImpersonate) return null;

  const label = userLabel || 'this user';

  const handleClick = async () => {
    setLoading(true);
    // Open the tab synchronously (inside the click) so popup blockers allow it,
    // then navigate it once we have the magic link.
    const newTab = window.open('about:blank', '_blank');
    // Paint a loading state immediately — otherwise the tab sits on a blank
    // white page while the edge function runs and looks like it never loads.
    try {
      newTab?.document.write(
        '<title>Starting session…</title><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font:14px system-ui;color:#475569;background:#f8fafc">Starting session…</body>',
      );
      newTab?.document.close();
    } catch { /* noop */ }

    try {
      const target = redirectTo || '/dashboard';
      const targetPath = target.startsWith('http')
        ? new URL(target).pathname + new URL(target).search
        : target;

      // The stored access token can be stale (expired, or belonging to a session
      // that was signed out elsewhere) — that makes the edge function reject the
      // call with "Invalid session". Force a refresh and use the fresh token.
      let accessToken: string | undefined;
      const { data: sessionData } = await supabase.auth.getSession();
      accessToken = sessionData.session?.access_token;
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.session?.access_token) accessToken = refreshed.session.access_token;

      if (!accessToken) {
        if (newTab) newTab.close();
        toast({
          title: 'Session expired',
          description: 'Please sign in again, then retry impersonation.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: {
          targetUserId: userId,
          redirectTo: `${window.location.origin}/impersonate`,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error || !(data?.tokenHash || data?.actionLink)) {
        if (newTab) newTab.close();
        // supabase-js hides the response body behind error.context — read it so
        // the admin sees the real reason (no email, permission, etc.).
        let reason = data?.error as string | undefined;
        const ctx = (error as any)?.context;
        if (!reason && ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.json();
            reason = body?.error;
          } catch { /* noop */ }
        }
        toast({
          title: 'Impersonation failed',
          description: reason || error?.message || 'Unable to generate sign-in link',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }


      // Verify the one-time token inside our own app (?impersonate=1 keeps the
      // session in sessionStorage) instead of relying on Supabase's redirect,
      // which 404s when the origin isn't in the auth redirect allow-list.
      const landing = data.tokenHash
        ? `${window.location.origin}/impersonate?impersonate=1&th=${encodeURIComponent(
            data.tokenHash,
          )}&next=${encodeURIComponent(targetPath)}${
            activeDivision?.id ? `&div=${encodeURIComponent(activeDivision.id)}` : ''
          }`
        : data.actionLink;

      if (newTab && !newTab.closed) {
        newTab.location.href = landing;
        toast({
          title: 'Impersonation started',
          description: `Opened ${label}'s session in a new tab. Close that tab to end impersonation.`,
        });
      } else {
        // Popup blocked (common inside the embedded preview). Offer to switch
        // this tab instead — the impersonated session is sessionStorage-scoped,
        // so the admin's own login survives in localStorage.
        const go = window.confirm(
          `Your browser blocked the new tab. Open ${label}'s session in this tab instead?`,
        );
        if (go) {
          window.location.href = landing;
          return;
        }
        toast({
          title: 'Popup blocked',
          description: 'Allow popups for this site to open the user session in a new tab.',
          variant: 'destructive',
        });
      }
      setLoading(false);

    } catch (e: any) {
      if (newTab) newTab.close();
      toast({
        title: 'Impersonation failed',
        description: e?.message || 'Unexpected error',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  if (variant === 'labeled') {
    return (
      <Button size="sm" variant="outline" onClick={handleClick} disabled={loading} className={className}>
        {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5 mr-1.5" />}
        Log in as
      </Button>
    );
  }

  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`flex items-center w-full px-2 py-1.5 text-sm rounded-sm hover:bg-accent text-violet-600 disabled:opacity-50 ${className || ''}`}
      >
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
        Log in as user
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      title={`Log in as ${label}`}
      className={`text-violet-600 hover:text-violet-700 ${className || ''}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
    </Button>
  );
}
