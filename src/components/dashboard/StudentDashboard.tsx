import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, User, AlertCircle, Target, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { WeeklyProgressChart } from '@/components/progress/WeeklyProgressChart';
import { ProgressRing } from '@/components/progress/ProgressRing';
import { SmartSessionRibbon } from './SmartSessionRibbon';
import { CourseDeckCarousel } from './CourseDeckCarousel';
import { QuickStatusWidgets } from './QuickStatusWidgets';

export function StudentDashboard() {
  const { profile, user } = useAuth();
  const currentMonth = new Date();

  // Fetch student stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['student-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Fetch attendance
      const attendanceRes = await supabase.from('attendance')
        .select('status, class_date, lesson_covered, homework, surah_name, ayah_from, ayah_to, raw_input_amount, lines_completed')
        .eq('student_id', user.id)
        .order('class_date', { ascending: false });

      // Fetch teacher assignment from student_teacher_assignments first
      const assignmentRes = await supabase.from('student_teacher_assignments')
        .select('teacher_id, subject:subjects(name)')
        .eq('student_id', user.id)
        .limit(1);

      // If no assignment, fallback to enrollments table
      let teacherId: string | null = null;
      let subjectName: string | null = 'Quran';

      if (assignmentRes.data?.[0]) {
        teacherId = assignmentRes.data[0].teacher_id;
        subjectName = (assignmentRes.data[0] as any).subject?.name || 'Quran';
      } else {
        // Fallback to enrollments
        const enrollmentRes = await supabase.from('enrollments')
          .select('teacher_id, subject:subjects(name)')
          .eq('student_id', user.id)
          .eq('status', 'active')
          .limit(1);
        
        if (enrollmentRes.data?.[0]) {
          teacherId = enrollmentRes.data[0].teacher_id;
          subjectName = (enrollmentRes.data[0] as any).subject?.name || 'Quran';
        }
      }

      // Fetch monthly plan
      const planRes = await supabase.from('student_monthly_plans')
        .select('*')
        .eq('student_id', user.id)
        .eq('month', format(currentMonth, 'MM'))
        .eq('year', format(currentMonth, 'yyyy'))
        .eq('status', 'approved')
        .limit(1);

      // Fetch teacher profile separately (RLS allows student -> assigned teacher)
      let teacher: { id: string; full_name: string; email: string | null } | null = null;
      if (teacherId) {
        const { data: teacherData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', teacherId)
          .maybeSingle();
        teacher = teacherData || null;
      }

      const attendance = attendanceRes.data || [];
      const activePlan = planRes.data?.[0];
      const present = attendance.filter(a => a.status === 'present').length;
      
      // Get latest lesson details
      const latestPresent = attendance.find(a => a.status === 'present');
      const currentLesson = latestPresent 
        ? `${latestPresent.surah_name || 'N/A'}${latestPresent.ayah_from ? `, Ayah ${latestPresent.ayah_from}` : ''}${latestPresent.ayah_to ? `-${latestPresent.ayah_to}` : ''}`
        : 'No lessons recorded';
      const currentHomework = latestPresent?.homework || 'No homework assigned';

      // Calculate monthly progress
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);
      const monthlyAttendance = attendance.filter(a => {
        const date = new Date(a.class_date);
        return date >= startDate && date <= endDate && a.status === 'present';
      });
      
      const totalAchieved = monthlyAttendance.reduce((sum, a) => {
        return sum + (Number(a.raw_input_amount) || Number(a.lines_completed) || 0);
      }, 0);
      
      const monthlyTarget = activePlan?.monthly_target || 30;
      const monthlyProgress = Math.min(100, Math.round((totalAchieved / monthlyTarget) * 100));

      return {
        totalClasses: attendance.length,
        attended: present,
        attendanceRate: attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0,
        teacher: teacher?.full_name || 'Not assigned',
        teacherEmail: teacher?.email || null,
        subject: subjectName,
        currentLesson,
        currentHomework,
        activePlan,
        monthlyProgress,
        monthlyTarget,
        totalAchieved,
        dailyTarget: activePlan?.daily_target || 1,
        markerLabel: activePlan?.primary_marker === 'rukus' ? 'Rukus' : activePlan?.primary_marker === 'pages' ? 'Pages' : 'Lines',
        recentLessons: attendance.slice(0, 3).map(a => ({
          date: format(new Date(a.class_date), 'MMM dd'),
          lesson: a.lesson_covered || 'No lesson recorded',
          homework: a.homework || 'No homework',
        })),
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Quick Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
            Welcome, {profile?.full_name || 'Student'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Track your Quran learning progress</p>
        </div>
        <QuickStatusWidgets />
      </div>

      {/* Smart Session Ribbon - Top Priority */}
      <SmartSessionRibbon />

      {/* Current Lesson & Homework - Mobile First */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2 text-primary">
              <BookOpen className="h-4 w-4" />
              Current Lesson
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl sm:text-2xl font-serif font-bold text-foreground">
              {stats?.currentLesson || 'No lesson recorded'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent/10 via-accent/5 to-transparent border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2 text-accent">
              <MessageSquare className="h-4 w-4" />
              Homework
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base sm:text-lg font-medium text-foreground">
              {stats?.currentHomework || 'No homework assigned'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Course Deck Carousel */}
      <CourseDeckCarousel />

      {/* Progress Ring & Teacher Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Progress Ring */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Monthly Goal
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-4">
            <ProgressRing percentage={stats?.monthlyProgress || 0} size={120} />
            <div className="text-center mt-3">
              <p className="text-sm text-muted-foreground">
                {stats?.totalAchieved || 0} / {stats?.monthlyTarget || 30} {stats?.markerLabel}
              </p>
              {stats?.activePlan && (
                <p className="text-xs text-primary mt-1">
                  {stats.dailyTarget} {stats.markerLabel}/day target
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Teacher Info */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Your Teacher</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-serif font-bold text-foreground">{stats?.teacher}</p>
                <p className="text-sm text-muted-foreground">{stats?.subject}</p>
              </div>
            </div>

            {/* Stats Row - Compact */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-secondary/50 rounded-lg">
                <p className="text-lg font-bold text-foreground">{stats?.totalClasses || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats?.attended || 0}</p>
                <p className="text-xs text-muted-foreground">Attended</p>
              </div>
              <div className="text-center p-2 bg-primary/10 rounded-lg">
                <p className="text-lg font-bold text-primary">{stats?.attendanceRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Progress Chart */}
      {user?.id && (
        <WeeklyProgressChart 
          studentId={user.id} 
          dailyTarget={stats?.dailyTarget || 1}
          markerLabel={stats?.markerLabel}
        />
      )}

      {/* Recent Lessons */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base">Recent Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          {!stats?.recentLessons || stats.recentLessons.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No lessons recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stats.recentLessons.map((lesson, idx) => (
                <div key={idx} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{lesson.lesson}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">📝 {lesson.homework}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{lesson.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
