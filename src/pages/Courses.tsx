import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Plus, Users, Eye, UserPlus, Archive, Search } from 'lucide-react';
import { format } from 'date-fns';

interface Course {
  id: string;
  name: string;
  teacher_id: string;
  subject_id: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  max_students: number;
  is_group_class: boolean;
  created_at: string;
  teacher?: { full_name: string };
  subject?: { name: string } | null;
  enrollment_count?: number;
}

interface CourseEnrollment {
  id: string;
  course_id: string;
  student_id: string;
  status: string;
  enrolled_at: string;
  student?: { full_name: string; email: string | null };
}

export default function Courses() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formMaxStudents, setFormMaxStudents] = useState('30');

  // Fetch courses with teacher and subject names
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*, teacher:profiles!courses_teacher_id_fkey(full_name), subject:subjects!courses_subject_id_fkey(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch enrollment counts
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('status', 'active');

      const countMap: Record<string, number> = {};
      (enrollments || []).forEach(e => {
        countMap[e.course_id] = (countMap[e.course_id] || 0) + 1;
      });

      return (data || []).map(c => ({
        ...c,
        enrollment_count: countMap[c.id] || 0,
      })) as Course[];
    },
  });

  // Fetch teachers for dropdown
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, profiles:user_id(id, full_name)')
        .eq('role', 'teacher');
      return (data || []).map((r: any) => ({
        id: r.profiles?.id,
        full_name: r.profiles?.full_name,
      })).filter((t: any) => t.id);
    },
  });

  // Fetch subjects for dropdown
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('subjects').select('id, name').eq('is_active', true);
      return data || [];
    },
  });

  // Fetch enrollments for selected course
  const { data: enrollments = [] } = useQuery({
    queryKey: ['course-enrollments', detailCourse?.id],
    enabled: !!detailCourse,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('*, student:profiles!course_enrollments_student_id_fkey(full_name, email)')
        .eq('course_id', detailCourse!.id)
        .order('enrolled_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CourseEnrollment[];
    },
  });

  // Fetch all students for enrollment picker
  const { data: allStudents = [] } = useQuery({
    queryKey: ['all-students'],
    enabled: enrollOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, profiles:user_id(id, full_name, email)')
        .eq('role', 'student');
      return (data || []).map((r: any) => ({
        id: r.profiles?.id,
        full_name: r.profiles?.full_name,
        email: r.profiles?.email,
      })).filter((s: any) => s.id);
    },
  });

  // Create course mutation
  const createCourse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('courses').insert({
        name: formName,
        teacher_id: formTeacherId,
        subject_id: formSubjectId || null,
        start_date: formStartDate,
        end_date: formEndDate || null,
        max_students: parseInt(formMaxStudents) || 30,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setCreateOpen(false);
      resetForm();
      toast({ title: 'Course created successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Enroll students mutation
  const enrollStudents = useMutation({
    mutationFn: async () => {
      if (!detailCourse) return;
      const rows = selectedStudents.map(sid => ({
        course_id: detailCourse.id,
        student_id: sid,
      }));
      const { error } = await supabase.from('course_enrollments').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-enrollments', detailCourse?.id] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setEnrollOpen(false);
      setSelectedStudents([]);
      toast({ title: `${selectedStudents.length} student(s) enrolled` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Archive course mutation
  const archiveCourse = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from('courses').update({ status: 'archived' }).eq('id', courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setDetailCourse(null);
      toast({ title: 'Course archived' });
    },
  });

  // Drop student mutation
  const dropStudent = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase.from('course_enrollments').update({ status: 'dropped' }).eq('id', enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-enrollments', detailCourse?.id] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({ title: 'Student dropped from course' });
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormTeacherId('');
    setFormSubjectId('');
    setFormStartDate('');
    setFormEndDate('');
    setFormMaxStudents('30');
  };

  const activeCourses = courses.filter(c => c.status === 'active');
  const archivedCourses = courses.filter(c => c.status === 'archived');

  // Filter already-enrolled students out of the enrollment picker
  const enrolledIds = new Set(enrollments.filter(e => e.status === 'active').map(e => e.student_id));
  const availableStudents = allStudents.filter(
    s => !enrolledIds.has(s.id) && (
      !studentSearch ||
      s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email?.toLowerCase().includes(studentSearch.toLowerCase())
    )
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="page-header-premium rounded-xl p-6 mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                <Users className="h-6 w-6" />
                Course Management
              </h1>
              <p className="text-white/80 mt-1">Create and manage group batches & courses</p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> New Course
            </Button>
          </div>
        </div>

        {/* Active Courses Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Courses ({activeCourses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading courses...</p>
            ) : activeCourses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No active courses yet. Create one to get started.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCourses.map(course => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.name}</TableCell>
                      <TableCell>{(course as any).teacher?.full_name || '—'}</TableCell>
                      <TableCell>{(course as any).subject?.name || '—'}</TableCell>
                      <TableCell>{format(new Date(course.start_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{course.enrollment_count}/{course.max_students}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setDetailCourse(course)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Archived Courses */}
        {archivedCourses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">Archived ({archivedCourses.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Name</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedCourses.map(course => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium text-muted-foreground">{course.name}</TableCell>
                      <TableCell>{(course as any).teacher?.full_name || '—'}</TableCell>
                      <TableCell>{course.enrollment_count}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setDetailCourse(course)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Course Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Course</DialogTitle>
            <DialogDescription>Set up a new group batch or course.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Course Name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Hifz Batch A - Morning" />
            </div>
            <div>
              <Label>Teacher *</Label>
              <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                <SelectTrigger><SelectValue placeholder="Select subject (optional)" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Max Students</Label>
              <Input type="number" value={formMaxStudents} onChange={e => setFormMaxStudents(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCourse.mutate()}
              disabled={!formName || !formTeacherId || !formStartDate || createCourse.isPending}
            >
              {createCourse.isPending ? 'Creating...' : 'Create Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Course Detail Sheet */}
      <Sheet open={!!detailCourse} onOpenChange={open => !open && setDetailCourse(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detailCourse?.name}</SheetTitle>
            <SheetDescription>
              Teacher: {(detailCourse as any)?.teacher?.full_name || '—'} · 
              {detailCourse?.status === 'active' ? (
                <Badge className="ml-2" variant="default">Active</Badge>
              ) : (
                <Badge className="ml-2" variant="secondary">Archived</Badge>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{enrollments.filter(e => e.status === 'active').length}</p>
                <p className="text-xs text-muted-foreground">Enrolled</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{detailCourse?.max_students}</p>
                <p className="text-xs text-muted-foreground">Max</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{enrollments.filter(e => e.status === 'dropped').length}</p>
                <p className="text-xs text-muted-foreground">Dropped</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {detailCourse?.status === 'active' && (
                <>
                  <Button size="sm" onClick={() => { setEnrollOpen(true); setSelectedStudents([]); setStudentSearch(''); }}>
                    <UserPlus className="h-4 w-4 mr-1" /> Enroll Students
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => archiveCourse.mutate(detailCourse.id)}>
                    <Archive className="h-4 w-4 mr-1" /> Archive
                  </Button>
                </>
              )}
            </div>

            {/* Enrolled students list */}
            <div>
              <h3 className="font-medium mb-2">Enrolled Students</h3>
              {enrollments.filter(e => e.status === 'active').length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No students enrolled yet.</p>
              ) : (
                <div className="space-y-2">
                  {enrollments.filter(e => e.status === 'active').map(enrollment => (
                    <div key={enrollment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{(enrollment as any).student?.full_name}</p>
                        <p className="text-xs text-muted-foreground">{(enrollment as any).student?.email}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                        onClick={() => dropStudent.mutate(enrollment.id)}>
                        Drop
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dropped students */}
            {enrollments.filter(e => e.status === 'dropped').length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-muted-foreground">Dropped Students</h3>
                <div className="space-y-2">
                  {enrollments.filter(e => e.status === 'dropped').map(enrollment => (
                    <div key={enrollment.id} className="flex items-center p-3 border rounded-lg opacity-60">
                      <p className="text-sm">{(enrollment as any).student?.full_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Enroll Students Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Enroll Students</DialogTitle>
            <DialogDescription>Select students to add to {detailCourse?.name}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-y-auto max-h-64 space-y-1">
            {availableStudents.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No students available</p>
            ) : (
              availableStudents.map(s => (
                <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                  <Checkbox
                    checked={selectedStudents.includes(s.id)}
                    onCheckedChange={checked => {
                      setSelectedStudents(prev =>
                        checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                      );
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button
              onClick={() => enrollStudents.mutate()}
              disabled={selectedStudents.length === 0 || enrollStudents.isPending}
            >
              {enrollStudents.isPending ? 'Enrolling...' : `Enroll ${selectedStudents.length} Student(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
