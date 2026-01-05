import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Validate E.164 phone number format: +<country_code><number> (7-15 digits total after +)
function isValidE164(phone: string): boolean {
  // E.164: starts with +, followed by 7-15 digits (no spaces, dashes, or other characters)
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

// Validate phone number - E.164 ONLY, no country-specific parsing or auto-prefixing
function validatePhone(rawPhone: string | null | undefined): {
  valid: boolean;
  critical: boolean;
  value: string | null;
  error: string | null;
  warning: string | null;
} {
  // Empty/null values are allowed (phone is optional)
  if (!rawPhone || rawPhone.trim() === "" || rawPhone.toLowerCase() === "n/a" || rawPhone.toLowerCase() === "nan") {
    return { valid: true, critical: false, value: null, error: null, warning: null };
  }

  const trimmed = rawPhone.trim();

  // Check for Excel scientific notation - CRITICAL ERROR
  if (isScientificNotation(trimmed)) {
    return {
      valid: false,
      critical: true,
      value: null,
      error: "CRITICAL: Phone appears to be Excel scientific notation (e.g., 9.23E+11). Re-export CSV with phone column formatted as Text.",
      warning: null,
    };
  }

  // Validate E.164 format strictly
  if (!isValidE164(trimmed)) {
    return {
      valid: false,
      critical: true,
      value: null,
      error: `Invalid phone format: "${trimmed}". Must be E.164 format: +<country_code><number> (e.g., +923001234567, +971564548951, +15108572790)`,
      warning: null,
    };
  }

  // Valid E.164 - store exactly as provided (no normalization)
  return {
    valid: true,
    critical: false,
    value: trimmed,
    error: null,
    warning: null,
  };
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate user row - using full_name (username) as unique key to allow duplicate emails
async function validateUserRow(
  row: Record<string, any>,
  rowNum: number,
  existingUsersByName: Map<string, any>,
  existingEmails: Set<string>
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let status: ValidationResult["status"] = "new";
  let diff: Record<string, { old: any; new: any }> | null = null;
  let existingId: string | null = null;

  const email = row.email?.trim()?.toLowerCase();
  const fullName = row.full_name?.trim();
  const role = row.role?.trim()?.toLowerCase();
  // Support both 'phone' and 'whatsapp_number' column names, filter out 'nan' values
  const rawWhatsapp = (row.whatsapp_number || row.phone)?.trim();
  const whatsappNumber = rawWhatsapp && rawWhatsapp.toLowerCase() !== 'nan' && rawWhatsapp.toLowerCase() !== 'n/a' ? rawWhatsapp : null;
  const age = row.age ? parseInt(row.age) : null;
  const gender = row.gender?.trim()?.toLowerCase();
  const password = row.password?.trim();

  // Required field validation - full_name is the unique key
  if (!fullName || fullName.length < 2) {
    errors.push("Full name (username) is required (min 2 characters)");
  }

  // Email is optional but validate format if provided
  if (email && !isValidEmail(email)) {
    errors.push(`Invalid email format: "${email}"`);
  }

  if (!role) {
    errors.push("Role is required");
  } else {
    const validRoles = ["admin", "teacher", "student", "parent", "examiner", "super_admin", "admin_admissions", "admin_fees", "admin_academic"];
    if (!validRoles.includes(role)) {
      errors.push(`Invalid role: "${role}". Valid: ${validRoles.join(", ")}`);
    }
  }

  // Phone validation - E.164 format only, no country-specific parsing
  const phoneResult = validatePhone(whatsappNumber);
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

  // Check if user exists by full_name (username) for upsert
  const nameKey = fullName?.toLowerCase();
  if (nameKey && existingUsersByName.has(nameKey)) {
    const existing = existingUsersByName.get(nameKey);
    existingId = existing.id;
    status = "update";
    diff = {};

    // Calculate diff
    if (existing.email !== email) {
      diff.email = { old: existing.email, new: email };
    }
    if (existing.whatsapp_number !== phoneResult.value) {
      diff.whatsapp_number = { old: existing.whatsapp_number, new: phoneResult.value };
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
  } else {
    // New user - password is required
    if (!password || password.length < 6) {
      errors.push("Password is required for new users (min 6 characters)");
    }
    // Email required for new users (for auth)
    if (!email) {
      errors.push("Email is required for new users");
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
      whatsapp_number: phoneResult.value,
      age,
      gender,
      password,
    },
    diff,
    existingId,
  };
}

// Validate assignment row - uses both name AND email for lookup (handles siblings with shared emails)
async function validateAssignmentRow(
  row: Record<string, any>,
  rowNum: number,
  allTeachers: Array<{ id: string; full_name: string; email: string | null }>,
  allStudents: Array<{ id: string; full_name: string; email: string | null }>,
  subjectMap: Map<string, string>,
  existingAssignments: Map<string, any>
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let status: ValidationResult["status"] = "new";
  let diff: Record<string, { old: any; new: any }> | null = null;
  let existingId: string | null = null;

  const teacherName = row.teacher_name?.trim();
  const teacherEmail = row.teacher_email?.trim()?.toLowerCase();
  const studentName = row.student_name?.trim();
  const studentEmail = row.student_email?.trim()?.toLowerCase();
  const subjectName = row.subject_name?.trim();

  // Validate teacher by both name AND email
  let teacherId: string | null = null;
  let resolvedTeacherName: string | null = null;
  if (!teacherName) {
    errors.push("Teacher name is required");
  } else if (!teacherEmail) {
    errors.push("Teacher email is required");
  } else {
    // Find teacher matching BOTH name and email
    const teacher = allTeachers.find(
      (t) => t.full_name?.toLowerCase() === teacherName.toLowerCase() && 
             t.email?.toLowerCase() === teacherEmail
    );
    if (!teacher) {
      // Check if name exists but email doesn't match
      const nameMatch = allTeachers.find((t) => t.full_name?.toLowerCase() === teacherName.toLowerCase());
      const emailMatch = allTeachers.find((t) => t.email?.toLowerCase() === teacherEmail);
      
      if (nameMatch && emailMatch && nameMatch.id !== emailMatch.id) {
        errors.push(`Teacher name "${teacherName}" and email "${teacherEmail}" belong to different users`);
      } else if (nameMatch) {
        errors.push(`Teacher "${teacherName}" found but email doesn't match (expected: ${nameMatch.email || "no email"})`);
      } else if (emailMatch) {
        errors.push(`Email "${teacherEmail}" found but name doesn't match (expected: ${emailMatch.full_name})`);
      } else {
        errors.push(`Teacher not found with name "${teacherName}" and email "${teacherEmail}"`);
      }
    } else {
      teacherId = teacher.id;
      resolvedTeacherName = teacher.full_name;
    }
  }

  // Validate student by both name AND email (important for siblings sharing same email)
  let studentId: string | null = null;
  let resolvedStudentName: string | null = null;
  if (!studentName) {
    errors.push("Student name is required");
  } else if (!studentEmail) {
    errors.push("Student email is required");
  } else {
    // Find student matching BOTH name and email
    const student = allStudents.find(
      (s) => s.full_name?.toLowerCase() === studentName.toLowerCase() && 
             s.email?.toLowerCase() === studentEmail
    );
    if (!student) {
      // Check if name exists but email doesn't match
      const nameMatch = allStudents.find((s) => s.full_name?.toLowerCase() === studentName.toLowerCase());
      const emailMatch = allStudents.find((s) => s.email?.toLowerCase() === studentEmail);
      
      if (nameMatch && !emailMatch) {
        errors.push(`Student "${studentName}" found but email doesn't match (expected: ${nameMatch.email || "no email"})`);
      } else if (!nameMatch && emailMatch) {
        errors.push(`Email "${studentEmail}" found but name doesn't match (expected: ${emailMatch.full_name})`);
      } else if (nameMatch && emailMatch && nameMatch.id !== emailMatch.id) {
        // This could be siblings - name doesn't match the email's user
        errors.push(`Student name "${studentName}" not found with email "${studentEmail}". Did you mean "${emailMatch.full_name}"?`);
      } else {
        errors.push(`Student not found with name "${studentName}" and email "${studentEmail}"`);
      }
    } else {
      studentId = student.id;
      resolvedStudentName = student.full_name;
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
      teacher_name: resolvedTeacherName,
      student_id: studentId,
      student_name: resolvedStudentName,
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
      teacher_local_time: normalizedTime,
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
      // Fetch existing users for upsert matching by full_name (username)
      const { data: existingUsersData } = await supabase
        .from("profiles")
        .select("id, email, full_name, whatsapp_number, age, gender");

      // Map by full_name (username) as unique key - allows duplicate emails
      const existingUsersByName = new Map<string, any>();
      const existingEmails = new Set<string>();
      existingUsersData?.forEach((u) => {
        if (u.full_name) existingUsersByName.set(u.full_name.toLowerCase(), u);
        if (u.email) existingEmails.add(u.email.toLowerCase());
      });

      for (let i = 0; i < rows.length; i++) {
        const result = await validateUserRow(rows[i], i + 1, existingUsersByName, existingEmails);
        validationResults.push(result);
      }
    } else if (type === "assignments") {
      // Fetch teachers, students, subjects, and existing assignments - lookup by BOTH name AND email
      const { data: teacherRoles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "student");

      const { data: teachers } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", teacherRoles?.map((r) => r.user_id) || []);

      const { data: students } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentRoles?.map((r) => r.user_id) || []);

      const { data: subjects } = await supabase.from("subjects").select("id, name");

      const { data: existingAssignmentsData } = await supabase
        .from("student_teacher_assignments")
        .select("id, teacher_id, student_id, subject_id, subjects(name)");

      // Keep full arrays for name+email matching (handles siblings with shared emails)
      const allTeachers = (teachers || []).map((t) => ({
        id: t.id,
        full_name: t.full_name,
        email: t.email,
      }));

      const allStudents = (students || []).map((s) => ({
        id: s.id,
        full_name: s.full_name,
        email: s.email,
      }));

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

      console.log(`[bulk-validate-import] Found ${allTeachers.length} teachers, ${allStudents.length} students`);

      for (let i = 0; i < rows.length; i++) {
        const result = await validateAssignmentRow(
          rows[i], i + 1, allTeachers, allStudents, subjectMap, existingAssignments
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
