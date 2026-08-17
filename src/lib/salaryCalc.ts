import { format, parseISO, endOfMonth, eachDayOfInterval } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { assignmentMonthWindow, SALARY_ASSIGNMENT_STATUSES } from '@/lib/salaryWindow';
import { normalizeAttendanceStatus } from '@/lib/attendanceStatus';

/**
 * SINGLE SOURCE OF TRUTH for salary sheet calculation + persistence.
 *
 * Both the Salary Engine page (single selected month) and the Salary Sheet Audit
 * bulk "Regenerate & Save All Flagged" action call these functions, so the numbers
 * written by either path are byte-identical. Never fork this logic.
 */

export interface StudentPayoutRow {
  studentId: string;
  studentName: string;
  assignmentId: string;
  dateFrom: string;
  dateTo: string;
  payoutRate: number;
  payoutType: string;
  eligibleDays: number;
  totalDays: number;
  calculatedAmount: number;
  editedAmount: number | null;
  /** True when the editedAmount comes from a saved manual override (not this session's edits). */
  overridePersisted: boolean;
  attendanceDays: { date: string; status: string }[];
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  rescheduledCount: number;
  holidayCount: number;
  missingCount: number;
  feeStatus: string;
  lastPaymentDate: string | null;
  invoiceId: string | null;
  salaryLinked: boolean;
  isTemporary: boolean;
}


export interface RoleSalaryRow {
  role: string;
  monthlyAmount: number;
  effectiveFrom: string;
  effectiveTo: string;
  activeDays: number;
  totalDays: number;
  proratedAmount: number;
  editedAmount: number | null;
  staffSalaryId: string;
}

export interface TeacherSalaryRow {
  teacherId: string;
  teacherName: string;
  students: StudentPayoutRow[];
  roleSalaries: RoleSalaryRow[];
  baseSalary: number;
  extraClassAmount: number;
  adjustmentAmount: number;
  deductions: number;
  netSalary: number;
  payoutStatus: string;
  payoutId?: string | null;
  staffType: 'teacher' | 'staff' | 'dual';
}

export interface SalaryCalcInput {
  profiles: any[];
  assignments: any[];
  attendance: any[];
  leaveEvents: any[];
  extraClasses: any[];
  salaryAdjustments: any[];
  existingPayouts: any[];
  feeInvoices: any[];
  schedules: any[];
  staffSalaries: any[];
  salaryMonth: string;
  /**
   * Session edits. A `null` value means the admin explicitly cleared the manual
   * override for that line (falls back to the calculated amount).
   */
  editAmounts?: Record<string, number | null>;
  editRoleAmounts?: Record<string, number | null>;

}

/** Month boundaries used everywhere: the register only counts up to today for the current month. */
export function salaryMonthBounds(salaryMonth: string) {
  const [year, month] = salaryMonth.split('-').map(Number);
  const monthStart = `${salaryMonth}-01`;
  const fullMonthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthEnd = today < fullMonthEnd ? today : fullMonthEnd;
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDatesInMonth = eachDayOfInterval({ start: parseISO(monthStart), end: parseISO(monthEnd) });
  return { monthStart, monthEnd, fullMonthEnd, daysInMonth, allDatesInMonth };
}

export function computeSalaryRows(input: SalaryCalcInput): TeacherSalaryRow[] {
  const {
    profiles, assignments, attendance, leaveEvents, extraClasses, salaryAdjustments,
    existingPayouts, feeInvoices, schedules, staffSalaries, salaryMonth,
    editAmounts = {}, editRoleAmounts = {},
  } = input;

  const { monthStart, monthEnd, fullMonthEnd, daysInMonth, allDatesInMonth } = salaryMonthBounds(salaryMonth);

  /**
   * Manual overrides that were saved on a previous version of the sheet.
   * Recalculation must NOT silently discard them — they are only replaced when
   * the admin edits the line again (number) or explicitly clears it (null).
   */
  const persistedOverrides = (teacherId: string) => {
    const payout = existingPayouts.find((p: any) => p.teacher_id === teacherId);
    const calc: any = payout?.calculation_json || {};
    const students = new Map<string, number>();
    const roles = new Map<string, number>();
    (Array.isArray(calc.students) ? calc.students : []).forEach((s: any) => {
      if (s?.assignmentId != null && s?.editedAmount !== null && s?.editedAmount !== undefined) {
        students.set(String(s.assignmentId), Number(s.editedAmount));
      }
    });
    (Array.isArray(calc.roleSalaries) ? calc.roleSalaries : []).forEach((r: any) => {
      if (r?.staffSalaryId != null && r?.editedAmount !== null && r?.editedAmount !== undefined) {
        roles.set(String(r.staffSalaryId), Number(r.editedAmount));
      }
    });
    return { students, roles };
  };

  const calculateRoleSalaries = (userId: string, savedRoles: Map<string, number>): RoleSalaryRow[] => {
    const userStaffSalaries = staffSalaries.filter((s: any) => s.user_id === userId);
    return userStaffSalaries.map((ss: any) => {
      const effFrom = ss.effective_from;
      const effTo = ss.effective_to || fullMonthEnd;
      const dateFrom = effFrom > monthStart ? effFrom : monthStart;
      const dateTo = effTo < fullMonthEnd ? effTo : fullMonthEnd;
      if (dateFrom > dateTo) return null;

      const fromDate = parseISO(dateFrom);
      const toDate = parseISO(dateTo);
      const activeDays = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      let proratedAmount = ss.monthly_amount;
      if (ss.prorate_partial_months && activeDays < daysInMonth) {
        proratedAmount = (ss.monthly_amount / daysInMonth) * activeDays;
      }

      const hasSessionEdit = Object.prototype.hasOwnProperty.call(editRoleAmounts, ss.id);
      const editedAmount = hasSessionEdit
        ? editRoleAmounts[ss.id]
        : (savedRoles.has(ss.id) ? savedRoles.get(ss.id)! : null);

      return {
        role: ss.role,
        monthlyAmount: Number(ss.monthly_amount),
        effectiveFrom: dateFrom,
        effectiveTo: dateTo,
        activeDays,
        totalDays: daysInMonth,
        proratedAmount: Math.round(proratedAmount * 100) / 100,
        editedAmount: editedAmount ?? null,
        staffSalaryId: ss.id,
      } as RoleSalaryRow;
    }).filter((r): r is RoleSalaryRow => r !== null);
  };

  return profiles.map((profile: any) => {
    const teacherAssignments = assignments.filter((a: any) => a.teacher_id === profile.id);
    const saved = persistedOverrides(profile.id);

    const studentRows: StudentPayoutRow[] = teacherAssignments.map((assign: any) => {

      const payoutAmount = Number(assign.payout_amount) || 0;
      const payoutType = assign.payout_type || 'monthly';
      const studentName = assign.profiles?.full_name || 'Unknown';

      // Window rules live in src/lib/salaryWindow.ts and are locked by unit tests
      // (ended assignments still pay for the months they were active; month-granular end dates).
      const win = assignmentMonthWindow(assign, monthStart, monthEnd);
      if (!win) return null;
      const { dateFrom, dateTo } = win;

      const fromDate = parseISO(dateFrom);
      const toDate = parseISO(dateTo);
      const totalDaysInRange = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      const teacherLeaves = leaveEvents.filter((l: any) => l.teacher_id === profile.id);
      let unpaidLeaveDays = 0;
      const leaveDateSet = new Set<string>();
      teacherLeaves.forEach((leave: any) => {
        const lStart = parseISO(leave.start_date);
        const lEnd = parseISO(leave.end_date);
        const overlapStart = lStart > fromDate ? lStart : fromDate;
        const overlapEnd = lEnd < toDate ? lEnd : toDate;
        if (overlapStart <= overlapEnd) {
          const days = eachDayOfInterval({ start: overlapStart, end: overlapEnd });
          days.forEach(d => {
            const key = format(d, 'yyyy-MM-dd');
            leaveDateSet.add(key);
            if (leave.leave_type === 'unpaid') unpaidLeaveDays++;
          });
        }
      });

      const eligibleDays = totalDaysInRange - unpaidLeaveDays;

      const studentAttendance = attendance.filter((a: any) => a.teacher_id === profile.id && a.student_id === assign.student_id);
      const attendanceMap = new Map<string, string>();
      studentAttendance.forEach((a: any) => attendanceMap.set(a.class_date, a.status));

      const assignSchedules = schedules.filter((s: any) => s.assignment_id === assign.id);
      const scheduledDays = new Set(assignSchedules.map((s: any) => s.day_of_week?.toLowerCase()));

      const attendanceDays = allDatesInMonth
        .filter(d => d >= fromDate && d <= toDate)
        .map(d => {
          const dateStr = format(d, 'yyyy-MM-dd');
          const attStatus = attendanceMap.get(dateStr);
          const dayName = format(d, 'EEEE').toLowerCase();
          // Normalise role-qualified statuses (student_leave / teacher_absent / …)
          const marked = normalizeAttendanceStatus(attStatus);
          let status = 'none';
          if (marked !== 'none') status = marked;
          else if (leaveDateSet.has(dateStr)) status = 'leave';
          else if (scheduledDays.size > 0 && !scheduledDays.has(dayName)) status = 'holiday';
          return { date: dateStr, status };
        });

      const presentCount = attendanceDays.filter(d => d.status === 'present').length;
      const absentCount = attendanceDays.filter(d => d.status === 'absent').length;
      const leaveCount = attendanceDays.filter(d => d.status === 'leave').length;
      const rescheduledCount = attendanceDays.filter(d => d.status === 'rescheduled').length;
      const holidayCount = attendanceDays.filter(d => d.status === 'holiday').length;
      const missingCount = attendanceDays.filter(d => d.status === 'none').length;

      let calculatedAmount = 0;
      if (payoutType === 'monthly') {
        calculatedAmount = (payoutAmount / daysInMonth) * eligibleDays;
      } else {
        calculatedAmount = payoutAmount * presentCount;
      }

      // Prefer invoice tied to this assignment; fallback to any paid invoice for the student; else first invoice
      const studentInvoices = feeInvoices.filter((f: any) => f.student_id === assign.student_id);
      const studentFee =
        studentInvoices.find((f: any) => f.assignment_id === assign.id) ||
        studentInvoices.find((f: any) => f.status === 'paid' || f.status === 'partially_paid') ||
        studentInvoices[0];

      const salaryLinked = assign.salary_linked !== false; // default true
      const isTemporary = assign.is_temporary === true;
      const effectiveCalc = salaryLinked ? calculatedAmount : 0;

      const hasSessionEdit = Object.prototype.hasOwnProperty.call(editAmounts, assign.id);
      const editedAmount = hasSessionEdit
        ? (editAmounts[assign.id] ?? null)
        : (saved.students.has(assign.id) ? saved.students.get(assign.id)! : null);

      return {
        studentId: assign.student_id,
        studentName,
        assignmentId: assign.id,
        dateFrom,
        dateTo,
        payoutRate: payoutAmount,
        payoutType,
        eligibleDays,
        totalDays: totalDaysInRange,
        calculatedAmount: Math.round(effectiveCalc * 100) / 100,
        editedAmount,
        overridePersisted: !hasSessionEdit && editedAmount !== null,
        attendanceDays,
        presentCount,
        absentCount,
        leaveCount,
        rescheduledCount,
        holidayCount,
        missingCount,
        feeStatus: studentFee?.status || 'no_invoice',
        lastPaymentDate: studentFee?.paid_at || null,
        invoiceId: studentFee?.id || null,
        salaryLinked,
        isTemporary,
      };
    }).filter((row): row is StudentPayoutRow => row !== null);

    const roleSalaries = calculateRoleSalaries(profile.id, saved.roles);


    const hasStudents = studentRows.length > 0;
    const hasRoleSalaries = roleSalaries.length > 0;
    if (!hasStudents && !hasRoleSalaries) return null;

    const teachingBase = studentRows.reduce((sum, r) => sum + (r.editedAmount ?? r.calculatedAmount), 0);
    const roleBase = roleSalaries.reduce((sum, r) => sum + (r.editedAmount ?? r.proratedAmount), 0);
    const baseSalary = teachingBase + roleBase;

    const teacherExtras = extraClasses.filter((e: any) => e.teacher_id === profile.id);
    const extraClassAmount = teacherExtras.reduce((sum: number, e: any) => sum + Number(e.rate), 0);
    const teacherAdj = salaryAdjustments.filter((a: any) => a.teacher_id === profile.id);
    const additions = teacherAdj.filter((a: any) => ['bonus', 'allowance', 'expense'].includes(a.adjustment_type)).reduce((s: number, a: any) => s + Number(a.amount), 0);
    const deductions = teacherAdj.filter((a: any) => a.adjustment_type === 'deduction').reduce((s: number, a: any) => s + Number(a.amount), 0);
    const netSalary = baseSalary + extraClassAmount + additions - deductions;
    const existingPayout = existingPayouts.find((p: any) => p.teacher_id === profile.id);

    const staffType = hasStudents && hasRoleSalaries ? 'dual' : hasStudents ? 'teacher' : 'staff';

    return {
      teacherId: profile.id,
      teacherName: profile.full_name,
      students: studentRows,
      roleSalaries,
      baseSalary: Math.round(baseSalary * 100) / 100,
      extraClassAmount: Math.round(extraClassAmount * 100) / 100,
      adjustmentAmount: Math.round(additions * 100) / 100,
      deductions: Math.round(deductions * 100) / 100,
      netSalary: Math.round(netSalary * 100) / 100,
      payoutStatus: existingPayout?.status || 'draft',
      payoutId: existingPayout?.id ?? null,
      staffType,
    } as TeacherSalaryRow;
  }).filter((t): t is TeacherSalaryRow => t !== null);
}

/** The exact row written to salary_payouts for a computed teacher-month. */
export function buildPayoutPayload(teacher: TeacherSalaryRow, salaryMonth: string) {
  return {
    teacher_id: teacher.teacherId,
    salary_month: salaryMonth,
    base_salary: teacher.baseSalary,
    extra_class_amount: teacher.extraClassAmount,
    adjustment_amount: teacher.adjustmentAmount,
    expense_amount: 0,
    gross_salary: teacher.baseSalary + teacher.extraClassAmount + teacher.adjustmentAmount,
    deductions: teacher.deductions,
    net_salary: teacher.netSalary,
    calculation_json: JSON.parse(JSON.stringify({
      students: teacher.students,
      roleSalaries: teacher.roleSalaries,
      staffType: teacher.staffType,
      calculated_at: new Date().toISOString(),
    })),
    status: 'confirmed',
  };
}

export const PAID_PAYOUT_STATUSES = ['locked', 'paid', 'partially_paid'];

export function isPaidLikePayout(status?: string | null) {
  return !!status && PAID_PAYOUT_STATUSES.includes(status);
}

/**
 * Persist a computed sheet for a teacher-month that is NOT paid/locked.
 * Paid/locked sheets must go through the reasoned `revise_salary_payout` RPC flow
 * in SalaryEngine — this function refuses to touch them.
 */
export async function saveUnpaidPayout(
  teacher: TeacherSalaryRow,
  salaryMonth: string,
  existing: { id: string; status: string } | null | undefined,
) {
  const payload = buildPayoutPayload(teacher, salaryMonth);
  if (existing) {
    if (isPaidLikePayout(existing.status)) {
      throw new Error(`Sheet is ${existing.status} — needs a manual revision with a reason`);
    }
    const { error } = await supabase
      .from('salary_payouts')
      .update({ ...payload, revision_required_at: null, revision_reason: null } as any)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('salary_payouts').insert(payload);
    if (error) throw error;
  }
}

/** Fetch every input needed to compute one salary month (mirrors SalaryEngine's queries). */
export async function fetchSalaryMonthInputs(salaryMonth: string): Promise<Omit<SalaryCalcInput, 'editAmounts' | 'editRoleAmounts'>> {
  const { monthStart, monthEnd, fullMonthEnd } = salaryMonthBounds(salaryMonth);

  const [roleRows, staffSalariesRes, assignmentsRes, attendanceRes, leaveRes, extraRes, adjRes, payoutsRes, invoicesRes, schedulesRes] =
    await Promise.all([
      supabase.from('user_roles').select('user_id').eq('role', 'teacher'),
      supabase.from('staff_salaries').select('*').lte('effective_from', fullMonthEnd).or(`effective_to.is.null,effective_to.gte.${monthStart}`),
      supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, student_id, effective_from_date, effective_to_date, status_effective_date, status, salary_linked, is_temporary, original_assignment_id, profiles!student_teacher_assignments_student_id_fkey(full_name)')
        .in('status', [...SALARY_ASSIGNMENT_STATUSES]),
      supabase.from('attendance').select('id, teacher_id, student_id, class_date, status').gte('class_date', monthStart).lte('class_date', monthEnd),
      supabase.from('leave_events').select('*').lte('start_date', monthEnd).gte('end_date', monthStart).eq('status', 'approved'),
      supabase.from('extra_classes').select('*').gte('class_date', monthStart).lte('class_date', monthEnd).eq('status', 'approved'),
      supabase.from('salary_adjustments').select('*').eq('salary_month', salaryMonth),
      supabase.from('salary_payouts').select('*').eq('salary_month', salaryMonth).or('is_archived.is.null,is_archived.eq.false'),
      supabase.from('fee_invoices').select('id, student_id, assignment_id, status, paid_at').is('voided_at', null).eq('is_archived', false).eq('billing_month', salaryMonth),
      supabase.from('schedules').select('assignment_id, day_of_week').eq('is_active', true),
    ]);

  const staffSalaries = staffSalariesRes.data || [];
  const teacherIds = (roleRows.data || []).map((r: any) => r.user_id);
  const staffOnlyIds = [...new Set(staffSalaries.map((s: any) => s.user_id).filter((id: string) => !teacherIds.includes(id)))];
  const allIds = [...new Set([...teacherIds, ...staffOnlyIds])];

  const { data: profiles } = allIds.length
    ? await supabase.from('profiles').select('id, full_name, email, country, city').in('id', allIds).is('archived_at', null).order('full_name')
    : { data: [] as any[] };

  return {
    profiles: profiles || [],
    assignments: assignmentsRes.data || [],
    attendance: attendanceRes.data || [],
    leaveEvents: leaveRes.data || [],
    extraClasses: extraRes.data || [],
    salaryAdjustments: adjRes.data || [],
    existingPayouts: payoutsRes.data || [],
    feeInvoices: invoicesRes.data || [],
    schedules: schedulesRes.data || [],
    staffSalaries,
    salaryMonth,
  };
}
