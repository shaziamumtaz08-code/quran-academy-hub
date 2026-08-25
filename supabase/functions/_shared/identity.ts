/**
 * Platform-wide identity resolution.
 *
 * ONE PERSON = ONE PERMANENT USER ID = ONE LOGIN IDENTITY.
 *
 * Rules (apply to every registration path — free course, paid course,
 * one-to-one, admin-created):
 *  - Email is the ONLY uniqueness key for "is this the same person".
 *  - Name is never a uniqueness key.
 *  - Phone is never a uniqueness or merge key. It is a SOFT duplicate signal
 *    only: same phone + different email => create normally, flag for review.
 *  - A submitted email is a LOOKUP key. It only becomes someone's auth login
 *    when it is confirmed to belong to that exact person.
 *  - Parent and child are always separate user ids.
 *  - Profile ids are never silently re-pointed at a different auth account.
 */

import { aqtHandleFromName } from "./aqt-email.ts";
import { defaultPasswordFor } from "./default-password.ts";
import type { IdentityConfig, RegistrationType } from "./org-identity.ts";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email?: string | null): boolean {
  return EMAIL_RE.test((email || "").trim());
}

function normEmail(email?: string | null) {
  return (email || "").toLowerCase().trim();
}

function normName(n?: string | null) {
  return (n || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normPhone(p?: string | null) {
  return (p || "").replace(/[^0-9]/g, "").slice(-10);
}

export async function findProfileByEmail(admin: any, email: string) {
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email, whatsapp_number")
    .ilike("email", normEmail(email))
    .order("created_at", { ascending: true })
    .limit(1);
  return data?.[0] ?? null;
}

export async function findAuthUserByEmail(admin: any, email: string): Promise<any | null> {
  const target = normEmail(email);
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    const found = users.find((u: any) => normEmail(u.email) === target);
    if (found) return found;
    if (users.length < 1000) break;
  }
  return null;
}

/** Academy-issued, login-only address on the organization's configured domain. */
export async function generateLoginEmail(
  admin: any,
  fullName: string,
  config: IdentityConfig,
  reserved: Set<string> = new Set(),
): Promise<string> {
  const handle = aqtHandleFromName(fullName);
  if (!handle) throw new Error(`Cannot build a login address from the name "${fullName}"`);

  for (let n = 0; n < 60; n++) {
    const candidate = `${handle}${n ? n + 1 : ""}@${config.loginDomain}`;
    if (reserved.has(candidate)) continue;
    if (await findProfileByEmail(admin, candidate)) continue;
    if (await findAuthUserByEmail(admin, candidate)) continue;
    reserved.add(candidate);
    return candidate;
  }
  throw new Error(`Could not allocate a unique login address for "${fullName}"`);
}

/**
 * Soft duplicate signal. Same phone + different email is legitimate (parents,
 * siblings) so we never merge — we only raise a flag for an admin to check.
 */
export async function flagPhoneDuplicate(
  admin: any,
  opts: { profileId: string; phone?: string | null; email: string; config: IdentityConfig },
) {
  if (!opts.config.phoneSoftDuplicateCheck) return null;
  const digits = normPhone(opts.phone);
  if (digits.length < 7) return null;

  const { data } = await admin
    .from("profiles")
    .select("id, full_name, email, whatsapp_number")
    .neq("id", opts.profileId)
    .ilike("whatsapp_number", `%${digits}`)
    .limit(5);

  const match = (data || []).find(
    (p: any) => normEmail(p.email) !== normEmail(opts.email) && normPhone(p.whatsapp_number) === digits,
  );
  if (!match) return null;

  await admin
    .from("profiles")
    .update({
      possible_duplicate_of: match.id,
      duplicate_flag_reason: `Same phone number as ${match.full_name || match.email} (different email) — verify this is a different person.`,
      duplicate_flagged_at: new Date().toISOString(),
      duplicate_reviewed_at: null,
    })
    .eq("id", opts.profileId);

  return match;
}

export interface ResolveOptions {
  /** Email submitted on the form. Lookup key — not automatically the login. */
  submittedEmail?: string | null;
  fullName: string;
  phone?: string | null;
  role: string;
  /** Extra profile columns to write on create (and merge on reuse). */
  profile?: Record<string, unknown>;
  config: IdentityConfig;
  /** Which registration workflow this person is coming through. */
  workflow: RegistrationType;
  /**
   * True when the submitted email is confirmed to belong to THIS person
   * (the registrant themselves, or a parent confirming the child's own email).
   */
  ownEmailConfirmed?: boolean;
  /** Emails already handed out inside the current request. */
  reserved?: Set<string>;
  password?: string;
}

export interface ResolvedPerson {
  ok: true;
  profileId: string;
  loginEmail: string;
  password: string;
  authCreated: boolean;
  profileCreated: boolean;
  reusedExisting: boolean;
  generatedLogin: boolean;
  duplicateFlaggedAgainst?: string | null;
}

export interface ResolveFailure {
  ok: false;
  status: number;
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Resolve (or create) the permanent user id for a person.
 * Never creates a second profile for an email that already exists, and never
 * hands one person's auth account to another person.
 */
export async function resolvePerson(
  admin: any,
  opts: ResolveOptions,
): Promise<ResolvedPerson | ResolveFailure> {
  const reserved = opts.reserved ?? new Set<string>();
  const submitted = normEmail(opts.submittedEmail);
  const fullName = (opts.fullName || "").trim() || "User";
  const password = opts.password || defaultPasswordFor(fullName);
  // Accounts handed the guessable academy default must change it at first login.
  const usedDefaultPassword = !opts.password;

  const canUseSubmittedAsLogin =
    isValidEmail(submitted) && (opts.workflow === "free" || opts.ownEmailConfirmed === true);

  // ── 1. Email lookup: does this person already exist? ────────────────────
  if (isValidEmail(submitted)) {
    const existing = await findProfileByEmail(admin, submitted);
    if (existing) {
      const sameNamedPerson = normName(existing.full_name) === normName(fullName);
      const isThisPerson = opts.workflow === "free" || opts.ownEmailConfirmed === true || sameNamedPerson;

      if (isThisPerson) {
        // Attach to the EXISTING user id — never create a second profile.
        const ensured = await ensureAuthForProfile(admin, {
          profileId: existing.id,
          email: normEmail(existing.email) || submitted,
          fullName,
          password,
        });
        if (!ensured.ok) return ensured;

        if ((opts.profile && Object.keys(opts.profile).length) || (usedDefaultPassword && ensured.authCreated)) {
          const patch: Record<string, unknown> = { ...(opts.profile || {}) };
          if (usedDefaultPassword && ensured.authCreated) patch.force_password_reset = true;
          Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
          if (Object.keys(patch).length) {
            await admin.from("profiles").update(patch).eq("id", ensured.profileId);
          }
        }
        await upsertRole(admin, ensured.profileId, opts.role);

        return {
          ok: true,
          profileId: ensured.profileId,
          loginEmail: ensured.email,
          password,
          authCreated: ensured.authCreated,
          profileCreated: false,
          reusedExisting: true,
          generatedLogin: false,
        };
      }
      // The submitted email belongs to somebody else (e.g. the parent).
      // Fall through and issue this person their own academy login.
    }
  } else if (opts.workflow === "free" && opts.config.freeRequiresOwnEmail) {
    return {
      ok: false,
      status: 400,
      code: "email_required",
      error: "Free course registration requires the student's own valid email address.",
    };
  }

  // ── 2. Decide the login identity for a brand-new person ─────────────────
  let loginEmail: string;
  let generatedLogin = false;

  if (canUseSubmittedAsLogin && !(await findAuthUserByEmail(admin, submitted))) {
    loginEmail = submitted;
  } else {
    const allowed =
      opts.workflow === "one_to_one"
        ? opts.config.oneToOneAllowsGeneratedEmail
        : opts.workflow === "paid"
        ? opts.config.paidAllowsGeneratedEmail
        : true;
    if (!allowed) {
      return {
        ok: false,
        status: 400,
        code: "own_email_required",
        error: `${fullName} needs their own email address — this academy does not issue generated logins for this workflow.`,
      };
    }
    try {
      loginEmail = await generateLoginEmail(admin, fullName, opts.config, reserved);
      generatedLogin = true;
    } catch (e: any) {
      return { ok: false, status: 400, code: "login_alloc_failed", error: e?.message || "Could not allocate a login" };
    }
  }

  // ── 3. Create the auth account first; the auth uid IS the profile id ────
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authErr || !authData?.user?.id) {
    return {
      ok: false,
      status: 500,
      code: "auth_create_failed",
      error: `Could not create a login for ${fullName}: ${authErr?.message || "unknown error"}`,
    };
  }

  const userId = authData.user.id;
  const payload: Record<string, unknown> = {
    id: userId,
    full_name: fullName,
    email: loginEmail,
    whatsapp_number: opts.phone || null,
    ...(opts.profile || {}),
    ...(usedDefaultPassword ? { force_password_reset: true } : {}),
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const { error: pErr } = await admin.from("profiles").upsert(payload, { onConflict: "id" });
  if (pErr) {
    return { ok: false, status: 500, code: "profile_create_failed", error: pErr.message };
  }

  await upsertRole(admin, userId, opts.role);

  const dup = await flagPhoneDuplicate(admin, {
    profileId: userId,
    phone: opts.phone,
    email: loginEmail,
    config: opts.config,
  });

  return {
    ok: true,
    profileId: userId,
    loginEmail,
    password,
    authCreated: true,
    profileCreated: true,
    reusedExisting: false,
    generatedLogin,
    duplicateFlaggedAgainst: dup?.id ?? null,
  };
}

async function upsertRole(admin: any, userId: string, role: string) {
  const { error } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (error) console.error(`role upsert failed for ${userId}/${role}: ${error.message}`);
}

/**
 * Make sure an existing profile has a matching auth account.
 * Historically some profiles were created without one. We adopt the auth uid
 * only after verifying the re-point actually succeeded and does not collide
 * with another person's profile — otherwise we fail loudly.
 */
async function ensureAuthForProfile(
  admin: any,
  opts: { profileId: string; email: string; fullName: string; password: string },
): Promise<{ ok: true; profileId: string; email: string; authCreated: boolean } | ResolveFailure> {
  const email = normEmail(opts.email);
  const existingAuth = await findAuthUserByEmail(admin, email);

  if (existingAuth) {
    if (existingAuth.id === opts.profileId) {
      return { ok: true, profileId: opts.profileId, email, authCreated: false };
    }
    // Auth account exists under a different id — only adopt it when no other
    // profile already owns that id (which would be a different person).
    const { data: owner } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", existingAuth.id)
      .maybeSingle();

    if (owner) {
      if (normEmail(owner.email) === email) {
        return { ok: true, profileId: owner.id, email, authCreated: false };
      }
      return {
        ok: false,
        status: 409,
        code: "identity_conflict",
        error:
          `Identity conflict: the login ${email} belongs to an account already held by ${owner.full_name || owner.id}. Admin review required.`,
        details: { auth_user_id: existingAuth.id, profile_id: opts.profileId },
      };
    }

    const { data: moved, error: moveErr } = await admin
      .from("profiles")
      .update({ id: existingAuth.id })
      .eq("id", opts.profileId)
      .select("id")
      .maybeSingle();

    if (moveErr || moved?.id !== existingAuth.id) {
      return {
        ok: false,
        status: 500,
        code: "profile_relink_failed",
        error: `Could not link profile ${opts.profileId} to its login account: ${moveErr?.message || "no row updated"}`,
      };
    }
    return { ok: true, profileId: existingAuth.id, email, authCreated: false };
  }

  // No auth account yet — create one carrying the existing profile id so the
  // permanent user id never changes.
  const { data, error } = await admin.auth.admin.createUser({
    id: opts.profileId,
    email,
    password: opts.password,
    email_confirm: true,
    user_metadata: { full_name: opts.fullName },
  } as any);

  if (error || !data?.user?.id) {
    return {
      ok: false,
      status: 500,
      code: "auth_create_failed",
      error: `Could not create a login for ${opts.fullName}: ${error?.message || "unknown error"}`,
    };
  }
  if (data.user.id !== opts.profileId) {
    return {
      ok: false,
      status: 500,
      code: "identity_conflict",
      error: `Login for ${email} was created under a different user id — aborting to avoid mixing identities.`,
    };
  }
  return { ok: true, profileId: opts.profileId, email, authCreated: true };
}
