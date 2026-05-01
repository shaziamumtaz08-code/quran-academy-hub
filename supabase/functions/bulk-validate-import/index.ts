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

// Validate user row — uses email as the canonical unique identity.
// Supports the full profile schema. Flags shared parent/student emails.
async function validateUserRow(
  row: Record<string, any>,
  rowNum: number,
  existingUsersByEmail: Map<string, any>,
  divisionsByKey: Map<string, { id: string; model_type: string; name: string }>,
  branchesByKey: Map<string, { id: string; name: string }>
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let status: ValidationResult["status"] = "new";
  let diff: Record<string, { old: any; new: any }> | null = null;
  let existingId: string | null = null;

  const email = row.email?.trim()?.toLowerCase() || null;
  const fullName = row.full_name?.trim() || null;
  const role = row.role?.trim()?.toLowerCase() || null;
  const password = row.password?.trim() || null;

  // Phone — accept either phone_whatsapp or legacy phone/whatsapp_number
  const rawWhatsapp = (row.phone_whatsapp || row.whatsapp_number || row.phone)?.toString().trim();
  const whatsappNumber = rawWhatsapp && !["nan", "n/a"].includes(rawWhatsapp.toLowerCase()) ? rawWhatsapp : null;
  const rawAlternate = (row.phone_alternate || "").toString().trim();
  const phoneAlternate = rawAlternate && !["nan", "n/a"].includes(rawAlternate.toLowerCase()) ? rawAlternate : null;

  const ageRaw = row.age?.toString().trim();
  const age = ageRaw && ageRaw !== "" ? parseInt(ageRaw) : null;
  const gender = row.gender?.trim()?.toLowerCase() || null;
  const dateOfBirth = parseFlexibleDate(row.date_of_birth?.toString() || "");

  const country = row.country?.trim() || null;
  const city = row.city?.trim() || null;
  const timezone = row.timezone?.trim() || null;
  const nationality = row.nationality?.trim() || null;
  const firstLanguage = row.first_language?.trim() || null;
  const arabicLevel = row.arabic_level?.trim()?.toLowerCase() || null;

  const divisionRaw = row.division?.trim()?.toLowerCase() || null;
  const branchRaw = row.branch?.trim() || null;

  const parentEmail = row.parent_email?.trim()?.toLowerCase() || null;
  const guardianType = row.guardian_type?.trim()?.toLowerCase() || null;

  const specialNeeds = row.special_needs?.trim() || null;
  const learningGoals = row.learning_goals?.trim() || null;
  const howDidYouHear = row.how_did_you_hear?.trim() || null;

  // Required fields
  if (!fullName || fullName.length < 2) {
    errors.push("full_name is required (min 2 characters)");
  }
  if (!email) {
    errors.push("email is required");
  } else if (!isValidEmail(email)) {
    errors.push(`Invalid email format: "${email}"`);
  }

  if (!role) {
    errors.push("role is required");
  } else {
    const validRoles = [
      "student", "teacher", "parent", "examiner",
      "admin_division", "admin_admissions", "admin_fees", "admin_academic",
    ];
    if (!validRoles.includes(role)) {
      errors.push(`Invalid role: "${role}". Valid: ${validRoles.join(", ")}`);
    }
  }

  // Phone validation
  const phoneResult = validatePhone(whatsappNumber);
  if (phoneResult.critical) errors.push(phoneResult.error!);
  if (phoneAlternate) {
    const altResult = validatePhone(phoneAlternate);
    if (altResult.critical) errors.push(`phone_alternate: ${altResult.error}`);
  }

  // Age
  if (age !== null && (isNaN(age) || age < 1 || age > 120)) {
    errors.push(`Invalid age: "${row.age}"`);
  }

  // Gender
  if (gender && !["male", "female", "other"].includes(gender)) {
    errors.push(`Invalid gender: "${gender}". Valid: male, female`);
  }

  // Arabic level
  if (arabicLevel && !["none", "beginner", "intermediate", "advanced", "native"].includes(arabicLevel)) {
    errors.push(`Invalid arabic_level: "${arabicLevel}". Valid: none, beginner, intermediate, advanced, native`);
  }

  // Guardian type
  if (guardianType && !["none", "parent", "guardian", "emergency_contact"].includes(guardianType)) {
    errors.push(`Invalid guardian_type: "${guardianType}". Valid: none, parent, guardian, emergency_contact`);
  }

  // Division
  let divisionId: string | null = null;
  if (divisionRaw) {
    const validDivisions = ["one_to_one", "group", "recorded"];
    if (!validDivisions.includes(divisionRaw)) {
      errors.push(`Invalid division: "${divisionRaw}". Valid: ${validDivisions.join(", ")}`);
    } else {
      const matchedDiv = divisionsByKey.get(divisionRaw);
      if (matchedDiv) divisionId = matchedDiv.id;
      else warnings.push(`Division "${divisionRaw}" does not exist in the system — user will be created without a division.`);
    }
  }

  // Branch (optional, name lookup)
  let branchId: string | null = null;
  if (branchRaw) {
    const matchedBranch = branchesByKey.get(branchRaw.toLowerCase());
    if (matchedBranch) branchId = matchedBranch.id;
    else warnings.push(`Branch "${branchRaw}" not found — user will be created without a branch.`);
  }

  // Parent email rules
  if (role === "student") {
    if (guardianType === "parent") {
      if (!parentEmail) {
        errors.push("parent_email is required when role=student and guardian_type=parent");
      } else if (!isValidEmail(parentEmail)) {
        errors.push(`Invalid parent_email format: "${parentEmail}"`);
      } else if (email && parentEmail === email) {
        errors.push("Student and parent cannot share the same email. Please provide a separate parent email.");
      }
    } else if (parentEmail && email && parentEmail === email) {
      errors.push("Student and parent cannot share the same email. Please provide a separate parent email.");
    }
  }

  // Existing-user matching by email (canonical identity)
  if (email && existingUsersByEmail.has(email)) {
    const existing = existingUsersByEmail.get(email);
    existingId = existing.id;
    status = "update";
    diff = {};
    if (existing.full_name !== fullName) diff.full_name = { old: existing.full_name, new: fullName };
    if (existing.whatsapp_number !== phoneResult.value) diff.whatsapp_number = { old: existing.whatsapp_number, new: phoneResult.value };
    if (existing.age !== age) diff.age = { old: existing.age, new: age };
    if (existing.gender !== gender) diff.gender = { old: existing.gender, new: gender };
    if (existing.country !== country) diff.country = { old: existing.country, new: country };
    if (existing.city !== city) diff.city = { old: existing.city, new: city };
    if (Object.keys(diff).length === 0) {
      diff = null;
      warnings.push("No changes detected — row will be skipped");
    }
  } else {
    // New user — password optional (blank = invite email flow handled at execute step)
    if (password && password.length < 6) {
      errors.push("Password must be at least 6 characters when provided");
    }
  }

  if (errors.length > 0) status = "error";
  else if (warnings.length > 0 && status !== "update") status = "warning";

  return {
    rowNum,
    status,
    errors,
    warnings,
    data: {
      email,
      full_name: fullName,
      role,
      password,
      whatsapp_number: phoneResult.value,
      phone_alternate: phoneAlternate,
      age,
      gender,
      date_of_birth: dateOfBirth,
      country,
      city,
      timezone,
      nationality,
      first_language: firstLanguage,
      arabic_level: arabicLevel,
      division_id: divisionId,
      branch_id: branchId,
      parent_email: parentEmail,
      guardian_type: guardianType,
      special_needs: specialNeeds,
      learning_goals: learningGoals,
      hear_about_us: howDidYouHear,
    },
    diff,
    existingId,
  };
}

// Parse flexible date formats: YYYY-MM-DD, D-Mon-YY, M/D/YYYY
function parseFlexibleDate(value: string): string | null {
  if (!value || value.trim() === "") return null;
  const v = value.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return v;
  }

  // M/D/YYYY or MM/DD/YYYY
  const slashMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
  }

  // D-Mon-YY or DD-Mon-YY (e.g. 1-Jan-26)
  const monMatch = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (monMatch) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const day = parseInt(monMatch[1]);
    const mon = months[monMatch[2].toLowerCase()];
    let year = parseInt(monMatch[3]);
    if (mon === undefined) return null;
    if (year < 100) year += 2000;
    const date = new Date(year, mon, day);
    if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
  }

  return null;
}

// Parse numeric value (handles commas, currency symbols)
function parseNumericValue(value: string): number | null {
  if (!value || value.trim() === "") return null;
  const cleaned = value.trim().replace(/[,$£€¥₹\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Validate assignment row - NAME is REQUIRED (profile-based identity), email is OPTIONAL hint
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
  const studentName = row.student_name?.trim();
  const subjectName = row.subject_name?.trim();
  const guardianEmail = row.guardian_email?.trim()?.toLowerCase();

  // Parse new optional fields
  const rawStatus = row.status?.trim()?.toLowerCase();
  const rawPayoutAmount = row.payout_amount?.toString()?.trim();
  const rawPayoutType = row.payout_type?.trim()?.toLowerCase();
  const rawEffectiveFrom = row.effective_from?.trim();

  // Validate new fields
  const validStatuses = ["active", "paused", "completed", "left"];
  let parsedStatus: string | null = null;
  if (rawStatus && rawStatus !== "" && rawStatus !== "nan") {
    if (validStatuses.includes(rawStatus)) {
      parsedStatus = rawStatus;
    } else {
      errors.push(`Invalid status: "${rawStatus}". Valid: ${validStatuses.join(", ")}`);
    }
  }

  let parsedPayoutAmount: number | null = null;
  if (rawPayoutAmount && rawPayoutAmount !== "" && rawPayoutAmount.toLowerCase() !== "nan") {
    parsedPayoutAmount = parseNumericValue(rawPayoutAmount);
    if (parsedPayoutAmount === null) {
      errors.push(`Invalid payout_amount: "${rawPayoutAmount}". Must be a number`);
    } else if (parsedPayoutAmount < 0) {
      errors.push(`Payout amount cannot be negative: ${parsedPayoutAmount}`);
    }
  }

  const validPayoutTypes = ["monthly", "per_class"];
  let parsedPayoutType: string | null = null;
  if (rawPayoutType && rawPayoutType !== "" && rawPayoutType !== "nan") {
    if (validPayoutTypes.includes(rawPayoutType)) {
      parsedPayoutType = rawPayoutType;
    } else {
      errors.push(`Invalid payout_type: "${rawPayoutType}". Valid: ${validPayoutTypes.join(", ")}`);
    }
  }

  let parsedEffectiveFrom: string | null = null;
  if (rawEffectiveFrom && rawEffectiveFrom !== "" && rawEffectiveFrom.toLowerCase() !== "nan") {
    parsedEffectiveFrom = parseFlexibleDate(rawEffectiveFrom);
    if (!parsedEffectiveFrom) {
      errors.push(`Invalid effective_from date: "${rawEffectiveFrom}". Use YYYY-MM-DD, M/D/YYYY, or D-Mon-YY`);
    }
  }

  // Validate teacher - NAME is REQUIRED
  let teacherId: string | null = null;
  let resolvedTeacherName: string | null = null;
  
  if (!teacherName) {
    errors.push("Teacher name is required");
  } else {
    const matchingTeachers = allTeachers.filter(
      (t) => t.full_name?.toLowerCase() === teacherName.toLowerCase()
    );
    
    if (matchingTeachers.length === 0) {
      errors.push(`Teacher not found: "${teacherName}"`);
    } else if (matchingTeachers.length === 1) {
      teacherId = matchingTeachers[0].id;
      resolvedTeacherName = matchingTeachers[0].full_name;
    } else {
      errors.push(`Ambiguous teacher: Multiple profiles found with name "${teacherName}"`);
    }
  }

  // Validate student - NAME is REQUIRED
  let studentId: string | null = null;
  let resolvedStudentName: string | null = null;
  
  if (!studentName) {
    errors.push("Student name is required");
  } else {
    const matchingStudents = allStudents.filter(
      (s) => s.full_name?.toLowerCase() === studentName.toLowerCase()
    );
    
    if (matchingStudents.length === 0) {
      errors.push(`Student not found: "${studentName}"`);
    } else if (matchingStudents.length === 1) {
      studentId = matchingStudents[0].id;
      resolvedStudentName = matchingStudents[0].full_name;
    } else {
      const ids = matchingStudents.map(s => s.id.substring(0, 8)).join(", ");
      errors.push(`Ambiguous student: Multiple profiles found with name "${studentName}" (IDs: ${ids}...)`);
    }
  }

  if (guardianEmail) {
    warnings.push(`Guardian email "${guardianEmail}" noted for reference`);
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

      if (existing.subject_id !== subjectId && subjectName) {
        diff.subject = { old: existing.subject_name || "(none)", new: subjectName || "(none)" };
      }
      if (parsedStatus !== null && existing.status !== parsedStatus) {
        diff.status = { old: existing.status, new: parsedStatus };
      }
      if (parsedPayoutAmount !== null && existing.payout_amount !== parsedPayoutAmount) {
        diff.payout_amount = { old: existing.payout_amount ?? "(none)", new: parsedPayoutAmount };
      }
      if (parsedPayoutType !== null && existing.payout_type !== parsedPayoutType) {
        diff.payout_type = { old: existing.payout_type ?? "(none)", new: parsedPayoutType };
      }
      if (parsedEffectiveFrom !== null && existing.effective_from_date !== parsedEffectiveFrom) {
        diff.effective_from = { old: existing.effective_from_date ?? "(none)", new: parsedEffectiveFrom };
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
      guardian_email: guardianEmail,
      status: parsedStatus,
      payout_amount: parsedPayoutAmount,
      payout_type: parsedPayoutType,
      effective_from_date: parsedEffectiveFrom,
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
      // Fetch existing users keyed by canonical email identity
      const { data: existingUsersData } = await supabase
        .from("profiles")
        .select("id, email, full_name, whatsapp_number, age, gender, country, city");

      const existingUsersByEmail = new Map<string, any>();
      existingUsersData?.forEach((u) => {
        if (u.email) existingUsersByEmail.set(u.email.toLowerCase(), u);
      });

      // Fetch divisions keyed by model_type (one_to_one|group|recorded)
      const { data: divisionsData } = await supabase
        .from("divisions")
        .select("id, name, model_type");
      const divisionsByKey = new Map<string, { id: string; model_type: string; name: string }>();
      divisionsData?.forEach((d: any) => {
        if (d.model_type) divisionsByKey.set(String(d.model_type).toLowerCase(), d);
      });

      // Fetch branches keyed by name (lowercased)
      const { data: branchesData } = await supabase
        .from("branches")
        .select("id, name");
      const branchesByKey = new Map<string, { id: string; name: string }>();
      branchesData?.forEach((b: any) => {
        if (b.name) branchesByKey.set(String(b.name).toLowerCase(), b);
      });

      for (let i = 0; i < rows.length; i++) {
        const result = await validateUserRow(
          rows[i],
          i + 1,
          existingUsersByEmail,
          divisionsByKey,
          branchesByKey
        );
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
        .select("id, teacher_id, student_id, subject_id, status, payout_amount, payout_type, effective_from_date, subjects(name)");

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
          status: a.status,
          payout_amount: a.payout_amount,
          payout_type: a.payout_type,
          effective_from_date: a.effective_from_date,
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
