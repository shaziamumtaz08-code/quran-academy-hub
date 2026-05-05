import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type EnrollmentStatus = 'active' | 'paused' | 'left' | 'completed' | 'inactive';

export interface DivisionMembership {
  divisionId: string;
  divisionName: string;
  modelType: string;
  /** Roles this user holds inside this specific division (e.g. ['student'], ['teacher','moderator']) */
  roles: string[];
  /** Aggregate status across this user's role(s) in this division. Worst-case wins for visibility. */
  status: EnrollmentStatus;
  /** Per-role status breakdown for tooltips */
  statusByRole?: Record<string, EnrollmentStatus>;
}

// Priority: active > paused > completed > left > inactive (most relevant first)
const STATUS_PRIORITY: Record<EnrollmentStatus, number> = {
  active: 0, paused: 1, completed: 2, left: 3, inactive: 4,
};
function pickStatus(a: EnrollmentStatus, b: EnrollmentStatus): EnrollmentStatus {
  return STATUS_PRIORITY[a] <= STATUS_PRIORITY[b] ? a : b;
}

/**
 * Resolves division membership for a list of user IDs.
 * Looks up student_teacher_assignments, course_class_students, and course_class_staff
 * to determine which divisions each user belongs to AND in what role per division.
 * Returns a Map<userId, DivisionMembership[]>.
 */
export function useDivisionMembership(userIds: string[], enabled = true) {
  return useQuery({
    queryKey: ['division-membership', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return new Map<string, DivisionMembership[]>();

      const { data: divisions } = await supabase
        .from('divisions')
        .select('id, name, model_type')
        .eq('is_active', true);
      const divMap = new Map((divisions || []).map(d => [d.id, { name: d.name, model_type: d.model_type }]));

      // 1:1 memberships via student_teacher_assignments — include all statuses
      const { data: staData } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, teacher_id, division_id, status');

      // Group student memberships — include all statuses
      const { data: ccsData } = await supabase
        .from('course_class_students')
        .select('student_id, status, class:course_classes!inner(courses:courses!inner(division_id))');

      // Group memberships: staff via course_class_staff → course_classes → courses
      const { data: staffData } = await supabase
        .from('course_class_staff')
        .select('user_id, staff_role, class:course_classes!inner(courses:courses!inner(division_id))');

      // Parent memberships: parents inherit divisions from their linked children
      const { data: parentLinks } = await supabase
        .from('student_parent_links')
        .select('parent_id, student_id');

      // Admin / staff memberships from user_context
      const { data: ctxRows } = await supabase
        .from('user_context')
        .select('user_id, division_id, primary_role')
        .in('user_id', userIds);

      // Map<userId, Map<divisionId, Map<role, status>>>
      const membershipMap = new Map<string, Map<string, Map<string, EnrollmentStatus>>>();
      const userIdSet = new Set(userIds);

      const addMembership = (userId: string, divisionId: string, role: string, status: EnrollmentStatus = 'active') => {
        if (!divisionId || !userIdSet.has(userId)) return;
        if (!membershipMap.has(userId)) membershipMap.set(userId, new Map());
        const divs = membershipMap.get(userId)!;
        if (!divs.has(divisionId)) divs.set(divisionId, new Map());
        const roleMap = divs.get(divisionId)!;
        const existing = roleMap.get(role);
        roleMap.set(role, existing ? pickStatus(existing, status) : status);
      };

      const normalizeStatus = (s: any): EnrollmentStatus => {
        const v = String(s || 'active').toLowerCase();
        if (v === 'active' || v === 'paused' || v === 'left' || v === 'completed' || v === 'inactive') return v;
        return 'inactive';
      };

      // 1:1 assignments
      (staData || []).forEach(a => {
        if (!a.division_id) return;
        const st = normalizeStatus(a.status);
        addMembership(a.student_id, a.division_id, 'student', st);
        addMembership(a.teacher_id, a.division_id, 'teacher', st);
      });

      // Group student memberships
      (ccsData || []).forEach((row: any) => {
        const divId = row.class?.courses?.division_id;
        if (divId) addMembership(row.student_id, divId, 'student', normalizeStatus(row.status));
      });

      // Group staff memberships
      (staffData || []).forEach((row: any) => {
        const divId = row.class?.courses?.division_id;
        if (divId) addMembership(row.user_id, divId, row.staff_role || 'teacher', 'active');
      });

      const ADMIN_CTX_ROLES = new Set([
        'admin', 'admin_division', 'admin_admissions', 'admin_fees',
        'admin_academic', 'super_admin', 'examiner', 'moderator', 'supervisor'
      ]);
      (ctxRows || []).forEach((row: any) => {
        if (!row.division_id || !row.primary_role) return;
        if (!ADMIN_CTX_ROLES.has(row.primary_role)) return;
        addMembership(row.user_id, row.division_id, row.primary_role, 'active');
      });

      // Parent memberships from children
      const allStudentDivs = new Map<string, Set<string>>();
      const addStudentDiv = (sid: string, did: string) => {
        if (!sid || !did) return;
        if (!allStudentDivs.has(sid)) allStudentDivs.set(sid, new Set());
        allStudentDivs.get(sid)!.add(did);
      };
      (staData || []).forEach(a => addStudentDiv(a.student_id, a.division_id));
      (ccsData || []).forEach((row: any) => addStudentDiv(row.student_id, row.class?.courses?.division_id));

      (parentLinks || []).forEach(link => {
        if (!link.parent_id || link.parent_id === link.student_id) return;
        const divs = allStudentDivs.get(link.student_id);
        if (!divs) return;
        divs.forEach(divId => addMembership(link.parent_id, divId, 'parent', 'active'));
      });

      const result = new Map<string, DivisionMembership[]>();
      userIds.forEach(uid => {
        const divs = membershipMap.get(uid);
        if (divs && divs.size > 0) {
          result.set(uid, [...divs.entries()].map(([did, roleMap]) => {
            const info = divMap.get(did);
            const statusByRole: Record<string, EnrollmentStatus> = {};
            let agg: EnrollmentStatus = 'inactive';
            let first = true;
            roleMap.forEach((st, r) => {
              statusByRole[r] = st;
              agg = first ? st : pickStatus(agg, st);
              first = false;
            });
            return {
              divisionId: did,
              divisionName: info?.name || 'Unknown',
              modelType: info?.model_type || 'unknown',
              roles: [...roleMap.keys()],
              status: agg,
              statusByRole,
            };
          }));
        } else {
          result.set(uid, []);
        }
      });

      return result;
    },
    enabled: enabled && userIds.length > 0,
    staleTime: 30000,
  });
}

/** Short name for division badges */
export function getDivisionShortName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('1-to-1') || lower.includes('one_to_one') || lower.includes('mentorship') || lower.includes('1:1')) return '1:1';
  if (lower.includes('group')) return 'Group';
  if (lower.includes('nazra')) return 'Nazra';
  if (lower.includes('hifz')) return 'Hifz';
  return name.length > 12 ? name.slice(0, 10) + '…' : name;
}

/** Division badge color by model type */
export function getDivisionBadgeClass(modelType: string): string {
  if (modelType === 'one_to_one') return 'bg-blue-500/10 text-blue-700 border-blue-200';
  if (modelType === 'group') return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
  return 'bg-muted text-muted-foreground border-border';
}

/** Display labels for app roles. Centralized so all UI surfaces stay consistent. */
const ROLE_DISPLAY_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  admin_division: 'Division Admin',
  admin_admissions: 'Admissions Manager',
  admin_fees: 'Finance Manager',
  admin_academic: 'Academic Manager',
  teacher: 'Teacher',
  examiner: 'Examiner',
  student: 'Student',
  parent: 'Parent',
};

/** Capitalize a role string for display */
export function formatRoleLabel(role: string): string {
  if (!role) return '';
  if (ROLE_DISPLAY_LABELS[role]) return ROLE_DISPLAY_LABELS[role];
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ');
}
