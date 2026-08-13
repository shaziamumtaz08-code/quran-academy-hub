import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-task-key",
};

const SALARY_ASSIGNMENT_STATUSES = ["active", "completed", "left"];
const PAID_LIKE = ["locked", "paid", "partially_paid"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => new Date(`${s}T00:00:00Z`);

function endOfMonthStr(dateStr: string) {
  const d = parse(dateStr);
  return fmt(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

function normalizeAttendanceStatus(raw?: string | null) {
  if (!raw) return "none";
  const s = String(raw).toLowerCase().trim();
  if (s === "present" || s === "late" || s === "attended") return "present";
  if (s === "holiday" || s === "off" || s === "off_day") return "holiday";
  if (s.includes("reschedul")) return "rescheduled";
  if (s.includes("leave")) return "leave";
  if (s.includes("absent")) return "absent";
  return "none";
}

function resolveAssignmentEnd(a: any): string | null {
  const rawEnd =
    a.effective_to_date ||
    ((a.status === "left" || a.status === "completed") ? a.status_effective_date : null);
  if (!rawEnd) return null;
  return endOfMonthStr(String(rawEnd).slice(0, 10));
}

function assignmentMonthWindow(a: any, monthStart: string, monthEnd: string) {
  const effectiveFrom = a.effective_from_date ? String(a.effective_from_date).slice(0, 10) : monthStart;
  const effectiveTo = resolveAssignmentEnd(a) || monthEnd;
  const dateFrom = effectiveFrom > monthStart ? effectiveFrom : monthStart;
  const dateTo = effectiveTo < monthEnd ? effectiveTo : monthEnd;
  if (dateFrom > dateTo) return null;
  return { dateFrom, dateTo };
}

function monthBounds(salaryMonth: string) {
  const [year, month] = salaryMonth.split("-").map(Number);
  const monthStart = `${salaryMonth}-01`;
  const fullMonthEnd = endOfMonthStr(monthStart);
  const today = fmt(new Date());
  const monthEnd = today < fullMonthEnd ? today : fullMonthEnd;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const allDates: string[] = [];
  for (let d = parse(monthStart); fmt(d) <= monthEnd; d = new Date(d.getTime() + 86400000)) allDates.push(fmt(d));
  return { monthStart, monthEnd, fullMonthEnd, daysInMonth, allDates };
}

const dayName = (s: string) =>
  ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][parse(s).getUTCDay()];

const daysBetween = (a: string, b: string) =>
  Math.max(1, Math.floor((parse(b).getTime() - parse(a).getTime()) / 86400000) + 1);

async function computeMonth(supabase: any, salaryMonth: string) {
  const { monthStart, monthEnd, fullMonthEnd, daysInMonth, allDates } = monthBounds(salaryMonth);

  const [roleRows, staffSalariesRes, assignmentsRes, attendanceRes, leaveRes, extraRes, adjRes, payoutsRes, invoicesRes, schedulesRes] =
    await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "teacher"),
      supabase.from("staff_salaries").select("*").lte("effective_from", fullMonthEnd).or(`effective_to.is.null,effective_to.gte.${monthStart}`),
      supabase
        .from("student_teacher_assignments")
        .select("id, teacher_id, student_id, payout_amount, payout_type, effective_from_date, effective_to_date, status_effective_date, status, salary_linked, is_temporary, profiles!student_teacher_assignments_student_id_fkey(full_name)")
        .in("status", SALARY_ASSIGNMENT_STATUSES),
      supabase.from("attendance").select("id, teacher_id, student_id, class_date, status").gte("class_date", monthStart).lte("class_date", monthEnd),
      supabase.from("leave_events").select("*").lte("start_date", monthEnd).gte("end_date", monthStart).eq("status", "approved"),
      supabase.from("extra_classes").select("*").gte("class_date", monthStart).lte("class_date", monthEnd).eq("status", "approved"),
      supabase.from("salary_adjustments").select("*").eq("salary_month", salaryMonth),
      supabase.from("salary_payouts").select("*").eq("salary_month", salaryMonth).or("is_archived.is.null,is_archived.eq.false"),
      supabase.from("fee_invoices").select("id, student_id, assignment_id, status, paid_at").is("voided_at", null).eq("is_archived", false).eq("billing_month", salaryMonth),
      supabase.from("schedules").select("assignment_id, day_of_week").eq("is_active", true),
    ]);

  const staffSalaries = staffSalariesRes.data || [];
  const teacherIds = (roleRows.data || []).map((r: any) => r.user_id);
  const staffOnly = [...new Set(staffSalaries.map((s: any) => s.user_id).filter((id: string) => !teacherIds.includes(id)))];
  const allIds = [...new Set([...teacherIds, ...staffOnly])];
  const { data: profiles } = allIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", allIds).is("archived_at", null).order("full_name")
    : { data: [] };

  const assignments = assignmentsRes.data || [];
  const attendance = attendanceRes.data || [];
  const leaveEvents = leaveRes.data || [];
  const extraClasses = extraRes.data || [];
  const salaryAdjustments = adjRes.data || [];
  const existingPayouts = payoutsRes.data || [];
  const feeInvoices = invoicesRes.data || [];
  const schedules = schedulesRes.data || [];

  const results: any[] = [];

  for (const profile of profiles || []) {
    const teacherAssignments = assignments.filter((a: any) => a.teacher_id === profile.id);

    const students = teacherAssignments.map((assign: any) => {
      const win = assignmentMonthWindow(assign, monthStart, monthEnd);
      if (!win) return null;
      const { dateFrom, dateTo } = win;
      const payoutAmount = Number(assign.payout_amount) || 0;
      const payoutType = assign.payout_type || "monthly";
      const totalDaysInRange = daysBetween(dateFrom, dateTo);

      let unpaidLeaveDays = 0;
      const leaveDateSet = new Set<string>();
      leaveEvents
        .filter((l: any) => l.teacher_id === profile.id)
        .forEach((leave: any) => {
          const overlapStart = leave.start_date > dateFrom ? leave.start_date : dateFrom;
          const overlapEnd = leave.end_date < dateTo ? leave.end_date : dateTo;
          if (overlapStart <= overlapEnd) {
            for (let d = parse(overlapStart); fmt(d) <= overlapEnd; d = new Date(d.getTime() + 86400000)) {
              leaveDateSet.add(fmt(d));
              if (leave.leave_type === "unpaid") unpaidLeaveDays++;
            }
          }
        });

      const eligibleDays = totalDaysInRange - unpaidLeaveDays;

      const attendanceMap = new Map<string, string>();
      attendance
        .filter((a: any) => a.teacher_id === profile.id && a.student_id === assign.student_id)
        .forEach((a: any) => attendanceMap.set(a.class_date, a.status));

      const scheduledDays = new Set(
        schedules.filter((s: any) => s.assignment_id === assign.id).map((s: any) => s.day_of_week?.toLowerCase()),
      );

      const attendanceDays = allDates
        .filter((d) => d >= dateFrom && d <= dateTo)
        .map((dateStr) => {
          const marked = normalizeAttendanceStatus(attendanceMap.get(dateStr));
          let status = "none";
          if (marked !== "none") status = marked;
          else if (leaveDateSet.has(dateStr)) status = "leave";
          else if (scheduledDays.size > 0 && !scheduledDays.has(dayName(dateStr))) status = "holiday";
          return { date: dateStr, status };
        });

      const count = (s: string) => attendanceDays.filter((d) => d.status === s).length;
      const presentCount = count("present");

      const calculatedAmount =
        payoutType === "monthly" ? (payoutAmount / daysInMonth) * eligibleDays : payoutAmount * presentCount;

      const studentInvoices = feeInvoices.filter((f: any) => f.student_id === assign.student_id);
      const studentFee =
        studentInvoices.find((f: any) => f.assignment_id === assign.id) ||
        studentInvoices.find((f: any) => f.status === "paid" || f.status === "partially_paid") ||
        studentInvoices[0];

      const salaryLinked = assign.salary_linked !== false;
      const effectiveCalc = salaryLinked ? calculatedAmount : 0;

      return {
        studentId: assign.student_id,
        studentName: assign.profiles?.full_name || "Unknown",
        assignmentId: assign.id,
        dateFrom,
        dateTo,
        payoutRate: payoutAmount,
        payoutType,
        eligibleDays,
        totalDays: totalDaysInRange,
        calculatedAmount: Math.round(effectiveCalc * 100) / 100,
        editedAmount: null,
        attendanceDays,
        presentCount,
        absentCount: count("absent"),
        leaveCount: count("leave"),
        rescheduledCount: count("rescheduled"),
        holidayCount: count("holiday"),
        missingCount: count("none"),
        feeStatus: studentFee?.status || "no_invoice",
        lastPaymentDate: studentFee?.paid_at || null,
        invoiceId: studentFee?.id || null,
        salaryLinked,
        isTemporary: assign.is_temporary === true,
      };
    }).filter(Boolean) as any[];

    const roleSalaries = staffSalaries
      .filter((ss: any) => ss.user_id === profile.id)
      .map((ss: any) => {
        const effFrom = ss.effective_from;
        const effTo = ss.effective_to || fullMonthEnd;
        const dateFrom = effFrom > monthStart ? effFrom : monthStart;
        const dateTo = effTo < fullMonthEnd ? effTo : fullMonthEnd;
        if (dateFrom > dateTo) return null;
        const activeDays = daysBetween(dateFrom, dateTo);
        let proratedAmount = Number(ss.monthly_amount);
        if (ss.prorate_partial_months && activeDays < daysInMonth) {
          proratedAmount = (Number(ss.monthly_amount) / daysInMonth) * activeDays;
        }
        return {
          role: ss.role,
          monthlyAmount: Number(ss.monthly_amount),
          effectiveFrom: dateFrom,
          effectiveTo: dateTo,
          activeDays,
          totalDays: daysInMonth,
          proratedAmount: Math.round(proratedAmount * 100) / 100,
          editedAmount: null,
          staffSalaryId: ss.id,
        };
      })
      .filter(Boolean) as any[];

    if (!students.length && !roleSalaries.length) continue;

    const baseSalary =
      students.reduce((s, r) => s + r.calculatedAmount, 0) +
      roleSalaries.reduce((s, r) => s + r.proratedAmount, 0);
    const extraClassAmount = extraClasses
      .filter((e: any) => e.teacher_id === profile.id)
      .reduce((s: number, e: any) => s + Number(e.rate), 0);
    const teacherAdj = salaryAdjustments.filter((a: any) => a.teacher_id === profile.id);
    const additions = teacherAdj
      .filter((a: any) => ["bonus", "allowance", "expense"].includes(a.adjustment_type))
      .reduce((s: number, a: any) => s + Number(a.amount), 0);
    const deductions = teacherAdj
      .filter((a: any) => a.adjustment_type === "deduction")
      .reduce((s: number, a: any) => s + Number(a.amount), 0);
    const netSalary = baseSalary + extraClassAmount + additions - deductions;
    const existing = existingPayouts.find((p: any) => p.teacher_id === profile.id);
    const staffType = students.length && roleSalaries.length ? "dual" : students.length ? "teacher" : "staff";

    results.push({
      profile,
      existing,
      payload: {
        teacher_id: profile.id,
        salary_month: salaryMonth,
        base_salary: Math.round(baseSalary * 100) / 100,
        extra_class_amount: Math.round(extraClassAmount * 100) / 100,
        adjustment_amount: Math.round(additions * 100) / 100,
        expense_amount: 0,
        gross_salary: Math.round((baseSalary + extraClassAmount + additions) * 100) / 100,
        deductions: Math.round(deductions * 100) / 100,
        net_salary: Math.round(netSalary * 100) / 100,
        calculation_json: { students, roleSalaries, staffType, calculated_at: new Date().toISOString() },
        status: "confirmed",
      },
    });
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const taskKey = Deno.env.get("SALARY_ADMIN_TASK_KEY");

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Auth: internal task key OR an authenticated admin/super_admin JWT
  let authorized = false;
  const provided = req.headers.get("x-admin-task-key");
  if (taskKey && provided && provided === taskKey) authorized = true;
  if (!authorized) {
    const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
    if (jwt) {
      const { data: userRes } = await supabase.auth.getUser(jwt);
      const uid = userRes?.user?.id;
      if (uid) {
        const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
        const { data: isSuper } = await supabase.rpc("has_role", { _user_id: uid, _role: "super_admin" });
        authorized = Boolean(isAdmin || isSuper);
      }
    }
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const months: string[] = body.months || [];
    const dryRun: boolean = body.dryRun === true;
    if (!months.length) throw new Error("months[] required (yyyy-MM)");

    const summary: any[] = [];
    for (const month of months) {
      const rows = await computeMonth(supabase, month);
      let created = 0, updated = 0, skipped = 0, unchanged = 0;
      const changes: any[] = [];

      for (const r of rows) {
        const existing = r.existing;
        const newNet = r.payload.net_salary;
        if (existing && PAID_LIKE.includes(existing.status)) {
          skipped++;
          continue;
        }
        const oldNet = existing ? Number(existing.net_salary) : null;
        if (existing && Math.abs((oldNet ?? 0) - newNet) < 0.5) {
          unchanged++;
          continue;
        }
        changes.push({ teacher: r.profile.full_name, month, oldNet, newNet, delta: Math.round((newNet - (oldNet ?? 0)) * 100) / 100 });
        if (dryRun) continue;

        if (existing) {
          const { error } = await supabase
            .from("salary_payouts")
            .update({ ...r.payload, revision_required_at: null, revision_reason: null })
            .eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase.from("salary_payouts").insert(r.payload);
          if (error) throw error;
          created++;
        }
      }

      summary.push({ month, teachers: rows.length, created, updated, unchanged, skippedPaid: skipped, changes });
    }

    return new Response(JSON.stringify({ ok: true, dryRun, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("regenerate-salary-sheets error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
