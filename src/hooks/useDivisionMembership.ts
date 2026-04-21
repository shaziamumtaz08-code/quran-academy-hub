import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DivisionMembership {
  divisionId: string;
  divisionName: string;
  modelType: string;
  /** Roles this user holds inside this specific division (e.g. ['student'], ['teacher','moderator']) */
  roles: string[];
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

      // 1:1 memberships via student_teacher_assignments (students AND teachers)
      const { data: staData } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, teacher_id, division_id')
        .eq('status', 'active');

      // Group memberships: students via course_class_students → course_classes → courses
      const { data: ccsData } = await supabase
        .from('course_class_students')
        .select('student_id, class:course_classes!inner(courses:courses!inner(division_id))')
        .eq('status', 'active');

      // Group memberships: staff via course_class_staff → course_classes → courses
      const { data: staffData } = await supabase
        .from('course_class_staff')
        .select('user_id, staff_role, class:course_classes!inner(courses:courses!inner(division_id))');

      // Parent memberships: parents inherit divisions from their linked children
      const { data: parentLinks } = await supabase
        .from('student_parent_links')
        .select('parent_id, student_id');

      // Map<userId, Map<divisionId, Set<role>>>
      const membershipMap = new Map<string, Map<string, Set<string>>>();
      const userIdSet = new Set(userIds);

      const addMembership = (userId: string, divisionId: string, role: string) => {
        if (!divisionId || !userIdSet.has(userId)) return;
        if (!membershipMap.has(userId)) membershipMap.set(userId, new Map());
        const divs = membershipMap.get(userId)!;
        if (!divs.has(divisionId)) divs.set(divisionId, new Set());
        divs.get(divisionId)!.add(role);
      };

      // 1:1 assignments: student → 'student', teacher → 'teacher'
      (staData || []).forEach(a => {
        if (!a.division_id) return;
        addMembership(a.student_id, a.division_id, 'student');
        addMembership(a.teacher_id, a.division_id, 'teacher');
      });

      // Group student memberships
      (ccsData || []).forEach((row: any) => {
        const divId = row.class?.courses?.division_id;
        if (divId) addMembership(row.student_id, divId, 'student');
      });

      // Group staff memberships — use staff_role if present (teacher/moderator/supervisor)
      (staffData || []).forEach((row: any) => {
        const divId = row.class?.courses?.division_id;
        if (divId) addMembership(row.user_id, divId, row.staff_role || 'teacher');
      });

      const result = new Map<string, DivisionMembership[]>();
      userIds.forEach(uid => {
        const divs = membershipMap.get(uid);
        if (divs && divs.size > 0) {
          result.set(uid, [...divs.entries()].map(([did, roleSet]) => {
            const info = divMap.get(did);
            return {
              divisionId: did,
              divisionName: info?.name || 'Unknown',
              modelType: info?.model_type || 'unknown',
              roles: [...roleSet],
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

/** Capitalize a role string for display */
export function formatRoleLabel(role: string): string {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ');
}
