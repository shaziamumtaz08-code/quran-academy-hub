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
    if (!confirm(`Log in as ${label}? You will be signed out of your admin account.`)) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: {
          targetUserId: userId,
          redirectTo: redirectTo || `${window.location.origin}/dashboard`,
        },
      });
      if (error || !data?.actionLink) {
        toast({
          title: 'Impersonation failed',
          description: error?.message || data?.error || 'Unable to generate sign-in link',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      await supabase.auth.signOut();
      window.location.href = data.actionLink;
    } catch (e: any) {
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
