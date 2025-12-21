import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from './StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle, BookOpen, DollarSign, User, FileText, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface ChildData {
  id: string;
  full_name: string;
  teacher: string | null;
  totalClasses: number;
  attended: number;
  attendanceRate: number;
  recentLessons: Array<{
    date: string;
    lesson: string;
    homework: string;
  }>;
}

export function ParentDashboard() {
  const { profile, user } = useAuth();

  // Fetch parent's children and their data
  const { data, isLoading } = useQuery({
    queryKey: ['parent-dashboard', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get linked children
      const { data: links, error: linksError } = await supabase
        .from('student_parent_links')
        .select('student_id, student:profiles!student_parent_links_student_id_fkey(id, full_name)')
        .eq('parent_id', user.id);

      if (linksError) throw linksError;

      if (!links || links.length === 0) {
        return { children: [] };
      }

      // Fetch data for each child
      const childrenData: ChildData[] = await Promise.all(
        links.map(async (link) => {
          const studentId = link.student_id;
          const studentName = link.student?.full_name || 'Unknown';

          // Get attendance
          const { data: attendance } = await supabase
            .from('attendance')
            .select('status, class_date, lesson_covered, homework')
            .eq('student_id', studentId)
            .order('class_date', { ascending: false });

          // Get teacher assignment
          const { data: teacherAssignment } = await supabase
            .from('student_teacher_assignments')
            .select('teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name)')
            .eq('student_id', studentId)
            .limit(1)
            .single();

          const attendanceRecords = attendance || [];
          const present = attendanceRecords.filter(a => a.status === 'present').length;

          return {
            id: studentId,
            full_name: studentName,
            teacher: teacherAssignment?.teacher?.full_name || null,
            totalClasses: attendanceRecords.length,
            attended: present,
            attendanceRate: attendanceRecords.length > 0 
              ? Math.round((present / attendanceRecords.length) * 100) 
              : 0,
            recentLessons: attendanceRecords.slice(0, 3).map(a => ({
              date: format(new Date(a.class_date), 'MMM dd'),
              lesson: a.lesson_covered || 'No lesson recorded',
              homework: a.homework || 'No homework',
            })),
          };
        })
      );

      return { children: childrenData };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Welcome, Parent</h1>
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

  const children = data?.children || [];

  if (children.length === 0) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Welcome, {profile?.full_name || 'Parent'}
          </h1>
          <p className="text-muted-foreground mt-1">Monitor your children's learning progress</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No children linked to your account</p>
              <p className="text-sm mt-1">Please contact an administrator to link your children.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Display first child's data (can be expanded to show multiple)
  const child = children[0];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground">
          Welcome, {profile?.full_name || 'Parent'}
        </h1>
        <p className="text-muted-foreground mt-1">Monitor your child's Quran learning progress</p>
      </div>

      {/* Child Info */}
      <div className="bg-primary/5 rounded-xl p-6 border border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Child</p>
              <p className="text-xl font-serif font-bold text-foreground">{child.full_name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Teacher</p>
            <p className="font-medium text-foreground">{child.teacher || 'Not assigned'}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Classes"
          value={child.totalClasses}
          icon={Calendar}
        />
        <StatCard
          title="Attended"
          value={child.attended}
          icon={CheckCircle}
          variant="primary"
        />
        <StatCard
          title="Attendance Rate"
          value={`${child.attendanceRate}%`}
          icon={BookOpen}
        />
        <StatCard
          title="Fee Status"
          value="Pending"
          icon={DollarSign}
          variant="gold"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Lessons */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Recent Lessons</CardTitle>
          </CardHeader>
          <CardContent>
            {child.recentLessons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No lessons recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {child.recentLessons.map((lesson, idx) => (
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
                    style={{ width: `${child.attendanceRate}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-muted-foreground">Attendance Rate</span>
                  <span className="font-medium text-foreground">{child.attendanceRate}%</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-3xl font-serif font-bold text-primary">{child.attended}</p>
                <p className="text-sm text-muted-foreground">of {child.totalClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multiple Children Indicator */}
      {children.length > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 text-muted-foreground">
              <User className="h-5 w-5" />
              <p>You have {children.length} children linked. Showing data for {child.full_name}.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
