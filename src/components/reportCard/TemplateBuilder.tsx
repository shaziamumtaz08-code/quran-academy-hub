import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Loader2, FileText, Save, X } from 'lucide-react';
import { SectionBuilder } from './SectionBuilder';
import { 
  Section, 
  TemplateStructure, 
  createEmptySection,
  calculateMaxScore 
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
    name: initialData?.name || '',
    subject_id: initialData?.subject_id || '',
    tenure: initialData?.tenure || 'monthly' as ExamTenure,
    description: initialData?.description || '',
  });

  const [structure, setStructure] = useState<TemplateStructure>(
    initialData?.structure_json || { sections: [] }
  );

  const addSection = () => {
    setStructure({
      sections: [...structure.sections, createEmptySection()],
    });
  };

  const updateSection = (index: number, section: Section) => {
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
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {initialData ? 'Edit Template' : 'Create Report Card Template'}
                </SheetTitle>
                <SheetDescription>
                  Build a flexible template with sections and grading criteria
                </SheetDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="py-6 space-y-6">
              {/* Basic Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Template Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Template Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Monthly Report Card - Nazrah"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Select 
                        value={formData.subject_id} 
                        onValueChange={(v) => setFormData({ ...formData, subject_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tenure">Frequency *</Label>
                      <Select 
                        value={formData.tenure} 
                        onValueChange={(v: ExamTenure) => setFormData({ ...formData, tenure: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Internal Notes</Label>
                      <Input
                        id="description"
                        placeholder="Optional notes for admins..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Sections Builder */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Report Card Structure</h3>
                    <p className="text-sm text-muted-foreground">
                      Add sections and criteria to define your report card layout
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{structure.sections.length} sections</Badge>
                    <Badge variant="outline">{totalCriteria} criteria</Badge>
                    <Badge variant="secondary">{maxScore} max score</Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  {structure.sections.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground mb-2">No sections added yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Start by adding a section like "Academic" or "Tarbiyah"
                      </p>
                      <Button onClick={addSection} className="gap-2">
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
                        className="w-full gap-2"
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

          <SheetFooter className="px-6 py-4 border-t">
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!formData.name || isSaving}
                className="gap-2"
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
