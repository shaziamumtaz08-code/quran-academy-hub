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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Filter, FileText, AlertCircle, Calendar, BookOpen, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { TemplateStructure } from '@/types/reportCard';

interface StudentReport {
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
    structure_json: TemplateStructure | null;
    subject: { id: string; name: string } | null;
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

export default function StudentReports() {
  const { profile, user, activeRole } = useAuth();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  
  // Filters
  const [studentFilter, setStudentFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [tenureFilter, setTenureFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const isAdminOrExaminer = activeRole === 'admin' || activeRole === 'examiner' || 
    activeRole === 'super_admin' || activeRole?.startsWith('admin_');
  const isTeacher = activeRole === 'teacher';
  const isStudentOrParent = activeRole === 'student' || activeRole === 'parent';

  // Fetch teacher's student IDs
  const { data: teacherStudentIds } = useQuery({
    queryKey: ['teacher-student-ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select('student_id')
        .eq('teacher_id', user.id);
      return (data || []).map(d => d.student_id);
    },
    enabled: !!user?.id && isTeacher,
  });

  // Fetch parent's children IDs
  const { data: parentChildrenIds } = useQuery({
    queryKey: ['parent-children-ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('student_parent_links')
        .select('student_id')
        .eq('parent_id', user.id);
      return (data || []).map(d => d.student_id);
    },
    enabled: !!user?.id && activeRole === 'parent',
  });

  // Fetch reports
  const { data: reports, isLoading, error } = useQuery({
    queryKey: ['student-reports', user?.id, activeRole],
    queryFn: async () => {
      let query = supabase
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
            structure_json,
            subject:subjects(id, name)
          )
        `)
        .order('exam_date', { ascending: false });

      if (isTeacher && teacherStudentIds && teacherStudentIds.length > 0) {
        query = query.in('student_id', teacherStudentIds);
      } else if (isTeacher && (!teacherStudentIds || teacherStudentIds.length === 0)) {
        return [];
      } else if (activeRole === 'student') {
        query = query.eq('student_id', user?.id);
      } else if (activeRole === 'parent' && parentChildrenIds && parentChildrenIds.length > 0) {
        query = query.in('student_id', parentChildrenIds);
      } else if (activeRole === 'parent' && (!parentChildrenIds || parentChildrenIds.length === 0)) {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(d => ({
        ...d,
        template: d.template ? {
          ...d.template,
          structure_json: d.template.structure_json as unknown as TemplateStructure | null,
        } : null,
      })) as StudentReport[];
    },
    enabled: !!user?.id && (
      (!isTeacher || teacherStudentIds !== undefined) &&
      (activeRole !== 'parent' || parentChildrenIds !== undefined)
    ),
  });

  // Fetch subjects
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return (data ?? []) as Subject[];
    },
  });

  // Fetch students for filter
  const { data: students } = useQuery({
    queryKey: ['students-for-filter', reports?.length],
    queryFn: async () => {
      if (isStudentOrParent) return [];
      const studentIds = [...new Set((reports ?? []).map(r => r.student_id).filter(Boolean))];
      if (studentIds.length === 0) return [];
      
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds)
        .order('full_name');
      return (data ?? []) as Profile[];
    },
    enabled: !isStudentOrParent && Array.isArray(reports),
  });

  const selectedReport = useMemo(() => {
    if (!reports || !selectedReportId) return null;
    return reports.find(r => r.id === selectedReportId) ?? null;
  }, [reports, selectedReportId]);

  const filteredReports = useMemo(() => {
    if (!Array.isArray(reports)) return [];
    
    return reports.filter(report => {
      if (!report) return false;
      if (studentFilter && report.student_id !== studentFilter) return false;
      if (subjectFilter && report.template?.subject?.id !== subjectFilter) return false;
      if (tenureFilter && report.template?.tenure !== tenureFilter) return false;
      if (monthFilter) {
        try {
          const month = new Date(report.exam_date).getMonth() + 1;
          if (month !== parseInt(monthFilter, 10)) return false;
        } catch {
          return false;
        }
      }
      return true;
    });
  }, [reports, studentFilter, subjectFilter, tenureFilter, monthFilter]);

  const getGradeBadge = (pct: number) => {
    if (isNaN(pct)) return <Badge variant="secondary">N/A</Badge>;
    if (pct >= 90) return <Badge className="bg-primary">Excellent</Badge>;
    if (pct >= 75) return <Badge variant="default">Good</Badge>;
    if (pct >= 60) return <Badge variant="secondary">Satisfactory</Badge>;
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

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-foreground">Student Reports</h1>
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p>Please sign in to view reports.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-foreground">Student Reports</h1>
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p>Failed to load reports</p>
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
          <h1 className="text-3xl font-bold text-foreground">Student Reports</h1>
          <p className="text-muted-foreground mt-1">
            {isStudentOrParent ? 'View your report cards and progress' : 'View and filter student report cards'}
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
                      {(students ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
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
                    {(subjects ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={tenureFilter || "all"} onValueChange={(val) => setTenureFilter(val === "all" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
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
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
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
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No reports found</p>
                <p className="text-sm mt-1">
                  {(reports ?? []).length === 0 
                    ? 'No report cards have been generated yet.'
                    : 'Try adjusting your filters.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isStudentOrParent && <TableHead>Student</TableHead>}
                    <TableHead>Template</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-center">Grade</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      {!isStudentOrParent && (
                        <TableCell className="font-medium">
                          {report.student?.full_name || '-'}
                        </TableCell>
                      )}
                      <TableCell>{report.template?.name || '-'}</TableCell>
                      <TableCell>{report.template?.subject?.name || '-'}</TableCell>
                      <TableCell>{formatDate(report.exam_date)}</TableCell>
                      <TableCell className="text-right">
                        {report.total_marks} / {report.max_total_marks}
                      </TableCell>
                      <TableCell className="text-center">
                        {getGradeBadge(report.percentage)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReportId(report.id)}
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
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedReportId} onOpenChange={(open) => !open && setSelectedReportId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Card Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedReport && (
            <ScrollArea className="flex-1">
              <div className="space-y-6 pr-4">
                {/* Header Info */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Student</p>
                      <p className="font-medium">{selectedReport.student?.full_name || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Subject</p>
                      <p className="font-medium">{selectedReport.template?.subject?.name || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-medium">{formatDate(selectedReport.exam_date)}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Score Summary */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Score</p>
                    <p className="text-2xl font-bold">
                      {selectedReport.total_marks} / {selectedReport.max_total_marks}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Overall</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">{selectedReport.percentage}%</span>
                      {getGradeBadge(selectedReport.percentage)}
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                {selectedReport.public_remarks && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Remarks</Label>
                    <p className="mt-1 p-3 bg-muted rounded-lg">{selectedReport.public_remarks}</p>
                  </div>
                )}

                {!isStudentOrParent && selectedReport.examiner_remarks && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Internal Notes</Label>
                    <p className="mt-1 p-3 bg-secondary rounded-lg">{selectedReport.examiner_remarks}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
