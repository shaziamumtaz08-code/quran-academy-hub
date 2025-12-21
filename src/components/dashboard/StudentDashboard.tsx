import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from './StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle, BookOpen, DollarSign, User, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export function StudentDashboard() {
  const { profile, user } = useAuth();

  // Fetch student stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['student-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const [attendanceRes, teacherRes] = await Promise.all([
        supabase.from('attendance').select('status, class_date, lesson_covered, homework').eq('student_id', user.id).order('class_date', { ascending: false }),
        supabase.from('student_teacher_assignments').select('teacher_id, teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name)').eq('student_id', user.id).limit(1),
      ]);

      const attendance = attendanceRes.data || [];
      const teacher = teacherRes.data?.[0]?.teacher;
      const present = attendance.filter(a => a.status === 'present').length;

      return {
        totalClasses: attendance.length,
        attended: present,
        attendanceRate: attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0,
        teacher: teacher?.full_name || 'Not assigned',
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

      {/* Teacher Info */}
      <div className="bg-primary/5 rounded-xl p-6 border border-primary/20">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Your Teacher</p>
            <p className="text-xl font-serif font-bold text-foreground">{stats?.teacher}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Classes"
          value={stats?.totalClasses || 0}
          icon={Calendar}
        />
        <StatCard
          title="Attended"
          value={stats?.attended || 0}
          icon={CheckCircle}
          variant="primary"
        />
        <StatCard
          title="Attendance Rate"
          value={`${stats?.attendanceRate || 0}%`}
          icon={BookOpen}
        />
        <StatCard
          title="Fee Status"
          value="Pending"
          icon={DollarSign}
          variant="gold"
        />
      </div>

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

      {/* Attendance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${stats?.attendanceRate || 0}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-muted-foreground">Attendance Rate</span>
                <span className="font-medium text-foreground">
                  {stats?.attendanceRate || 0}%
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-3xl font-serif font-bold text-primary">{stats?.attended || 0}</p>
              <p className="text-sm text-muted-foreground">of {stats?.totalClasses || 0} classes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
