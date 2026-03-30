import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Plus, Users, Eye, UserPlus, Archive, Search, Clock, Trash2, CheckCircle, XCircle, AlertCircle, ClipboardCheck, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableToolbar } from '@/components/ui/table-toolbar';
import { format } from 'date-fns';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ─────────────────────────────────────────────
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

interface CourseSchedule {
  id: string;
  course_id: string;
  day_of_week: string;
  student_local_time: string;
  teacher_local_time: string;
  duration_minutes: number;
  is_active: boolean;
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAYS_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

function formatTime12h(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

// ─── Main Component ────────────────────────────────────
export default function Courses() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { activeDivision, activeBranch } = useDivision();
  const { activeRole, profile } = useAuth();

  const canCreateCourse = useMemo(() => {
    const allowed = new Set(['super_admin', 'admin', 'admin_academic']);
    const assignedRoles = profile?.roles || [];
    return assignedRoles.some((role) => allowed.has(role)) || (activeRole ? allowed.has(activeRole) : false);
  }, [activeRole, profile?.roles]);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [activeTab, setActiveTab] = useState('students');
  const [courseSearch, setCourseSearch] = useState('');
  const [courseFilterTeacher, setCourseFilterTeacher] = useState('all');

  useEffect(() => {
    if (!canCreateCourse) {
      console.warn('[Courses] Create disabled: insufficient role', {
        activeRole,
        assignedRoles: profile?.roles || [],
      });
    }
  }, [canCreateCourse, activeRole, profile?.roles]);

  // Schedule form state
  const [scheduleDay, setScheduleDay] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState('30');

  // Attendance state
  const [attendanceDate, setAttendanceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, 'present' | 'student_absent' | 'late'>>({});

  // Form state
  const [formName, setFormName] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formMaxStudents, setFormMaxStudents] = useState('30');

  // ─── Queries ──────────────────────────────────────────
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', activeDivision?.id],
    queryFn: async () => {
      let q = supabase
        .from('courses')
        .select('*, teacher:profiles!courses_teacher_id_fkey(full_name), subject:subjects!courses_subject_id_fkey(name)')
        .order('created_at', { ascending: false });
      if (activeDivision?.id) q = q.eq('division_id', activeDivision.id);
      if (activeBranch?.id) q = q.eq('branch_id', activeBranch.id);
      const { data, error } = await q;
      if (error) throw error;

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

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-for-courses'],
    queryFn: async () => {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher');
      if (!roleRows?.length) return [];
      const userIds = roleRows.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
        .is('archived_at', null)
        .order('full_name');
      return profiles || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: async () => {
      const { data } = await supabase.from('subjects').select('id, name').eq('is_active', true);
      return data || [];
    },
  });

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

  const { data: courseSchedules = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['course-schedules', detailCourse?.id],
    enabled: !!detailCourse,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('id, course_id, day_of_week, student_local_time, teacher_local_time, duration_minutes, is_active')
        .eq('course_id', detailCourse!.id)
        .eq('is_active', true)
        .order('day_of_week');
      if (error) throw error;
      return (data || []) as CourseSchedule[];
    },
  });

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

  // ─── Mutations ────────────────────────────────────────
  const createCourse = useMutation({
    mutationFn: async () => {
      console.log('[Courses] CREATE MUTATION FIRED', { formName, formTeacherId, activeBranch: activeBranch?.id, activeDivision: activeDivision?.id, profileId: profile?.id });
      let branchId = activeBranch?.id ?? null;
      let divisionId = activeDivision?.id ?? null;

      if ((!branchId || !divisionId) && profile?.id) {
        const { data: fallbackContext } = await supabase
          .rpc('get_user_default_context', { _user_id: profile.id })
          .maybeSingle();

        branchId = branchId || fallbackContext?.branch_id || null;
        divisionId = divisionId || fallbackContext?.division_id || null;
      }

      if (!branchId || !divisionId) {
        console.warn('[Courses] Create blocked: missing branch/division context');
        throw new Error('Please select a branch/division before creating a course');
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      const payload = {
        name: formName.trim() || `Untitled Course ${today}`,
        teacher_id: formTeacherId || profile?.id,
        subject_id: formSubjectId || null,
        start_date: formStartDate || today,
        end_date: formEndDate || null,
        max_students: parseInt(formMaxStudents) || 30,
        branch_id: branchId,
        division_id: divisionId,
      };

      if (!payload.teacher_id) {
        console.warn('[Courses] Create blocked: no teacher selected and no fallback profile');
        throw new Error('Select a teacher before creating the course');
      }

      const { error } = await supabase.from('courses').insert(payload);
      if (error) {
        console.error('[Courses] INSERT ERROR:', error);
        throw error;
      }
      console.log('[Courses] INSERT SUCCESS');
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

  const addCourseSchedule = useMutation({
    mutationFn: async () => {
      if (!detailCourse) return;
      const { error } = await supabase.from('schedules').insert({
        course_id: detailCourse.id,
        assignment_id: null,
        day_of_week: scheduleDay,
        student_local_time: scheduleTime,
        teacher_local_time: scheduleTime,
        duration_minutes: parseInt(scheduleDuration),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-schedules', detailCourse?.id] });
      setScheduleDay('');
      setScheduleTime('');
      setScheduleDuration('30');
      toast({ title: 'Class timing added' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteCourseSchedule = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase.from('schedules').delete().eq('id', scheduleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-schedules', detailCourse?.id] });
      toast({ title: 'Class timing removed' });
    },
  });

  // Fetch existing attendance for selected date & course
  const { data: existingAttendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['course-attendance', detailCourse?.id, attendanceDate],
    enabled: !!detailCourse && activeTab === 'attendance',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, student_id, status, class_date')
        .eq('course_id', detailCourse!.id)
        .eq('class_date', attendanceDate);
      if (error) throw error;
      return data || [];
    },
  });

  const markedStudentIds = new Set(existingAttendance.map(a => a.student_id));

  // Submit group attendance
  const submitGroupAttendance = useMutation({
    mutationFn: async () => {
      if (!detailCourse) return;
      const entries = Object.entries(attendanceStatuses);
      if (entries.length === 0) throw new Error('No statuses selected');

      // Validate all students are enrolled
      const activeEnrollmentIds = new Set(enrollments.filter(e => e.status === 'active').map(e => e.student_id));
      const invalidStudents = entries.filter(([sid]) => !activeEnrollmentIds.has(sid));
      if (invalidStudents.length > 0) throw new Error('Some students are not enrolled in this course');

      // Get course schedule for time info
      const scheduleForToday = courseSchedules[0]; // Use first slot as default
      
      const rows = entries
        .filter(([sid]) => !markedStudentIds.has(sid)) // Skip already marked
        .map(([studentId, status]) => ({
          student_id: studentId,
          teacher_id: detailCourse.teacher_id,
          course_id: detailCourse.id,
          class_date: attendanceDate,
          class_time: scheduleForToday?.teacher_local_time || '09:00',
          duration_minutes: scheduleForToday?.duration_minutes || 30,
          status: status === 'late' ? 'present' : status,
          reason: status === 'late' ? 'Late' : null,
        }));

      if (rows.length === 0) throw new Error('All selected students already have attendance for this date');

      const { error } = await supabase.from('attendance').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-attendance', detailCourse?.id, attendanceDate] });
      setAttendanceStatuses({});
      toast({ title: 'Group attendance saved', description: `Attendance marked for ${attendanceDate}` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // ─── Helpers ──────────────────────────────────────────
  const resetForm = () => {
    setFormName(''); setFormTeacherId(''); setFormSubjectId('');
    setFormStartDate(''); setFormEndDate(''); setFormMaxStudents('30');
  };

  const activeCourses = courses.filter(c => c.status === 'active');
  const archivedCourses = courses.filter(c => c.status === 'archived');

  const teacherFilterOptions = React.useMemo(() => {
    const uniqueTeachers = new Map<string, string>();
    courses.forEach(c => {
      const name = (c as any).teacher?.full_name;
      if (name) uniqueTeachers.set(c.teacher_id, name);
    });
    return [
      { value: 'all', label: 'All Teachers' },
      ...Array.from(uniqueTeachers.entries()).map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [courses]);

  const filteredActiveCourses = React.useMemo(() => {
    return activeCourses.filter(c => {
      const matchesSearch = !courseSearch ||
        c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
        (c as any).teacher?.full_name?.toLowerCase().includes(courseSearch.toLowerCase()) ||
        (c as any).subject?.name?.toLowerCase().includes(courseSearch.toLowerCase());
      const matchesTeacher = courseFilterTeacher === 'all' || c.teacher_id === courseFilterTeacher;
      return matchesSearch && matchesTeacher;
    });
  }, [activeCourses, courseSearch, courseFilterTeacher]);

  const enrolledIds = new Set(enrollments.filter(e => e.status === 'active').map(e => e.student_id));
  const activeEnrolled = enrollments.filter(e => e.status === 'active').length;
  const capacityReached = detailCourse?.max_students ? activeEnrolled >= detailCourse.max_students : false;

  const availableStudents = allStudents.filter(
    s => !enrolledIds.has(s.id) && (
      !studentSearch ||
      s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email?.toLowerCase().includes(studentSearch.toLowerCase())
    )
  );

  // Sort course schedules by day order
  const sortedSchedules = [...courseSchedules].sort((a, b) => {
    return DAYS_OF_WEEK.indexOf(a.day_of_week) - DAYS_OF_WEEK.indexOf(b.day_of_week);
  });

  // Check max_students before enrolling
  const handleEnroll = () => {
    if (detailCourse?.max_students && (activeEnrolled + selectedStudents.length) > detailCourse.max_students) {
      toast({
        title: 'Capacity exceeded',
        description: `Max ${detailCourse.max_students} students. Currently ${activeEnrolled} enrolled.`,
        variant: 'destructive',
      });
      return;
    }
    enrollStudents.mutate();
  };

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
            <Button
              onClick={() => { console.log('[Courses] NEW COURSE BUTTON CLICKED'); setCreateOpen(true); }}
              disabled={false}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              title={!canCreateCourse ? 'You can open this form, but create requires super_admin/admin/admin_academic role' : 'Create course'}
            >
              <Plus className="h-4 w-4 mr-2" /> New Course
            </Button>
          </div>
        </div>

        {/* Active Courses Table */}
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="text-lg">Active Courses ({activeCourses.length})</CardTitle>
            <TableToolbar
              searchValue={courseSearch}
              onSearchChange={setCourseSearch}
              searchPlaceholder="Search courses..."
              filterValue={courseFilterTeacher}
              onFilterChange={setCourseFilterTeacher}
              filterOptions={teacherFilterOptions}
              filterLabel="Teacher"
              onReset={() => { setCourseSearch(''); setCourseFilterTeacher('all'); }}
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading courses...</p>
            ) : filteredActiveCourses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No courses found.</p>
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
                  {filteredActiveCourses.map(course => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.name}</TableCell>
                      <TableCell>{(course as any).teacher?.full_name || '—'}</TableCell>
                      <TableCell>{(course as any).subject?.name || '—'}</TableCell>
                      <TableCell>{format(new Date(course.start_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{course.enrollment_count}/{course.max_students}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/courses/${course.id}`)}>
                          <Eye className="h-4 w-4 mr-1" /> Open
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setDetailCourse(course); setActiveTab('students'); }}>
                          <Users className="h-4 w-4 mr-1" /> Quick View
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
                        <Button size="sm" variant="ghost" onClick={() => { setDetailCourse(course); setActiveTab('students'); }}>
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
              disabled={createCourse.isPending}
              title="Create course"
            >
              {createCourse.isPending ? 'Creating...' : 'Create Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Course Detail Sheet with Tabs */}
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
                <p className="text-2xl font-bold">{activeEnrolled}</p>
                <p className="text-xs text-muted-foreground">Enrolled</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{detailCourse?.max_students}</p>
                <p className="text-xs text-muted-foreground">Max</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{courseSchedules.length}</p>
                <p className="text-xs text-muted-foreground">Slots/wk</p>
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

            {/* Tabs: Students | Class Timings | Attendance */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="students" className="flex-1">Students</TabsTrigger>
                <TabsTrigger value="timings" className="flex-1">Timings</TabsTrigger>
                <TabsTrigger value="attendance" className="flex-1">Attendance</TabsTrigger>
              </TabsList>

              {/* Students Tab */}
              <TabsContent value="students">
                <div className="space-y-4">
                  <h3 className="font-medium">Enrolled Students</h3>
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
                          {detailCourse?.status === 'active' && (
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                              onClick={() => dropStudent.mutate(enrollment.id)}>
                              Drop
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

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
              </TabsContent>

              {/* Class Timings Tab */}
              <TabsContent value="timings">
                <div className="space-y-4">
                  {/* Add slot form */}
                  {detailCourse?.status === 'active' && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Add Weekly Slot
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        <Select value={scheduleDay} onValueChange={setScheduleDay}>
                          <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map(d => (
                              <SelectItem key={d} value={d}>{DAYS_LABELS[d]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
                        <Select value={scheduleDuration} onValueChange={setScheduleDuration}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="45">45 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                            <SelectItem value="90">90 min</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => addCourseSchedule.mutate()}
                        disabled={!scheduleDay || !scheduleTime || addCourseSchedule.isPending}
                      >
                        {addCourseSchedule.isPending ? 'Adding...' : 'Add Slot'}
                      </Button>
                    </div>
                  )}

                  {/* List existing slots */}
                  {loadingSchedules ? (
                    <p className="text-muted-foreground text-sm text-center py-4">Loading...</p>
                  ) : sortedSchedules.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No class timings set.</p>
                  ) : (
                    <div className="space-y-2">
                      {sortedSchedules.map(slot => (
                        <div key={slot.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="capitalize font-medium">
                              {DAYS_LABELS[slot.day_of_week] || slot.day_of_week}
                            </Badge>
                            <span className="text-sm font-medium">
                              {formatTime12h(slot.student_local_time)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({slot.duration_minutes} min)
                            </span>
                          </div>
                          {detailCourse?.status === 'active' && (
                            <Button size="sm" variant="ghost" className="text-destructive"
                              onClick={() => deleteCourseSchedule.mutate(slot.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Attendance Tab */}
              <TabsContent value="attendance">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Label className="shrink-0">Date:</Label>
                    <Input 
                      type="date" 
                      value={attendanceDate} 
                      onChange={e => { setAttendanceDate(e.target.value); setAttendanceStatuses({}); }}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="w-auto"
                    />
                  </div>

                  {loadingAttendance ? (
                    <p className="text-muted-foreground text-sm text-center py-4">Loading...</p>
                  ) : enrollments.filter(e => e.status === 'active').length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No enrolled students.</p>
                  ) : (
                    <div className="space-y-2">
                      {enrollments.filter(e => e.status === 'active').map(enrollment => {
                        const alreadyMarked = markedStudentIds.has(enrollment.student_id);
                        const existing = existingAttendance.find(a => a.student_id === enrollment.student_id);
                        const currentStatus = attendanceStatuses[enrollment.student_id];

                        return (
                          <div key={enrollment.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{(enrollment as any).student?.full_name}</p>
                              {alreadyMarked && (
                                <Badge variant="outline" className="text-xs">
                                  {existing?.status === 'present' ? '✓ Present' : existing?.status === 'student_absent' ? '✗ Absent' : existing?.status}
                                </Badge>
                              )}
                            </div>
                            {!alreadyMarked && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant={currentStatus === 'present' ? 'default' : 'outline'}
                                  className={currentStatus === 'present' ? 'bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2' : 'h-7 px-2'}
                                  onClick={() => setAttendanceStatuses(prev => ({ ...prev, [enrollment.student_id]: 'present' }))}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={currentStatus === 'late' ? 'default' : 'outline'}
                                  className={currentStatus === 'late' ? 'bg-amber-600 hover:bg-amber-700 text-white h-7 px-2' : 'h-7 px-2'}
                                  onClick={() => setAttendanceStatuses(prev => ({ ...prev, [enrollment.student_id]: 'late' }))}
                                >
                                  <AlertCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={currentStatus === 'student_absent' ? 'default' : 'outline'}
                                  className={currentStatus === 'student_absent' ? 'bg-red-600 hover:bg-red-700 text-white h-7 px-2' : 'h-7 px-2'}
                                  onClick={() => setAttendanceStatuses(prev => ({ ...prev, [enrollment.student_id]: 'student_absent' }))}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Mark All shortcuts + Submit */}
                  {enrollments.filter(e => e.status === 'active').length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const all: Record<string, 'present'> = {};
                          enrollments.filter(e => e.status === 'active' && !markedStudentIds.has(e.student_id))
                            .forEach(e => { all[e.student_id] = 'present'; });
                          setAttendanceStatuses(prev => ({ ...prev, ...all }));
                        }}
                      >
                        Mark All Present
                      </Button>
                      <div className="flex-1" />
                      <Button
                        onClick={() => submitGroupAttendance.mutate()}
                        disabled={Object.keys(attendanceStatuses).length === 0 || submitGroupAttendance.isPending}
                      >
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        {submitGroupAttendance.isPending ? 'Saving...' : `Save (${Object.keys(attendanceStatuses).length})`}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Enroll Students Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Enroll Students</DialogTitle>
            <DialogDescription>
              Select students to add to {detailCourse?.name}
              {capacityReached && (
                <span className="block text-destructive mt-1">⚠ Course is at full capacity ({detailCourse?.max_students})</span>
              )}
            </DialogDescription>
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
              onClick={handleEnroll}
              disabled={selectedStudents.length === 0 || enrollStudents.isPending || capacityReached}
            >
              {enrollStudents.isPending ? 'Enrolling...' : `Enroll ${selectedStudents.length} Student(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
