import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Loader2, Settings, ToggleLeft, ToggleRight, Layers, ListChecks, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TemplateBuilder } from '@/components/reportCard/TemplateBuilder';
import { TemplateStructure, ReportSection, ReportCriteriaRow } from '@/types/reportCard';
import type { Database } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

// Helper to create a sample template structure matching requirements
const createSampleTemplateStructure = (): TemplateStructure => {
  const createCriteria = (name: string, maxMarks: number): ReportCriteriaRow => ({
    id: crypto.randomUUID(),
    criteria_name: name,
    max_marks: maxMarks,
  });

  // Section: Qur'an Recitation with 5 criteria, each Max = 20, Total = 100
  const quranRecitationSection: ReportSection = {
    id: crypto.randomUUID(),
    title: "Qur'an Recitation",
    showSubtotal: true,
    criteria: [
      createCriteria('Pronunciation of Letters (Huroof) / ادائیگی حروف', 20),
      createCriteria('Pronunciation of Vowel Marks (Harakaat) / ادائیگی حرکات', 20),
      createCriteria('Rules of Recitation (Application of Rules) / اطلاق تجوید', 20),
      createCriteria('Fluency / روانی', 20),
      createCriteria('Explanations / توضیحات', 20),
    ],
  };

  return { sections: [quranRecitationSection] };
};

export default function ReportCardTemplates() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicatingTemplate, setDuplicatingTemplate] = useState<ReportTemplate | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

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
  const { data: templates = [], isLoading, isFetched } = useQuery({
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

  // Auto-seed a demo template if none exist
  useEffect(() => {
    const seedDemoTemplate = async () => {
      if (!isFetched || isLoading || seedingDemo) return;
      if (templates.length > 0) return; // Already have templates
      if (!user?.id) return;

      setSeedingDemo(true);
      try {
        const { error } = await supabase
          .from('exam_templates')
          .insert({
            name: 'Nazrah Quran - Monthly',
            subject_id: null,
            tenure: 'monthly' as ExamTenure,
            description: "Standard monthly assessment for Nazrah Qur'an with 5 criteria. Total: 100 marks. Includes Urdu/Arabic terminology.",
            structure_json: createSampleTemplateStructure() as unknown as Database['public']['Tables']['exam_templates']['Insert']['structure_json'],
            created_by: user.id,
            is_active: true,
          });
        
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['report-card-templates'] });
          toast({ title: 'Demo Template Created', description: 'Nazrah Quran - Monthly template has been added.' });
        }
      } catch (e) {
        console.error('Failed to seed demo template:', e);
      } finally {
        setSeedingDemo(false);
      }
    };

    seedDemoTemplate();
  }, [isFetched, isLoading, templates.length, user?.id, seedingDemo]);

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

  // Duplicate template mutation
  const duplicateMutation = useMutation({
    mutationFn: async ({ template, newName }: { template: ReportTemplate; newName: string }) => {
      const { error } = await supabase
        .from('exam_templates')
        .insert({
          name: newName,
          subject_id: template.subject_id,
          tenure: template.tenure,
          description: template.description,
          structure_json: template.structure_json as unknown as Database['public']['Tables']['exam_templates']['Insert']['structure_json'],
          created_by: user?.id || null,
          is_active: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-card-templates'] });
      setDuplicateDialogOpen(false);
      setDuplicatingTemplate(null);
      setDuplicateName('');
      toast({ title: 'Success', description: 'Template duplicated successfully. You can now edit the copy.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const openDuplicateDialog = (template: ReportTemplate) => {
    // Generate a unique name like "Template Name (1)", checking for existing copies
    const baseName = template.name.replace(/\s*\(\d+\)$/, ''); // Remove existing (n) suffix
    const existingCopies = templates.filter(t => 
      t.name.startsWith(baseName) && t.name !== template.name
    );
    const nextNumber = existingCopies.length + 1;
    setDuplicateName(`${baseName} (${nextNumber})`);
    setDuplicatingTemplate(template);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicate = () => {
    if (duplicatingTemplate && duplicateName.trim()) {
      duplicateMutation.mutate({ template: duplicatingTemplate, newName: duplicateName.trim() });
    }
  };

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
      <div className="space-y-8">
        {/* Premium Page Header */}
        <div className="page-header-premium">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary-foreground">Report Card Templates</h1>
              <p className="text-primary-foreground/70 mt-1">
                Create flexible templates for academic and tarbiyah report cards
              </p>
            </div>
            <Button 
              onClick={() => setIsBuilderOpen(true)} 
              className="gap-2 bg-accent hover:bg-cyan-dark text-accent-foreground shadow-glow"
            >
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </div>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : templates.length === 0 ? (
          <Card className="card-premium border-0">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                <FileText className="h-10 w-10 text-accent" />
              </div>
              <p className="text-xl font-semibold text-foreground mb-2">No templates yet</p>
              <p className="text-sm text-muted-foreground mb-6">Create your first report card template to get started</p>
              <Button 
                onClick={() => setIsBuilderOpen(true)} 
                className="gap-2 bg-accent hover:bg-cyan-dark text-accent-foreground"
              >
                <Plus className="h-4 w-4" />
                Create Your First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              const stats = getStructureStats(template.structure_json);
              
              return (
                <Card 
                  key={template.id} 
                  className={`card-premium border-0 ${!template.is_active ? 'opacity-60' : ''}`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="section-header">
                        <CardTitle className="text-lg font-semibold">{template.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.subject?.name || 'General Template'}
                        </p>
                      </div>
                      <Badge 
                        className={`badge-pill ${template.is_active 
                          ? 'bg-accent/10 text-accent border-accent/20' 
                          : 'bg-muted text-muted-foreground'}`}
                        variant="outline"
                      >
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline" className="badge-pill capitalize border-border/50">
                        {template.tenure}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Layers className="h-4 w-4 text-accent" />
                        <span>{stats.sections} sections</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <ListChecks className="h-4 w-4 text-accent" />
                        <span>{stats.criteria} criteria</span>
                      </div>
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
                        className="flex-1 gap-2 border-border/50 hover:border-accent hover:text-accent"
                        onClick={() => openEdit(template)}
                      >
                        <Settings className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-border/50 hover:border-accent hover:text-accent"
                        onClick={() => openDuplicateDialog(template)}
                        disabled={duplicateMutation.isPending}
                        title="Duplicate template"
                      >
                        <Copy className="h-4 w-4" />
                        Duplicate
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
                        className="hover:bg-accent/10"
                      >
                        {template.is_active ? (
                          <ToggleRight className="h-5 w-5 text-accent" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
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

      {/* Duplicate Template Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Template</DialogTitle>
            <DialogDescription>
              Enter a name for the duplicated template.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="duplicate-name">Template Name</Label>
            <Input
              id="duplicate-name"
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="Enter template name"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDuplicateDialogOpen(false);
                setDuplicatingTemplate(null);
                setDuplicateName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={!duplicateName.trim() || duplicateMutation.isPending}
            >
              {duplicateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Duplicating...
                </>
              ) : (
                'Duplicate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
