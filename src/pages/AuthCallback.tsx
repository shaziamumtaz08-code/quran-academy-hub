import { Link, useSearchParams } from 'react-router-dom';

/**
 * Landing page for external OAuth redirects (e.g. the Zoom Marketplace app's
 * "OAuth Redirect URL"). Zoom only needs this URL to exist and respond — the
 * LMS itself signs Meeting SDK requests server-side, so nothing is exchanged
 * here. We simply acknowledge the redirect and point the user back into the app.
 */
export default function AuthCallback() {
  const [params] = useSearchParams();
  const hasCode = Boolean(params.get('code'));
  const error = params.get('error_description') || params.get('error');

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">
          {error ? 'Authorization failed' : hasCode ? 'Zoom app authorized' : 'Authorization callback'}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {error
            ? error
            : hasCode
              ? 'You can close this tab and return to the Zoom Marketplace — the app has been approved for this domain.'
              : 'This page handles redirects from connected apps. Nothing further is needed here.'}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Return to the LMS
        </Link>
      </div>
    </main>
  );
}
