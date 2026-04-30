import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import TeacherSchedulesView from '@/components/teacher/TeacherSchedulesView';
import { Users, BookOpen, ClipboardCheck, BarChart3, MessageSquare, Target } from 'lucide-react';

export default function TeacherTeachingLanding() {
  const { user } = useAuth();
  const { activeDivision } = useDivision();
  const isOneToOne = activeDivision?.model_type === 'one_to_one';
  const isGroup = activeDivision?.model_type === 'group';
  const isRecorded = activeDivision?.model_type === 'recorded';

  const { data: oneToOneStudents = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['teacher-landing-students', user?.id, activeDivision?.id],
    enabled: !!user?.id && isOneToOne,
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from('student_teacher_assignments')
        .select('id, student_id, subject_id')
        .eq('teacher_id', user!.id)
        .eq('status', 'active')
        .eq('division_id', activeDivision!.id);
      if (error) throw error;
      const studentIds = [...new Set((assignments || []).map((a: any) => a.student_id))];
      if (studentIds.length === 0) return [];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', studentIds);
      const nameMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name]));
      return (assignments || []).map((a: any) => ({ ...a, student_name: nameMap[a.student_id] || 'Unknown' }));
    },
  });

  const { data: groupClasses = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['teacher-landing-classes', user?.id, activeDivision?.id],
    enabled: !!user?.id && isGroup,
    queryFn: async () => {
      const { data: staff, error } = await (supabase as any)
        .from('course_class_staff')
        .select('class_id, course_classes(id, name, course_id, courses(id, title))')
        .eq('user_id', user!.id);
      if (error) throw error;
      return staff || [];
    },
  });

  const { data: planningCount = 0 } = useQuery({
    queryKey: ['teacher-landing-planning-count', user?.id, activeDivision?.id],
    enabled: !!user?.id && isOneToOne,
    queryFn: async () => {
      const month = new Date().toISOString().slice(0, 7) + '-01';
      const { count } = await (supabase as any)
        .from('monthly_plans')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', user!.id)
        .eq('plan_month', month);
      return count || 0;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-lms-navy">My Classes</h1>
        <p className="text-sm text-muted-foreground">Your teaching workspace</p>
      </div>

      {!isRecorded && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {isOneToOne ? <><Users className="h-4 w-4" /> My Students</> : <><BookOpen className="h-4 w-4" /> My Classes</>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isOneToOne ? (
              loadingStudents ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : oneToOneStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No active students assigned.</p>
              ) : (
                <div className="space-y-2">
                  {oneToOneStudents.map((s: any) => (
                    <Link key={s.id} to="/students" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                      <div className="font-medium text-sm">{s.student_name}</div>
                      <Badge variant="outline" className="text-[10px]">1:1</Badge>
                    </Link>
                  ))}
                </div>
              )
            ) : (
              loadingClasses ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : groupClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No classes assigned.</p>
              ) : (
                <div className="space-y-2">
                  {groupClasses.map((s: any) => {
                    const cls = s.course_classes;
                    if (!cls) return null;
                    return (
                      <Link key={s.class_id} to={`/my-teaching/${cls.course_id}`} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                        <div>
                          <div className="font-medium text-sm">{cls.name}</div>
                          <div className="text-xs text-muted-foreground">{cls.courses?.title}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">Group</Badge>
                      </Link>
                    );
                  })}
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {!isRecorded && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <TeacherSchedulesView />
          </CardContent>
        </Card>
      )}

      {isOneToOne && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> This Month's Planning</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-lms-navy">{planningCount}</div>
              <div className="text-xs text-muted-foreground">students with plans this month</div>
            </div>
            <Link to="/monthly-planning"><Button variant="outline" size="sm">Open Planning</Button></Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Link to="/attendance"><Button variant="outline" className="w-full gap-2"><ClipboardCheck className="h-4 w-4" /> Mark Attendance</Button></Link>
          <Link to="/student-reports"><Button variant="outline" className="w-full gap-2"><BarChart3 className="h-4 w-4" /> Reports</Button></Link>
          <Link to="/communication"><Button variant="outline" className="w-full gap-2"><MessageSquare className="h-4 w-4" /> Communication</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
