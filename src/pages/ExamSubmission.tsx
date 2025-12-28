import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, User, FileText, Calculator, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ExamTenure = Database['public']['Enums']['exam_tenure'];

interface Subject {
  id: string;
  name: string;
}

interface ExamTemplate {
  id: string;
  name: string;
  subject_id: string | null;
  subject?: Subject | null;
  tenure: ExamTenure;
  description?: string | null;
  is_active: boolean;
}

interface ExamTemplateField {
  id: string;
  template_id: string;
  label: string;
  max_marks: number;
  description?: string | null;
  is_public: boolean;
  sort_order: number;
}

interface Student {
  id: string;
  full_name: string;
}

interface FieldValue {
  field_id: string;
  marks: number;
}

export default function ExamSubmission() {
  const { toast } = useToast();
  const { user, activeRole } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [examinerRemarks, setExaminerRemarks] = useState('');
  const [publicRemarks, setPublicRemarks] = useState('');

  const isAdminOrExaminer = activeRole === 'admin' || activeRole === 'examiner' || activeRole === 'super_admin' ||
    activeRole === 'admin_admissions' || activeRole === 'admin_fees' || activeRole === 'admin_academic';
  const isTeacher = activeRole === 'teacher';

  // Fetch students based on role
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students-for-exam', user?.id, activeRole],
    queryFn: async () => {
      if (isAdminOrExaminer) {
        // Admin/Examiner can see all students
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .order('full_name');
        if (error) throw error;
        
        // Filter to only users with student role
        const { data: studentRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'student');
        
        const studentIds = new Set((studentRoles || []).map(r => r.user_id));
        return (data || []).filter(p => studentIds.has(p.id)) as Student[];
      } else if (isTeacher) {
        // Teacher can only see assigned students
        const { data: assignments, error: assignError } = await supabase
          .from('student_teacher_assignments')
          .select('student_id')
          .eq('teacher_id', user?.id);
        
        if (assignError) throw assignError;
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

  // Fetch active exam templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['active-exam-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_templates')
        .select(`
          id,
          name,
          subject_id,
          tenure,
          description,
          is_active,
          subject:subjects(id, name)
        `)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as ExamTemplate[];
    },
  });

  // Fetch template fields
  const { data: allFields = [] } = useQuery({
    queryKey: ['exam-template-fields'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_template_fields')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as ExamTemplateField[];
    },
  });

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return templates.find(t => t.id === selectedTemplateId) || null;
  }, [selectedTemplateId, templates]);

  const templateFields = useMemo(() => {
    if (!selectedTemplateId) return [];
    return allFields.filter(f => f.template_id === selectedTemplateId).sort((a, b) => a.sort_order - b.sort_order);
  }, [selectedTemplateId, allFields]);

  const scorableFields = templateFields.filter(f => f.max_marks > 0);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setFieldValues([]);
  };

  const handleFieldValueChange = (fieldId: string, marks: number) => {
    const field = templateFields.find(f => f.id === fieldId);
    if (field && marks > field.max_marks) {
      marks = field.max_marks;
    }
    if (marks < 0) marks = 0;

    setFieldValues(prev => {
      const existing = prev.find(v => v.field_id === fieldId);
      if (existing) {
        return prev.map(v => v.field_id === fieldId ? { ...v, marks } : v);
      }
      return [...prev, { field_id: fieldId, marks }];
    });
  };

  const getFieldValue = (fieldId: string): number => {
    return fieldValues.find(v => v.field_id === fieldId)?.marks || 0;
  };

  const totalMarks = scorableFields.reduce((sum, field) => sum + getFieldValue(field.id), 0);
  const maxTotalMarks = scorableFields.reduce((sum, field) => sum + field.max_marks, 0);
  const percentage = maxTotalMarks > 0 ? Math.round((totalMarks / maxTotalMarks) * 100) : 0;

  // Submit exam mutation
  const submitExamMutation = useMutation({
    mutationFn: async () => {
      // Insert the exam record
      const { data: examData, error: examError } = await supabase
        .from('exams')
        .insert({
          template_id: selectedTemplateId,
          student_id: selectedStudent,
          examiner_id: user?.id || null,
          exam_date: examDate,
          total_marks: totalMarks,
          max_total_marks: maxTotalMarks,
          percentage,
          examiner_remarks: examinerRemarks || null,
          public_remarks: publicRemarks || null,
        })
        .select()
        .single();

      if (examError) throw examError;

      // Insert field results
      if (fieldValues.length > 0) {
        const fieldResults = fieldValues.map(fv => ({
          exam_id: examData.id,
          field_id: fv.field_id,
          marks: fv.marks,
        }));

        const { error: fieldsError } = await supabase
          .from('exam_field_results')
          .insert(fieldResults);

        if (fieldsError) throw fieldsError;
      }

      return examData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-results'] });
      toast({ title: 'Success', description: 'Exam results submitted successfully' });
      
      // Reset form
      setSelectedStudent('');
      setSelectedTemplateId('');
      setFieldValues([]);
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

    if (fieldValues.length === 0) {
      toast({ title: 'Error', description: 'Please enter marks for at least one field', variant: 'destructive' });
      return;
    }

    submitExamMutation.mutate();
  };

  const isLoading = studentsLoading || templatesLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Submit Exam Results</h1>
          <p className="text-muted-foreground mt-1">Record examination marks for a student</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Exam Details
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
                <div className="grid gap-4 md:grid-cols-2">
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
                    {students.length === 0 && (
                      <p className="text-xs text-muted-foreground">No students available</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Exam Template *
                    </Label>
                    <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
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
                    {templates.length === 0 && (
                      <p className="text-xs text-muted-foreground">No active templates. Create one first.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Exam Date</Label>
                  <Input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </div>

                {/* Template Fields */}
                {selectedTemplate && (
                  <>
                    <Separator />
                    
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          Enter Marks
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{selectedTemplate.subject?.name || 'No subject'}</Badge>
                          <Badge variant="secondary" className="capitalize">{selectedTemplate.tenure}</Badge>
                        </div>
                      </div>

                      {templateFields.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No fields defined for this template. Add fields in Exam Templates.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {templateFields.map((field) => (
                            <div key={field.id} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                  {field.label}
                                  {!field.is_public && (
                                    <Badge variant="secondary" className="text-xs">Internal</Badge>
                                  )}
                                </Label>
                                {field.max_marks > 0 && (
                                  <span className="text-sm text-muted-foreground">
                                    Max: {field.max_marks}
                                  </span>
                                )}
                              </div>
                              {field.description && (
                                <p className="text-xs text-muted-foreground">{field.description}</p>
                              )}
                              {field.max_marks > 0 ? (
                                <Input
                                  type="number"
                                  min={0}
                                  max={field.max_marks}
                                  value={getFieldValue(field.id) || ''}
                                  onChange={(e) => handleFieldValueChange(field.id, parseInt(e.target.value) || 0)}
                                  placeholder={`Enter marks (0-${field.max_marks})`}
                                />
                              ) : (
                                <Textarea
                                  placeholder="Enter notes..."
                                  className="h-20"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Score Summary */}
                      {scorableFields.length > 0 && (
                        <div className="mt-6 p-4 bg-secondary rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Total Score</span>
                            <div className="text-right">
                              <span className="text-2xl font-bold text-primary">{totalMarks}</span>
                              <span className="text-muted-foreground"> / {maxTotalMarks}</span>
                              <Badge className="ml-3" variant={percentage >= 70 ? 'default' : percentage >= 50 ? 'secondary' : 'destructive'}>
                                {percentage}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Remarks */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Examiner Remarks (Internal)</Label>
                        <Textarea
                          placeholder="Internal notes visible only to admin/examiner..."
                          value={examinerRemarks}
                          onChange={(e) => setExaminerRemarks(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">These remarks are NOT visible to students or parents</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Public Remarks</Label>
                        <Textarea
                          placeholder="Feedback visible to student and parent..."
                          value={publicRemarks}
                          onChange={(e) => setPublicRemarks(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">These remarks WILL be visible to students and parents</p>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Button 
          onClick={handleSubmit} 
          className="w-full"
          disabled={!selectedStudent || !selectedTemplateId || fieldValues.length === 0 || submitExamMutation.isPending}
        >
          {submitExamMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Submit Exam Results
        </Button>
      </div>
    </DashboardLayout>
  );
}
