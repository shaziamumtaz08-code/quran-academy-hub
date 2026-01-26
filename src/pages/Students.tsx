import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Mail, User, Loader2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StudentCard } from '@/components/students/StudentCard';
import { StudentDetailDrawer } from '@/components/students/StudentDetailDrawer';
import { StudentHistoryDialog } from '@/components/students/StudentHistoryDialog';
import { StudentScheduleDialog } from '@/components/students/StudentScheduleDialog';
import { QuickAttendanceModal } from '@/components/attendance/QuickAttendanceModal';

interface Student {
  id: string;
  full_name: string;
  email: string | null;
  teacher_name: string | null;
}

type AssignmentStatus = 'active' | 'paused' | 'completed';

interface TeacherStudent {
  id: string;
  full_name: string;
  email: string | null;
  subject_name: string | null;
  assignment_status: AssignmentStatus;
  daily_target_lines: number;
  preferred_unit: string;
  last_lesson: string | null;
  homework: string | null;
  age: number | null;
  gender: string | null;
}

export default function Students() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<TeacherStudent | null>(null);
  const [historyStudent, setHistoryStudent] = useState<TeacherStudent | null>(null);
  const [scheduleStudent, setScheduleStudent] = useState<TeacherStudent | null>(null);
  const [attendanceStudent, setAttendanceStudent] = useState<TeacherStudent | null>(null);
  const { user, activeRole } = useAuth();

  // Determine role-based behavior
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');
  const isTeacher = activeRole === 'teacher';
  const isParent = activeRole === 'parent';

  // Fetch students for teacher with full details (subject, schedule, targets)
  const { data: teacherStudents = [], isLoading: isLoadingTeacher } = useQuery({
    queryKey: ['teacher-students-detailed', user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get assignments with student profile and subject
      const { data: assignments, error: assignError } = await supabase
        .from('student_teacher_assignments')
        .select(`
          student_id,
          status,
          student:profiles!student_teacher_assignments_student_id_fkey(
            id, full_name, email, daily_target_lines, preferred_unit, age, gender
          ),
          subject:subjects(name)
        `)
        .eq('teacher_id', user.id)
        .in('status', ['active', 'paused']);

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) return [];

      const studentIds = assignments.map(a => a.student_id);

      // Get latest attendance record per student (for last lesson + homework)
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('student_id, lesson_covered, surah_name, ayah_from, ayah_to, homework, class_date')
        .eq('teacher_id', user.id)
        .in('student_id', studentIds)
        .eq('status', 'present')
        .order('class_date', { ascending: false });

      // Build a map of latest attendance per student
      const latestAttendance = new Map<string, { lesson: string | null; homework: string | null }>();
      (attendanceData || []).forEach(record => {
        if (!latestAttendance.has(record.student_id)) {
          let lesson = record.lesson_covered;
          if (!lesson && record.surah_name) {
            lesson = record.surah_name;
            if (record.ayah_from) {
              lesson += `, Ayah ${record.ayah_from}`;
              if (record.ayah_to && record.ayah_to !== record.ayah_from) {
                lesson += `-${record.ayah_to}`;
              }
            }
          }
          latestAttendance.set(record.student_id, {
            lesson,
            homework: record.homework,
          });
        }
      });

      return assignments.map((a: any) => ({
        id: a.student?.id || a.student_id,
        full_name: a.student?.full_name || 'Unknown',
        email: a.student?.email || null,
        subject_name: a.subject?.name || null,
        assignment_status: (a.status || 'active') as AssignmentStatus,
        daily_target_lines: a.student?.daily_target_lines || 0,
        preferred_unit: a.student?.preferred_unit || 'lines',
        last_lesson: latestAttendance.get(a.student_id)?.lesson || null,
        homework: latestAttendance.get(a.student_id)?.homework || null,
        age: a.student?.age ?? null,
        gender: a.student?.gender ?? null,
      })) as TeacherStudent[];
    },
    enabled: !!user?.id && isTeacher,
  });

  // Fetch students for admin/parent (original simple view)
  const { data: students = [], isLoading: isLoadingOther } = useQuery({
    queryKey: ['students-list-full', user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return [];

      // For parents: only show linked children
      if (isParent) {
        const { data: links, error: linkError } = await supabase
          .from('student_parent_links')
          .select(`
            student_id,
            student:profiles!student_parent_links_student_id_fkey(id, full_name, email)
          `)
          .eq('parent_id', user.id);

        if (linkError) throw linkError;

        // Get teacher assignments for children
        const childIds = (links || []).map((l: any) => l.student_id);
        const { data: assignments } = await supabase
          .from('student_teacher_assignments')
          .select(`student_id, teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name)`)
          .in('student_id', childIds);

        const teacherMap = new Map<string, string>();
        assignments?.forEach((a: any) => {
          teacherMap.set(a.student_id, a.teacher?.full_name || null);
        });

        return (links || []).map((l: any) => ({
          id: l.student?.id || l.student_id,
          full_name: l.student?.full_name || 'Unknown',
          email: l.student?.email || null,
          teacher_name: teacherMap.get(l.student_id) || null,
        })) as Student[];
      }

      // For admins: show all students (original behavior)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (roleError) throw roleError;

      const studentIds = roleData?.map(r => r.user_id) || [];
      if (studentIds.length === 0) return [];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', studentIds);

      if (profileError) throw profileError;

      const { data: assignments, error: assignError } = await supabase
        .from('student_teacher_assignments')
        .select(`
          student_id,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name)
        `)
        .in('student_id', studentIds);

      if (assignError) throw assignError;

      const teacherMap = new Map<string, string>();
      assignments?.forEach((a: any) => {
        teacherMap.set(a.student_id, a.teacher?.full_name || null);
      });

      return (profiles || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        teacher_name: teacherMap.get(p.id) || null,
      })) as Student[];
    },
    enabled: !!user?.id && !isTeacher,
  });

  const isLoading = isTeacher ? isLoadingTeacher : isLoadingOther;

  // Filter for teacher view
  const filteredTeacherStudents = teacherStudents.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  // Filter for admin/parent view
  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  // Get appropriate subtitle based on role
  const getSubtitle = () => {
    if (isTeacher) return 'View your assigned students with lesson details';
    if (isParent) return 'View your children';
    return "View your academy's students";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Students</h1>
            <p className="text-muted-foreground mt-1">{getSubtitle()}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Info note - only for admins */}
        {isAdmin && (
          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            To add or manage students, go to <strong>User Management</strong>. To assign teachers, use the <strong>Assignments</strong> page.
          </p>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isTeacher ? (
          // Teacher's Card Grid View
          filteredTeacherStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No students found</p>
              <p className="text-sm mt-1">No students are assigned to you yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTeacherStudents.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  onViewHistory={() => setHistoryStudent(student)}
                  onViewSchedule={() => setScheduleStudent(student)}
                />
              ))}
            </div>
          )
        ) : (
          // Admin/Parent Table View
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No students found</p>
                <p className="text-sm mt-1">
                  {isParent ? 'No children are linked to your account' : 'Add students via User Management'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Assigned Teacher</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{student.full_name}</span>
                          {student.email && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {student.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.teacher_name ? (
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {student.teacher_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not assigned</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* Student Detail Drawer (for teachers) */}
        {isTeacher && user?.id && (
          <StudentDetailDrawer
            open={!!selectedStudent}
            onOpenChange={(open) => !open && setSelectedStudent(null)}
            student={selectedStudent}
            teacherId={user.id}
          />
        )}

        {/* Student History Dialog (Book Icon) */}
        {isTeacher && historyStudent && (
          <StudentHistoryDialog
            open={!!historyStudent}
            onOpenChange={(open) => !open && setHistoryStudent(null)}
            studentId={historyStudent.id}
            studentName={historyStudent.full_name}
          />
        )}

        {/* Student Schedule Dialog (Calendar Icon) */}
        {isTeacher && scheduleStudent && (
          <StudentScheduleDialog
            open={!!scheduleStudent}
            onOpenChange={(open) => !open && setScheduleStudent(null)}
            studentId={scheduleStudent.id}
            studentName={scheduleStudent.full_name}
          />
        )}

        {/* Quick Attendance Modal */}
        {isTeacher && attendanceStudent && (
          <QuickAttendanceModal
            open={!!attendanceStudent}
            onOpenChange={(open) => !open && setAttendanceStudent(null)}
            student={attendanceStudent}
          />
        )}
      </div>
    </DashboardLayout>
  );
}