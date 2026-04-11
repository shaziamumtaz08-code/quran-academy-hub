import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Users, BookOpen, Calendar, Video, Sparkles,
  ClipboardCheck, FileText, GraduationCap, ExternalLink, Clock
} from 'lucide-react';

export default function TeacherCourseView() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('classes');

  const { data: course, isLoading } = useQuery({
    queryKey: ['teacher-course', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('courses')
        .select('id, name, level, description, division_id, divisions:divisions(name)')
        .eq('id', courseId!)
        .single();
      return data;
    },
    enabled: !!courseId,
  });

  const { data: myClasses = [] } = useQuery({
    queryKey: ['teacher-my-classes', courseId, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('course_class_staff')
        .select(`
          id, staff_role,
          class:course_classes!inner(
            id, name, schedule_days, schedule_time, session_duration,
            meeting_link, max_seats, course_id,
            students:course_class_students(id, student_id)
          )
        `)
        .eq('user_id', user!.id)
        .eq('class.course_id', courseId!);
      return data || [];
    },
    enabled: !!courseId && !!user?.id,
  });

  // Student profiles for all classes
  const studentIds = [...new Set(
    myClasses.flatMap((mc: any) => (mc.class?.students || []).map((s: any) => s.student_id))
  )];

  const { data: studentProfiles = [] } = useQuery({
    queryKey: ['teacher-class-students', studentIds.join(',')],
    queryFn: async () => {
      const { data } = await supabase.from('profiles')
        .select('id, full_name, email')
        .in('id', studentIds);
      return data || [];
    },
    enabled: studentIds.length > 0,
  });

  const profileMap = new Map(studentProfiles.map(p => [p.id, p]));

  const { data: syllabus } = useQuery({
    queryKey: ['teacher-syllabus', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('syllabi')
        .select('id, rows, duration_weeks, sessions_week, status')
        .eq('course_id', courseId!)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!courseId,
  });

  const { data: pendingSubmissions = [] } = useQuery({
    queryKey: ['teacher-pending-submissions', courseId],
    queryFn: async () => {
      const { data } = await supabase.from('course_assignment_submissions')
        .select('id, status, assignment_id, course_assignments!inner(course_id, title)')
        .eq('course_assignments.course_id', courseId!)
        .eq('status', 'submitted');
      return data || [];
    },
    enabled: !!courseId,
  });

  const totalStudents = myClasses.reduce((sum, c: any) => sum + ((c.class?.students as any[])?.length || 0), 0);

  const quickActions = [
    {
      icon: Sparkles,
      label: 'Teaching OS',
      sub: syllabus ? 'Open planner' : 'Create syllabus',
      color: 'text-amber-600',
      onClick: () => syllabus
        ? navigate(`/teaching-os/planner?syllabus_id=${syllabus.id}&course_id=${courseId}`)
        : navigate(`/teaching-os?course_id=${courseId}`),
    },
    {
      icon: ClipboardCheck,
      label: 'Attendance',
      sub: 'Mark today',
      color: 'text-emerald-600',
      onClick: () => setActiveTab('attendance'),
    },
    {
      icon: GraduationCap,
      label: 'Exams',
      sub: 'Create & grade',
      color: 'text-violet-600',
      onClick: () => navigate(`/teaching-os/assessment?course_id=${courseId}`),
    },
    {
      icon: FileText,
      label: 'Assignments',
      sub: pendingSubmissions.length > 0 ? `${pendingSubmissions.length} to review` : 'All caught up',
      color: 'text-blue-600',
      onClick: () => setActiveTab('assignments'),
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/my-dashboard')} className="mb-2 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> My Dashboard
        </Button>
        <h1 className="text-xl font-bold text-foreground">{course?.name}</h1>
        <p className="text-sm text-muted-foreground">
          {(course?.divisions as any)?.name}
          {course?.level && ` · ${course.level}`}
          {` · ${totalStudents} students in my classes`}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map(qa => (
          <Card key={qa.label} className="p-3 cursor-pointer hover:border-primary/30 transition-colors" onClick={qa.onClick}>
            <qa.icon className={`h-5 w-5 ${qa.color} mb-1.5`} />
            <p className="text-sm font-medium">{qa.label}</p>
            <p className="text-xs text-muted-foreground">{qa.sub}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto justify-start">
          <TabsTrigger value="classes" className="gap-1"><Users className="h-3.5 w-3.5" /> My Classes</TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Attendance</TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1"><FileText className="h-3.5 w-3.5" /> Assignments</TabsTrigger>
          <TabsTrigger value="students" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> Students</TabsTrigger>
        </TabsList>

        {/* ─── MY CLASSES ─── */}
        <TabsContent value="classes" className="space-y-3 mt-4">
          {myClasses.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              You are not assigned to any classes in this course yet.
            </CardContent></Card>
          ) : (
            myClasses.map((mc: any) => {
              const cls = mc.class;
              const students: any[] = cls?.students || [];
              const studentCount = students.length;
              const maxSeats = cls?.max_seats || 0;
              const capacityPct = maxSeats ? Math.round(studentCount / maxSeats * 100) : 0;

              return (
                <Card key={mc.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{cls?.name}</p>
                          <Badge variant="secondary" className="text-[10px]">{mc.staff_role}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {(cls?.schedule_days as string[])?.join(', ')} · {cls?.schedule_time} · {cls?.session_duration} min
                        </p>
                      </div>
                      {cls?.meeting_link && (
                        <Button size="sm" className="w-full sm:w-auto" onClick={() => window.open(cls.meeting_link, '_blank')}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Start Class
                        </Button>
                      )}
                    </div>

                    {/* Capacity */}
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{studentCount} students</span>
                        <span>{studentCount}/{maxSeats || '∞'}</span>
                      </div>
                      {maxSeats > 0 && (
                        <Progress
                          value={capacityPct}
                          className={`h-1.5 ${capacityPct > 90 ? '[&>div]:bg-destructive' : capacityPct > 70 ? '[&>div]:bg-amber-500' : ''}`}
                        />
                      )}
                    </div>

                    {/* Student badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {students.slice(0, 10).map((s: any) => {
                        const profile = profileMap.get(s.student_id);
                        return (
                          <Badge key={s.id} variant="outline" className="text-[10px] font-normal">
                            {profile?.full_name || 'Student'}
                          </Badge>
                        );
                      })}
                      {studentCount > 10 && (
                        <Badge variant="secondary" className="text-[10px]">+{studentCount - 10} more</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ─── ATTENDANCE ─── */}
        <TabsContent value="attendance" className="mt-4">
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Quick attendance marking will be available here. Use the{' '}
            <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate('/attendance')}>
              attendance page
            </Button>{' '}
            to mark attendance for now.
          </CardContent></Card>
        </TabsContent>

        {/* ─── ASSIGNMENTS ─── */}
        <TabsContent value="assignments" className="space-y-3 mt-4">
          {pendingSubmissions.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-3 text-sm text-amber-800">
                {pendingSubmissions.length} submission{pendingSubmissions.length > 1 ? 's' : ''} waiting for review
              </CardContent>
            </Card>
          )}
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
            Full assignment management coming soon.
          </CardContent></Card>
        </TabsContent>

        {/* ─── STUDENTS ─── */}
        <TabsContent value="students" className="space-y-4 mt-4">
          {myClasses.map((mc: any) => {
            const cls = mc.class;
            const students: any[] = cls?.students || [];
            return (
              <div key={mc.id}>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">{cls?.name}</p>
                <div className="space-y-1">
                  {students.map((s: any) => {
                    const profile = profileMap.get(s.student_id);
                    return (
                      <div key={s.id} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {(profile?.full_name || 'S').charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{profile?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{profile?.email}</p>
                        </div>
                      </div>
                    );
                  })}
                  {students.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No students assigned</p>
                  )}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
