import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from './StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle, BookOpen, DollarSign, User, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { SmartSessionRibbon } from './SmartSessionRibbon';
import { CourseDeckCarousel } from './CourseDeckCarousel';
import { QuickStatusWidgets } from './QuickStatusWidgets';

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
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const children = data?.children || [];

  if (children.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
            Welcome, {profile?.full_name || 'Parent'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor your children's learning progress</p>
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
    <div className="space-y-6 animate-fade-in">
      {/* Header with Quick Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
            Welcome, {profile?.full_name || 'Parent'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor your child's Quran learning progress</p>
        </div>
        <QuickStatusWidgets />
      </div>

      {/* Child Info with Smart Ribbon */}
      <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your Child</p>
              <p className="text-lg font-serif font-bold text-foreground">{child.full_name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Teacher</p>
            <p className="font-medium text-foreground text-sm">{child.teacher || 'Not assigned'}</p>
          </div>
        </div>
      </div>

      {/* Course Deck Carousel */}
      <CourseDeckCarousel />

      {/* Stats Grid - Compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
          title="Attendance"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Lessons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Recent Lessons</CardTitle>
          </CardHeader>
          <CardContent>
            {child.recentLessons.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No lessons recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {child.recentLessons.map((lesson, idx) => (
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

        {/* Attendance Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Attendance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${child.attendanceRate}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-muted-foreground">Attendance Rate</span>
                  <span className="font-medium text-foreground">{child.attendanceRate}%</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-2xl font-serif font-bold text-primary">{child.attended}</p>
                <p className="text-xs text-muted-foreground">of {child.totalClasses}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multiple Children Indicator */}
      {children.length > 1 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3 text-muted-foreground">
              <User className="h-4 w-4" />
              <p className="text-sm">You have {children.length} children linked. Showing data for {child.full_name}.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
