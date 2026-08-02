import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * Landing page for the admin "Log in as user" flow.
 * Opened in a new tab with ?impersonate=1&th=<token_hash>. The supabase client
 * detects impersonate=1 and scopes this tab's session to sessionStorage, so the
 * admin's own session in the original tab stays untouched.
 */
export default function Impersonate() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const tokenHash = params.get('th');
    const next = params.get('next') || '/dashboard';
    if (!tokenHash) {
      setError('Missing impersonation token.');
      return;
    }

    (async () => {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: tokenHash,
      });
      if (verifyError) {
        setError(verifyError.message || 'Could not start the impersonated session.');
        return;
      }
      const sep = next.includes('?') ? '&' : '?';
      navigate(`${next}${sep}impersonate=1`, { replace: true });
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      {error ? (
        <div className="max-w-md text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-lg font-bold text-foreground">Impersonation failed</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">
            The link may have already been used or expired. Close this tab and try again.
          </p>
        </div>
      ) : (
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Starting session…</p>
        </div>
      )}
    </div>
  );
}
