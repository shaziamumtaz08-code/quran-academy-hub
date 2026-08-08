/**
 * Per-organization identity configuration.
 *
 * SaaS-readiness: the academy-issued login domain and the free / paid /
 * one-to-one workflow rules live in `public.org_identity_config`, never in
 * code. Another academy on this platform gets its own row.
 */

export interface IdentityConfig {
  loginDomain: string;
  loginEmailPattern: string;
  freeRequiresOwnEmail: boolean;
  paidAllowsGeneratedEmail: boolean;
  oneToOneAllowsGeneratedEmail: boolean;
  phoneSoftDuplicateCheck: boolean;
}

/** Last-resort fallback if the config table is empty (fresh install). */
const FALLBACK: IdentityConfig = {
  loginDomain: "alqurantimeacademy.com",
  loginEmailPattern: "first.last",
  freeRequiresOwnEmail: true,
  paidAllowsGeneratedEmail: true,
  oneToOneAllowsGeneratedEmail: true,
  phoneSoftDuplicateCheck: true,
};

export async function loadIdentityConfig(admin: any, orgId?: string | null): Promise<IdentityConfig> {
  let q = admin
    .from("org_identity_config")
    .select("*")
    .order("is_default", { ascending: false })
    .limit(1);
  if (orgId) q = q.eq("org_id", orgId);

  const { data } = await q.maybeSingle();
  if (!data) return { ...FALLBACK };

  return {
    loginDomain: data.login_domain || FALLBACK.loginDomain,
    loginEmailPattern: data.login_email_pattern || FALLBACK.loginEmailPattern,
    freeRequiresOwnEmail: data.free_requires_own_email ?? FALLBACK.freeRequiresOwnEmail,
    paidAllowsGeneratedEmail: data.paid_allows_generated_email ?? FALLBACK.paidAllowsGeneratedEmail,
    oneToOneAllowsGeneratedEmail:
      data.one_to_one_allows_generated_email ?? FALLBACK.oneToOneAllowsGeneratedEmail,
    phoneSoftDuplicateCheck: data.phone_soft_duplicate_check ?? FALLBACK.phoneSoftDuplicateCheck,
  };
}

export type RegistrationType = "free" | "paid" | "one_to_one";

export function normaliseRegistrationType(value: unknown): RegistrationType {
  const v = String(value || "").toLowerCase();
  if (v === "free" || v === "paid" || v === "one_to_one") return v;
  return "paid";
}
