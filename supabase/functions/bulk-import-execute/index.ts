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
        try {
          if (row.status === "update" && row.existingId) {
            // Update existing user profile
            const { error } = await supabase
              .from("profiles")
              .update({
                full_name: row.data.full_name,
                whatsapp_number: row.data.whatsapp_number,
                age: row.data.age,
                gender: row.data.gender,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.existingId);

            if (error) throw error;

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "updated",
              id: row.existingId,
              error: null,
            });
          } else if (row.status === "new" || row.status === "warning") {
            // Create new user via auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
              email: row.data.email,
              password: row.data.password,
              email_confirm: true,
            });

            if (authError) throw authError;

            const userId = authData.user.id;

            // Create profile
            const { error: profileError } = await supabase.from("profiles").insert({
              id: userId,
              email: row.data.email,
              full_name: row.data.full_name,
              whatsapp_number: row.data.whatsapp_number,
              age: row.data.age,
              gender: row.data.gender,
            });

            if (profileError) {
              console.error(`Profile creation failed for ${row.data.email}:`, profileError);
            }

            // Assign role
            const { error: roleError } = await supabase.from("user_roles").insert({
              user_id: userId,
              role: row.data.role,
            });

            if (roleError) {
              console.error(`Role assignment failed for ${row.data.email}:`, roleError);
            }

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "created",
              id: userId,
              error: null,
            });
          }
        } catch (error: any) {
          console.error(`[bulk-import-execute] User row ${row.rowNum} failed:`, error);
          results.push({
            rowNum: row.rowNum,
            success: false,
            action: "skipped",
            id: null,
            error: error.message || "Unknown error",
          });
        }
      }
    } else if (type === "assignments") {
      for (const row of validRows) {
        try {
          if (row.status === "update" && row.existingId) {
            // Update existing assignment
            const { error } = await supabase
              .from("student_teacher_assignments")
              .update({
                subject_id: row.data.subject_id,
              })
              .eq("id", row.existingId);

            if (error) throw error;

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "updated",
              id: row.existingId,
              error: null,
            });
          } else if (row.status === "new" || row.status === "warning") {
            // Create new assignment
            const { data, error } = await supabase
              .from("student_teacher_assignments")
              .insert({
                teacher_id: row.data.teacher_id,
                student_id: row.data.student_id,
                subject_id: row.data.subject_id,
              })
              .select("id")
              .single();

            if (error) throw error;

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "created",
              id: data.id,
              error: null,
            });
          }
        } catch (error: any) {
          console.error(`[bulk-import-execute] Assignment row ${row.rowNum} failed:`, error);
          results.push({
            rowNum: row.rowNum,
            success: false,
            action: "skipped",
            id: null,
            error: error.message || "Unknown error",
          });
        }
      }
    } else if (type === "schedules") {
      for (const row of validRows) {
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

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "updated",
              id: row.existingId,
              error: null,
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

            results.push({
              rowNum: row.rowNum,
              success: true,
              action: "created",
              id: data.id,
              error: null,
            });
          }
        } catch (error: any) {
          console.error(`[bulk-import-execute] Schedule row ${row.rowNum} failed:`, error);
          results.push({
            rowNum: row.rowNum,
            success: false,
            action: "skipped",
            id: null,
            error: error.message || "Unknown error",
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
