import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FileText, User, Calendar, AlertCircle, GraduationCap, DollarSign, Archive, Video, ExternalLink } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export default function Reports() {
  const { user, activeRole } = useAuth();
  const [selectedMonth, setSelectedMonth] = React.useState(format(new Date(), 'yyyy-MM'));

  // Role checks based on activeRole
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');
  const isTeacher = activeRole === 'teacher';
  const isStudent = activeRole === 'student';
  const isParent = activeRole === 'parent';

  // Fetch parent's children IDs (for parent role)
  const { data: childrenIds } = useQuery({
    queryKey: ['parent-children-ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('student_parent_links')
        .select('student_id')
        .eq('parent_id', user.id);
      if (error) throw error;
      return (data || []).map(d => d.student_id);
    },
    enabled: !!user?.id && isParent,
  });

  // Get student IDs to filter data
  const getStudentIds = React.useCallback(() => {
    if (isStudent) return user?.id ? [user.id] : [];
    if (isParent) return childrenIds || [];
    return [];
  }, [isStudent, isParent, user?.id, childrenIds]);

  // Fetch attendance data
  const { data: attendanceReports, isLoading: attendanceLoading } = useQuery({
    queryKey: ['monthly-reports', selectedMonth, user?.id, activeRole],
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

      if (isStudent) {
        query = query.eq('student_id', user.id);
      } else if (isTeacher) {
        query = query.eq('teacher_id', user.id);
      } else if (isParent && childrenIds && childrenIds.length > 0) {
        query = query.in('student_id', childrenIds);
      } else if (isParent && (!childrenIds || childrenIds.length === 0)) {
        return [];
      }

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
    enabled: !!user?.id && (isParent ? childrenIds !== undefined : true),
  });

  // Fetch exam results
  const { data: examResults, isLoading: examsLoading } = useQuery({
    queryKey: ['exam-reports', selectedMonth, user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return [];

      const [year, month] = selectedMonth.split('-');
      const startDate = format(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');

      let query = supabase
        .from('exams')
        .select(`
          id,
          exam_date,
          total_marks,
          max_total_marks,
          percentage,
          public_remarks,
          student:profiles!exams_student_id_fkey(id, full_name),
          template:exam_templates(name, tenure)
        `)
        .gte('exam_date', startDate)
        .lte('exam_date', endDate)
        .order('exam_date', { ascending: false });

      const studentIds = getStudentIds();
      if (isStudent || isParent) {
        if (studentIds.length === 0) return [];
        query = query.in('student_id', studentIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && (isParent ? childrenIds !== undefined : true),
  });

  // Fetch fee history
  const { data: feeHistory, isLoading: feesLoading } = useQuery({
    queryKey: ['fee-reports', user?.id, activeRole],
    queryFn: async () => {
      if (!user?.id) return [];

      const studentIds = getStudentIds();
      if ((isStudent || isParent) && studentIds.length === 0) return [];

      let query = supabase
        .from('student_fees')
        .select(`
          id,
          month,
          year,
          monthly_fee,
          amount_paid,
          status,
          payment_method,
          remark,
          student:profiles!student_fees_student_id_fkey(id, full_name)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(12);

      if (isStudent || isParent) {
        query = query.in('student_id', studentIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && (isParent ? childrenIds !== undefined : true),
  });

  // Generate month options (last 6 months)
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    };
  });

  const getMonthLabel = (month: string, year: string) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isStudent ? 'View your progress and history' : 'Access academic and financial records'}
            </p>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
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

        {/* Tabbed Reports */}
        <Tabs defaultValue="academic" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="academic" className="gap-2">
              <GraduationCap className="h-4 w-4 hidden sm:block" />
              Academic
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4 hidden sm:block" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="archive" className="gap-2">
              <Archive className="h-4 w-4 hidden sm:block" />
              Archive
            </TabsTrigger>
          </TabsList>

          {/* Academic Tab */}
          <TabsContent value="academic" className="space-y-6">
            {/* Attendance Reports */}
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent" />
                Attendance Logs
              </h3>
              
              {attendanceLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[1, 2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
                </div>
              ) : attendanceReports && attendanceReports.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {attendanceReports.map((report: any) => {
                    const attendanceRate = report.totalClasses > 0 
                      ? Math.round((report.attendedClasses / report.totalClasses) * 100) 
                      : 0;
                    
                    return (
                      <Card key={report.studentId} className="overflow-hidden hover:shadow-card-hover transition-shadow">
                        <div className="bg-primary/5 p-4 border-b border-border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-serif font-bold text-foreground">{report.studentName}</h4>
                                {!isStudent && (
                                  <p className="text-xs text-muted-foreground">Teacher: {report.teacherName}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <CardContent className="p-4 space-y-4">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                              <p className="text-xl font-bold text-primary">{attendanceRate}%</p>
                              <p className="text-xs text-muted-foreground">Rate</p>
                            </div>
                            <div>
                              <p className="text-xl font-bold text-foreground">{report.attendedClasses}/{report.totalClasses}</p>
                              <p className="text-xs text-muted-foreground">Classes</p>
                            </div>
                            <div>
                              <p className="text-xl font-bold text-accent">{report.lessons.length}</p>
                              <p className="text-xs text-muted-foreground">Lessons</p>
                            </div>
                          </div>

                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${attendanceRate}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground">No attendance records for this month</p>
                </Card>
              )}
            </div>

            {/* Exam Marksheets */}
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-accent" />
                Exam Marksheets
              </h3>

              {examsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
              ) : examResults && examResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {examResults.map((exam: any) => (
                    <Card key={exam.id} className="overflow-hidden hover:shadow-card-hover transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-foreground">{exam.template?.name || 'Exam'}</h4>
                            <p className="text-xs text-muted-foreground">{(exam.student as any)?.full_name}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{exam.template?.tenure}</Badge>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-primary">{exam.percentage}%</span>
                          <span className="text-sm text-muted-foreground">
                            ({exam.total_marks}/{exam.max_total_marks})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(exam.exam_date), 'MMM dd, yyyy')}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground">No exam records for this month</p>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-accent" />
                Fee History
              </h3>

              {feesLoading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : feeHistory && feeHistory.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/50">
                          <tr>
                            <th className="text-left p-3 font-medium text-foreground">Month</th>
                            {!isStudent && <th className="text-left p-3 font-medium text-foreground">Student</th>}
                            <th className="text-right p-3 font-medium text-foreground">Amount</th>
                            <th className="text-right p-3 font-medium text-foreground">Paid</th>
                            <th className="text-center p-3 font-medium text-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {feeHistory.map((fee: any) => (
                            <tr key={fee.id} className="hover:bg-secondary/30">
                              <td className="p-3 text-foreground">{getMonthLabel(fee.month, fee.year)}</td>
                              {!isStudent && <td className="p-3 text-muted-foreground">{(fee.student as any)?.full_name}</td>}
                              <td className="p-3 text-right text-foreground">${fee.monthly_fee}</td>
                              <td className="p-3 text-right text-foreground">${fee.amount_paid || 0}</td>
                              <td className="p-3 text-center">
                                <Badge 
                                  variant={fee.status === 'paid' ? 'default' : 'destructive'}
                                  className="capitalize"
                                >
                                  {fee.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="p-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground">No fee records found</p>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Archive Tab */}
          <TabsContent value="archive" className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
                <Video className="h-5 w-5 text-accent" />
                Past Lessons & Recordings
              </h3>

              <Card className="p-8 text-center">
                <Archive className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-foreground font-medium mb-1">Coming Soon</p>
                <p className="text-sm text-muted-foreground">
                  Recording links and lesson archives will appear here
                </p>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
