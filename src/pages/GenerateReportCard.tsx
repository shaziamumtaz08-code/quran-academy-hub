import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, User, Calendar, Loader2, Send, Upload, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ReportCardForm } from '@/components/reportCard/ReportCardForm';
import { BulkReportCardDialog } from '@/components/reportCard/BulkReportCardDialog';
import {
  CriteriaValue,
  StoredCriteriaEntry,
  TemplateStructure,
  calculateMaxScore,
} from '@/types/reportCard';
import type { Database } from '@/integrations/supabase/types';

type ExamTenure = Database['public']['Enums']['exam_tenure'];

interface Student {
  id: string;
  full_name: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  subject_id: string | null;
  subject?: { id: string; name: string } | null;
  tenure: ExamTenure;
  structure_json: TemplateStructure | null;
}

interface ExistingExam {
  id: string;
  template_id: string;
  student_id: string;
  exam_date: string;
  criteria_values_json: StoredCriteriaEntry[] | null;
  examiner_remarks: string | null;
  public_remarks: string | null;
  template?: {
    id: string;
    name: string;
    structure_json: TemplateStructure | null;
    subject?: { id: string; name: string } | null;
  } | null;
  student?: { id: string; full_name: string } | null;
}

export default function GenerateReportCard() {
  const { toast } = useToast();
  const { user, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const editId = searchParams.get('edit');
  const isEditMode = !!editId;

  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [criteriaValues, setCriteriaValues] = useState<CriteriaValue[]>([]);
  const [examinerRemarks, setExaminerRemarks] = useState('');
  const [publicRemarks, setPublicRemarks] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editDataLoaded, setEditDataLoaded] = useState(false);

  const isAdminOrExaminer =
    activeRole === 'admin' ||
    activeRole === 'examiner' ||
    activeRole === 'super_admin' ||
    activeRole?.startsWith('admin_');
  const isTeacher = activeRole === 'teacher';

  // Fetch students
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students-for-report', user?.id, activeRole],
    queryFn: async () => {
      if (isAdminOrExaminer) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .order('full_name');
        if (error) throw error;

        const { data: studentRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'student');

        const studentIds = new Set((studentRoles || []).map((r) => r.user_id));
        return (data || []).filter((p) => studentIds.has(p.id)) as Student[];
      }

      if (isTeacher) {
        const { data: assignments } = await supabase
          .from('student_teacher_assignments')
          .select('student_id')
          .eq('teacher_id', user?.id)
          .eq('status', 'active');

        if (!assignments || assignments.length === 0) return [];

        const studentIds = assignments.map((a) => a.student_id);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds)
          .order('full_name');

        if (error) throw error;
        return (data || []) as Student[];
      }

      return [];
    },
    enabled: !!user?.id && (isAdminOrExaminer || isTeacher),
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['active-report-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_templates')
        .select(
          `
          id,
          name,
          subject_id,
          tenure,
          structure_json,
          subject:subjects(id, name)
        `
        )
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []).map((d) => ({
        ...d,
        structure_json: d.structure_json as unknown as TemplateStructure | null,
      })) as ReportTemplate[];
    },
  });

  // Fetch existing exam for edit mode
  const { data: existingExam, isLoading: examLoading } = useQuery({
    queryKey: ['edit-exam', editId],
    queryFn: async () => {
      if (!editId) return null;
      const { data, error } = await supabase
        .from('exams')
        .select(`
          id,
          template_id,
          student_id,
          exam_date,
          criteria_values_json,
          examiner_remarks,
          public_remarks,
          template:exam_templates!exams_template_id_fkey(
            id,
            name,
            structure_json,
            subject:subjects(id, name)
          ),
          student:profiles!exams_student_id_fkey(id, full_name)
        `)
        .eq('id', editId)
        .single();

      if (error) throw error;
      return {
        ...data,
        criteria_values_json: data.criteria_values_json as unknown as StoredCriteriaEntry[] | null,
        template: data.template ? {
          ...data.template,
          structure_json: data.template.structure_json as unknown as TemplateStructure | null,
        } : null,
      } as ExistingExam;
    },
    enabled: !!editId,
  });

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || null;
  }, [selectedTemplateId, templates]);

  const structure = selectedTemplate?.structure_json || { sections: [] };

  const flatCriteria = useMemo(() => {
    return structure.sections.flatMap((s) => s.criteria.map((c) => ({ sectionId: s.id, criteria: c })));
  }, [structure]);

  // Initialize entries for every criterion when template changes (for new reports only)
  useEffect(() => {
    if (!selectedTemplateId || editDataLoaded) {
      if (!selectedTemplateId) setCriteriaValues([]);
      return;
    }

    const initial: CriteriaValue[] = flatCriteria.map(({ sectionId, criteria }) => ({
      criteriaId: criteria.id,
      sectionId,
      obtained_marks: null,
      remarks: '',
    }));

    setCriteriaValues(initial);
  }, [selectedTemplateId, flatCriteria, editDataLoaded]);

  // Load existing exam data when editing
  useEffect(() => {
    if (!isEditMode || !existingExam || editDataLoaded) return;
    
    // Pre-populate form with existing data
    setSelectedStudent(existingExam.student_id);
    setSelectedTemplateId(existingExam.template_id);
    setReportDate(existingExam.exam_date);
    setExaminerRemarks(existingExam.examiner_remarks || '');
    setPublicRemarks(existingExam.public_remarks || '');
    
    // Map stored criteria values to CriteriaValue format
    if (existingExam.criteria_values_json && existingExam.template?.structure_json) {
      const struct = existingExam.template.structure_json;
      const values: CriteriaValue[] = [];
      
      for (const section of struct.sections) {
        for (const criterion of section.criteria) {
          const stored = existingExam.criteria_values_json.find(
            (cv) => cv.criteria_name === criterion.criteria_name
          );
          values.push({
            criteriaId: criterion.id,
            sectionId: section.id,
            obtained_marks: stored?.obtained_marks ?? null,
            remarks: stored?.remarks || '',
          });
        }
      }
      
      setCriteriaValues(values);
    }
    
    setEditDataLoaded(true);
  }, [isEditMode, existingExam, editDataLoaded]);

  const onEntryChange = (
    criteriaId: string,
    sectionId: string,
    patch: Partial<Pick<CriteriaValue, 'obtained_marks' | 'remarks'>>
  ) => {
    setCriteriaValues((prev) => {
      const idx = prev.findIndex((v) => v.criteriaId === criteriaId);
      if (idx === -1) return [...prev, { criteriaId, sectionId, obtained_marks: null, ...patch }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const totals = useMemo(() => {
    const totalMax = calculateMaxScore(structure);
    const totalObtained = flatCriteria.reduce((sum, { criteria }) => {
      const entry = criteriaValues.find((v) => v.criteriaId === criteria.id);
      return sum + (entry?.obtained_marks ?? 0);
    }, 0);
    const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
    return { totalMax, totalObtained, percentage };
  }, [structure, flatCriteria, criteriaValues]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Authentication required');

      const entries: StoredCriteriaEntry[] = flatCriteria.map(({ criteria }) => {
        const entry = criteriaValues.find((v) => v.criteriaId === criteria.id);
        return {
          criteria_name: criteria.criteria_name,
          max_marks: criteria.max_marks,
          obtained_marks: entry?.obtained_marks ?? 0,
          remarks: (entry?.remarks || '').trim() || undefined,
        };
      });

      const { data, error } = await supabase.functions.invoke('submit-report-card', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          ...(isEditMode && editId ? { exam_id: editId } : {}),
          template_id: selectedTemplateId,
          student_id: selectedStudent,
          exam_date: reportDate,
          criteria_entries: entries,
          examiner_remarks: examinerRemarks || null,
          public_remarks: publicRemarks || null,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['student-reports'] });
      queryClient.invalidateQueries({ queryKey: ['edit-exam'] });
      
      const successMessage = data?.updated 
        ? 'Report card updated successfully' 
        : 'Report card generated successfully';
      toast({ title: 'Success', description: successMessage });

      if (isEditMode) {
        navigate('/student-reports');
      } else {
        setSelectedStudent('');
        setSelectedTemplateId('');
        setCriteriaValues([]);
        setExaminerRemarks('');
        setPublicRemarks('');
      }
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = () => {
    if (!selectedStudent || !selectedTemplateId) {
      toast({ title: 'Error', description: 'Please select student and template', variant: 'destructive' });
      return;
    }

    if (flatCriteria.length === 0) {
      toast({ title: 'Error', description: 'Selected template has no criteria rows', variant: 'destructive' });
      return;
    }

    const missing = flatCriteria
      .map(({ criteria }) => {
        const entry = criteriaValues.find((v) => v.criteriaId === criteria.id);
        return entry?.obtained_marks === null ? criteria.criteria_name : null;
      })
      .filter(Boolean) as string[];

    if (missing.length > 0) {
      toast({
        title: 'Obtained marks required',
        description: `Please enter obtained marks for: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
        variant: 'destructive',
      });
      return;
    }

    // Additional sanity: obtained <= max
    const invalid = flatCriteria
      .map(({ criteria }) => {
        const entry = criteriaValues.find((v) => v.criteriaId === criteria.id);
        if (entry?.obtained_marks === null) return null;
        return entry.obtained_marks > criteria.max_marks ? criteria.criteria_name : null;
      })
      .filter(Boolean) as string[];

    if (invalid.length > 0) {
      toast({
        title: 'Invalid marks',
        description: `Obtained marks cannot exceed max marks (${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''})`,
        variant: 'destructive',
      });
      return;
    }

    submitMutation.mutate();
  };

  const isLoading = studentsLoading || templatesLoading || (isEditMode && examLoading);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {isEditMode && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/student-reports')}
                className="mt-1"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {isEditMode ? 'Edit Report Card' : 'Generate Report Card'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditMode 
                  ? `Editing report for ${existingExam?.student?.full_name || 'student'}`
                  : 'Enter obtained marks for every criteria row (max marks come from the template)'
                }
              </p>
            </div>
          </div>
          {!isEditMode && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors px-3 py-1.5 text-sm font-medium flex items-center gap-1.5"
              onClick={() => setBulkDialogOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              Bulk Import
            </Badge>
          )}
        </div>

        <BulkReportCardDialog
          open={bulkDialogOpen}
          onOpenChange={setBulkDialogOpen}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Select Student *
                    </Label>
                    <Select 
                      value={selectedStudent} 
                      onValueChange={setSelectedStudent}
                      disabled={isEditMode}
                    >
                      <SelectTrigger className={isEditMode ? 'opacity-70' : ''}>
                        <SelectValue placeholder="Choose a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Report Template *
                    </Label>
                    <Select 
                      value={selectedTemplateId} 
                      onValueChange={setSelectedTemplateId}
                      disabled={isEditMode}
                    >
                      <SelectTrigger className={isEditMode ? 'opacity-70' : ''}>
                        <SelectValue placeholder="Choose a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Report Date
                    </Label>
                    <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
                  </div>
                </div>

                {selectedTemplate && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedTemplate.subject?.name || 'Any subject'}</Badge>
                    <Badge variant="secondary" className="capitalize">
                      {selectedTemplate.tenure}
                    </Badge>
                    <Badge variant="outline">
                      Total Max: {totals.totalMax}
                    </Badge>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {selectedTemplate && structure.sections.length > 0 && (
          <>
            <ReportCardForm structure={structure} values={criteriaValues} onEntryChange={onEntryChange} />

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Overall Remarks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Internal Remarks (Staff Only)</Label>
                  <Textarea
                    placeholder="Notes visible only to staff..."
                    value={examinerRemarks}
                    onChange={(e) => setExaminerRemarks(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Public Remarks (Visible to Student/Parent)</Label>
                  <Textarea
                    placeholder="Feedback for the student and parent..."
                    value={publicRemarks}
                    onChange={(e) => setPublicRemarks(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmit}
              className="w-full gap-2"
              size="lg"
              disabled={!selectedStudent || !selectedTemplateId || submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isEditMode ? 'Update Report Card' : 'Submit Report Card'}
            </Button>
          </>
        )}

        {selectedTemplate && structure.sections.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Template has no structure defined</p>
              <p className="text-sm">Please edit the template to add sections and criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
