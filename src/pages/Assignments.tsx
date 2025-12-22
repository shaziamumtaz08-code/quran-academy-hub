import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Users, GraduationCap, Trash2, Loader2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  full_name: string;
}

interface Assignment {
  id: string;
  teacher_id: string;
  student_id: string;
  teacher_name: string;
  student_name: string;
  created_at: string;
}

export default function Assignments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  // Fetch teachers
  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(id, full_name)')
        .eq('role', 'teacher');

      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.profiles.id,
        full_name: row.profiles.full_name,
      })) as Profile[];
    },
  });

  // Fetch students
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(id, full_name)')
        .eq('role', 'student');

      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.profiles.id,
        full_name: row.profiles.full_name,
      })) as Profile[];
    },
  });

  // Fetch existing assignments
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['student-teacher-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select(`
          id,
          teacher_id,
          student_id,
          created_at,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
          student:profiles!student_teacher_assignments_student_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        teacher_id: row.teacher_id,
        student_id: row.student_id,
        teacher_name: row.teacher?.full_name || 'Unknown',
        student_name: row.student?.full_name || 'Unknown',
        created_at: row.created_at,
      })) as Assignment[];
    },
  });

  // Create assignments mutation
  const createMutation = useMutation({
    mutationFn: async ({ teacherId, studentIds }: { teacherId: string; studentIds: string[] }) => {
      const records = studentIds.map(studentId => ({
        teacher_id: teacherId,
        student_id: studentId,
      }));

      const { error } = await supabase
        .from('student_teacher_assignments')
        .upsert(records, { onConflict: 'teacher_id,student_id', ignoreDuplicates: true });

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI sync
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-students'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      toast({ title: 'Success', description: 'Assignments created successfully' });
      setSelectedTeacher('');
      setSelectedStudents([]);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete assignment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('student_teacher_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI sync
      queryClient.invalidateQueries({ queryKey: ['student-teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-students'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      toast({ title: 'Deleted', description: 'Assignment removed' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSubmit = () => {
    if (!selectedTeacher || selectedStudents.length === 0) {
      toast({ title: 'Error', description: 'Select a teacher and at least one student', variant: 'destructive' });
      return;
    }
    createMutation.mutate({ teacherId: selectedTeacher, studentIds: selectedStudents });
  };

  const isLoading = loadingTeachers || loadingStudents || loadingAssignments;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Student–Teacher Assignment</h1>
          <p className="text-muted-foreground mt-1">Assign students to teachers for attendance and dashboard access</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assignment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Create Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Teacher Selection */}
              <div className="space-y-2">
                <Label>Select Teacher</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a teacher..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student Selection */}
              <div className="space-y-2">
                <Label>Select Students</Label>
                <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                  {students.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">No students found</p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {students.map((student) => (
                        <label
                          key={student.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedStudents.includes(student.id)}
                            onCheckedChange={() => handleStudentToggle(student.id)}
                          />
                          <span className="text-sm">{student.full_name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {selectedStudents.length > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedStudents.length} student(s) selected</p>
                )}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!selectedTeacher || selectedStudents.length === 0 || createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Assignment
              </Button>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Teachers</p>
                    <p className="text-2xl font-bold">{teachers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Students</p>
                    <p className="text-2xl font-bold">{students.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <UserPlus className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Assignments</p>
                    <p className="text-2xl font-bold">{assignments.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Assignments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Current Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No assignments yet</p>
                <p className="text-sm">Create an assignment above to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.teacher_name}</TableCell>
                      <TableCell>{assignment.student_name}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(assignment.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}