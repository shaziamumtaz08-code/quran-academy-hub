import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { FileText, User, Calendar, Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ReportCardForm } from '@/components/reportCard/ReportCardForm';
import { TemplateStructure, CriteriaValue, DEFAULT_SKILL_LABELS } from '@/types/reportCard';
import type { Database } from '@/integrations/supabase/types';

interface Student {
  id: string;
  full_name: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  subject_id: string | null;
  subject?: { id: string; name: string } | null;
  tenure: string;
  structure_json: TemplateStructure | null;
}

export default function GenerateReportCard() {
  const { toast } = useToast();
  const { user, activeRole } = useAuth();
  const queryClient = useQueryClient();

  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [criteriaValues, setCriteriaValues] = useState<CriteriaValue[]>([]);
  const [examinerRemarks, setExaminerRemarks] = useState('');
  const [publicRemarks, setPublicRemarks] = useState('');

  const isAdminOrExaminer = activeRole === 'admin' || activeRole === 'examiner' || 
    activeRole === 'super_admin' || activeRole?.startsWith('admin_');
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
        
        const studentIds = new Set((studentRoles || []).map(r => r.user_id));
        return (data || []).filter(p => studentIds.has(p.id)) as Student[];
      } else if (isTeacher) {
        const { data: assignments } = await supabase
          .from('student_teacher_assignments')
          .select('student_id')
          .eq('teacher_id', user?.id);
        
        if (!assignments || assignments.length === 0) return [];
        
        const studentIds = assignments.map(a => a.student_id);
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
        .select(`
          id,
          name,
          subject_id,
          tenure,
          structure_json,
          subject:subjects(id, name)
        `)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        structure_json: d.structure_json as unknown as TemplateStructure | null,
      })) as ReportTemplate[];
    },
  });

  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || null;
  }, [selectedTemplateId, templates]);

  const structure = selectedTemplate?.structure_json || { sections: [] };

  // Handle value change
  const handleValueChange = (criteriaId: string, sectionId: string, value: number | string) => {
    const criteria = structure.sections
      .flatMap(s => s.criteria)
      .find(c => c.id === criteriaId);
    
    if (!criteria) return;

    let numericValue = 0;
    if (criteria.type === 'numeric' || criteria.type === 'star') {
      numericValue = typeof value === 'number' ? value : parseInt(value as string) || 0;
    } else if (criteria.type === 'skill') {
      // Skill type - convert label to numeric value (1, 2, 3)
      const labels = criteria.skillLabels || DEFAULT_SKILL_LABELS;
      numericValue = labels.indexOf(value as string) + 1;
    } else if (criteria.type === 'grade') {
      // Grade type - convert letter to numeric value (F=0, D=1, C=2, B=3, A=4)
      const labels = criteria.gradeLabels || ['F', 'D', 'C', 'B', 'A'];
      numericValue = labels.indexOf(value as string);
      if (numericValue < 0) numericValue = 0;
    }

    setCriteriaValues(prev => {
      const existing = prev.findIndex(v => v.criteriaId === criteriaId);
      const newValue: CriteriaValue = {
        criteriaId,
        sectionId,
        value,
        numericValue,
      };
      
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newValue;
        return updated;
      }
      return [...prev, newValue];
    });
  };

  // Calculate totals
  const { totalScore, maxScore, percentage } = useMemo(() => {
    let total = 0;
    let max = 0;

    for (const section of structure.sections) {
      for (const criteria of section.criteria) {
        const val = criteriaValues.find(v => v.criteriaId === criteria.id);
        if (criteria.type === 'numeric' && criteria.maxMarks) {
          max += criteria.maxMarks;
          total += val?.numericValue || 0;
        } else if (criteria.type === 'skill') {
          max += 3;
          total += val?.numericValue || 0;
        } else if (criteria.type === 'star') {
          max += criteria.starMax || 5;
          total += val?.numericValue || 0;
        } else if (criteria.type === 'grade') {
          max += (criteria.gradeLabels?.length || 5) - 1;
          total += val?.numericValue || 0;
        }
      }
    }

    return {
      totalScore: total,
      maxScore: max,
      percentage: max > 0 ? Math.round((total / max) * 100) : 0,
    };
  }, [structure, criteriaValues]);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      // Insert exam record
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .insert({
          template_id: selectedTemplateId,
          student_id: selectedStudent,
          examiner_id: user?.id || null,
          exam_date: reportDate,
          total_marks: totalScore,
          max_total_marks: maxScore,
          percentage,
          examiner_remarks: examinerRemarks || null,
          public_remarks: publicRemarks || null,
        })
        .select()
        .single();

      if (examError) throw examError;

      // Note: We're storing all criteria values in exam_field_results
      // but the structure is now in structure_json on the template
      // For backward compatibility, we still record field results

      return examData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-reports'] });
      toast({ title: 'Success', description: 'Report card generated successfully' });
      
      // Reset form
      setSelectedStudent('');
      setSelectedTemplateId('');
      setCriteriaValues([]);
      setExaminerRemarks('');
      setPublicRemarks('');
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = () => {
    if (!selectedStudent || !selectedTemplateId) {
      toast({ title: 'Error', description: 'Please select student and template', variant: 'destructive' });
      return;
    }

    if (criteriaValues.length === 0) {
      toast({ title: 'Error', description: 'Please fill in at least one criteria', variant: 'destructive' });
      return;
    }

    submitMutation.mutate();
  };

  const isLoading = studentsLoading || templatesLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Generate Report Card</h1>
          <p className="text-muted-foreground mt-1">
            Fill in the report card for a student using the selected template
          </p>
        </div>

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
                {/* Student & Template Selection */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Select Student *
                    </Label>
                    <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                      <SelectTrigger>
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
                      onValueChange={(v) => {
                        setSelectedTemplateId(v);
                        setCriteriaValues([]); // Reset values on template change
                      }}
                    >
                      <SelectTrigger>
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
                    <Input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Template Info */}
                {selectedTemplate && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedTemplate.subject?.name || 'No subject'}</Badge>
                    <Badge variant="secondary" className="capitalize">{selectedTemplate.tenure}</Badge>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Form */}
        {selectedTemplate && structure.sections.length > 0 && (
          <>
            <ReportCardForm
              structure={structure}
              values={criteriaValues}
              onValueChange={handleValueChange}
            />

            <Separator />

            {/* Remarks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Remarks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Internal Remarks (Admin Only)</Label>
                  <Textarea
                    placeholder="Notes visible only to admin/examiner..."
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
              disabled={!selectedStudent || !selectedTemplateId || criteriaValues.length === 0 || submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Generate Report Card
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
