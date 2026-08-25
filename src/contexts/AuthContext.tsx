import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin"
  | "admin"
  | "admin_division"
  | "admin_admissions"
  | "admin_fees"
  | "admin_academic"
  | "teacher"
  | "student"
  | "parent"
  | "examiner";

// Role priority for determining primary role (lower = higher priority)
const ROLE_PRIORITY: Record<AppRole, number> = {
  super_admin: 1,
  admin: 2,
  admin_division: 2,
  admin_admissions: 3,
  admin_fees: 4,
  admin_academic: 5,
  examiner: 6,
  teacher: 7,
  parent: 8,
  student: 9,
};

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string;
  roles: AppRole[];
  role: AppRole | null; // Primary role (for backward compatibility)
  force_password_reset?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  isSuperAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
  activeRole: AppRole | null;
  setActiveRole: (role: AppRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Get primary role from array of roles
function getPrimaryRole(roles: AppRole[]): AppRole | null {
  if (roles.length === 0) return null;
  return roles.reduce((primary, current) => {
    return ROLE_PRIORITY[current] < ROLE_PRIORITY[primary] ? current : primary;
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<AppRole | null>(null);
  const [activeRolePermissions, setActiveRolePermissions] = useState<string[]>([]);

  // Keep active role aligned with the current authenticated user's real roles.
  // NOTE: Only clear activeRole if the user has no roles AND no profile at all
  // (i.e. fully signed out). A transient empty-roles read must NOT wipe it,
  // otherwise RouteGuard bounces the user back to /login on the next click.
  useEffect(() => {
    if (!profile) return;
    if (!profile.roles?.length) return; // keep last known activeRole
    if (!activeRole || !profile.roles.includes(activeRole)) {
      setActiveRoleState(profile.role || profile.roles[0]);
    }
  }, [profile, activeRole]);

  // Fetch permissions for the active role
  useEffect(() => {
    const fetchActiveRolePermissions = async () => {
      if (!activeRole) {
        setActiveRolePermissions([]);
        return;
      }

      // Super admin has all permissions - no need to fetch
      if (activeRole === "super_admin") {
        setActiveRolePermissions(["*"]); // Special marker for all permissions
        return;
      }

      const { data: templateData } = await supabase
        .from("role_templates")
        .select("permissions")
        .eq("role", activeRole)
        .single();

      setActiveRolePermissions(templateData?.permissions || []);
    };

    fetchActiveRolePermissions();
  }, [activeRole]);

  const setActiveRole = (role: AppRole) => {
    // Guard against client-side role escalation: only allow switching to a
    // role that the user actually holds according to their profile.
    if (profile?.roles?.includes(role)) {
      setActiveRoleState(role);
    } else {
      console.warn(`[AuthContext] Blocked setActiveRole(${role}) — user does not hold this role.`);
    }
  };

  // Fetch user profile and ALL roles.
  // IMPORTANT: On transient errors (network blip, 429 rate-limit on mobile),
  // do NOT overwrite an existing good profile with null/empty. That would
  // clear activeRole and cause RouteGuard to redirect to /login on next click.
  const fetchProfile = async (userId: string) => {
    try {
      const [{ data: profileData, error: profileError }, { data: rolesData, error: rolesError }] =
        await Promise.all([
          supabase.from("profiles").select("id, email, full_name, force_password_reset").eq("id", userId).single(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);

      const profileFailed = profileError && profileError.code !== "PGRST116";
      const rolesFailed = !!rolesError;

      // If the roles read failed transiently, keep whatever we had — never
      // clear roles/activeRole based on an errored response.
      if (rolesFailed) {
        console.warn("[AuthContext] Transient roles fetch error; keeping cached roles.", rolesError);
        return;
      }
      if (profileFailed) {
        console.warn("[AuthContext] Transient profile fetch error.", profileError);
      }

      const roles: AppRole[] = (rolesData || []).map((r) => r.role as AppRole);

      setProfile((prev) => {
        // If roles came back empty but we previously had roles for this same
        // user, treat as transient (RLS/session hiccup) and keep the cached set.
        const effectiveRoles =
          roles.length === 0 && prev && prev.id === userId && prev.roles.length > 0
            ? prev.roles
            : roles;
        const primaryRole = getPrimaryRole(effectiveRoles);
        return {
          id: userId,
          email: profileData?.email ?? prev?.email ?? null,
          full_name: profileData?.full_name ?? prev?.full_name ?? "User",
          force_password_reset:
            (profileData as any)?.force_password_reset ?? prev?.force_password_reset ?? false,
          roles: effectiveRoles,
          role: primaryRole,
        };
      });

      setActiveRoleState((currentRole) => {
        const effectiveRoles =
          roles.length === 0 && currentRole ? [currentRole] : roles;
        const primaryRole = getPrimaryRole(effectiveRoles);
        if (!primaryRole) return currentRole; // keep whatever we had
        return currentRole && effectiveRoles.includes(currentRole) ? currentRole : primaryRole;
      });
    } catch (error) {
      console.error("Error in fetchProfile:", error);
    }
  };

  useEffect(() => {
    let initialised = false;
    // Track which user id we've already loaded a profile for. Supabase's
    // onAuthStateChange fires SIGNED_IN not only on real sign-in, but ALSO
    // whenever the tab regains focus and the session is re-hydrated / a token
    // is refreshed. Treating those as fresh sign-ins flips isLoading=true,
    // which unmounts every page (RouteGuard/DashboardLayout show a spinner)
    // and wipes local view state (open dialogs, "which record am I editing").
    // We must only run the full sign-in flow when the user actually changes.
    let loadedUserId: string | null = null;

    // THEN check for existing session first to set initial state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadedUserId = session.user.id;
        fetchProfile(session.user.id).finally(() => {
          initialised = true;
          setIsLoading(false);
        });
      } else {
        initialised = true;
        setIsLoading(false);
      }
    });

    // Auth state listener handles subsequent changes (token refresh, sign out, etc.)
    // IMPORTANT: Only re-fetch profile on real sign-in events. Re-fetching on
    // every TOKEN_REFRESHED spams /token and profiles reads, which on mobile
    // networks hits Supabase's 429 rate-limit and causes intermittent redirects
    // back to /login when the user clicks anything.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' && session?.user) {
        // Supabase fires SIGNED_IN on tab refocus too. Only run the full
        // loading flow when the signed-in user is genuinely new (or first),
        // otherwise every tab switch unmounts the current view and resets
        // local state.
        if (loadedUserId === session.user.id) {
          if (!initialised) {
            initialised = true;
            setIsLoading(false);
          }
          return;
        }
        loadedUserId = session.user.id;
        // Gate downstream guards until profile is loaded to avoid redirect races.
        setIsLoading(true);
        setTimeout(() => {
          fetchProfile(session.user.id).finally(() => {
            initialised = true;
            setIsLoading(false);
          });
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        loadedUserId = null;
        setProfile(null);
        setActiveRoleState(null);
        setActiveRolePermissions([]);
        if (!initialised) {
          initialised = true;
          setIsLoading(false);
        }
      }
      // TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION → just update session,
      // do NOT re-fetch profile. Initial load is handled by getSession() above.
    });

    return () => subscription.unsubscribe();
  }, []);


  // Update user's timezone in profile ONLY if not already set
  const updateUserTimezone = async (userId: string) => {
    try {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!browserTimezone) return;

      // Only set timezone if the profile doesn't already have one
      const { data: existing } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", userId)
        .single();

      if (existing?.timezone) return; // Already has a timezone, don't overwrite

      const { error } = await supabase.from("profiles").update({ timezone: browserTimezone }).eq("id", userId);

      if (error) {
        console.warn("Failed to update timezone:", error.message);
      }
    } catch (err) {
      console.warn("Error detecting/updating timezone:", err);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // On successful login, update the user's timezone silently
      if (!error && data?.user?.id) {
        // Don't await - update timezone in background
        updateUserTimezone(data.user.id);
        // Fire-and-forget activity log
        import('@/lib/activityLogger').then(({ trackActivity }) =>
          trackActivity({
            action: 'login_success', entityType: 'auth', entityLabel: email,
          })
        ).catch(() => {});
      } else if (error) {
        // Log failed attempts (best-effort; will only persist if a session exists)
        console.warn('Login failed for', email);
      }

      return { error: error ? new Error(error.message) : null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      // Create profile for new user
      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: data.user.id,
          email: email,
          full_name: fullName,
        });

        if (profileError) {
          console.error("Error creating profile:", profileError);
        }

        // Assign default student role
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "student",
        });

        if (roleError) {
          console.error("Error assigning role:", roleError);
        }

        // Resolve default tenant context and ensure user_context row (non-fatal)
        try {
          const { data: ctxSetting } = await supabase
            .from("app_settings")
            .select("setting_value")
            .eq("setting_key", "default_signup_context")
            .maybeSingle();
          const v = ctxSetting?.setting_value as
            | { organization_id?: string; branch_id?: string; division_id?: string }
            | undefined;
          if (v?.organization_id) {
            const { error: ctxErr } = await supabase.rpc("ensure_user_context", {
              p_user_id: data.user.id,
              p_organization_id: v.organization_id,
              p_branch_id: v.branch_id ?? null,
              p_division_id: v.division_id ?? null,
              p_primary_role: "student",
            });
            if (ctxErr) console.warn("user_context insert failed:", ctxErr.message);
          } else {
            console.warn("default_signup_context missing in app_settings; skipping user_context");
          }
        } catch (e: any) {
          console.warn("user_context resolution threw:", e?.message);
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const logout = async () => {
    // Clear stored email history on logout for privacy
    try {
      localStorage.removeItem("lms_recent_emails");
    } catch {
      // Ignore storage errors
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setActiveRolePermissions([]);
    setActiveRoleState(null);
  };

  const hasPermission = (permission: string): boolean => {
    // super_admin: unrestricted
    if (activeRole === "super_admin") return true;
    // admin_division: full access within their division scope (division filtering
    // is enforced separately by the Division Context Engine)
    if (activeRole === "admin_division") return true;
    return activeRolePermissions.includes(permission);
  };

  const hasRole = (role: AppRole): boolean => {
    return profile?.roles.includes(role) || false;
  };

  // isSuperAdmin should check activeRole for consistency
  const isSuperAdmin = activeRole === "super_admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        login,
        signUp,
        logout,
        isAuthenticated: !!user,
        hasPermission,
        isSuperAdmin,
        hasRole,
        activeRole,
        setActiveRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
