import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Mail, User, Loader2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Student {
  id: string;
  full_name: string;
  email: string | null;
  teacher_name: string | null;
}

export default function Students() {
  const [searchTerm, setSearchTerm] = useState('');
  const { user, activeRole } = useAuth();

  // Determine role-based behavior
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');
  const isTeacher = activeRole === 'teacher';
  const isParent = activeRole === 'parent';

  // Fetch students from Supabase - filtered by activeRole
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-list-full', user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return [];

      // For teachers: only show assigned students
      if (isTeacher) {
        const { data: assignments, error: assignError } = await supabase
          .from('student_teacher_assignments')
          .select(`
            student_id,
            student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, email)
          `)
          .eq('teacher_id', user.id);

        if (assignError) throw assignError;

        return (assignments || []).map((a: any) => ({
          id: a.student?.id || a.student_id,
          full_name: a.student?.full_name || 'Unknown',
          email: a.student?.email || null,
          teacher_name: null, // Teacher is viewing their own students
        })) as Student[];
      }

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
      // Get all users with student role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (roleError) throw roleError;

      const studentIds = roleData?.map(r => r.user_id) || [];
      if (studentIds.length === 0) return [];

      // Get profiles for those students
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', studentIds);

      if (profileError) throw profileError;

      // Get teacher assignments
      const { data: assignments, error: assignError } = await supabase
        .from('student_teacher_assignments')
        .select(`
          student_id,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name)
        `)
        .in('student_id', studentIds);

      if (assignError) throw assignError;

      // Map assignments by student_id
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
    enabled: !!user?.id,
  });

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  // Get appropriate subtitle based on role
  const getSubtitle = () => {
    if (isTeacher) return 'View your assigned students';
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

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No students found</p>
              <p className="text-sm mt-1">
                {isTeacher ? 'No students are assigned to you yet' : 
                 isParent ? 'No children are linked to your account' : 
                 'Add students via User Management'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  {!isTeacher && <TableHead>Assigned Teacher</TableHead>}
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
                    {!isTeacher && (
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
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
