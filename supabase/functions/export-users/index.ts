import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ExportRequest {
  userIds?: string[]; // For selected users
  searchTerm?: string; // For filtered users
  exportType: "selected" | "filtered" | "all";
  format: "csv" | "xlsx";
  fields: string[];
  includePasswords: boolean;
  adminId: string;
}

const FIELD_HEADERS: Record<string, string> = {
  id: "User ID",
  full_name: "Full Name",
  email: "Email",
  whatsapp_number: "Phone",
  role: "Role",
  status: "Status",
  gender: "Gender",
  age: "Age",
  country: "Country",
  city: "City",
  created_at: "Created Date",
  password: "Password",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token to verify super_admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is super_admin
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has super_admin role
    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      console.error("User is not super_admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Only Super Admin can export users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ExportRequest = await req.json();
    const { userIds, searchTerm, exportType, format, fields, includePasswords, adminId } = body;

    console.log("Export request:", { exportType, format, fields, includePasswords, userCount: userIds?.length });

    // Use service role client for fetching all users and auth data
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch users based on export type
    let query = adminClient.from("profiles").select("*");

    if (exportType === "selected" && userIds && userIds.length > 0) {
      query = query.in("id", userIds);
    } else if (exportType === "filtered" && searchTerm) {
      query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const { data: profiles, error: profilesError } = await query.order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch users" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No users to export" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch roles for all users
    const userIdsToFetch = profiles.map(p => p.id);
    const { data: rolesData } = await adminClient
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIdsToFetch);

    const rolesMap: Record<string, string[]> = {};
    rolesData?.forEach(r => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });

    // Fetch passwords from auth.users if requested
    let passwordsMap: Record<string, string> = {};
    if (includePasswords && fields.includes("password")) {
      // Note: Supabase Auth hashes passwords - they cannot be retrieved in plain text
      // This would require a custom password field stored in profiles
      // For now, we'll show "N/A - Auth Managed" as passwords are not stored in plain text
      console.log("Password export requested - passwords are managed by auth system");
    }

    // Build export data
    const exportData = profiles.map(profile => {
      const row: Record<string, string> = {};
      
      fields.forEach(field => {
        switch (field) {
          case "id":
            row[FIELD_HEADERS[field]] = profile.id;
            break;
          case "full_name":
            row[FIELD_HEADERS[field]] = profile.full_name || "";
            break;
          case "email":
            row[FIELD_HEADERS[field]] = profile.email || "";
            break;
          case "whatsapp_number":
            row[FIELD_HEADERS[field]] = profile.whatsapp_number || "";
            break;
          case "role":
            row[FIELD_HEADERS[field]] = rolesMap[profile.id]?.join(", ") || "No role";
            break;
          case "status":
            row[FIELD_HEADERS[field]] = "Active"; // Could be derived from other data
            break;
          case "gender":
            row[FIELD_HEADERS[field]] = profile.gender || "";
            break;
          case "age":
            row[FIELD_HEADERS[field]] = profile.age?.toString() || "";
            break;
          case "country":
            row[FIELD_HEADERS[field]] = profile.country || "";
            break;
          case "city":
            row[FIELD_HEADERS[field]] = profile.city || "";
            break;
          case "created_at":
            row[FIELD_HEADERS[field]] = profile.created_at 
              ? new Date(profile.created_at).toLocaleDateString()
              : "";
            break;
          case "password":
            // Passwords in Supabase Auth are hashed and cannot be retrieved
            row[FIELD_HEADERS[field]] = passwordsMap[profile.id] || "N/A - Auth Managed";
            break;
        }
      });
      
      return row;
    });

    // Log the export action
    const { error: auditError } = await adminClient.from("export_audit_logs").insert({
      admin_id: adminId,
      user_count: profiles.length,
      export_type: exportType,
      export_format: format,
      fields_included: fields,
      included_passwords: includePasswords,
    });

    if (auditError) {
      console.error("Failed to log export:", auditError);
      // Don't fail the export for audit log failure
    }

    // Generate file content
    let fileContent: string;
    let contentType: string;
    let fileExtension: string;

    if (format === "csv") {
      // Generate CSV
      const headers = fields.map(f => FIELD_HEADERS[f] || f);
      const csvRows = [headers.join(",")];
      
      exportData.forEach(row => {
        const values = headers.map(h => {
          const val = row[h] || "";
          // Escape quotes and wrap in quotes if contains comma or quote
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
      // Generate simple XLSX-compatible XML (Excel can open this)
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

    // Generate filename
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 16).replace(/[-:T]/g, "_").replace("_", "_");
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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
