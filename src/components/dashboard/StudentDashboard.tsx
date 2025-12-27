import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from './StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle, BookOpen, User, AlertCircle, Target, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { WeeklyProgressChart } from '@/components/progress/WeeklyProgressChart';
import { ProgressRing } from '@/components/progress/ProgressRing';

export function StudentDashboard() {
  const { profile, user } = useAuth();
  const currentMonth = new Date();

  // Fetch student stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['student-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const [attendanceRes, enrollmentRes, planRes] = await Promise.all([
        supabase.from('attendance')
          .select('status, class_date, lesson_covered, homework, surah_name, ayah_from, ayah_to, raw_input_amount, lines_completed')
          .eq('student_id', user.id)
          .order('class_date', { ascending: false }),
        // Fetch from enrollments table for teacher and subject info
        supabase.from('enrollments')
          .select(`
            teacher_id,
            subject_id,
            teacher:profiles!enrollments_teacher_id_fkey(id, full_name, email),
            subject:subjects!enrollments_subject_id_fkey(name)
          `)
          .eq('student_id', user.id)
          .eq('status', 'active')
          .limit(1),
        supabase.from('student_monthly_plans')
          .select('*')
          .eq('student_id', user.id)
          .eq('month', format(currentMonth, 'MM'))
          .eq('year', format(currentMonth, 'yyyy'))
          .eq('status', 'approved')
          .limit(1),
      ]);

      const attendance = attendanceRes.data || [];
      const enrollment = enrollmentRes.data?.[0];
      const teacher = enrollment?.teacher as { id: string; full_name: string; email: string } | null;
      const subject = enrollment?.subject as { name: string } | null;
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
        subject: subject?.name || 'Quran',
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
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Welcome, Student</h1>
          <p className="text-muted-foreground mt-1">Loading your dashboard...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground">
          Welcome, {profile?.full_name || 'Student'}
        </h1>
        <p className="text-muted-foreground mt-1">Track your Quran learning progress</p>
      </div>

      {/* Current Lesson & Homework Card - Prominently displayed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif flex items-center gap-2 text-primary">
              <BookOpen className="h-5 w-5" />
              Current Lesson
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-serif font-bold text-foreground">
              {stats?.currentLesson || 'No lesson recorded'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Last recorded lesson position</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent/10 via-accent/5 to-transparent border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif flex items-center gap-2 text-accent">
              <MessageSquare className="h-5 w-5" />
              Teacher's Homework
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium text-foreground">
              {stats?.currentHomework || 'No homework assigned'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Complete before next class</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Ring & Teacher Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Progress Ring */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Target className="h-5 w-5" />
              Monthly Goal
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ProgressRing percentage={stats?.monthlyProgress || 0} size={140} />
            <div className="text-center mt-4">
              <p className="text-sm text-muted-foreground">
                {stats?.totalAchieved || 0} of {stats?.monthlyTarget || 30} {stats?.markerLabel}
              </p>
              {stats?.activePlan ? (
                <p className="text-xs text-primary mt-1">
                  Daily target: {stats.dailyTarget} {stats.markerLabel}/day
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  No active plan for this month
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Teacher Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif">Your Teacher</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-xl font-serif font-bold text-foreground">{stats?.teacher}</p>
                <p className="text-sm text-muted-foreground">{stats?.subject}</p>
                {stats?.teacherEmail && (
                  <p className="text-xs text-primary mt-1">{stats.teacherEmail}</p>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-secondary/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{stats?.totalClasses || 0}</p>
                <p className="text-xs text-muted-foreground">Total Classes</p>
              </div>
              <div className="text-center p-3 bg-emerald-light/10 rounded-lg">
                <p className="text-2xl font-bold text-emerald-light">{stats?.attended || 0}</p>
                <p className="text-xs text-muted-foreground">Attended</p>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats?.attendanceRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Attendance</p>
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
        <CardHeader>
          <CardTitle className="font-serif">Recent Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          {!stats?.recentLessons || stats.recentLessons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No lessons recorded yet</p>
              <p className="text-sm mt-1">Your lessons will appear here once marked</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stats.recentLessons.map((lesson, idx) => (
                <div key={idx} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{lesson.lesson}</p>
                      <p className="text-sm text-muted-foreground mt-1">📝 {lesson.homework}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{lesson.date}</span>
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
