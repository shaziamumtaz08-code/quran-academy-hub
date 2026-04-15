import { supabase } from '@/integrations/supabase/client';

/**
 * Ensure a chat group exists for a class. If not, create one and populate members.
 */
export async function ensureClassChatGroup(
  classId: string,
  className: string,
  courseId: string,
  createdBy: string,
): Promise<string | null> {
  // Check if group already exists
  const { data: existing } = await (supabase
    .from('chat_groups')
    .select('id') as any)
    .eq('class_id', classId)
    .limit(1);

  if (existing && existing.length > 0) return existing[0].id;

  // Create group
  const { data: newGroup, error } = await supabase.from('chat_groups').insert({
    name: `${className} Chat`,
    type: 'group',
    created_by: createdBy,
    course_id: courseId,
    class_id: classId,
    channel_mode: 'class',
    is_active: true,
    is_dm: false,
  } as any).select('id').single();

  if (error || !newGroup) return null;

  // Fetch students and staff for this class
  const [{ data: students }, { data: staff }] = await Promise.all([
    supabase.from('course_class_students').select('student_id').eq('class_id', classId),
    supabase.from('course_class_staff').select('user_id').eq('class_id', classId),
  ]);

  const members: Array<{ group_id: string; user_id: string; role: string }> = [];
  
  (students || []).forEach(s => {
    members.push({ group_id: newGroup.id, user_id: s.student_id, role: 'member' });
  });
  
  (staff || []).forEach(s => {
    members.push({ group_id: newGroup.id, user_id: s.user_id, role: 'admin' });
  });

  if (!members.some(m => m.user_id === createdBy)) {
    members.push({ group_id: newGroup.id, user_id: createdBy, role: 'admin' });
  }

  if (members.length > 0) {
    await supabase.from('chat_members').insert(members);
  }

  return newGroup.id;
}

/**
 * Sync a single student into the class chat group.
 */
export async function addStudentToClassChat(classId: string, studentId: string) {
  const { data: groups } = await (supabase
    .from('chat_groups')
    .select('id') as any)
    .eq('class_id', classId)
    .limit(1);

  if (!groups?.length) return;

  const groupId = groups[0].id;
  const { data: existing } = await supabase
    .from('chat_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', studentId)
    .limit(1);

  if (existing?.length) return;

  await supabase.from('chat_members').insert({
    group_id: groupId,
    user_id: studentId,
    role: 'member',
  });
}

/**
 * Remove a student from the class chat group.
 */
export async function removeStudentFromClassChat(classId: string, studentId: string) {
  const { data: groups } = await supabase
    .from('chat_groups')
    .select('id')
    .eq('class_id' as any, classId)
    .limit(1) as any;

  if (!groups?.length) return;

  await supabase.from('chat_members')
    .delete()
    .eq('group_id', groups[0].id)
    .eq('user_id', studentId);
}

/**
 * Check if a class has a chat group.
 */
export async function classHasChatGroup(classId: string): Promise<boolean> {
  const { data } = await supabase
    .from('chat_groups')
    .select('id')
    .eq('class_id' as any, classId)
    .limit(1) as any;
  return (data?.length || 0) > 0;
}
