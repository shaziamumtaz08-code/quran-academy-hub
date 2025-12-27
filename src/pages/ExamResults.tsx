import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Filter, Calendar, BookOpen, User, FileText, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ExamResult {
  id: string;
  template_id: string;
  student_id: string;
  examiner_id: string | null;
  total_marks: number;
  max_total_marks: number;
  percentage: number;
  examiner_remarks: string | null;
  public_remarks: string | null;
  exam_date: string;
  created_at: string;
  student: { id: string; full_name: string } | null;
  template: {
    id: string;
    name: string;
    tenure: string;
    subject: { id: string; name: string } | null;
  } | null;
}

interface ExamFieldResult {
  id: string;
  exam_id: string;
  field_id: string;
  marks: number;
  field: {
    id: string;
    label: string;
    max_marks: number;
    is_public: boolean;
    sort_order: number;
  } | null;
}

interface Subject {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
}

export default function ExamResults() {
  const { profile, user, activeRole } = useAuth();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  
  // Filters
  const [studentFilter, setStudentFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [tenureFilter, setTenureFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  // Role checks based on activeRole (not profile.role)
  const isAdminOrExaminer = activeRole === 'admin' || activeRole === 'examiner' || activeRole === 'super_admin' || 
    activeRole === 'admin_admissions' || activeRole === 'admin_fees' || activeRole === 'admin_academic';
  const isTeacher = activeRole === 'teacher';
  const isStudentOrParent = activeRole === 'student' || activeRole === 'parent';

  // Fetch exam results - RLS handles access control, but add activeRole to queryKey for refetch on role switch
  const { data: examResults, isLoading: isLoadingExams, error: examsError } = useQuery({
    queryKey: ['exam-results', user?.id, activeRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select(`
          id,
          template_id,
          student_id,
          examiner_id,
          total_marks,
          max_total_marks,
          percentage,
          examiner_remarks,
          public_remarks,
          exam_date,
          created_at,
          student:profiles!exams_student_id_fkey(id, full_name),
          template:exam_templates!exams_template_id_fkey(
            id,
            name,
            tenure,
            subject:subjects(id, name)
          )
        `)
        .order('exam_date', { ascending: false });

      if (error) throw error;
      return (data ?? []) as ExamResult[];
    },
    enabled: !!user?.id,
  });

  // Fetch subjects for filter dropdown
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });

  // Fetch students for filter dropdown (only for admin/teacher/examiner)
  const { data: students } = useQuery({
    queryKey: ['students-for-filter', examResults?.length],
    queryFn: async () => {
      if (isStudentOrParent) return [];
      
      // Get unique student IDs from exam results
      const studentIds = [...new Set((examResults ?? []).map(e => e.student_id).filter(Boolean))];
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds)
        .order('full_name');

      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: !isStudentOrParent && Array.isArray(examResults),
  });

  // Fetch field results for selected exam
  const { data: fieldResults, isLoading: isLoadingFields, error: fieldsError } = useQuery({
    queryKey: ['exam-field-results', selectedExamId],
    queryFn: async () => {
      if (!selectedExamId) return [];

      const { data, error } = await supabase
        .from('exam_field_results')
        .select(`
          id,
          exam_id,
          field_id,
          marks,
          field:exam_template_fields(
            id,
            label,
            max_marks,
            is_public,
            sort_order
          )
        `)
        .eq('exam_id', selectedExamId);

      if (error) throw error;
      return (data ?? []) as ExamFieldResult[];
    },
    enabled: !!selectedExamId,
  });

  // Get selected exam details - safe access
  const selectedExam = useMemo(() => {
    if (!examResults || !selectedExamId) return null;
    return examResults.find(e => e.id === selectedExamId) ?? null;
  }, [examResults, selectedExamId]);

  // Apply filters with safe access
  const filteredResults = useMemo(() => {
    if (!Array.isArray(examResults)) return [];
    
    return examResults.filter(exam => {
      if (!exam) return false;
      if (studentFilter && exam.student_id !== studentFilter) return false;
      if (subjectFilter && exam.template?.subject?.id !== subjectFilter) return false;
      if (tenureFilter && exam.template?.tenure !== tenureFilter) return false;
      if (monthFilter) {
        try {
          const examMonth = new Date(exam.exam_date).getMonth() + 1;
          if (examMonth !== parseInt(monthFilter, 10)) return false;
        } catch {
          return false;
        }
      }
      return true;
    });
  }, [examResults, studentFilter, subjectFilter, tenureFilter, monthFilter]);

  // Filter field results based on user role with safe access
  const visibleFieldResults = useMemo(() => {
    if (!Array.isArray(fieldResults)) return [];
    
    const validResults = fieldResults.filter(r => r && r.field);
    
    // Admin/Examiner/Teacher see all fields (RLS already filters for teacher)
    if (!isStudentOrParent) {
      return validResults.sort((a, b) => 
        (a.field?.sort_order ?? 0) - (b.field?.sort_order ?? 0)
      );
    }
    
    // Student/Parent see only public fields
    return validResults
      .filter(r => r.field?.is_public === true)
      .sort((a, b) => (a.field?.sort_order ?? 0) - (b.field?.sort_order ?? 0));
  }, [fieldResults, isStudentOrParent]);

  const handleViewDetails = (examId: string) => {
    setSelectedExamId(examId);
  };

  const handleCloseDialog = () => {
    setSelectedExamId(null);
  };

  const getPercentageBadge = (percentage: number) => {
    if (isNaN(percentage)) return <Badge variant="secondary">N/A</Badge>;
    if (percentage >= 80) return <Badge className="bg-primary">Excellent</Badge>;
    if (percentage >= 70) return <Badge variant="default">Good</Badge>;
    if (percentage >= 50) return <Badge variant="secondary">Satisfactory</Badge>;
    return <Badge variant="destructive">Needs Improvement</Badge>;
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  // Not authenticated state
  if (!profile) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Exam Results</h1>
            <p className="text-muted-foreground mt-1">View exam results and progress</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No exam results available for your account.</p>
                <p className="text-sm mt-1">Please sign in to view your exam results.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (examsError) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Exam Results</h1>
            <p className="text-muted-foreground mt-1">View exam results and progress</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 text-destructive" />
                <p className="text-lg font-medium">Failed to load exam results</p>
                <p className="text-sm">{examsError instanceof Error ? examsError.message : 'Unknown error'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Exam Results</h1>
          <p className="text-muted-foreground mt-1">
            {isStudentOrParent ? 'View your exam results and progress' : 'View and filter exam results'}
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {!isStudentOrParent && (
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={studentFilter || "all"} onValueChange={(val) => setStudentFilter(val === "all" ? "" : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All students" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All students</SelectItem>
                      {(students ?? []).map((student) => (
                        <SelectItem key={student.id} value={student.id}>{student.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={subjectFilter || "all"} onValueChange={(val) => setSubjectFilter(val === "all" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {(subjects ?? []).map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Tenure</Label>
                <Select value={tenureFilter || "all"} onValueChange={(val) => setTenureFilter(val === "all" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tenures" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tenures</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={monthFilter || "all"} onValueChange={(val) => setMonthFilter(val === "all" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All months</SelectItem>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoadingExams ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {(examResults ?? []).length === 0 
                    ? 'No exam results available.' 
                    : 'No exam results match your filters.'}
                </p>
                <p className="text-sm mt-1">
                  {(examResults ?? []).length === 0 
                    ? (isStudentOrParent 
                        ? 'No exam results are available for your account yet.' 
                        : 'There are no exam results in the system yet.')
                    : 'Try adjusting your filters to see results.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isStudentOrParent && <TableHead>Student</TableHead>}
                    <TableHead>Exam</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Tenure</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Percentage</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((exam) => (
                    <TableRow key={exam.id}>
                      {!isStudentOrParent && (
                        <TableCell className="font-medium">
                          {exam.student?.full_name ?? 'Unknown'}
                        </TableCell>
                      )}
                      <TableCell>{exam.template?.name ?? 'Unknown'}</TableCell>
                      <TableCell>{exam.template?.subject?.name ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {exam.template?.tenure ?? '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(exam.exam_date)}</TableCell>
                      <TableCell className="text-center font-medium">
                        {exam.total_marks ?? 0} / {exam.max_total_marks ?? 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {getPercentageBadge(Number(exam.percentage ?? 0))}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(exam.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={!!selectedExamId} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Exam Result Details</DialogTitle>
            </DialogHeader>
            
            {selectedExam ? (
              <div className="space-y-6 pt-4">
                {/* Header Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" /> Student
                    </p>
                    <p className="font-medium">{selectedExam.student?.full_name ?? 'Unknown'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Date
                    </p>
                    <p className="font-medium">{formatDate(selectedExam.exam_date)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> Exam
                    </p>
                    <p className="font-medium">{selectedExam.template?.name ?? 'Unknown'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Subject</p>
                    <Badge variant="outline">{selectedExam.template?.subject?.name ?? '-'}</Badge>
                  </div>
                </div>

                <Separator />

                {/* Score Breakdown */}
                <div>
                  <h3 className="font-semibold mb-4">Score Breakdown</h3>
                  {isLoadingFields ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : fieldsError ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                      <p className="text-sm">Failed to load field results</p>
                    </div>
                  ) : visibleFieldResults.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">
                      No field results available
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {visibleFieldResults
                        .filter(r => r.field && (r.field.max_marks ?? 0) > 0)
                        .map((result) => (
                          <div key={result.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                            <span>{result.field?.label ?? 'Unknown Field'}</span>
                            <span className="font-medium">
                              {result.marks ?? 0} / {result.field?.max_marks ?? 0}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Total Score */}
                <div className="p-4 bg-primary/10 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total Score</span>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">
                        {selectedExam.total_marks ?? 0}
                      </span>
                      <span className="text-muted-foreground"> / {selectedExam.max_total_marks ?? 0}</span>
                      <div className="mt-1">
                        {getPercentageBadge(Number(selectedExam.percentage ?? 0))}
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({selectedExam.percentage ?? 0}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Public Remarks */}
                {selectedExam.public_remarks && (
                  <div>
                    <h3 className="font-semibold mb-2">Feedback</h3>
                    <p className="p-3 bg-secondary/50 rounded-lg text-sm">
                      {selectedExam.public_remarks}
                    </p>
                  </div>
                )}

                {/* Internal remarks - only for admin/examiner */}
                {isAdminOrExaminer && selectedExam.examiner_remarks && (
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      Examiner Notes
                      <Badge variant="secondary" className="text-xs">Internal</Badge>
                    </h3>
                    <p className="p-3 bg-muted rounded-lg text-sm">
                      {selectedExam.examiner_remarks}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>No exam selected</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
