import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username, pin } = await req.json();

    // Validate input
    if (
      !username ||
      typeof username !== "string" ||
      !pin ||
      typeof pin !== "string"
    ) {
      return new Response(
        JSON.stringify({ error: "Username and PIN are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "PIN must be exactly 4 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Look up credentials
    const { data: cred, error: credError } = await supabase
      .from("minor_credentials")
      .select("id, profile_id, pin_hash, failed_attempts, locked_until")
      .eq("username", username.toLowerCase().trim())
      .single();

    if (credError || !cred) {
      return new Response(
        JSON.stringify({ error: "Invalid username or PIN" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check lockout
    if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
      const remainingMin = Math.ceil(
        (new Date(cred.locked_until).getTime() - Date.now()) / 60000
      );
      return new Response(
        JSON.stringify({
          error: `Account locked. Try again in ${remainingMin} minute(s).`,
          locked: true,
          remaining_minutes: remainingMin,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify PIN
    const pinHash = await hashPin(pin);

    if (pinHash !== cred.pin_hash) {
      const newAttempts = (cred.failed_attempts || 0) + 1;
      const updateData: Record<string, unknown> = {
        failed_attempts: newAttempts,
      };

      if (newAttempts >= MAX_ATTEMPTS) {
        updateData.locked_until = new Date(
          Date.now() + LOCKOUT_MINUTES * 60 * 1000
        ).toISOString();
      }

      await supabase
        .from("minor_credentials")
        .update(updateData)
        .eq("id", cred.id);

      const attemptsLeft = MAX_ATTEMPTS - newAttempts;
      return new Response(
        JSON.stringify({
          error:
            attemptsLeft > 0
              ? `Invalid PIN. ${attemptsLeft} attempt(s) remaining.`
              : `Account locked for ${LOCKOUT_MINUTES} minutes.`,
          attempts_remaining: Math.max(0, attemptsLeft),
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PIN correct — reset failed attempts
    await supabase
      .from("minor_credentials")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("id", cred.id);

    // Get profile info
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("id", cred.profile_id)
      .single();

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", cred.profile_id)
      .limit(1)
      .single();

    // Check if there's an auth user linked — if so, generate a session
    // For minors without auth.users entry, we return profile data for client-side session
    const { data: authUser } = await supabase.auth.admin.getUserById(cred.profile_id);

    let session = null;
    if (authUser?.user) {
      // Generate a magic link token for the user (auto-login)
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: authUser.user.email!,
      });
      if (linkData?.properties?.hashed_token) {
        session = {
          type: "magic_link",
          hashed_token: linkData.properties.hashed_token,
          email: authUser.user.email,
        };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile: {
          id: profile?.id || cred.profile_id,
          full_name: profile?.full_name,
          avatar_url: profile?.avatar_url,
          role: roleData?.role || "student",
        },
        session,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
