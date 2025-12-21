import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ClipboardCheck, User, FileText, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { mockStudents, mockExamTemplates, mockTemplateFields, getTemplateWithFields } from '@/lib/mockExamData';
import { ExamTemplate, ExamTemplateField } from '@/types/exam';

interface FieldValue {
  field_id: string;
  marks: number;
}

export default function ExamSubmission() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [examinerRemarks, setExaminerRemarks] = useState('');
  const [publicRemarks, setPublicRemarks] = useState('');

  const template = useMemo(() => {
    if (!selectedTemplate) return null;
    return getTemplateWithFields(selectedTemplate);
  }, [selectedTemplate]);

  const templateFields = template?.fields || [];
  const scorableFields = templateFields.filter(f => f.max_marks > 0);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
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

  const handleSubmit = () => {
    if (!selectedStudent || !selectedTemplate) {
      toast({ title: 'Error', description: 'Please select student and template', variant: 'destructive' });
      return;
    }

    if (fieldValues.length === 0) {
      toast({ title: 'Error', description: 'Please enter marks for at least one field', variant: 'destructive' });
      return;
    }

    // In real implementation, this would save to Supabase
    const submission = {
      template_id: selectedTemplate,
      student_id: selectedStudent,
      examiner_id: profile?.id,
      exam_date: examDate,
      total_marks: totalMarks,
      max_total_marks: maxTotalMarks,
      percentage,
      examiner_remarks: examinerRemarks,
      public_remarks: publicRemarks,
      values: fieldValues,
    };

    console.log('Submitting exam:', submission);
    
    toast({ title: 'Success', description: 'Exam results submitted successfully' });
    
    // Reset form
    setSelectedStudent('');
    setSelectedTemplate('');
    setFieldValues([]);
    setExaminerRemarks('');
    setPublicRemarks('');
  };

  const activeTemplates = mockExamTemplates.filter(t => t.is_active);

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
                    {mockStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Exam Template *
                </Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            {template && (
              <>
                <Separator />
                
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Enter Marks
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{template.subject?.name}</Badge>
                      <Badge variant="secondary" className="capitalize">{template.tenure}</Badge>
                    </div>
                  </div>

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
                            value={getFieldValue(field.id).toString() === '0' ? '' : ''}
                            className="h-20"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Score Summary */}
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
          </CardContent>
        </Card>

        <Button 
          onClick={handleSubmit} 
          className="w-full"
          disabled={!selectedStudent || !selectedTemplate || fieldValues.length === 0}
        >
          Submit Exam Results
        </Button>
      </div>
    </DashboardLayout>
  );
}
