import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportRow {
  rowNum: number;
  status: "new" | "update" | "warning";
  data: Record<string, any>;
  existingId: string | null;
}

interface ImportResult {
  rowNum: number;
  success: boolean;
  action: "created" | "updated" | "skipped";
  id: string | null;
  error: string | null;
  userName: string | null; // Added for detailed error messages
}

// Look up an existing auth user id by email (auth enforces unique emails)
async function findAuthUserIdByEmail(supabase: any, email: string): Promise<string | null> {
  const target = (email || "").trim().toLowerCase();
  if (!target) return null;

  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to lookup auth user for email "${email}": ${error.message}`);
    }

    const found = data?.users?.find((u: any) => (u.email || "").toLowerCase() === target);
    if (found) return found.id;

    if (!data?.users || data.users.length < perPage) return null;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, rows } = await req.json();

    console.log(`[bulk-import-execute] Executing ${rows?.length || 0} ${type} imports`);

    if (!type || !["users", "assignments", "schedules"].includes(type)) {
      throw new Error("Invalid type. Must be 'users', 'assignments', or 'schedules'");
    }

    if (!rows || !Array.isArray(rows)) {
      throw new Error("No rows provided for import");
    }

    // Filter out error rows - only process new, update, and warning rows
    const validRows: ImportRow[] = rows.filter(
      (r: any) => r.status === "new" || r.status === "update" || r.status === "warning"
    );

    const results: ImportResult[] = [];

    if (type === "users") {
      for (const row of validRows) {
        const userName = row.data.full_name || `Row ${row.rowNum}`;
        try {
          if (row.status === "update" && row.existingId) {
            // Update existing user profile
            const updateData: Record<string, any> = {
              updated_at: new Date().toISOString(),
            };

            // Only update fields that have values
            if (row.data.email) updateData.email = row.data.email;
            // Phone stored exactly as provided (E.164 format validated upstream)
            const rawWhatsapp = row.data.whatsapp_number || row.data.phone;
            if (rawWhatsapp !== undefined && rawWhatsapp !== null && 
                String(rawWhatsapp).toLowerCase() !== 'nan' && 
                String(rawWhatsapp).toLowerCase() !== 'n/a' &&
                String(rawWhatsapp).trim() !== '') {
              updateData.whatsapp_number = String(rawWhatsapp).trim();
            }
            if (row.data.age !== undefined) updateData.age = row.data.age;
            if (row.data.gender !== undefined) updateData.gender = row.data.gender;

            const { error } = await supabase
              .from("profiles")
              .update(updateData)
              .eq("id", row.existingId);

            if (error) throw error;

            // Ensure role is assigned even for updates (fixes previously imported users that ended up with no role)
            const normalizedRole = (row.data.role || "").toString().trim().toLowerCase();
            if (normalizedRole) {
              const { error: roleErr } = await supabase.from("user_roles").upsert(
                {
                  user_id: row.existingId,
                  role: normalizedRole,
                },
                { onConflict: "user_id,role" }
              );
              if (roleErr) {
                console.error(`[bulk-import-execute] Role assignment failed for ${userName}:`, roleErr);
              }
            }

            console.log(`[bulk-import-execute] Updated user: ${userName} (${row.existingId})`);

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "updated",
              id: row.existingId,
              error: null,
              userName,
            });
          } else if (row.status === "new" || row.status === "warning") {
            const normalizedEmail = (row.data.email || "").toString().trim().toLowerCase();
            const fullName = (row.data.full_name || "").toString().trim();

            // If a profile with the same NAME+EMAIL already exists, update it (idempotent import)
            if (normalizedEmail && fullName) {
              const { data: existingProfile, error: existingProfileError } = await supabase
                .from("profiles")
                .select("id")
                .eq("full_name", fullName)
                .eq("email", normalizedEmail)
                .maybeSingle();

              if (existingProfileError) throw existingProfileError;

              if (existingProfile?.id) {
                const updateData: Record<string, any> = {
                  updated_at: new Date().toISOString(),
                };

                // Phone stored exactly as provided (E.164 format validated upstream)
                const rawWhatsapp2 = row.data.whatsapp_number || row.data.phone;
                if (rawWhatsapp2 !== undefined && rawWhatsapp2 !== null && 
                    String(rawWhatsapp2).toLowerCase() !== 'nan' && 
                    String(rawWhatsapp2).toLowerCase() !== 'n/a' &&
                    String(rawWhatsapp2).trim() !== '') {
                  updateData.whatsapp_number = String(rawWhatsapp2).trim();
                }
                if (row.data.age !== undefined) updateData.age = row.data.age;
                if (row.data.gender !== undefined) updateData.gender = row.data.gender;

                const { error: updateErr } = await supabase
                  .from("profiles")
                  .update(updateData)
                  .eq("id", existingProfile.id);

                if (updateErr) throw updateErr;

                // Best-effort role insert
                const { error: roleErr } = await supabase.from("user_roles").insert({
                  user_id: existingProfile.id,
                  role: row.data.role,
                });
                if (roleErr) {
                  console.error(`[bulk-import-execute] Role assignment failed for ${userName}:`, roleErr);
                }

                console.log(`[bulk-import-execute] Updated user (matched by name+email): ${userName} (${existingProfile.id})`);

                results.push({
                  rowNum: row.rowNum,
                  success: true,
                  action: "updated",
                  id: existingProfile.id,
                  error: null,
                  userName,
                });

                continue;
              }
            }

            // NEW LOGIC: For students, each row should create a SEPARATE profile
            // even if they share an email (e.g., siblings using parent's email)
            // Only the first user with an email gets an auth account; others get profiles only
            
            let userId: string | null = null;
            let isNewAuthUser = false;

            // First, check if an auth user with this email already exists
            const existingAuthId = await findAuthUserIdByEmail(supabase, normalizedEmail);

            if (existingAuthId) {
              // Auth user exists - check if this exact person (name + email) already has a profile
              const { data: existingPersonProfile } = await supabase
                .from("profiles")
                .select("id")
                .eq("full_name", fullName)
                .eq("email", normalizedEmail)
                .maybeSingle();

              if (existingPersonProfile?.id) {
                // This exact person already exists, update them
                userId = existingPersonProfile.id;
                console.log(`[bulk-import-execute] Found existing profile for ${fullName} with email ${normalizedEmail}`);
              } else {
                // Different person with same email (e.g., sibling) - create new profile with new UUID
                userId = crypto.randomUUID();
                console.log(`[bulk-import-execute] Creating new profile (${userId}) for ${fullName} sharing email ${normalizedEmail}`);
              }
            } else {
              // No auth user exists - create one
              const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: normalizedEmail,
                password: row.data.password,
                email_confirm: true,
              });

              if (authError) {
                throw new Error(`Auth user creation failed: ${authError.message}`);
              }

              userId = authData.user.id;
              isNewAuthUser = true;
              console.log(`[bulk-import-execute] Created new auth user ${userId} for ${fullName}`);
            }

            // Insert or update profile
            // Phone stored exactly as provided (E.164 format validated upstream)
            const rawWhatsapp3 = row.data.whatsapp_number || row.data.phone;
            const cleanWhatsapp = (rawWhatsapp3 !== undefined && rawWhatsapp3 !== null && 
                String(rawWhatsapp3).toLowerCase() !== 'nan' && 
                String(rawWhatsapp3).toLowerCase() !== 'n/a' &&
                String(rawWhatsapp3).trim() !== '') ? String(rawWhatsapp3).trim() : null;
            
            const { error: profileError } = await supabase.from("profiles").upsert(
              {
                id: userId,
                email: normalizedEmail,
                full_name: row.data.full_name,
                whatsapp_number: cleanWhatsapp,
                age: row.data.age,
                gender: row.data.gender,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );

            if (profileError) {
              console.error(`[bulk-import-execute] Profile upsert failed for ${userName}:`, profileError);
              throw new Error(`Profile upsert failed: ${profileError.message}`);
            }

            // Assign role (ignore duplicate errors)
            const { error: roleError } = await supabase.from("user_roles").insert({
              user_id: userId,
              role: row.data.role,
            });

            if (roleError && !roleError.message.includes("duplicate")) {
              console.error(`[bulk-import-execute] Role assignment failed for ${userName}:`, roleError);
            }

            const action: ImportResult["action"] = isNewAuthUser ? "created" : "created"; // Both are creates for profile
            console.log(
              `[bulk-import-execute] Created profile: ${userName} (${userId}) as ${row.data.role}${existingAuthId && !isNewAuthUser ? " (shared email)" : ""}`
            );

            results.push({
              rowNum: row.rowNum,
              success: true,
              action,
              id: userId,
              error: null,
              userName,
            });
          }
        } catch (error: any) {
          console.error(`[bulk-import-execute] User row ${row.rowNum} (${userName}) failed:`, error);
          results.push({
            rowNum: row.rowNum,
            success: false,
            action: "skipped",
            id: null,
            error: error.message || "Unknown error",
            userName,
          });
        }
      }
    } else if (type === "assignments") {
      for (const row of validRows) {
        const assignmentName = `${row.data.teacher_name} → ${row.data.student_name}`;
        try {
          // Resolve timezones from profiles
          let studentTz: string | null = null;
          let teacherTz: string | null = null;

          if (row.data.student_id) {
            const { data: sp } = await supabase
              .from("profiles")
              .select("timezone")
              .eq("id", row.data.student_id)
              .maybeSingle();
            studentTz = sp?.timezone || null;
          }
          if (row.data.teacher_id) {
            const { data: tp } = await supabase
              .from("profiles")
              .select("timezone")
              .eq("id", row.data.teacher_id)
              .maybeSingle();
            teacherTz = tp?.timezone || null;
          }

          if (row.status === "update" && row.existingId) {
            const updateData: Record<string, any> = {
              subject_id: row.data.subject_id,
            };
            if (studentTz) updateData.student_timezone = studentTz;
            if (teacherTz) updateData.teacher_timezone = teacherTz;

            const { error } = await supabase
              .from("student_teacher_assignments")
              .update(updateData)
              .eq("id", row.existingId);

            if (error) throw error;

            console.log(`[bulk-import-execute] Updated assignment: ${assignmentName}`);

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "updated",
              id: row.existingId,
              error: null,
              userName: assignmentName,
            });
          } else if (row.status === "new" || row.status === "warning") {
            const insertData: Record<string, any> = {
              teacher_id: row.data.teacher_id,
              student_id: row.data.student_id,
              subject_id: row.data.subject_id,
            };
            if (studentTz) insertData.student_timezone = studentTz;
            if (teacherTz) insertData.teacher_timezone = teacherTz;

            const { data, error } = await supabase
              .from("student_teacher_assignments")
              .insert(insertData)
              .select("id")
              .single();

            if (error) throw error;

            console.log(`[bulk-import-execute] Created assignment: ${assignmentName}`);

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "created",
              id: data.id,
              error: null,
              userName: assignmentName,
            });
          }
        } catch (error: any) {
          console.error(`[bulk-import-execute] Assignment row ${row.rowNum} (${assignmentName}) failed:`, error);
          results.push({
            rowNum: row.rowNum,
            success: false,
            action: "skipped",
            id: null,
            error: error.message || "Unknown error",
            userName: assignmentName,
          });
        }
      }
    } else if (type === "schedules") {
      for (const row of validRows) {
        const scheduleName = `${row.data.teacher_name} → ${row.data.student_name} (${row.data.day_of_week})`;
        try {
          if (row.status === "update" && row.existingId) {
            // Update existing schedule
            const { error } = await supabase
              .from("schedules")
              .update({
                duration_minutes: row.data.duration_minutes,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.existingId);

            if (error) throw error;

            console.log(`[bulk-import-execute] Updated schedule: ${scheduleName}`);

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "updated",
              id: row.existingId,
              error: null,
              userName: scheduleName,
            });
          } else if (row.status === "new" || row.status === "warning") {
            // Create new schedule
            const { data, error } = await supabase
              .from("schedules")
              .insert({
                assignment_id: row.data.assignment_id,
                day_of_week: row.data.day_of_week,
                student_local_time: row.data.student_local_time,
                teacher_local_time: row.data.teacher_local_time,
                duration_minutes: row.data.duration_minutes,
                is_active: true,
              })
              .select("id")
              .single();

            if (error) throw error;

            console.log(`[bulk-import-execute] Created schedule: ${scheduleName}`);

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "created",
              id: data.id,
              error: null,
              userName: scheduleName,
            });
          }
        } catch (error: any) {
          console.error(`[bulk-import-execute] Schedule row ${row.rowNum} (${scheduleName}) failed:`, error);
          results.push({
            rowNum: row.rowNum,
            success: false,
            action: "skipped",
            id: null,
            error: error.message || "Unknown error",
            userName: scheduleName,
          });
        }
      }
    }

    const summary = {
      total: validRows.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      created: results.filter((r) => r.action === "created").length,
      updated: results.filter((r) => r.action === "updated").length,
    };

    console.log(`[bulk-import-execute] Summary:`, summary);

    return new Response(
      JSON.stringify({ summary, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[bulk-import-execute] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
