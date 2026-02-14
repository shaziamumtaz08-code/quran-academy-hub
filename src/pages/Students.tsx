import React, { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Mail, User, Loader2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StudentCard } from '@/components/students/StudentCard';
import { StudentDetailDrawer } from '@/components/students/StudentDetailDrawer';
import { StudentHistoryDialog } from '@/components/students/StudentHistoryDialog';
import { StudentScheduleDialog } from '@/components/students/StudentScheduleDialog';
import { QuickAttendanceModal } from '@/components/attendance/QuickAttendanceModal';
import { useSearchParams } from 'react-router-dom';

interface Student {
  id: string;
  full_name: string;
  email: string | null;
  teacher_name: string | null;
  country: string | null;
  city: string | null;
  gender: string | null;
  age: number | null;
  subjects: { id: string; name: string }[];
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

type SortField = 'name' | 'email' | 'teacher' | 'country' | 'city' | 'gender' | 'age';
type SortOrder = 'asc' | 'desc';

export default function Students() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<TeacherStudent | null>(null);
  const [historyStudent, setHistoryStudent] = useState<TeacherStudent | null>(null);
  const [scheduleStudent, setScheduleStudent] = useState<TeacherStudent | null>(null);
  const [attendanceStudent, setAttendanceStudent] = useState<TeacherStudent | null>(null);
  const { user, activeRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Sorting & Filtering
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterGender, setFilterGender] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState(searchParams.get('subjectId') || '');

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
          .select(`student_id, teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name), subject:subjects(id, name)`)
          .in('student_id', childIds)
          .eq('status', 'active');

        const teacherMap = new Map<string, string>();
        const subjectMap = new Map<string, { id: string; name: string }[]>();
        assignments?.forEach((a: any) => {
          if (!teacherMap.has(a.student_id)) {
            teacherMap.set(a.student_id, a.teacher?.full_name || null);
          }
          if (a.subject?.id) {
            const existing = subjectMap.get(a.student_id) || [];
            if (!existing.find((s: any) => s.id === a.subject.id)) {
              existing.push({ id: a.subject.id, name: a.subject.name });
            }
            subjectMap.set(a.student_id, existing);
          }
        });

        return (links || []).map((l: any) => ({
          id: l.student?.id || l.student_id,
          full_name: l.student?.full_name || 'Unknown',
          email: l.student?.email || null,
          teacher_name: teacherMap.get(l.student_id) || null,
          country: null,
          city: null,
          gender: null,
          age: null,
          subjects: subjectMap.get(l.student_id) || [],
        })) as Student[];
      }

      // For admins: show all students with location data and subjects
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (roleError) throw roleError;

      const studentIds = roleData?.map(r => r.user_id) || [];
      if (studentIds.length === 0) return [];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, country, city, gender, age')
        .in('id', studentIds);

      if (profileError) throw profileError;

      const { data: assignments, error: assignError } = await supabase
        .from('student_teacher_assignments')
        .select(`
          student_id,
          subject_id,
          teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name),
          subject:subjects(id, name)
        `)
        .in('student_id', studentIds)
        .eq('status', 'active');

      if (assignError) throw assignError;

      const teacherMap = new Map<string, string>();
      const subjectMap = new Map<string, { id: string; name: string }[]>();
      assignments?.forEach((a: any) => {
        if (!teacherMap.has(a.student_id)) {
          teacherMap.set(a.student_id, a.teacher?.full_name || null);
        }
        if (a.subject?.id) {
          const existing = subjectMap.get(a.student_id) || [];
          if (!existing.find(s => s.id === a.subject.id)) {
            existing.push({ id: a.subject.id, name: a.subject.name });
          }
          subjectMap.set(a.student_id, existing);
        }
      });

      return (profiles || []).map(p => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        teacher_name: teacherMap.get(p.id) || null,
        country: p.country || null,
        city: p.city || null,
        gender: p.gender || null,
        age: p.age || null,
        subjects: subjectMap.get(p.id) || [],
      })) as Student[];
    },
    enabled: !!user?.id && !isTeacher,
  });

  const isLoading = isTeacher ? isLoadingTeacher : isLoadingOther;

  // Get unique values for filters
  const uniqueCountries = useMemo(() => {
    const countries = new Set(students.map(s => s.country).filter(Boolean) as string[]);
    return [...countries].sort();
  }, [students]);

  const uniqueCities = useMemo(() => {
    const cities = students
      .filter(s => !filterCountry || s.country === filterCountry)
      .map(s => s.city)
      .filter(Boolean) as string[];
    return [...new Set(cities)].sort();
  }, [students, filterCountry]);

  const uniqueSubjects = useMemo(() => {
    const subjectMap = new Map<string, string>();
    students.forEach(s => s.subjects?.forEach(sub => subjectMap.set(sub.id, sub.name)));
    return [...subjectMap.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  // Filter for teacher view
  const filteredTeacherStudents = teacherStudents.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  // Filter for admin/parent view with sorting
  const filteredStudents = useMemo(() => {
    let filtered = students.filter(student => {
      const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesGender = !filterGender || student.gender === filterGender;
      const matchesCountry = !filterCountry || student.country === filterCountry;
      const matchesCity = !filterCity || student.city === filterCity;
      const matchesSubject = !filterSubjectId || student.subjects?.some(s => s.id === filterSubjectId);
      return matchesSearch && matchesGender && matchesCountry && matchesCity && matchesSubject;
    });

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = (a.full_name || '').localeCompare(b.full_name || '');
          break;
        case 'email':
          cmp = (a.email || '').localeCompare(b.email || '');
          break;
        case 'teacher':
          cmp = (a.teacher_name || '').localeCompare(b.teacher_name || '');
          break;
        case 'country':
          cmp = (a.country || '').localeCompare(b.country || '');
          break;
        case 'city':
          cmp = (a.city || '').localeCompare(b.city || '');
          break;
        case 'gender':
          cmp = (a.gender || '').localeCompare(b.gender || '');
          break;
        case 'age':
          cmp = (a.age || 0) - (b.age || 0);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [students, searchTerm, filterGender, filterCountry, filterCity, filterSubjectId, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 text-primary" /> 
      : <ArrowDown className="h-4 w-4 ml-1 text-primary" />;
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterGender('');
    setFilterCountry('');
    setFilterCity('');
    setFilterSubjectId('');
    setSortField('name');
    setSortOrder('asc');
    setSearchParams({});
  };

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

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {isAdmin && (
            <>
              <Select value={filterGender || "all"} onValueChange={(v) => setFilterGender(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCountry || "all"} onValueChange={(v) => { setFilterCountry(v === 'all' ? '' : v); setFilterCity(''); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {uniqueCountries.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCity || "all"} onValueChange={(v) => setFilterCity(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="City" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {uniqueCities.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSubjectId || "all"} onValueChange={(v) => { setFilterSubjectId(v === 'all' ? '' : v); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {uniqueSubjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={resetFilters} title="Reset Filters">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          )}
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
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      <span className="flex items-center">Student {getSortIcon('name')}</span>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-muted/50"
                      onClick={() => handleSort('teacher')}
                    >
                      <span className="flex items-center">Assigned Teacher {getSortIcon('teacher')}</span>
                    </TableHead>
                    <TableHead>Subject(s)</TableHead>
                    {isAdmin && (
                      <>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-muted/50"
                          onClick={() => handleSort('country')}
                        >
                          <span className="flex items-center">Country {getSortIcon('country')}</span>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-muted/50"
                          onClick={() => handleSort('city')}
                        >
                          <span className="flex items-center">City {getSortIcon('city')}</span>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-muted/50"
                          onClick={() => handleSort('gender')}
                        >
                          <span className="flex items-center">Gender {getSortIcon('gender')}</span>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer select-none hover:bg-muted/50"
                          onClick={() => handleSort('age')}
                        >
                          <span className="flex items-center">Age {getSortIcon('age')}</span>
                        </TableHead>
                      </>
                    )}
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
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {student.subjects && student.subjects.length > 0 ? (
                            student.subjects.map(sub => (
                              <Badge key={sub.id} variant="secondary" className="text-xs">
                                {sub.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <>
                          <TableCell className="text-muted-foreground">{student.country || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{student.city || '-'}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">{student.gender || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{student.age || '-'}</TableCell>
                        </>
                      )}
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