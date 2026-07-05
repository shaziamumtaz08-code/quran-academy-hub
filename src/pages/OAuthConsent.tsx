import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * Typed façade over the (beta) `supabase.auth.oauth` namespace so this page
 * compiles regardless of the currently installed supabase-js version.
 */
type AuthorizationDetails = {
  client?: { name?: string; logo_uri?: string; client_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
  scope?: string[] | string;
};
type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

/**
 * `next` is user-controlled; only forward it back to the login page when it is
 * a same-origin relative path. Anything else falls back to just `/login`.
 */
function safeRelative(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/login";
  return next;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error: err } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (err) return setError(err.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load authorization request.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (err) {
        setBusy(false);
        return setError(err.message);
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        return setError("No redirect returned by the authorization server.");
      }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Could not complete the authorization.");
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
        <Card className="max-w-md w-full p-6 space-y-3">
          <h1 className="text-lg font-semibold">Authorization problem</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>Return to app</Button>
        </Card>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </main>
    );
  }

  const clientName = details.client?.name ?? "an external app";
  const scopeList = Array.isArray(details.scope)
    ? details.scope
    : typeof details.scope === "string"
    ? details.scope.split(" ").filter(Boolean)
    : [];

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-slate-100">
      <Card className="max-w-md w-full p-8 space-y-5 bg-slate-900/80 border-slate-800 text-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Connect {clientName}</h1>
            <p className="text-xs text-slate-400">to your Al Quran Time Academy account</p>
          </div>
        </div>

        <p className="text-sm text-slate-300">
          {clientName} is requesting permission to act as you inside this app. It will only see
          data your role already allows you to view.
        </p>

        {scopeList.length > 0 && (
          <div className="text-xs bg-slate-800/60 rounded-md p-3 space-y-1">
            <div className="font-medium text-slate-200">Requested scopes</div>
            <ul className="list-disc list-inside text-slate-400">
              {scopeList.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => decide(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
          </Button>
          <Button variant="outline" className="flex-1 border-slate-700 text-slate-200 hover:bg-slate-800" disabled={busy} onClick={() => decide(false)}>
            Deny
          </Button>
        </div>
      </Card>
    </main>
  );
}

export { safeRelative };
