import { supabase } from '@/integrations/supabase/client';

/**
 * Find or create a course-scoped DM between two users.
 * Returns the chat_group id.
 */
export async function findOrCreateCourseDM(
  userId: string,
  teacherId: string,
  courseId: string,
  courseName: string,
  userName: string,
  teacherName: string,
): Promise<string | null> {
  // Check if a DM already exists between these two for this course
  const { data: existingGroups } = await supabase
    .from('chat_groups')
    .select('id')
    .eq('is_dm', true)
    .eq('course_id', courseId);

  if (existingGroups?.length) {
    // Check if both users are members of any of these groups
    for (const group of existingGroups) {
      const { data: members } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('group_id', group.id);

      const memberIds = members?.map(m => m.user_id) || [];
      if (memberIds.includes(userId) && memberIds.includes(teacherId)) {
        return group.id; // Existing DM found
      }
    }
  }

  // Create new DM group
  const { data: newGroup, error } = await supabase.from('chat_groups').insert({
    name: `${courseName} - ${userName} ↔ ${teacherName}`,
    type: 'course_dm',
    course_id: courseId,
    created_by: userId,
    is_dm: true,
    is_active: true,
    channel_mode: 'private',
  }).select('id').single();

  if (error || !newGroup) return null;

  // Add both users as members
  await supabase.from('chat_members').insert([
    { group_id: newGroup.id, user_id: userId, role: 'member' },
    { group_id: newGroup.id, user_id: teacherId, role: 'member' },
  ]);

  return newGroup.id;
}

/**
 * Get the assigned teacher(s) for a student's class in a course.
 */
export async function getCourseTeachers(
  studentId: string,
  courseId: string,
): Promise<Array<{ userId: string; name: string; role: string }>> {
  // Find which class the student is in
  const { data: studentClass } = await supabase
    .from('course_class_students')
    .select('class_id')
    .eq('student_id', studentId);

  // Filter to classes in this course
  let classIds: string[] = [];
  if (studentClass?.length) {
    const allClassIds = studentClass.map(sc => sc.class_id);
    const { data: courseClasses } = await supabase
      .from('course_classes')
      .select('id')
      .eq('course_id', courseId)
      .in('id', allClassIds);
    classIds = (courseClasses || []).map(c => c.id);
  }

  if (classIds.length) {
    // Get staff for the student's specific class(es)
    const { data: staff } = await supabase
      .from('course_class_staff')
      .select('user_id, staff_role')
      .in('class_id', classIds)
      .in('staff_role', ['teacher', 'assistant']);

    if (staff?.length) {
      const uniqueIds = [...new Set(staff.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueIds);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || 'Teacher']));

      const map = new Map<string, { userId: string; name: string; role: string }>();
      staff.forEach(s => {
        if (!map.has(s.user_id)) {
          map.set(s.user_id, { userId: s.user_id, name: nameMap[s.user_id] || 'Teacher', role: s.staff_role });
        }
      });
      return [...map.values()];
    }
  }

  // Fallback: find any teacher for this course's classes
  const { data: courseClasses } = await supabase
    .from('course_classes')
    .select('id')
    .eq('course_id', courseId);

  if (courseClasses?.length) {
    const { data: staff } = await supabase
      .from('course_class_staff')
      .select('user_id, staff_role')
      .in('class_id', courseClasses.map(c => c.id))
      .in('staff_role', ['teacher', 'assistant']);

    if (staff?.length) {
      const uniqueIds = [...new Set(staff.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueIds);
      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || 'Teacher']));

      const map = new Map<string, { userId: string; name: string; role: string }>();
      staff.forEach(s => {
        if (!map.has(s.user_id)) {
          map.set(s.user_id, { userId: s.user_id, name: nameMap[s.user_id] || 'Teacher', role: s.staff_role });
        }
      });
      return [...map.values()];
    }
  }

  return [];
}
