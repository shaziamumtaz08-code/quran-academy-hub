import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { SubjectBadge } from '@/components/shared/SubjectBadge';

export default function TeacherStudentsView() {
  const { user } = useAuth();
  const { activeDivision } = useDivision();

  const { data: assignments = [], isLoading } = useQuery({
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
        .eq('status', 'active');

      if (activeDivision?.id) {
        query = query.eq('division_id', activeDivision.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch student and subject names
      const studentIds = [...new Set((data || []).map(a => a.student_id))];
      const subjectIds = [...new Set((data || []).map(a => a.subject_id).filter(Boolean))];

      const [studentsRes, subjectsRes] = await Promise.all([
        studentIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', studentIds)
          : { data: [] },
        subjectIds.length > 0
          ? supabase.from('subjects').select('id, name').in('id', subjectIds as string[])
          : { data: [] },
      ]);

      const studentMap = Object.fromEntries((studentsRes.data || []).map(s => [s.id, s.full_name]));
      const subjectMap = Object.fromEntries((subjectsRes.data || []).map(s => [s.id, s.name]));

      return (data || []).map(a => ({
        ...a,
        student_name: studentMap[a.student_id] || 'Unknown',
        subject_name: a.subject_id ? subjectMap[a.subject_id] || '—' : '—',
      }));
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return <div className="space-y-3 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-lms-navy">My Students</h2>
          <p className="text-sm text-lms-text-3">Your active student assignments</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />
          {assignments.length} students
        </Badge>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 text-lms-text-3">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No active student assignments</p>
        </div>
      ) : (
        <div className="rounded-lg border border-lms-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-lms-surface">
                <TableHead className="text-xs">Student</TableHead>
                <TableHead className="text-xs">Subject</TableHead>
                <TableHead className="text-xs">Tracking</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-sm">{a.student_name}</TableCell>
                  <TableCell>
                    {a.subject_name !== '—' ? (
                      <SubjectBadge subject={a.subject_name} />
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
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Active</Badge>
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
