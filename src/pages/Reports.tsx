import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, User, Calendar, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export default function Reports() {
  const { user, profile, isSuperAdmin, hasPermission } = useAuth();
  const [selectedMonth, setSelectedMonth] = React.useState(format(new Date(), 'yyyy-MM'));

  const isAdmin = isSuperAdmin || profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher';
  const isStudent = profile?.role === 'student';
  const isParent = profile?.role === 'parent';

  // Fetch real data from attendance table
  const { data: reports, isLoading } = useQuery({
    queryKey: ['monthly-reports', selectedMonth, user?.id, profile?.role],
    queryFn: async () => {
      if (!user?.id) return [];

      const [year, month] = selectedMonth.split('-');
      const startDate = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');

      let query = supabase
        .from('attendance')
        .select(`
          id,
          status,
          class_date,
          sabaq,
          lesson_covered,
          homework,
          student_id,
          teacher_id,
          student:profiles!attendance_student_id_fkey(id, full_name),
          teacher:profiles!attendance_teacher_id_fkey(id, full_name)
        `)
        .gte('class_date', startDate)
        .lte('class_date', endDate)
        .order('class_date', { ascending: false });

      // Apply RLS-compliant filters
      if (isStudent) {
        query = query.eq('student_id', user.id);
      } else if (isTeacher) {
        query = query.eq('teacher_id', user.id);
      }
      // Admins see all via RLS

      const { data, error } = await query;
      if (error) throw error;

      // Group by student
      const groupedByStudent = (data || []).reduce((acc, record) => {
        const studentId = record.student_id;
        if (!acc[studentId]) {
          acc[studentId] = {
            studentId,
            studentName: (record.student as any)?.full_name || 'Unknown',
            teacherName: (record.teacher as any)?.full_name || 'Unknown',
            totalClasses: 0,
            attendedClasses: 0,
            lessons: [] as string[],
          };
        }
        acc[studentId].totalClasses++;
        if (record.status === 'present' || record.status === 'late') {
          acc[studentId].attendedClasses++;
        }
        if (record.sabaq || record.lesson_covered) {
          acc[studentId].lessons.push(record.sabaq || record.lesson_covered || '');
        }
        return acc;
      }, {} as Record<string, any>);

      return Object.values(groupedByStudent);
    },
    enabled: !!user?.id,
  });

  // Generate month options (last 6 months)
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    };
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Monthly Reports</h1>
            <p className="text-muted-foreground mt-1">
              {isStudent ? 'View your progress and performance' : 'View student progress and performance reports'}
            </p>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reports Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : reports && reports.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reports.map((report: any) => {
              const attendanceRate = report.totalClasses > 0 
                ? Math.round((report.attendedClasses / report.totalClasses) * 100) 
                : 0;
              
              return (
                <div key={report.studentId} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-soft transition-shadow">
                  {/* Header */}
                  <div className="bg-primary/5 p-6 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-serif text-lg font-bold text-foreground">{report.studentName}</h3>
                          {!isStudent && (
                            <p className="text-sm text-muted-foreground">Teacher: {report.teacherName}</p>
                          )}
                        </div>
                      </div>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {monthOptions.find(m => m.value === selectedMonth)?.label}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-serif font-bold text-primary">{attendanceRate}%</p>
                        <p className="text-xs text-muted-foreground">Attendance</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-serif font-bold text-foreground">{report.attendedClasses}/{report.totalClasses}</p>
                        <p className="text-xs text-muted-foreground">Classes</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-serif font-bold text-accent">{report.lessons.length}</p>
                        <p className="text-xs text-muted-foreground">Lessons</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Attendance Rate</span>
                        <span className="text-sm font-medium text-foreground">{attendanceRate}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${attendanceRate}%` }}
                        />
                      </div>
                    </div>

                    {/* Recent Lessons */}
                    {report.lessons.length > 0 && (
                      <div className="bg-secondary/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">Recent Lessons</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {report.lessons.slice(0, 3).join(', ')}
                          {report.lessons.length > 3 && ` and ${report.lessons.length - 3} more`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Data Available</h3>
            <p className="text-muted-foreground">
              No attendance records found for {monthOptions.find(m => m.value === selectedMonth)?.label}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
