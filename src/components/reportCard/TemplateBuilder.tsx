import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter 
} from '@/components/ui/sheet';
import { Plus, Loader2, FileText, Save, X, Layers, ListChecks, Award } from 'lucide-react';
import { SectionBuilder } from './SectionBuilder';
import {
  ReportSection,
  TemplateStructure,
  createEmptySection,
  calculateMaxScore,
} from '@/types/reportCard';
import type { Database } from '@/integrations/supabase/types';

type ExamTenure = Database['public']['Enums']['exam_tenure'];

interface Subject {
  id: string;
  name: string;
}

interface TemplateBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  onSave: (data: {
    name: string;
    subject_id: string | null;
    tenure: ExamTenure;
    description: string | null;
    structure_json: TemplateStructure;
  }) => void;
  isSaving: boolean;
  initialData?: {
    name: string;
    subject_id: string | null;
    tenure: ExamTenure;
    description: string | null;
    structure_json: TemplateStructure | null;
  };
}

export function TemplateBuilder({
  isOpen,
  onClose,
  subjects,
  onSave,
  isSaving,
  initialData,
}: TemplateBuilderProps) {
  const [formData, setFormData] = useState({
    name: '',
    subject_id: '',
    tenure: 'monthly' as ExamTenure,
    description: '',
  });

  const [structure, setStructure] = useState<TemplateStructure>({ sections: [] });

  // Reset state when initialData changes (editing vs creating) or sheet opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialData?.name || '',
        subject_id: initialData?.subject_id || '',
        tenure: initialData?.tenure || ('monthly' as ExamTenure),
        description: initialData?.description || '',
      });
      setStructure(initialData?.structure_json || { sections: [] });
    }
  }, [isOpen, initialData]);

  const addSection = () => {
    setStructure({
      sections: [...structure.sections, createEmptySection()],
    });
  };

  const updateSection = (index: number, section: ReportSection) => {
    const updated = [...structure.sections];
    updated[index] = section;
    setStructure({ sections: updated });
  };

  const deleteSection = (index: number) => {
    const updated = structure.sections.filter((_, i) => i !== index);
    setStructure({ sections: updated });
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= structure.sections.length) return;
    const updated = [...structure.sections];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setStructure({ sections: updated });
  };

  const handleSave = () => {
    if (!formData.name) return;
    
    onSave({
      name: formData.name,
      subject_id: formData.subject_id || null,
      tenure: formData.tenure,
      description: formData.description || null,
      structure_json: structure,
    });
  };

  const totalCriteria = structure.sections.reduce((sum, s) => sum + s.criteria.length, 0);
  const maxScore = calculateMaxScore(structure);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl p-0 border-0">
        <div className="flex flex-col h-full bg-background">
          {/* Premium Header */}
          <SheetHeader className="page-header-premium rounded-none px-6 py-5">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl flex items-center gap-2 text-primary-foreground">
                  <FileText className="h-5 w-5 text-accent" />
                  {initialData ? 'Edit Template' : 'Create Report Card Template'}
                </SheetTitle>
                <SheetDescription className="text-primary-foreground/70">
                  Build a flexible template with sections and grading criteria
                </SheetDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="py-6 space-y-6">
              {/* Basic Info Card */}
              <Card className="card-premium border-0">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base section-header">Template Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">Template Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Monthly Report Card - Nazrah"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="input-premium border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm font-medium">Subject</Label>
                      <Select 
                        value={formData.subject_id} 
                        onValueChange={(v) => setFormData({ ...formData, subject_id: v })}
                      >
                        <SelectTrigger className="border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20">
                          <SelectValue placeholder="Select subject (optional)" />
                        </SelectTrigger>
                        <SelectContent className="border-0 shadow-card">
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tenure" className="text-sm font-medium">Frequency *</Label>
                      <Select 
                        value={formData.tenure} 
                        onValueChange={(v: ExamTenure) => setFormData({ ...formData, tenure: v })}
                      >
                        <SelectTrigger className="border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-0 shadow-card">
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-medium">Internal Notes</Label>
                      <Input
                        id="description"
                        placeholder="Optional notes for admins..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="input-premium border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator className="bg-border/50" />

              {/* Sections Builder */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="section-header">
                    <h3 className="text-lg font-semibold">Report Card Structure</h3>
                    <p className="text-sm text-muted-foreground">
                      Add sections and criteria to define your report card layout
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="badge-pill border-border/50 gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-accent" />
                      {structure.sections.length} sections
                    </Badge>
                    <Badge variant="outline" className="badge-pill border-border/50 gap-1.5">
                      <ListChecks className="h-3.5 w-3.5 text-accent" />
                      {totalCriteria} criteria
                    </Badge>
                    <Badge className="badge-pill bg-accent/10 text-accent border-accent/20 gap-1.5">
                      <Award className="h-3.5 w-3.5" />
                      {maxScore} max score
                    </Badge>
                  </div>
                </div>

                <div className="space-y-6">
                  {structure.sections.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-border/50 rounded-xl bg-card">
                      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                        <FileText className="h-8 w-8 text-accent" />
                      </div>
                      <p className="text-foreground font-medium mb-2">No sections added yet</p>
                      <p className="text-sm text-muted-foreground mb-6">
                        Start by adding a section like "Academic" or "Tarbiyah"
                      </p>
                      <Button 
                        onClick={addSection} 
                        className="gap-2 bg-accent hover:bg-cyan-dark text-accent-foreground"
                      >
                        <Plus className="h-4 w-4" />
                        Add First Section
                      </Button>
                    </div>
                  ) : (
                    <>
                      {structure.sections.map((section, index) => (
                        <SectionBuilder
                          key={section.id}
                          section={section}
                          sectionIndex={index}
                          onUpdate={(updated) => updateSection(index, updated)}
                          onDelete={() => deleteSection(index)}
                          onMoveUp={() => moveSection(index, index - 1)}
                          onMoveDown={() => moveSection(index, index + 1)}
                          isFirst={index === 0}
                          isLast={index === structure.sections.length - 1}
                        />
                      ))}
                      
                      <Button
                        variant="outline"
                        onClick={addSection}
                        className="w-full gap-2 border-dashed border-2 border-border/50 hover:border-accent hover:text-accent hover:bg-accent/5 py-6"
                      >
                        <Plus className="h-4 w-4" />
                        Add Section
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <SheetFooter className="px-6 py-4 border-t border-border/50 bg-card">
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="border-border/50 hover:border-accent hover:text-accent"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!formData.name || isSaving}
                className="gap-2 bg-accent hover:bg-cyan-dark text-accent-foreground shadow-glow"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {initialData ? 'Update Template' : 'Create Template'}
              </Button>
            </div>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
