import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Award } from 'lucide-react';
import {
  ReportSection,
  ReportCriteriaRow,
  createEmptyCriteria,
  calculateSectionMaxScore,
} from '@/types/reportCard';

interface SectionBuilderProps {
  section: ReportSection;
  sectionIndex: number;
  onUpdate: (section: ReportSection) => void;
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

  const updateSectionTitle = (title: string) => onUpdate({ ...section, title });
  const toggleSubtotal = (showSubtotal: boolean) => onUpdate({ ...section, showSubtotal });

  const addCriteria = () => {
    const newCriteria = createEmptyCriteria();
    onUpdate({ ...section, criteria: [...section.criteria, newCriteria] });
  };

  const updateCriteria = (index: number, criteria: ReportCriteriaRow) => {
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

  const sectionMaxScore = calculateSectionMaxScore(section);

  return (
    <Card className="card-premium border-0 overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-r from-accent/5 to-transparent border-l-4 border-l-accent">
        <div className="flex items-center gap-4">
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
              placeholder="Section Title (e.g., Performance, Discipline)"
              value={section.title}
              onChange={(e) => updateSectionTitle(e.target.value)}
              className="font-semibold text-lg border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20 bg-card"
            />

            <div className="flex items-center gap-2 mt-2">
              <Switch
                id={`subtotal-${section.id}`}
                checked={section.showSubtotal !== false}
                onCheckedChange={toggleSubtotal}
              />
              <Label
                htmlFor={`subtotal-${section.id}`}
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Show section subtotal
              </Label>
              {section.showSubtotal !== false && sectionMaxScore > 0 && (
                <Badge variant="outline" className="ml-2 text-xs">
                  <Award className="h-3 w-3 mr-1" />
                  Max: {sectionMaxScore}
                </Badge>
              )}
            </div>
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
          {section.criteria.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border/50 rounded-xl bg-muted/30">
              <p className="text-muted-foreground font-medium">No criteria added yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Define criteria with <strong>Max Marks</strong> here. Teachers will enter <strong>Obtained Marks</strong> when generating reports.
              </p>
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
            Add Criteria Row
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

interface CriteriaRowProps {
  criteria: ReportCriteriaRow;
  index: number;
  onUpdate: (criteria: ReportCriteriaRow) => void;
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
  return (
    <div className="flex flex-col gap-3 p-4 bg-card rounded-xl border border-border/50 shadow-sm transition-all duration-200 hover:shadow-card hover:border-accent/30 group">
      <div className="flex items-start gap-3">
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

        <div className="flex-1 grid gap-4 md:grid-cols-5">
          <div className="md:col-span-3">
            <Label className="text-xs text-muted-foreground mb-1 block" htmlFor={`${criteria.id}-name`}>
              Criteria Name
            </Label>
            <Input
              id={`${criteria.id}-name`}
              placeholder={`e.g., Tajweed, Fluency, Understanding`}
              value={criteria.criteria_name}
              onChange={(e) => onUpdate({ ...criteria, criteria_name: e.target.value })}
              className="border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block" htmlFor={`${criteria.id}-max`}>
              Max Marks
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${criteria.id}-max`}
                type="number"
                min={1}
                value={criteria.max_marks ?? ''}
                onChange={(e) =>
                  onUpdate({
                    ...criteria,
                    max_marks: Math.max(1, parseInt(e.target.value || '0', 10) || 1),
                  })
                }
                className="border-border/50 focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="10"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">pts</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 pt-1">
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
    </div>
  );
}