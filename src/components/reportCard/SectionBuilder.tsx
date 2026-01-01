import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onMoveUp}
              disabled={isFirst}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onMoveDown}
              disabled={isLast}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Section {sectionIndex + 1}</Badge>
            </div>
            <Input
              placeholder="Section Title (e.g., Academic Subjects, Tarbiyah)"
              value={section.title}
              onChange={(e) => updateSectionTitle(e.target.value)}
              className="font-semibold text-lg"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Criteria List */}
          {section.criteria.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>No criteria added yet</p>
              <p className="text-sm">Add criteria to define what will be graded</p>
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
            className="w-full gap-2"
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
    <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg group">
      <div className="flex flex-col gap-1 pt-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onMoveUp}
          disabled={isFirst}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onMoveDown}
          disabled={isLast}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 grid gap-3 md:grid-cols-4">
        {/* Title */}
        <div className="md:col-span-2">
          <Input
            placeholder="Criteria Title (e.g., Pronunciation, Math)"
            value={criteria.title}
            onChange={(e) => onUpdate({ ...criteria, title: e.target.value })}
          />
        </div>

        {/* Type */}
        <Select
          value={criteria.type}
          onValueChange={(v) => handleTypeChange(v as CriteriaType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">marks</span>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSkillEditor(!showSkillEditor)}
            className={cn(showSkillEditor && 'ring-2 ring-primary')}
          >
            Edit Labels
          </Button>
        )}
      </div>

      {/* Visibility Toggle */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onUpdate({ ...criteria, isPublic: !criteria.isPublic })}
          title={criteria.isPublic ? 'Visible to students/parents' : 'Hidden from students/parents'}
        >
          {criteria.isPublic ? (
            <Eye className="h-4 w-4 text-primary" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Skill Labels Editor */}
      {criteria.type === 'skill' && showSkillEditor && (
        <div className="col-span-full mt-3 p-3 bg-background rounded-lg border">
          <Label className="text-sm font-medium mb-2 block">Skill Level Labels (Low to High)</Label>
          <div className="grid grid-cols-3 gap-2">
            {(criteria.skillLabels || DEFAULT_SKILL_LABELS).map((label, i) => (
              <Input
                key={i}
                value={label}
                onChange={(e) => updateSkillLabel(i, e.target.value)}
                placeholder={`Level ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
