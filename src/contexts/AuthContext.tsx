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
  useEffect(() => {
    if (!profile?.roles?.length) {
      if (activeRole) setActiveRoleState(null);
      return;
    }

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
    setActiveRoleState(role);
  };

  // Fetch user profile and ALL roles
  const fetchProfile = async (userId: string) => {
    try {
      // Get profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("Error fetching profile:", profileError);
      }

      // Get ALL user roles (not just one)
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (rolesError && rolesError.code !== "PGRST116") {
        console.error("Error fetching roles:", rolesError);
      }

      const roles: AppRole[] = (rolesData || []).map((r) => r.role as AppRole);
      const primaryRole = getPrimaryRole(roles);

      setProfile({
        id: userId,
        email: profileData?.email || null,
        full_name: profileData?.full_name || "User",
        roles,
        role: primaryRole,
      });

      setActiveRoleState((currentRole) => {
        if (!primaryRole) return null;
        return currentRole && roles.includes(currentRole) ? currentRole : primaryRole;
      });
    } catch (error) {
      console.error("Error in fetchProfile:", error);
    }
  };

  useEffect(() => {
    let initialised = false;

    // THEN check for existing session first to set initial state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setActiveRoleState(null);
        setActiveRolePermissions([]);

        // Defer to avoid Supabase deadlock on rapid state changes
        setTimeout(() => {
          fetchProfile(session.user.id).finally(() => {
            // Ensure isLoading is resolved even if getSession didn't fire yet
            if (!initialised) {
              initialised = true;
              setIsLoading(false);
            }
          });
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        // Only clear profile on explicit sign-out, not transient auth events
        setProfile(null);
        setActiveRoleState(null);
        setActiveRolePermissions([]);
        if (!initialised) {
          initialised = true;
          setIsLoading(false);
        }
      }
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
    // Check based on activeRole, not all roles
    if (activeRole === "super_admin") {
      return true;
    }
    // Check if active role has this permission
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
