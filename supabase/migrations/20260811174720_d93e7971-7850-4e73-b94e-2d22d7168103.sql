-- 1. Ensure course webhook secret is never exposed to public/authenticated readers
REVOKE SELECT (webhook_secret) ON public.courses FROM anon, authenticated;

-- 2. Organizations: allow only non-sensitive columns to authenticated readers; settings stays admin-only via RPC
REVOKE SELECT ON public.organizations FROM anon, authenticated;
GRANT SELECT (id, name, slug, logo_url, code, created_at, updated_at) ON public.organizations TO authenticated;

DROP POLICY IF EXISTS "Authenticated view organization basics" ON public.organizations;
CREATE POLICY "Authenticated view organization basics"
ON public.organizations
FOR SELECT
TO authenticated
USING (true);
