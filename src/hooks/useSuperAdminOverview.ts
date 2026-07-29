import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAcademyTimezone, zonedDayName, zonedDateKey } from '@/hooks/useAcademyTimezone';

export interface DivisionMeta {
  id: string;
  name: string;
  modelType: string;
  branchName: string;
  branchType: string;
}

export interface DivisionMetrics {
  students: number;
  teachers: number;
  classesToday: number;
  attendanceMarked: number;
  attendancePresent: number;
  attendancePct: number | null;
  overdueCount: number;
  overdueAmount: number;
  alerts: number;
  revenueMtd: number;
}

export interface SuperAdminOverview {
  divisions: DivisionMeta[];
  metrics: Record<string, DivisionMetrics>;
}

const emptyMetrics = (): DivisionMetrics => ({
  students: 0,
  teachers: 0,
  classesToday: 0,
  attendanceMarked: 0,
  attendancePresent: 0,
  attendancePct: null,
  overdueCount: 0,
  overdueAmount: 0,
  alerts: 0,
  revenueMtd: 0,
});

export function useSuperAdminOverview() {
  const tz = useAcademyTimezone();
  const today = zonedDateKey(tz);
  const dayName = zonedDayName(tz);
  const monthKey = today.slice(0, 7);

  return useQuery<SuperAdminOverview>({
    queryKey: ['super-admin-overview', today, dayName],
    staleTime: 60_000,
    queryFn: async () => {
      const [divRes, branchRes] = await Promise.all([
        supabase.from('divisions').select('id, name, model_type, branch_id').eq('is_active', true),
        supabase.from('branches').select('id, name, type').eq('is_active', true),
      ]);

      const branchMap = new Map((branchRes.data || []).map((b: any) => [b.id, b]));
      const divisions: DivisionMeta[] = (divRes.data || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        modelType: d.model_type,
        branchName: branchMap.get(d.branch_id)?.name || 'Unknown',
        branchType: branchMap.get(d.branch_id)?.type || 'online',
      }));

      const metrics: Record<string, DivisionMetrics> = {};
      divisions.forEach((d) => { metrics[d.id] = emptyMetrics(); });
      const bucket = (id?: string | null) => (id && metrics[id] ? metrics[id] : null);

      const [
        assignmentRes,
        courseRes,
        enrollmentRes,
        classStaffRes,
        scheduleRes,
        courseClassRes,
        attendanceRes,
        invoiceRes,
        riskRes,
      ] = await Promise.all([
        supabase.from('student_teacher_assignments').select('division_id, student_id, teacher_id').eq('status', 'active'),
        supabase.from('courses').select('id, division_id, teacher_id'),
        supabase.from('course_enrollments').select('student_id, course:courses!inner(id, division_id)').eq('status', 'active'),
        supabase.from('course_class_staff').select('user_id, class:course_classes!inner(courses!inner(division_id))'),
        supabase.from('schedules').select('id, division_id').eq('day_of_week', dayName).eq('is_active', true),
        supabase.from('course_classes').select('id, schedule_days, status, course:courses!inner(division_id)'),
        supabase.from('attendance').select('id, status, division_id').eq('class_date', today),
        supabase.from('fee_invoices').select('amount, amount_paid, status, due_date, billing_month, division_id, is_archived, voided_at'),
        supabase.from('at_risk_flags').select('id, course:courses(division_id)').is('resolved_at', null),
      ]);

      // Students / teachers (1:1 divisions)
      const oneToOne = new Map<string, { s: Set<string>; t: Set<string> }>();
      (assignmentRes.data || []).forEach((r: any) => {
        if (!r.division_id) return;
        if (!oneToOne.has(r.division_id)) oneToOne.set(r.division_id, { s: new Set(), t: new Set() });
        const b = oneToOne.get(r.division_id)!;
        if (r.student_id) b.s.add(r.student_id);
        if (r.teacher_id) b.t.add(r.teacher_id);
      });

      // Students / teachers (group divisions)
      const group = new Map<string, { s: Set<string>; t: Set<string> }>();
      const ensureGroup = (id: string) => {
        if (!group.has(id)) group.set(id, { s: new Set(), t: new Set() });
        return group.get(id)!;
      };
      (courseRes.data || []).forEach((c: any) => {
        if (!c.division_id) return;
        const b = ensureGroup(c.division_id);
        if (c.teacher_id) b.t.add(c.teacher_id);
      });
      (enrollmentRes.data || []).forEach((r: any) => {
        const div = r.course?.division_id;
        if (div && r.student_id) ensureGroup(div).s.add(r.student_id);
      });
      (classStaffRes.data || []).forEach((r: any) => {
        const div = r.class?.courses?.division_id;
        if (div && r.user_id) ensureGroup(div).t.add(r.user_id);
      });

      divisions.forEach((d) => {
        const src = d.modelType === 'one_to_one' ? oneToOne.get(d.id) : group.get(d.id);
        metrics[d.id].students = src?.s.size || 0;
        metrics[d.id].teachers = src?.t.size || 0;
      });

      // Classes today
      (scheduleRes.data || []).forEach((s: any) => {
        const m = bucket(s.division_id);
        if (m) m.classesToday += 1;
      });
      (courseClassRes.data || []).forEach((c: any) => {
        const div = c.course?.division_id;
        const m = bucket(div);
        if (!m) return;
        if (c.status && c.status !== 'active') return;
        const days: string[] = Array.isArray(c.schedule_days) ? c.schedule_days : [];
        if (days.some((d) => String(d).toLowerCase().startsWith(dayName.slice(0, 3)))) m.classesToday += 1;
      });

      // Attendance today
      (attendanceRes.data || []).forEach((a: any) => {
        const m = bucket(a.division_id);
        if (!m) return;
        m.attendanceMarked += 1;
        if (a.status === 'present' || a.status === 'late') m.attendancePresent += 1;
      });

      // Fees
      (invoiceRes.data || []).forEach((i: any) => {
        const m = bucket(i.division_id);
        if (!m || i.is_archived || i.voided_at) return;
        const balance = Number(i.amount || 0) - Number(i.amount_paid || 0);
        const overdue = balance > 0 && (i.status === 'overdue' || (i.due_date && i.due_date < today));
        if (overdue) {
          m.overdueCount += 1;
          m.overdueAmount += balance;
        }
        if (i.billing_month === monthKey) m.revenueMtd += Number(i.amount_paid || 0);
      });

      // Alerts
      (riskRes.data || []).forEach((r: any) => {
        const m = bucket(r.course?.division_id);
        if (m) m.alerts += 1;
      });

      divisions.forEach((d) => {
        const m = metrics[d.id];
        m.attendancePct = m.attendanceMarked > 0 ? Math.round((m.attendancePresent / m.attendanceMarked) * 100) : null;
      });

      return { divisions, metrics };
    },
  });
}
