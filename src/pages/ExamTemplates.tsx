import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileEdit, Trash2, Eye, EyeOff, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mockSubjects, mockExamTemplates, mockTemplateFields, getTemplateWithFields } from '@/lib/mockExamData';
import { ExamTemplate, ExamTemplateField, ExamTenure, Subject } from '@/types/exam';

export default function ExamTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ExamTemplate[]>(mockExamTemplates);
  const [fields, setFields] = useState<ExamTemplateField[]>(mockTemplateFields);
  const [selectedTemplate, setSelectedTemplate] = useState<ExamTemplate | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    subject_id: '',
    tenure: 'monthly' as ExamTenure,
    description: '',
  });
  
  // Field form state
  const [fieldForm, setFieldForm] = useState({
    label: '',
    max_marks: 0,
    description: '',
    is_public: true,
  });

  const handleCreateTemplate = () => {
    if (!formData.name || !formData.subject_id) {
      toast({ title: 'Error', description: 'Please fill required fields', variant: 'destructive' });
      return;
    }

    const newTemplate: ExamTemplate = {
      id: String(Date.now()),
      name: formData.name,
      subject_id: formData.subject_id,
      subject: mockSubjects.find(s => s.id === formData.subject_id),
      tenure: formData.tenure,
      description: formData.description,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTemplates([...templates, newTemplate]);
    setFormData({ name: '', subject_id: '', tenure: 'monthly', description: '' });
    setIsCreateOpen(false);
    toast({ title: 'Success', description: 'Exam template created successfully' });
  };

  const handleAddField = () => {
    if (!selectedTemplate || !fieldForm.label) {
      toast({ title: 'Error', description: 'Please enter a field label', variant: 'destructive' });
      return;
    }

    const newField: ExamTemplateField = {
      id: String(Date.now()),
      template_id: selectedTemplate.id,
      label: fieldForm.label,
      max_marks: fieldForm.max_marks,
      description: fieldForm.description,
      is_public: fieldForm.is_public,
      sort_order: fields.filter(f => f.template_id === selectedTemplate.id).length + 1,
      created_at: new Date().toISOString(),
    };

    setFields([...fields, newField]);
    setFieldForm({ label: '', max_marks: 0, description: '', is_public: true });
    toast({ title: 'Success', description: 'Field added successfully' });
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
    toast({ title: 'Success', description: 'Field removed' });
  };

  const handleToggleActive = (templateId: string) => {
    setTemplates(templates.map(t => 
      t.id === templateId ? { ...t, is_active: !t.is_active } : t
    ));
  };

  const templateFields = selectedTemplate 
    ? fields.filter(f => f.template_id === selectedTemplate.id).sort((a, b) => a.sort_order - b.sort_order)
    : [];

  const totalMaxMarks = templateFields.filter(f => f.max_marks > 0).reduce((sum, f) => sum + f.max_marks, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Exam Templates</h1>
            <p className="text-muted-foreground mt-1">Create and manage reusable exam templates</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Exam Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Nazrah Monthly Assessment"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select value={formData.subject_id} onValueChange={(v) => setFormData({ ...formData, subject_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockSubjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tenure">Tenure *</Label>
                  <Select value={formData.tenure} onValueChange={(v: ExamTenure) => setFormData({ ...formData, tenure: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description (internal)</Label>
                  <Textarea
                    id="description"
                    placeholder="Internal notes about this template..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                
                <Button onClick={handleCreateTemplate} className="w-full">Create Template</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const tFields = fields.filter(f => f.template_id === template.id);
            const maxMarks = tFields.filter(f => f.max_marks > 0).reduce((sum, f) => sum + f.max_marks, 0);
            
            return (
              <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{template.subject?.name}</p>
                    </div>
                    <Badge variant={template.is_active ? 'default' : 'secondary'}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="capitalize">{template.tenure}</Badge>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{tFields.length} fields</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{maxMarks} marks</span>
                  </div>
                  
                  {template.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setIsFieldsOpen(true);
                      }}
                    >
                      <FileEdit className="h-4 w-4 mr-1" />
                      Edit Fields
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(template.id)}
                    >
                      {template.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Field Editor Dialog */}
        <Dialog open={isFieldsOpen} onOpenChange={setIsFieldsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedTemplate?.name} - Fields
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 pt-4">
              {/* Add Field Form */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Add New Field</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Field Label *</Label>
                      <Input
                        placeholder="e.g., Fluency"
                        value={fieldForm.label}
                        onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Marks</Label>
                      <Input
                        type="number"
                        min={0}
                        value={fieldForm.max_marks}
                        onChange={(e) => setFieldForm({ ...fieldForm, max_marks: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Description (internal)</Label>
                    <Input
                      placeholder="Optional internal notes..."
                      value={fieldForm.description}
                      onChange={(e) => setFieldForm({ ...fieldForm, description: e.target.value })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={fieldForm.is_public}
                        onCheckedChange={(checked) => setFieldForm({ ...fieldForm, is_public: checked })}
                      />
                      <Label className="font-normal">
                        {fieldForm.is_public ? (
                          <span className="flex items-center gap-1"><Eye className="h-4 w-4" /> Visible to Student/Parent</span>
                        ) : (
                          <span className="flex items-center gap-1"><EyeOff className="h-4 w-4" /> Internal Only</span>
                        )}
                      </Label>
                    </div>
                    <Button onClick={handleAddField} size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Field
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Existing Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Template Fields</h3>
                  <span className="text-sm text-muted-foreground">Total Max: {totalMaxMarks} marks</span>
                </div>
                
                {templateFields.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No fields added yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="w-24 text-center">Max Marks</TableHead>
                        <TableHead className="w-24 text-center">Visibility</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templateFields.map((field) => (
                        <TableRow key={field.id}>
                          <TableCell>
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{field.label}</p>
                              {field.description && (
                                <p className="text-xs text-muted-foreground">{field.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {field.max_marks > 0 ? field.max_marks : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {field.is_public ? (
                              <Eye className="h-4 w-4 text-primary mx-auto" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteField(field.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
