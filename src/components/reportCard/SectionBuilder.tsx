import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  ChevronDown, 
  ChevronUp,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  Section, 
  Criteria, 
  CriteriaType, 
  createEmptyCriteria,
  DEFAULT_SKILL_LABELS 
} from '@/types/reportCard';
import { cn } from '@/lib/utils';

interface SectionBuilderProps {
  section: Section;
  sectionIndex: number;
  onUpdate: (section: Section) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function SectionBuilder({
  section,
  sectionIndex,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SectionBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const updateSectionTitle = (title: string) => {
    onUpdate({ ...section, title });
  };

  const addCriteria = () => {
    const newCriteria = createEmptyCriteria();
    onUpdate({ ...section, criteria: [...section.criteria, newCriteria] });
  };

  const updateCriteria = (index: number, criteria: Criteria) => {
    const updated = [...section.criteria];
    updated[index] = criteria;
    onUpdate({ ...section, criteria: updated });
  };

  const deleteCriteria = (index: number) => {
    const updated = section.criteria.filter((_, i) => i !== index);
    onUpdate({ ...section, criteria: updated });
  };

  const moveCriteria = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= section.criteria.length) return;
    const updated = [...section.criteria];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onUpdate({ ...section, criteria: updated });
  };

  return (
    <Card className="card-premium border-0 overflow-hidden">
      {/* Section Header with Cyan Accent Strip */}
      <CardHeader className="pb-4 bg-gradient-to-r from-accent/5 to-transparent border-l-4 border-l-accent">
        <div className="flex items-center gap-4">
          {/* Reorder Controls */}
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-accent/10 hover:text-accent"
              onClick={onMoveUp}
              disabled={isFirst}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-accent/10 hover:text-accent"
              onClick={onMoveDown}
              disabled={isLast}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1">
            <Badge className="badge-pill bg-accent/10 text-accent border-accent/20 mb-3">
              Section {sectionIndex + 1}
            </Badge>
            <Input
              placeholder="Section Title (e.g., Academic Subjects, Tarbiyah)"
              value={section.title}
              onChange={(e) => updateSectionTitle(e.target.value)}
              className="font-semibold text-lg border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20 bg-card"
            />
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="hover:bg-accent/10 hover:text-accent"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4 pt-2">
          {/* Criteria List */}
          {section.criteria.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border/50 rounded-xl bg-muted/30">
              <p className="text-muted-foreground font-medium">No criteria added yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add criteria to define what will be graded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {section.criteria.map((criteria, index) => (
                <CriteriaRow
                  key={criteria.id}
                  criteria={criteria}
                  index={index}
                  onUpdate={(updated) => updateCriteria(index, updated)}
                  onDelete={() => deleteCriteria(index)}
                  onMoveUp={() => moveCriteria(index, index - 1)}
                  onMoveDown={() => moveCriteria(index, index + 1)}
                  isFirst={index === 0}
                  isLast={index === section.criteria.length - 1}
                />
              ))}
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={addCriteria}
            className="w-full gap-2 border-dashed border-border/50 hover:border-accent hover:text-accent hover:bg-accent/5"
          >
            <Plus className="h-4 w-4" />
            Add Criteria
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

interface CriteriaRowProps {
  criteria: Criteria;
  index: number;
  onUpdate: (criteria: Criteria) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

function CriteriaRow({
  criteria,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: CriteriaRowProps) {
  const [showSkillEditor, setShowSkillEditor] = useState(false);

  const handleTypeChange = (type: CriteriaType) => {
    if (type === 'skill') {
      onUpdate({
        ...criteria,
        type,
        maxMarks: undefined,
        skillLabels: DEFAULT_SKILL_LABELS,
      });
    } else {
      onUpdate({
        ...criteria,
        type,
        maxMarks: 10,
        skillLabels: undefined,
      });
    }
  };

  const updateSkillLabel = (index: number, label: string) => {
    const labels = [...(criteria.skillLabels || DEFAULT_SKILL_LABELS)];
    labels[index] = label;
    onUpdate({ ...criteria, skillLabels: labels });
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-card rounded-xl border border-border/50 shadow-sm transition-all duration-200 hover:shadow-card hover:border-accent/30 group">
      <div className="flex items-start gap-3">
        {/* Reorder Controls */}
        <div className="flex flex-col items-center gap-0.5 pt-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent/10 hover:text-accent"
            onClick={onMoveUp}
            disabled={isFirst}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-accent/10 hover:text-accent"
            onClick={onMoveDown}
            disabled={isLast}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex-1 grid gap-4 md:grid-cols-4">
          {/* Title */}
          <div className="md:col-span-2">
            <Input
              placeholder="Criteria Title (e.g., Pronunciation, Math)"
              value={criteria.title}
              onChange={(e) => onUpdate({ ...criteria, title: e.target.value })}
              className="border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {/* Type */}
          <Select
            value={criteria.type}
            onValueChange={(v) => handleTypeChange(v as CriteriaType)}
          >
            <SelectTrigger className="border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-0 shadow-card">
              <SelectItem value="numeric">Numeric Score</SelectItem>
              <SelectItem value="skill">Skill Level</SelectItem>
            </SelectContent>
          </Select>

          {/* Max Marks or Skill Editor Toggle */}
          {criteria.type === 'numeric' ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Max"
                value={criteria.maxMarks || ''}
                onChange={(e) => onUpdate({ ...criteria, maxMarks: parseInt(e.target.value) || 10 })}
                className="border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">marks</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSkillEditor(!showSkillEditor)}
              className={cn(
                "border-border/50 hover:border-accent hover:text-accent",
                showSkillEditor && 'border-accent text-accent bg-accent/5'
              )}
            >
              Edit Labels
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onUpdate({ ...criteria, isPublic: !criteria.isPublic })}
            title={criteria.isPublic ? 'Visible to students/parents' : 'Hidden from students/parents'}
            className="hover:bg-accent/10"
          >
            {criteria.isPublic ? (
              <Eye className="h-4 w-4 text-accent" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Skill Labels Editor */}
      {criteria.type === 'skill' && showSkillEditor && (
        <div className="p-4 bg-muted/30 rounded-lg border border-border/50 ml-9">
          <Label className="text-sm font-medium mb-3 block text-muted-foreground">
            Skill Level Labels (Low to High)
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {(criteria.skillLabels || DEFAULT_SKILL_LABELS).map((label, i) => (
              <Input
                key={i}
                value={label}
                onChange={(e) => updateSkillLabel(i, e.target.value)}
                placeholder={`Level ${i + 1}`}
                className="border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
