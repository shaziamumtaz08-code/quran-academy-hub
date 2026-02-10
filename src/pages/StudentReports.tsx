import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Filter, FileText, AlertCircle, X, TrendingUp, Trash2, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, Loader2, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { TemplateStructure, StoredCriteriaEntry } from '@/types/reportCard';
import { ReportCardCertificate } from '@/components/reports/ReportCardCertificate';
import { useToast } from '@/hooks/use-toast';

interface StudentReport {
  id: string;
  template_id: string;
  student_id: string;
  examiner_id: string | null;
  total_marks: number;
  max_total_marks: number;
  percentage: number;
  criteria_values_json: StoredCriteriaEntry[] | null;
  examiner_remarks: string | null;
  public_remarks: string | null;
  exam_date: string;
  created_at: string;
  deleted_at: string | null;
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

type SortField = 'student' | 'template' | 'subject' | 'date' | 'score' | 'percentage';
type SortOrder = 'asc' | 'desc';

export default function StudentReports() {
  const { profile, user, activeRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null); // single delete
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Filters
  const [studentFilter, setStudentFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [tenureFilter, setTenureFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

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

  // Recycle bin mode
  const [showRecycleBin, setShowRecycleBin] = useState(false);

  // Fetch reports
  const { data: reports, isLoading, error } = useQuery({
    queryKey: ['student-reports', user?.id, activeRole, showRecycleBin],
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
          criteria_values_json,
          examiner_remarks,
          public_remarks,
          exam_date,
          created_at,
          deleted_at,
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

      // Filter by soft-delete status
      if (showRecycleBin) {
        query = query.not('deleted_at', 'is', null);
      } else {
        query = query.is('deleted_at', null);
      }

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
        criteria_values_json: (d as any).criteria_values_json as unknown as StoredCriteriaEntry[] | null,
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
      
      // Year + Month filter
      if (report.exam_date) {
        try {
          const reportDate = new Date(report.exam_date);
          const reportYear = reportDate.getFullYear().toString();
          const reportMonth = (reportDate.getMonth() + 1).toString();
          
          if (yearFilter && reportYear !== yearFilter) return false;
          if (monthFilter && reportMonth !== monthFilter) return false;
        } catch {
          return false;
        }
      }
      return true;
    });
  }, [reports, studentFilter, subjectFilter, tenureFilter, monthFilter, yearFilter]);

  // Sort filtered reports
  const sortedReports = useMemo(() => {
    const sorted = [...filteredReports];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'student':
          cmp = (a.student?.full_name || '').localeCompare(b.student?.full_name || '');
          break;
        case 'template':
          cmp = (a.template?.name || '').localeCompare(b.template?.name || '');
          break;
        case 'subject':
          cmp = (a.template?.subject?.name || '').localeCompare(b.template?.subject?.name || '');
          break;
        case 'date':
          cmp = new Date(a.exam_date || 0).getTime() - new Date(b.exam_date || 0).getTime();
          break;
        case 'score':
          cmp = a.total_marks - b.total_marks;
          break;
        case 'percentage':
          cmp = a.percentage - b.percentage;
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredReports, sortField, sortOrder]);

  // Progress tracking: count reports per student this month
  const reportsThisMonth = useMemo(() => {
    if (!Array.isArray(reports)) return new Map<string, number>();
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const countMap = new Map<string, number>();
    
    reports.forEach(report => {
      if (!report.exam_date || !report.student_id) return;
      try {
        const reportDate = new Date(report.exam_date);
        if (reportDate.getMonth() === currentMonth && reportDate.getFullYear() === currentYear) {
          countMap.set(report.student_id, (countMap.get(report.student_id) || 0) + 1);
        }
      } catch {}
    });
    
    return countMap;
  }, [reports]);

  // Soft delete mutation (move to recycle bin)
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('exams')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-reports'] });
      toast({ title: 'Moved to Recycle Bin', description: 'Report card(s) moved to recycle bin. They will be permanently deleted after 3 days.' });
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('exams')
        .update({ deleted_at: null })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-reports'] });
      toast({ title: 'Restored', description: 'Report card(s) restored successfully' });
      setSelectedIds(new Set());
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Permanent delete mutation
  const permanentDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('exams')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-reports'] });
      toast({ title: 'Permanently Deleted', description: 'Report card(s) permanently deleted' });
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1 text-cyan-600" /> 
      : <ArrowDown className="h-4 w-4 ml-1 text-cyan-600" />;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedReports.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDeleteClick = (id?: string) => {
    if (id) {
      setDeleteTarget(id);
    } else {
      setDeleteTarget(null);
    }
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    const ids = deleteTarget ? [deleteTarget] : [...selectedIds];
    if (ids.length > 0) {
      deleteMutation.mutate(ids);
    }
  };

  const resetFilters = () => {
    setStudentFilter('');
    setSubjectFilter('');
    setTenureFilter('');
    setMonthFilter('');
    setYearFilter(new Date().getFullYear().toString());
    setSortField('date');
    setSortOrder('desc');
  };

  const getGradeBadge = (pct: number) => {
    if (isNaN(pct)) return <Badge className="rounded-full px-3 py-1 bg-gray-100 text-gray-600">N/A</Badge>;
    if (pct >= 90) return <Badge className="rounded-full px-3 py-1 bg-cyan-500 text-white font-semibold">Mastered</Badge>;
    if (pct >= 80) return <Badge className="rounded-full px-3 py-1 bg-cyan-400 text-white font-semibold">Excellent</Badge>;
    if (pct >= 70) return <Badge className="rounded-full px-3 py-1 bg-blue-500 text-white font-semibold">Proficient</Badge>;
    if (pct >= 60) return <Badge className="rounded-full px-3 py-1 bg-amber-500 text-white font-semibold">Progressing</Badge>;
    return <Badge className="rounded-full px-3 py-1 bg-gray-400 text-white font-semibold">Beginning</Badge>;
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { 
        day: 'numeric',
        month: 'short', 
        year: 'numeric' 
      });
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

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      { value: (currentYear - 2).toString(), label: (currentYear - 2).toString() },
      { value: (currentYear - 1).toString(), label: (currentYear - 1).toString() },
      { value: currentYear.toString(), label: currentYear.toString() },
      { value: (currentYear + 1).toString(), label: (currentYear + 1).toString() },
    ];
  }, []);

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
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif">Student Report Cards</h1>
              <p className="text-cyan-300/80 mt-1">
                {isStudentOrParent ? 'View your official progress reports' : 'View and manage student report cards'}
              </p>
            </div>
            {/* Recycle bin toggle + Progress tracking */}
            <div className="hidden sm:flex items-center gap-3">
              {isAdminOrExaminer && (
                <Button
                  variant={showRecycleBin ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setShowRecycleBin(!showRecycleBin); setSelectedIds(new Set()); }}
                  className={showRecycleBin ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-white/10 text-white border-white/20 hover:bg-white/20"}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Recycle Bin
                </Button>
              )}
              {!showRecycleBin && !isStudentOrParent && reportsThisMonth.size > 0 && (
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                  <TrendingUp className="h-5 w-5 text-cyan-400" />
                  <div className="text-white">
                    <p className="text-xs text-cyan-300">Reports This Month</p>
                    <p className="text-lg font-bold">{[...reportsThisMonth.values()].reduce((a, b) => a + b, 0)}</p>
                  </div>
                </div>
              )}
            </div>
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
            <div className="grid gap-4 md:grid-cols-5">
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

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Year</Label>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reset + Bulk Delete */}
              <div className="flex items-end gap-2 pt-2 md:col-span-5">
                <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
                {isAdminOrExaminer && selectedIds.size > 0 && !showRecycleBin && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleDeleteClick()}
                    className="gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Move to Bin ({selectedIds.size})
                  </Button>
                )}
                {isAdminOrExaminer && selectedIds.size > 0 && showRecycleBin && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => restoreMutation.mutate([...selectedIds])}
                      disabled={restoreMutation.isPending}
                      className="gap-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore ({selectedIds.size})
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDeleteClick()}
                      className="gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Permanently ({selectedIds.size})
                    </Button>
                  </>
                )}
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
                    {isAdminOrExaminer && (
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={sortedReports.length > 0 && selectedIds.size === sortedReports.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                    )}
                    {!isStudentOrParent && (
                      <TableHead 
                        className="text-navy-900 font-semibold cursor-pointer select-none hover:bg-gray-100"
                        onClick={() => handleSort('student')}
                      >
                        <span className="flex items-center">Student {getSortIcon('student')}</span>
                      </TableHead>
                    )}
                    <TableHead 
                      className="text-navy-900 font-semibold cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => handleSort('template')}
                    >
                      <span className="flex items-center">Template {getSortIcon('template')}</span>
                    </TableHead>
                    <TableHead 
                      className="text-navy-900 font-semibold cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => handleSort('subject')}
                    >
                      <span className="flex items-center">Subject {getSortIcon('subject')}</span>
                    </TableHead>
                    <TableHead 
                      className="text-navy-900 font-semibold cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => handleSort('date')}
                    >
                      <span className="flex items-center">Date {getSortIcon('date')}</span>
                    </TableHead>
                    <TableHead 
                      className="text-right text-navy-900 font-semibold cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => handleSort('score')}
                    >
                      <span className="flex items-center justify-end">Score {getSortIcon('score')}</span>
                    </TableHead>
                    <TableHead 
                      className="text-center text-navy-900 font-semibold cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => handleSort('percentage')}
                    >
                      <span className="flex items-center justify-center">Grade {getSortIcon('percentage')}</span>
                    </TableHead>
                    <TableHead className="text-right text-navy-900 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedReports.map((report) => {
                    const monthCount = reportsThisMonth.get(report.student_id) || 0;
                    
                    return (
                      <TableRow 
                        key={report.id} 
                        className="hover:bg-cyan-50/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedReportId(report.id)}
                      >
                        {isAdminOrExaminer && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(report.id)}
                              onCheckedChange={(checked) => handleSelectOne(report.id, !!checked)}
                            />
                          </TableCell>
                        )}
                        {!isStudentOrParent && (
                          <TableCell className="font-medium text-navy-900">
                            <div className="flex items-center gap-2">
                              {report.student?.full_name || '-'}
                              {monthCount > 0 && (
                                <Badge variant="outline" className="text-xs text-cyan-600 border-cyan-200 bg-cyan-50">
                                  {monthCount} this month
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-muted-foreground">{report.template?.name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-full px-3 border-cyan-200 text-cyan-700 bg-cyan-50">
                            {report.template?.subject?.name || 'General'}
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
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {showRecycleBin ? (
                              // Recycle bin actions: restore & permanent delete
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                                  onClick={() => restoreMutation.mutate([report.id])}
                                  disabled={restoreMutation.isPending}
                                  title="Restore"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteClick(report.id)}
                                  title="Delete permanently"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              // Normal actions: view, edit, soft delete
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-cyan-600 hover:text-cyan-700 hover:bg-cyan-100"
                                  onClick={() => setSelectedReportId(report.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {isAdminOrExaminer && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                                      onClick={() => navigate(`/generate-report-card?edit=${report.id}`)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDeleteClick(report.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showRecycleBin ? 'Permanently Delete' : 'Move to Recycle Bin'}</DialogTitle>
            <DialogDescription>
              {showRecycleBin 
                ? `Are you sure you want to permanently delete ${deleteTarget ? 'this report card' : `${selectedIds.size} report card(s)`}? This action cannot be undone.`
                : `Move ${deleteTarget ? 'this report card' : `${selectedIds.size} report card(s)`} to the recycle bin? Items will be permanently deleted after 3 days.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                const ids = deleteTarget ? [deleteTarget] : [...selectedIds];
                if (ids.length > 0) {
                  if (showRecycleBin) {
                    permanentDeleteMutation.mutate(ids);
                  } else {
                    deleteMutation.mutate(ids);
                  }
                }
              }}
              disabled={deleteMutation.isPending || permanentDeleteMutation.isPending}
            >
              {(deleteMutation.isPending || permanentDeleteMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {showRecycleBin ? 'Delete Permanently' : 'Move to Bin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
