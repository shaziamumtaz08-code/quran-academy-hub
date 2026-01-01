import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Loader2, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TemplateBuilder } from '@/components/reportCard/TemplateBuilder';
import { TemplateStructure } from '@/types/reportCard';
import type { Database } from '@/integrations/supabase/types';

type ExamTenure = Database['public']['Enums']['exam_tenure'];

interface Subject {
  id: string;
  name: string;
  description?: string | null;
}

interface ReportTemplate {
  id: string;
  name: string;
  subject_id: string | null;
  subject?: Subject | null;
  tenure: ExamTenure;
  description?: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  structure_json: TemplateStructure | null;
}

export default function ReportCardTemplates() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);

  // Fetch subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Subject[];
    },
  });

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['report-card-templates'],
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
          created_by,
          created_at,
          updated_at,
          structure_json,
          subject:subjects(id, name, description)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(d => ({
        ...d,
        structure_json: d.structure_json as unknown as TemplateStructure | null,
      })) as ReportTemplate[];
    },
  });

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      subject_id: string | null;
      tenure: ExamTenure;
      description: string | null;
      structure_json: TemplateStructure;
    }) => {
      const { error } = await supabase
        .from('exam_templates')
        .insert({
          name: data.name,
          subject_id: data.subject_id,
          tenure: data.tenure,
          description: data.description,
          structure_json: data.structure_json as unknown as Database['public']['Tables']['exam_templates']['Insert']['structure_json'],
          created_by: user?.id || null,
          is_active: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-card-templates'] });
      setIsBuilderOpen(false);
      toast({ title: 'Success', description: 'Report card template created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      name: string;
      subject_id: string | null;
      tenure: ExamTenure;
      description: string | null;
      structure_json: TemplateStructure;
    }) => {
      const { error } = await supabase
        .from('exam_templates')
        .update({
          name: data.name,
          subject_id: data.subject_id,
          tenure: data.tenure,
          description: data.description,
          structure_json: data.structure_json as unknown as Database['public']['Tables']['exam_templates']['Update']['structure_json'],
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-card-templates'] });
      setEditingTemplate(null);
      toast({ title: 'Success', description: 'Template updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('exam_templates')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-card-templates'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSave = (data: {
    name: string;
    subject_id: string | null;
    tenure: ExamTenure;
    description: string | null;
    structure_json: TemplateStructure;
  }) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (template: ReportTemplate) => {
    setEditingTemplate(template);
  };

  const closeBuilder = () => {
    setIsBuilderOpen(false);
    setEditingTemplate(null);
  };

  const getStructureStats = (structure: TemplateStructure | null) => {
    if (!structure || !structure.sections) return { sections: 0, criteria: 0 };
    const sections = structure.sections.length;
    const criteria = structure.sections.reduce((sum, s) => sum + (s.criteria?.length || 0), 0);
    return { sections, criteria };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Report Card Templates</h1>
            <p className="text-muted-foreground mt-1">
              Create flexible templates for academic and tarbiyah report cards
            </p>
          </div>
          <Button onClick={() => setIsBuilderOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No templates yet</p>
              <p className="text-sm mt-1">Create your first report card template to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              const stats = getStructureStats(template.structure_json);
              
              return (
                <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.subject?.name || 'No subject'}
                        </p>
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
                      <span className="text-muted-foreground">{stats.sections} sections</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{stats.criteria} criteria</span>
                    </div>
                    
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => openEdit(template)}
                      >
                        <Settings className="h-4 w-4" />
                        Edit Template
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleActiveMutation.mutate({ 
                          id: template.id, 
                          is_active: !template.is_active 
                        })}
                        disabled={toggleActiveMutation.isPending}
                        title={template.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {template.is_active ? (
                          <ToggleRight className="h-5 w-5 text-primary" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Template Builder Sheet */}
      <TemplateBuilder
        isOpen={isBuilderOpen || !!editingTemplate}
        onClose={closeBuilder}
        subjects={subjects}
        onSave={handleSave}
        isSaving={createMutation.isPending || updateMutation.isPending}
        initialData={editingTemplate ? {
          name: editingTemplate.name,
          subject_id: editingTemplate.subject_id,
          tenure: editingTemplate.tenure,
          description: editingTemplate.description || null,
          structure_json: editingTemplate.structure_json,
        } : undefined}
      />
    </DashboardLayout>
  );
}
