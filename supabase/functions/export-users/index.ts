import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ExportRequest {
  userIds?: string[];
  searchTerm?: string;
  exportType: "selected" | "filtered" | "all" | "my_division";
  format: "csv" | "xlsx";
  fields: string[];
  includePasswords?: boolean;
  adminId: string;
}

const FIELD_HEADERS: Record<string, string> = {
  id: "User ID",
  full_name: "Full Name",
  email: "Email",
  whatsapp_number: "Phone",
  role: "Role",
  status: "Status",
  account_status: "Account Status",
  gender: "Gender",
  age: "Age",
  date_of_birth: "Date of Birth",
  nationality: "Nationality",
  urn: "UID / Roll No",
  country: "Country",
  city: "City",
  timezone: "Timezone",
  first_language: "First Language",
  arabic_level: "Arabic Level",
  division: "Division",
  branch: "Branch",
  join_date: "Join Date",
  profile_completion: "Profile Completion %",
  guardian_type: "Guardian Type",
  parent_email: "Parent Email",
  parent_name: "Parent Name",
  created_at: "Created Date",
};

// Fields used to compute profile completion %
const COMPLETION_FIELDS = [
  "full_name", "email", "whatsapp_number", "gender", "age",
  "date_of_birth", "country", "city", "timezone", "nationality",
  "first_language", "arabic_level",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch caller roles
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = (callerRoles || []).map(r => r.role);
    const isSuperAdmin = roles.includes("super_admin");
    const isDivisionAdmin = roles.includes("admin_division") || roles.includes("admin");
    const isAdmissionsOrAcademic =
      roles.includes("admin_admissions") || roles.includes("admin_academic");

    if (!isSuperAdmin && !isDivisionAdmin && !isAdmissionsOrAcademic) {
      return new Response(JSON.stringify({ error: "Insufficient permissions to export users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body: ExportRequest = await req.json();
    const { userIds, searchTerm, exportType, format, fields, adminId } = body;

    console.log("Export request:", { exportType, format, fields, userCount: userIds?.length, roles });

    // Resolve caller's active division (used for division-scoped exports)
    let callerDivisionId: string | null = null;
    if (!isSuperAdmin) {
      const { data: ctx } = await adminClient
        .from("user_context")
        .select("division_id, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      callerDivisionId = ctx?.division_id || null;
    }

    // Build base query
    let query = adminClient.from("profiles").select("*");

    if (exportType === "selected" && userIds && userIds.length > 0) {
      query = query.in("id", userIds);
    } else if (exportType === "filtered" && searchTerm) {
      query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    } else if (exportType === "my_division") {
      // Will scope below using division-member ids
    } else if (exportType === "all" && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Only Super Admin can export all users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Division scoping for non-super-admin roles.
    // Mirror the UI's multi-source membership resolution so the export matches
    // the table the admin sees: user_context + 1:1 assignments + group class
    // students + group class staff + parents (via student_parent_links).
    if (!isSuperAdmin) {
      if (!callerDivisionId) {
        return new Response(JSON.stringify({ error: "No active division found for caller" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const allowed = new Set<string>();

      // 1) user_context (admins, staff bound directly)
      const { data: ctxRows } = await adminClient
        .from("user_context")
        .select("user_id")
        .eq("division_id", callerDivisionId);
      ctxRows?.forEach(r => r.user_id && allowed.add(r.user_id));

      // 2) 1:1 student_teacher_assignments (students + teachers)
      const { data: staRows } = await adminClient
        .from("student_teacher_assignments")
        .select("student_id, teacher_id")
        .eq("division_id", callerDivisionId);
      staRows?.forEach(r => {
        if (r.student_id) allowed.add(r.student_id);
        if (r.teacher_id) allowed.add(r.teacher_id);
      });

      // 3) Group classes — collect class ids in this division first
      const { data: classRows } = await adminClient
        .from("course_classes")
        .select("id, courses:courses!inner(division_id)")
        .eq("courses.division_id", callerDivisionId);
      const classIds = (classRows || []).map((c: any) => c.id);

      if (classIds.length > 0) {
        const { data: groupStudents } = await adminClient
          .from("course_class_students")
          .select("student_id")
          .in("class_id", classIds);
        groupStudents?.forEach(r => r.student_id && allowed.add(r.student_id));

        const { data: groupStaff } = await adminClient
          .from("course_class_staff")
          .select("user_id")
          .in("class_id", classIds);
        groupStaff?.forEach(r => r.user_id && allowed.add(r.user_id));
      }

      // 4) Parents inherit from any in-scope student
      const studentIds = [...allowed];
      if (studentIds.length > 0) {
        const { data: parentLinks } = await adminClient
          .from("student_parent_links")
          .select("parent_id, student_id")
          .in("student_id", studentIds);
        parentLinks?.forEach(r => r.parent_id && allowed.add(r.parent_id));
      }

      const allowedIds = [...allowed];
      if (allowedIds.length === 0) {
        return new Response(JSON.stringify({ error: "No users in your division" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Intersect with any explicit selection / filtered ids the client passed,
      // so a "selected" or "filtered" export from a division admin can never leak
      // outside their division.
      query = query.in("id", allowedIds);
    }

    const { data: profiles, error: profilesError } = await query.order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return new Response(JSON.stringify({ error: "Failed to fetch users" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ error: "No users to export" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const profileIds = profiles.map(p => p.id);

    // Roles map
    const { data: rolesData } = await adminClient
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", profileIds);
    const rolesMap: Record<string, string[]> = {};
    rolesData?.forEach(r => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });

    // Division/branch via user_context (default first)
    const needsDivisionOrBranch = fields.includes("division") || fields.includes("branch");
    const divisionMap: Record<string, string> = {};
    const branchMap: Record<string, string> = {};
    if (needsDivisionOrBranch) {
      const { data: ctxData } = await adminClient
        .from("user_context")
        .select("user_id, division_id, branch_id, is_default")
        .in("user_id", profileIds)
        .order("is_default", { ascending: false });

      const divIds = new Set<string>();
      const brIds = new Set<string>();
      const userCtx: Record<string, { division_id?: string; branch_id?: string }> = {};
      ctxData?.forEach(row => {
        if (!userCtx[row.user_id]) {
          userCtx[row.user_id] = { division_id: row.division_id, branch_id: row.branch_id };
          if (row.division_id) divIds.add(row.division_id);
          if (row.branch_id) brIds.add(row.branch_id);
        }
      });

      const divNames: Record<string, string> = {};
      const brNames: Record<string, string> = {};
      if (divIds.size > 0) {
        const { data } = await adminClient.from("divisions").select("id, name").in("id", [...divIds]);
        data?.forEach(d => { divNames[d.id] = d.name; });
      }
      if (brIds.size > 0) {
        const { data } = await adminClient.from("branches").select("id, name").in("id", [...brIds]);
        data?.forEach(b => { brNames[b.id] = b.name; });
      }
      profileIds.forEach(uid => {
        const ctx = userCtx[uid];
        if (ctx?.division_id && divNames[ctx.division_id]) divisionMap[uid] = divNames[ctx.division_id];
        if (ctx?.branch_id && brNames[ctx.branch_id]) branchMap[uid] = brNames[ctx.branch_id];
      });
    }

    // Parent info via student_parent_links
    const needsParent = fields.includes("parent_email") || fields.includes("parent_name");
    const parentEmailMap: Record<string, string> = {};
    const parentNameMap: Record<string, string> = {};
    if (needsParent) {
      const { data: links } = await adminClient
        .from("student_parent_links")
        .select("student_id, parent_id")
        .in("student_id", profileIds);
      const parentIds = [...new Set((links || []).map(l => l.parent_id).filter(Boolean))];
      const parentInfo: Record<string, { email: string; name: string }> = {};
      if (parentIds.length > 0) {
        const { data: parents } = await adminClient
          .from("profiles")
          .select("id, full_name, email")
          .in("id", parentIds);
        parents?.forEach(p => {
          parentInfo[p.id] = { email: p.email || "", name: p.full_name || "" };
        });
      }
      links?.forEach(l => {
        const info = parentInfo[l.parent_id];
        if (!info) return;
        // Take first parent encountered
        if (!parentEmailMap[l.student_id]) parentEmailMap[l.student_id] = info.email;
        if (!parentNameMap[l.student_id]) parentNameMap[l.student_id] = info.name;
      });
    }

    // Build export rows
    const exportData = profiles.map(profile => {
      const row: Record<string, string> = {};

      const completion = (() => {
        const filled = COMPLETION_FIELDS.filter(f => {
          const v = (profile as Record<string, unknown>)[f];
          return v !== null && v !== undefined && String(v).trim() !== "";
        }).length;
        return Math.round((filled / COMPLETION_FIELDS.length) * 100);
      })();

      fields.forEach(field => {
        const header = FIELD_HEADERS[field] || field;
        switch (field) {
          case "id": row[header] = profile.id; break;
          case "full_name": row[header] = profile.full_name || ""; break;
          case "email": row[header] = profile.email || ""; break;
          case "whatsapp_number": row[header] = profile.whatsapp_number || ""; break;
          case "role": row[header] = rolesMap[profile.id]?.join(", ") || "No role"; break;
          case "status": row[header] = profile.account_status || "active"; break;
          case "account_status": row[header] = profile.account_status || "active"; break;
          case "gender": row[header] = profile.gender || ""; break;
          case "age": row[header] = profile.age?.toString() || ""; break;
          case "date_of_birth":
            row[header] = profile.date_of_birth
              ? new Date(profile.date_of_birth).toISOString().slice(0, 10) : "";
            break;
          case "nationality": row[header] = profile.nationality || ""; break;
          case "urn": row[header] = profile.registration_id || ""; break;
          case "country": row[header] = profile.country || ""; break;
          case "city": row[header] = profile.city || ""; break;
          case "timezone": row[header] = profile.timezone || ""; break;
          case "first_language": row[header] = profile.first_language || ""; break;
          case "arabic_level": row[header] = profile.arabic_level || ""; break;
          case "division": row[header] = divisionMap[profile.id] || ""; break;
          case "branch": row[header] = branchMap[profile.id] || ""; break;
          case "join_date":
            row[header] = profile.created_at
              ? new Date(profile.created_at).toISOString().slice(0, 10) : "";
            break;
          case "profile_completion": row[header] = `${completion}%`; break;
          case "guardian_type": row[header] = profile.guardian_type || ""; break;
          case "parent_email": row[header] = parentEmailMap[profile.id] || ""; break;
          case "parent_name": row[header] = parentNameMap[profile.id] || ""; break;
          case "created_at":
            row[header] = profile.created_at
              ? new Date(profile.created_at).toLocaleDateString() : "";
            break;
        }
      });
      return row;
    });

    // Audit log
    const { error: auditError } = await adminClient.from("export_audit_logs").insert({
      admin_id: adminId,
      user_count: profiles.length,
      export_type: exportType,
      export_format: format,
      fields_included: fields,
      included_passwords: false,
    });
    if (auditError) console.error("Failed to log export:", auditError);

    // Generate output
    let fileContent: string;
    let contentType: string;
    let fileExtension: string;

    if (format === "csv") {
      const headers = fields.map(f => FIELD_HEADERS[f] || f);
      const csvRows = [headers.join(",")];
      exportData.forEach(row => {
        const values = headers.map(h => {
          const val = row[h] || "";
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        });
        csvRows.push(values.join(","));
      });
      fileContent = csvRows.join("\n");
      contentType = "text/csv";
      fileExtension = "csv";
    } else {
      const headers = fields.map(f => FIELD_HEADERS[f] || f);
      let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Users">
    <Table>
      <Row>`;
      headers.forEach(h => {
        xmlContent += `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
      });
      xmlContent += `</Row>`;
      exportData.forEach(row => {
        xmlContent += `<Row>`;
        headers.forEach(h => {
          const val = row[h] || "";
          xmlContent += `<Cell><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
        });
        xmlContent += `</Row>`;
      });
      xmlContent += `</Table></Worksheet></Workbook>`;
      fileContent = xmlContent;
      contentType = "application/vnd.ms-excel";
      fileExtension = "xls";
    }

    const now = new Date();
    const filename = `users_export_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}.${fileExtension}`;

    console.log(`Export complete: ${profiles.length} users, format: ${format}, file: ${filename}`);

    return new Response(fileContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    const errorMessage = error instanceof Error ? error.message : "Export failed";
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
