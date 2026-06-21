import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const canImpersonate =
    (activeRole === 'super_admin' || activeRole === 'admin') &&
    userId !== currentUser?.id;
  if (!canImpersonate) return null;

  const label = userLabel || 'this user';

  const handleClick = async () => {
    if (!confirm(`Open ${label}'s dashboard in a new tab? You will stay signed in as admin in this tab.`)) return;
    setLoading(true);
    // Open the tab synchronously (inside the click) so popup blockers allow it,
    // then navigate it once we have the magic link.
    const newTab = window.open('about:blank', '_blank');
    try {
      const target = redirectTo || `${window.location.origin}/dashboard`;
      // Append impersonate=1 so the new tab's supabase client uses sessionStorage
      // and a unique storage key — keeping admin's session intact in this tab.
      const sep = target.includes('?') ? '&' : '?';
      const impersonateRedirect = `${target}${sep}impersonate=1`;

      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: {
          targetUserId: userId,
          redirectTo: impersonateRedirect,
        },
      });
      if (error || !data?.actionLink) {
        if (newTab) newTab.close();
        toast({
          title: 'Impersonation failed',
          description: error?.message || data?.error || 'Unable to generate sign-in link',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      if (newTab) {
        newTab.location.href = data.actionLink;
      } else {
        // Popup was blocked — fall back to opening in this tab is undesirable;
        // surface a clear message instead.
        toast({
          title: 'Popup blocked',
          description: 'Allow popups for this site to open the user session in a new tab.',
          variant: 'destructive',
        });
      }
      toast({
        title: 'Impersonation started',
        description: `Opened ${label}'s session in a new tab. Close that tab to end impersonation.`,
      });
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
