import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DivisionMembership {
  divisionId: string;
  divisionName: string;
  modelType: string;
}

/**
 * Resolves division membership for a list of user IDs.
 * Looks up student_teacher_assignments, course_class_students, and course_class_staff
 * to determine which divisions each user belongs to.
 * Returns a Map<userId, DivisionMembership[]>.
 */
export function useDivisionMembership(userIds: string[], enabled = true) {
  return useQuery({
    queryKey: ['division-membership', userIds.sort().join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return new Map<string, DivisionMembership[]>();

      // Fetch all divisions for name resolution
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
        .select('user_id, class:course_classes!inner(courses:courses!inner(division_id))');

      const membershipMap = new Map<string, Set<string>>();

      const addMembership = (userId: string, divisionId: string) => {
        if (!divisionId || !userIds.includes(userId)) return;
        if (!membershipMap.has(userId)) membershipMap.set(userId, new Set());
        membershipMap.get(userId)!.add(divisionId);
      };

      // Process 1:1 assignments
      (staData || []).forEach(a => {
        if (a.division_id) {
          addMembership(a.student_id, a.division_id);
          addMembership(a.teacher_id, a.division_id);
        }
      });

      // Process group student memberships
      (ccsData || []).forEach((row: any) => {
        const divId = row.class?.courses?.division_id;
        if (divId) addMembership(row.student_id, divId);
      });

      // Process group staff memberships
      (staffData || []).forEach((row: any) => {
        const divId = row.class?.courses?.division_id;
        if (divId) addMembership(row.user_id, divId);
      });

      // Convert to DivisionMembership[]
      const result = new Map<string, DivisionMembership[]>();
      userIds.forEach(uid => {
        const divIds = membershipMap.get(uid);
        if (divIds && divIds.size > 0) {
          result.set(uid, [...divIds].map(did => {
            const info = divMap.get(did);
            return {
              divisionId: did,
              divisionName: info?.name || 'Unknown',
              modelType: info?.model_type || 'unknown',
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
  if (name.toLowerCase().includes('1-to-1') || name.toLowerCase().includes('one_to_one') || name.toLowerCase().includes('mentorship')) return '1:1';
  if (name.toLowerCase().includes('group')) return 'Group';
  if (name.toLowerCase().includes('nazra')) return 'Nazra';
  if (name.toLowerCase().includes('hifz')) return 'Hifz';
  // Truncate long names
  return name.length > 12 ? name.slice(0, 10) + '…' : name;
}

/** Division badge color by model type */
export function getDivisionBadgeClass(modelType: string): string {
  if (modelType === 'one_to_one') return 'bg-blue-500/10 text-blue-700 border-blue-200';
  if (modelType === 'group') return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
  return 'bg-muted text-muted-foreground border-border';
}
