import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Filter, FileText, AlertCircle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { TemplateStructure } from '@/types/reportCard';
import { ReportCardCertificate } from '@/components/reports/ReportCardCertificate';

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
    if (isNaN(pct)) return <Badge className="rounded-full px-3 py-1 bg-gray-100 text-gray-600">N/A</Badge>;
    if (pct >= 90) return <Badge className="rounded-full px-3 py-1 bg-cyan-500 text-white font-semibold">Mastered</Badge>;
    if (pct >= 75) return <Badge className="rounded-full px-3 py-1 bg-cyan-100 text-cyan-800 font-semibold">Proficient</Badge>;
    if (pct >= 60) return <Badge className="rounded-full px-3 py-1 bg-blue-100 text-blue-800 font-semibold">Progressing</Badge>;
    return <Badge className="rounded-full px-3 py-1 bg-gray-200 text-gray-700 font-semibold">Beginning</Badge>;
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
        {/* Premium Page Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 p-6 sm:p-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtNi42MjcgMC0xMiA1LjM3My0xMiAxMnM1LjM3MyAxMiAxMiAxMiAxMi01LjM3MyAxMi0xMi01LjM3My0xMi0xMi0xMnptMCAyMGMtNC40MTggMC04LTMuNTgyLTgtOHMzLjU4Mi04IDgtOCA4IDMuNTgyIDggOC0zLjU4MiA4LTggOHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAzIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative">
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif">Student Report Cards</h1>
            <p className="text-cyan-300/80 mt-1">
              {isStudentOrParent ? 'View your official progress reports' : 'View and manage student report cards'}
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500" />
        </div>

        {/* Filters Card */}
        <Card className="bg-white shadow-md rounded-xl border-0">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-base flex items-center gap-2 text-navy-900">
              <Filter className="h-4 w-4 text-cyan-500" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid gap-4 md:grid-cols-4">
              {!isStudentOrParent && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Student</Label>
                  <Select value={studentFilter || "all"} onValueChange={(val) => setStudentFilter(val === "all" ? "" : val)}>
                    <SelectTrigger className="border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
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
                <Label className="text-sm text-muted-foreground">Subject</Label>
                <Select value={subjectFilter || "all"} onValueChange={(val) => setSubjectFilter(val === "all" ? "" : val)}>
                  <SelectTrigger className="border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
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
                <Label className="text-sm text-muted-foreground">Frequency</Label>
                <Select value={tenureFilter || "all"} onValueChange={(val) => setTenureFilter(val === "all" ? "" : val)}>
                  <SelectTrigger className="border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
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
                <Label className="text-sm text-muted-foreground">Month</Label>
                <Select value={monthFilter || "all"} onValueChange={(val) => setMonthFilter(val === "all" ? "" : val)}>
                  <SelectTrigger className="border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
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
        <Card className="bg-white shadow-md rounded-xl border-0 overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-6">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50 text-cyan-500" />
                <p className="text-lg font-medium text-navy-900">No reports found</p>
                <p className="text-sm mt-1">
                  {(reports ?? []).length === 0 
                    ? 'No report cards have been generated yet.'
                    : 'Try adjusting your filters.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow className="hover:bg-gray-50">
                    {!isStudentOrParent && <TableHead className="text-navy-900 font-semibold">Student</TableHead>}
                    <TableHead className="text-navy-900 font-semibold">Template</TableHead>
                    <TableHead className="text-navy-900 font-semibold">Subject</TableHead>
                    <TableHead className="text-navy-900 font-semibold">Date</TableHead>
                    <TableHead className="text-right text-navy-900 font-semibold">Score</TableHead>
                    <TableHead className="text-center text-navy-900 font-semibold">Grade</TableHead>
                    <TableHead className="text-right text-navy-900 font-semibold">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow 
                      key={report.id} 
                      className="hover:bg-cyan-50/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedReportId(report.id)}
                    >
                      {!isStudentOrParent && (
                        <TableCell className="font-medium text-navy-900">
                          {report.student?.full_name || '-'}
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground">{report.template?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full px-3 border-cyan-200 text-cyan-700 bg-cyan-50">
                          {report.template?.subject?.name || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(report.exam_date)}</TableCell>
                      <TableCell className="text-right font-medium">
                        <span className="text-navy-900">{report.total_marks}</span>
                        <span className="text-muted-foreground"> / {report.max_total_marks}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getGradeBadge(report.percentage)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-cyan-600 hover:text-cyan-700 hover:bg-cyan-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReportId(report.id);
                          }}
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

      {/* Premium Certificate Dialog */}
      <Dialog open={!!selectedReportId} onOpenChange={(open) => !open && setSelectedReportId(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-auto p-0 bg-slate-100">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-10 bg-white/80 hover:bg-white shadow-md rounded-full"
            onClick={() => setSelectedReportId(null)}
          >
            <X className="h-4 w-4" />
          </Button>
          
          {selectedReport && (
            <ReportCardCertificate 
              report={selectedReport} 
              showInternalNotes={!isStudentOrParent}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
