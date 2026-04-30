import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { SubjectBadge } from '@/components/shared/SubjectBadge';
import { Button } from '@/components/ui/button';

export default function TeacherStudentsView() {
  const { user } = useAuth();
  const { activeDivision } = useDivision();
  const modelType = (activeDivision?.model_type as string) || null;

  // ───────── 1:1 BRANCH ─────────
  const oneToOneEnabled = !!user?.id && modelType !== 'group' && modelType !== 'recorded';
  const { data: assignments = [], isLoading: loading1to1 } = useQuery({
    queryKey: ['teacher-my-students', user?.id, activeDivision?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('student_teacher_assignments')
        .select(`
          id, status, created_at, payout_amount, payout_type,
          requires_schedule, requires_planning, requires_attendance,
          student_id, teacher_id, subject_id
        `)
        .eq('teacher_id', user.id)
        .eq('status', 'active') as any;

      if (activeDivision?.id) {
        query = query.eq('division_id', activeDivision.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const studentIds = [...new Set((data || []).map((a: any) => a.student_id))];
      const subjectIds = [...new Set((data || []).map((a: any) => a.subject_id).filter(Boolean))];

      const [studentsRes, subjectsRes] = await Promise.all([
        studentIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', studentIds as string[])
          : { data: [] },
        subjectIds.length > 0
          ? supabase.from('subjects').select('id, name').in('id', subjectIds as string[])
          : { data: [] },
      ]);

      const studentMap = Object.fromEntries((studentsRes.data || []).map((s: any) => [s.id, s.full_name]));
      const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s: any) => [s.id, s.name]));

      return (data || []).map((a: any) => ({
        ...a,
        student_name: studentMap[a.student_id] || 'Unknown',
        subject_name: a.subject_id ? subjectMap[a.subject_id] || '—' : '—',
      }));
    },
    enabled: oneToOneEnabled,
  });

  // ───────── GROUP BRANCH ─────────
  const groupEnabled = !!user?.id && modelType === 'group';
  const { data: groupedClasses = [], isLoading: loadingGroup } = useQuery({
    queryKey: ['teacher-group-students', user?.id, activeDivision?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: staffRows, error: staffErr } = await (supabase as any)
        .from('course_class_staff')
        .select('class_id, course_classes!inner(id, name, course_id, courses!inner(name))')
        .eq('user_id', user.id);
      if (staffErr) throw staffErr;

      const classIds = (staffRows || []).map((c: any) => c.class_id).filter(Boolean);
      if (!classIds.length) return [];

      const { data: rosterRows } = await (supabase as any)
        .from('course_class_students')
        .select('student_id, class_id, status, profile:profiles!course_class_students_student_id_fkey(id, full_name, email)')
        .in('class_id', classIds)
        .eq('status', 'active');

      return (staffRows || []).map((s: any) => {
        const students = (rosterRows || []).filter((r: any) => r.class_id === s.class_id);
        return {
          class_id: s.class_id,
          class_name: s.course_classes?.name || 'Unnamed Class',
          course_name: s.course_classes?.courses?.name || '—',
          students,
        };
      });
    },
    enabled: groupEnabled,
  });

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const isLoading = loading1to1 || loadingGroup;
  if (isLoading) {
    return <div className="space-y-3 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  }

  // ───────── RECORDED EMPTY STATE ─────────
  if (modelType === 'recorded') {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-base font-medium">No student rosters</p>
        <p className="text-sm mt-1">Recorded courses don't have student rosters.</p>
      </div>
    );
  }

  // ───────── GROUP RENDER ─────────
  if (modelType === 'group') {
    const totalStudents = groupedClasses.reduce((sum: number, c: any) => sum + (c.students?.length || 0), 0);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-lms-navy">My Students</h2>
            <p className="text-sm text-muted-foreground">Students in classes you teach</p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            {totalStudents} students
          </Badge>
        </div>

        {groupedClasses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No classes assigned</p>
            <p className="text-xs mt-1">You aren't currently staffed on any group classes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedClasses.map((cls: any) => {
              const isCollapsed = collapsed[cls.class_id];
              return (
                <div key={cls.class_id} className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => toggle(cls.class_id)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted text-left"
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <BookOpen className="h-4 w-4 text-lms-accent" />
                    <span className="text-sm font-medium flex-1">{cls.class_name}</span>
                    <span className="text-xs text-muted-foreground">{cls.course_name}</span>
                    <Badge variant="secondary" className="text-[10px]">{cls.students.length}</Badge>
                  </button>
                  {!isCollapsed && (
                    cls.students.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground">No active students</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Name</TableHead>
                            <TableHead className="text-xs">Email</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cls.students.map((r: any) => (
                            <TableRow key={`${cls.class_id}-${r.student_id}`}>
                              <TableCell className="font-medium text-sm">{r.profile?.full_name || 'Unknown'}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{r.profile?.email || '—'}</TableCell>
                              <TableCell>
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Active</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ───────── 1:1 RENDER (default) ─────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-lms-navy">My Students</h2>
          <p className="text-sm text-muted-foreground">Your active student assignments</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />
          {assignments.length} students
        </Badge>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No active student assignments</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Student</TableHead>
                <TableHead className="text-xs">Subject</TableHead>
                <TableHead className="text-xs">Tracking</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-sm">{a.student_name}</TableCell>
                  <TableCell>
                    {a.subject_name !== '—' ? (
                      <SubjectBadge name={a.subject_name} />
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {a.requires_schedule && <Badge variant="outline" className="text-[9px] px-1.5 py-0">S</Badge>}
                      {a.requires_planning && <Badge variant="outline" className="text-[9px] px-1.5 py-0">P</Badge>}
                      {a.requires_attendance && <Badge variant="outline" className="text-[9px] px-1.5 py-0">A</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Active</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
