import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parsePhoneNumber, isValidPhoneNumber } from "https://esm.sh/libphonenumber-js@1.10.53";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationResult {
  rowNum: number;
  status: "new" | "update" | "warning" | "error";
  errors: string[];
  warnings: string[];
  data: Record<string, any>;
  diff: Record<string, { old: any; new: any }> | null;
  existingId: string | null;
}

interface ValidationResponse {
  summary: {
    total: number;
    new: number;
    updates: number;
    warnings: number;
    errors: number;
  };
  rows: ValidationResult[];
}

// Detect Excel scientific notation (e.g., 9.23E+11)
function isScientificNotation(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return /^\d+\.?\d*[eE][+\-]?\d+$/.test(value.trim());
}

// Validate and normalize phone number
function validatePhone(
  rawPhone: string | null | undefined,
  defaultCountry: string = "PK"
): {
  valid: boolean;
  critical: boolean;
  normalized: string | null;
  error: string | null;
  warning: string | null;
  original: string | null;
} {
  if (!rawPhone || rawPhone.trim() === "" || rawPhone.toLowerCase() === "n/a") {
    return { valid: true, critical: false, normalized: null, error: null, warning: null, original: null };
  }

  const trimmed = rawPhone.trim();

  // Check for Excel scientific notation - CRITICAL ERROR
  if (isScientificNotation(trimmed)) {
    return {
      valid: false,
      critical: true,
      normalized: null,
      error: "CRITICAL: Phone appears to be Excel scientific notation (e.g., 9.23E+11). Re-export CSV with phone column formatted as Text.",
      warning: null,
      original: trimmed,
    };
  }

  try {
    // Try to parse the phone number
    const phone = parsePhoneNumber(trimmed, defaultCountry as any);
    
    if (!phone || !phone.isValid()) {
      return {
        valid: false,
        critical: true,
        normalized: null,
        error: `Invalid phone number format: "${trimmed}"`,
        warning: null,
        original: trimmed,
      };
    }

    // Get E.164 format
    const e164 = phone.format("E.164");

    // Check if landline
    const numType = phone.getType();
    const isLandline = numType === "FIXED_LINE";
    
    return {
      valid: true,
      critical: false,
      normalized: e164,
      error: null,
      warning: isLandline ? "Landline detected - SMS/WhatsApp won't work" : null,
      original: trimmed,
    };
  } catch (e) {
    return {
      valid: false,
      critical: true,
      normalized: null,
      error: `Could not parse phone number: "${trimmed}"`,
      warning: null,
      original: trimmed,
    };
  }
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate user row
async function validateUserRow(
  row: Record<string, any>,
  rowNum: number,
  existingUsers: Map<string, any>,
  defaultCountry: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let status: ValidationResult["status"] = "new";
  let diff: Record<string, { old: any; new: any }> | null = null;
  let existingId: string | null = null;

  const email = row.email?.trim()?.toLowerCase();
  const fullName = row.full_name?.trim();
  const role = row.role?.trim()?.toLowerCase();
  const whatsappNumber = row.whatsapp_number?.trim();
  const age = row.age ? parseInt(row.age) : null;
  const gender = row.gender?.trim()?.toLowerCase();
  const password = row.password?.trim();

  // Required field validation
  if (!email) {
    errors.push("Email is required");
  } else if (!isValidEmail(email)) {
    errors.push(`Invalid email format: "${email}"`);
  }

  if (!fullName || fullName.length < 2) {
    errors.push("Full name is required (min 2 characters)");
  }

  if (!role) {
    errors.push("Role is required");
  } else {
    const validRoles = ["admin", "teacher", "student", "parent", "examiner", "super_admin", "admin_admissions", "admin_fees", "admin_academic"];
    if (!validRoles.includes(role)) {
      errors.push(`Invalid role: "${role}". Valid: ${validRoles.join(", ")}`);
    }
  }

  if (!password || password.length < 6) {
    errors.push("Password is required (min 6 characters)");
  }

  // Phone validation with libphonenumber-js
  const phoneResult = validatePhone(whatsappNumber, defaultCountry);
  if (phoneResult.critical) {
    errors.push(phoneResult.error!);
  } else if (phoneResult.warning) {
    warnings.push(phoneResult.warning);
  }

  // Age validation
  if (age !== null && (isNaN(age) || age < 1 || age > 120)) {
    errors.push(`Invalid age: "${row.age}"`);
  }

  // Gender validation
  if (gender && !["male", "female", "other"].includes(gender)) {
    errors.push(`Invalid gender: "${gender}". Valid: male, female, other`);
  }

  // Check if user exists (for upsert)
  if (email && existingUsers.has(email)) {
    const existing = existingUsers.get(email);
    existingId = existing.id;
    status = "update";
    diff = {};

    // Calculate diff
    if (existing.full_name !== fullName) {
      diff.full_name = { old: existing.full_name, new: fullName };
    }
    if (existing.whatsapp_number !== phoneResult.normalized) {
      diff.whatsapp_number = { old: existing.whatsapp_number, new: phoneResult.normalized };
    }
    if (existing.age !== age) {
      diff.age = { old: existing.age, new: age };
    }
    if (existing.gender !== gender) {
      diff.gender = { old: existing.gender, new: gender };
    }

    if (Object.keys(diff).length === 0) {
      diff = null;
      warnings.push("No changes detected - row will be skipped");
    }
  }

  // Determine final status
  if (errors.length > 0) {
    status = "error";
  } else if (warnings.length > 0 && status !== "update") {
    status = "warning";
  }

  return {
    rowNum,
    status,
    errors,
    warnings,
    data: {
      email,
      full_name: fullName,
      role,
      whatsapp_number: phoneResult.normalized,
      age,
      gender,
      password,
    },
    diff,
    existingId,
  };
}

// Validate assignment row
async function validateAssignmentRow(
  row: Record<string, any>,
  rowNum: number,
  teacherMap: Map<string, string>,
  studentMap: Map<string, string>,
  subjectMap: Map<string, string>,
  existingAssignments: Map<string, any>
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let status: ValidationResult["status"] = "new";
  let diff: Record<string, { old: any; new: any }> | null = null;
  let existingId: string | null = null;

  const teacherName = row.teacher_name?.trim();
  const studentName = row.student_name?.trim();
  const subjectName = row.subject_name?.trim();

  // Validate teacher
  let teacherId: string | null = null;
  if (!teacherName) {
    errors.push("Teacher name is required");
  } else {
    teacherId = teacherMap.get(teacherName.toLowerCase()) || null;
    if (!teacherId) {
      errors.push(`Teacher not found: "${teacherName}"`);
    }
  }

  // Validate student
  let studentId: string | null = null;
  if (!studentName) {
    errors.push("Student name is required");
  } else {
    studentId = studentMap.get(studentName.toLowerCase()) || null;
    if (!studentId) {
      errors.push(`Student not found: "${studentName}"`);
    }
  }

  // Validate subject (optional)
  let subjectId: string | null = null;
  if (subjectName) {
    subjectId = subjectMap.get(subjectName.toLowerCase()) || null;
    if (!subjectId) {
      errors.push(`Subject not found: "${subjectName}"`);
    }
  }

  // Check for existing assignment (upsert by teacher+student)
  if (teacherId && studentId) {
    const key = `${teacherId}:${studentId}`;
    if (existingAssignments.has(key)) {
      const existing = existingAssignments.get(key);
      existingId = existing.id;
      status = "update";
      diff = {};

      if (existing.subject_id !== subjectId) {
        diff.subject = { old: existing.subject_name || "(none)", new: subjectName || "(none)" };
      }

      if (Object.keys(diff).length === 0) {
        diff = null;
        warnings.push("No changes detected - row will be skipped");
      }
    }
  }

  if (errors.length > 0) {
    status = "error";
  } else if (warnings.length > 0 && status !== "update") {
    status = "warning";
  }

  return {
    rowNum,
    status,
    errors,
    warnings,
    data: {
      teacher_id: teacherId,
      teacher_name: teacherName,
      student_id: studentId,
      student_name: studentName,
      subject_id: subjectId,
      subject_name: subjectName,
    },
    diff,
    existingId,
  };
}

// Validate schedule row
async function validateScheduleRow(
  row: Record<string, any>,
  rowNum: number,
  teacherMap: Map<string, string>,
  studentMap: Map<string, string>,
  assignmentMap: Map<string, any>,
  existingSchedules: Map<string, any>
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let status: ValidationResult["status"] = "new";
  let diff: Record<string, { old: any; new: any }> | null = null;
  let existingId: string | null = null;

  const teacherName = row.teacher_name?.trim();
  const studentName = row.student_name?.trim();
  const dayOfWeek = row.day_of_week?.trim();
  const time = row.time?.trim();
  const duration = row.duration_minutes ? parseInt(row.duration_minutes) : 30;

  // Validate teacher and student
  let teacherId: string | null = null;
  let studentId: string | null = null;

  if (!teacherName) {
    errors.push("Teacher name is required");
  } else {
    teacherId = teacherMap.get(teacherName.toLowerCase()) || null;
    if (!teacherId) {
      errors.push(`Teacher not found: "${teacherName}"`);
    }
  }

  if (!studentName) {
    errors.push("Student name is required");
  } else {
    studentId = studentMap.get(studentName.toLowerCase()) || null;
    if (!studentId) {
      errors.push(`Student not found: "${studentName}"`);
    }
  }

  // Find assignment
  let assignmentId: string | null = null;
  if (teacherId && studentId) {
    const key = `${teacherId}:${studentId}`;
    const assignment = assignmentMap.get(key);
    if (!assignment) {
      errors.push(`No assignment found for teacher "${teacherName}" and student "${studentName}"`);
    } else {
      assignmentId = assignment.id;
    }
  }

  // Validate day
  const dayMap: Record<string, string> = {
    mon: "monday", monday: "monday",
    tue: "tuesday", tuesday: "tuesday",
    wed: "wednesday", wednesday: "wednesday",
    thu: "thursday", thursday: "thursday",
    fri: "friday", friday: "friday",
    sat: "saturday", saturday: "saturday",
    sun: "sunday", sunday: "sunday",
  };
  
  let normalizedDay: string | null = null;
  if (!dayOfWeek) {
    errors.push("Day of week is required");
  } else {
    normalizedDay = dayMap[dayOfWeek.toLowerCase()] || null;
    if (!normalizedDay) {
      errors.push(`Invalid day: "${dayOfWeek}". Valid: Mon, Tue, Wed, Thu, Fri, Sat, Sun`);
    }
  }

  // Validate and normalize time
  let normalizedTime: string | null = null;
  if (!time) {
    errors.push("Time is required");
  } else {
    // Try to parse time in various formats
    const timeMatch = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2];
      const period = timeMatch[3]?.toUpperCase();

      if (period === "PM" && hours < 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      normalizedTime = `${hours.toString().padStart(2, "0")}:${minutes}`;
    } else {
      errors.push(`Invalid time format: "${time}". Use HH:MM or H:MM AM/PM`);
    }
  }

  // Validate duration
  if (isNaN(duration) || duration < 15 || duration > 180) {
    errors.push(`Invalid duration: "${row.duration_minutes}". Must be 15-180 minutes`);
  }

  // Check for existing schedule (upsert by assignment+day+time)
  if (assignmentId && normalizedDay && normalizedTime) {
    const key = `${assignmentId}:${normalizedDay}:${normalizedTime}`;
    if (existingSchedules.has(key)) {
      const existing = existingSchedules.get(key);
      existingId = existing.id;
      status = "update";
      diff = {};

      if (existing.duration_minutes !== duration) {
        diff.duration_minutes = { old: existing.duration_minutes, new: duration };
      }

      if (Object.keys(diff).length === 0) {
        diff = null;
        warnings.push("No changes detected - row will be skipped");
      }
    }
  }

  if (errors.length > 0) {
    status = "error";
  } else if (warnings.length > 0 && status !== "update") {
    status = "warning";
  }

  return {
    rowNum,
    status,
    errors,
    warnings,
    data: {
      assignment_id: assignmentId,
      teacher_name: teacherName,
      student_name: studentName,
      day_of_week: normalizedDay,
      student_local_time: normalizedTime,
      teacher_local_time: normalizedTime, // Will be calculated properly in execute
      duration_minutes: duration,
    },
    diff,
    existingId,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, rows, defaultCountry = "PK" } = await req.json();

    console.log(`[bulk-validate-import] Validating ${rows?.length || 0} ${type} rows`);

    if (!type || !["users", "assignments", "schedules"].includes(type)) {
      throw new Error("Invalid type. Must be 'users', 'assignments', or 'schedules'");
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new Error("No rows provided for validation");
    }

    const validationResults: ValidationResult[] = [];

    if (type === "users") {
      // Fetch existing users for upsert matching
      const { data: existingUsersData } = await supabase
        .from("profiles")
        .select("id, email, full_name, whatsapp_number, age, gender");

      const existingUsers = new Map<string, any>();
      existingUsersData?.forEach((u) => {
        if (u.email) existingUsers.set(u.email.toLowerCase(), u);
      });

      for (let i = 0; i < rows.length; i++) {
        const result = await validateUserRow(rows[i], i + 1, existingUsers, defaultCountry);
        validationResults.push(result);
      }
    } else if (type === "assignments") {
      // Fetch teachers, students, subjects, and existing assignments
      const { data: teachers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", (await supabase.from("user_roles").select("user_id").eq("role", "teacher")).data?.map((r) => r.user_id) || []);

      const { data: students } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", (await supabase.from("user_roles").select("user_id").eq("role", "student")).data?.map((r) => r.user_id) || []);

      const { data: subjects } = await supabase.from("subjects").select("id, name");

      const { data: existingAssignmentsData } = await supabase
        .from("student_teacher_assignments")
        .select("id, teacher_id, student_id, subject_id, subjects(name)");

      const teacherMap = new Map<string, string>();
      teachers?.forEach((t) => teacherMap.set(t.full_name.toLowerCase(), t.id));

      const studentMap = new Map<string, string>();
      students?.forEach((s) => studentMap.set(s.full_name.toLowerCase(), s.id));

      const subjectMap = new Map<string, string>();
      subjects?.forEach((s) => subjectMap.set(s.name.toLowerCase(), s.id));

      const existingAssignments = new Map<string, any>();
      existingAssignmentsData?.forEach((a: any) => {
        existingAssignments.set(`${a.teacher_id}:${a.student_id}`, {
          id: a.id,
          subject_id: a.subject_id,
          subject_name: a.subjects?.name,
        });
      });

      for (let i = 0; i < rows.length; i++) {
        const result = await validateAssignmentRow(
          rows[i], i + 1, teacherMap, studentMap, subjectMap, existingAssignments
        );
        validationResults.push(result);
      }
    } else if (type === "schedules") {
      // Fetch teachers, students, assignments, and existing schedules
      const { data: teachers } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", (await supabase.from("user_roles").select("user_id").eq("role", "teacher")).data?.map((r) => r.user_id) || []);

      const { data: students } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", (await supabase.from("user_roles").select("user_id").eq("role", "student")).data?.map((r) => r.user_id) || []);

      const { data: assignments } = await supabase
        .from("student_teacher_assignments")
        .select("id, teacher_id, student_id");

      const { data: existingSchedulesData } = await supabase
        .from("schedules")
        .select("id, assignment_id, day_of_week, student_local_time, duration_minutes");

      const teacherMap = new Map<string, string>();
      teachers?.forEach((t) => teacherMap.set(t.full_name.toLowerCase(), t.id));

      const studentMap = new Map<string, string>();
      students?.forEach((s) => studentMap.set(s.full_name.toLowerCase(), s.id));

      const assignmentMap = new Map<string, any>();
      assignments?.forEach((a) => {
        assignmentMap.set(`${a.teacher_id}:${a.student_id}`, { id: a.id });
      });

      const existingSchedules = new Map<string, any>();
      existingSchedulesData?.forEach((s) => {
        existingSchedules.set(`${s.assignment_id}:${s.day_of_week}:${s.student_local_time}`, s);
      });

      for (let i = 0; i < rows.length; i++) {
        const result = await validateScheduleRow(
          rows[i], i + 1, teacherMap, studentMap, assignmentMap, existingSchedules
        );
        validationResults.push(result);
      }
    }

    // Calculate summary
    const summary = {
      total: validationResults.length,
      new: validationResults.filter((r) => r.status === "new").length,
      updates: validationResults.filter((r) => r.status === "update").length,
      warnings: validationResults.filter((r) => r.status === "warning" || r.warnings.length > 0).length,
      errors: validationResults.filter((r) => r.status === "error").length,
    };

    console.log(`[bulk-validate-import] Summary:`, summary);

    const response: ValidationResponse = {
      summary,
      rows: validationResults,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[bulk-validate-import] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
