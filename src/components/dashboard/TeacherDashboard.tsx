import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from './StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, CheckCircle, BookOpen, Clock, AlertCircle, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { StartClassButton } from '@/components/zoom/StartClassButton';

export function TeacherDashboard() {
  const { profile, user } = useAuth();
  const { toast } = useToast();

  // Fetch teacher stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['teacher-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const [assignmentsRes, attendanceRes] = await Promise.all([
        supabase.from('student_teacher_assignments').select('student_id').eq('teacher_id', user.id),
        supabase.from('attendance').select('status, class_date').eq('teacher_id', user.id),
      ]);

      const today = format(new Date(), 'yyyy-MM-dd');
      const attendance = attendanceRes.data || [];
      const todayClasses = attendance.filter(a => a.class_date === today);

      return {
        assignedStudents: assignmentsRes.data?.length || 0,
        classesToday: todayClasses.length,
        classesThisMonth: attendance.length,
        attendanceRate: attendance.length > 0
          ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100)
          : 0,
        presentToday: todayClasses.filter(a => a.status === 'present').length,
        absentToday: todayClasses.filter(a => a.status === 'absent').length,
        lateToday: todayClasses.filter(a => a.status === 'late').length,
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Welcome, Teacher</h1>
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Welcome, {profile?.full_name || 'Teacher'}
          </h1>
          <p className="text-muted-foreground mt-1">Here's your teaching overview</p>
        </div>
        
        {/* Start Class Button */}
        <Card className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <Video className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Zoom License Pool</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">Start a class with an available Zoom room</p>
            </div>
            <StartClassButton />
          </div>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Assigned Students"
          value={stats?.assignedStudents || 0}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Classes Today"
          value={stats?.classesToday || 0}
          icon={Calendar}
        />
        <StatCard
          title="Classes This Month"
          value={stats?.classesThisMonth || 0}
          icon={BookOpen}
        />
        <StatCard
          title="Attendance Rate"
          value={`${stats?.attendanceRate || 0}%`}
          icon={CheckCircle}
          variant="gold"
        />
      </div>

      {/* Today's Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.classesToday === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No classes recorded today</p>
              <p className="text-sm mt-1">Go to Attendance to mark today's classes</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-emerald-light/10 rounded-lg">
                <p className="text-3xl font-serif font-bold text-emerald-light">{stats?.presentToday || 0}</p>
                <p className="text-sm text-emerald-light/80 mt-1">Present</p>
              </div>
              <div className="text-center p-4 bg-accent/10 rounded-lg">
                <p className="text-3xl font-serif font-bold text-accent">{stats?.lateToday || 0}</p>
                <p className="text-sm text-accent/80 mt-1">Late</p>
              </div>
              <div className="text-center p-4 bg-destructive/10 rounded-lg">
                <p className="text-3xl font-serif font-bold text-destructive">{stats?.absentToday || 0}</p>
                <p className="text-sm text-destructive/80 mt-1">Absent</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif">This Month's Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-2xl font-serif font-bold text-primary">{stats?.classesThisMonth || 0}</p>
              <p className="text-sm text-muted-foreground">Total Classes</p>
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-emerald-light">{stats?.attendanceRate || 0}%</p>
              <p className="text-sm text-muted-foreground">Attendance Rate</p>
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-accent">{stats?.assignedStudents || 0}</p>
              <p className="text-sm text-muted-foreground">Students</p>
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-foreground">-</p>
              <p className="text-sm text-muted-foreground">Avg. Score</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
