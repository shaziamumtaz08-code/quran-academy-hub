import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Star, Award } from 'lucide-react';
import { 
  TemplateStructure, 
  CriteriaValue, 
  DEFAULT_SKILL_LABELS,
  DEFAULT_STAR_MAX,
  DEFAULT_GRADE_LABELS,
  calculateSectionMaxScore
} from '@/types/reportCard';
import { cn } from '@/lib/utils';

interface ReportCardFormProps {
  structure: TemplateStructure;
  values: CriteriaValue[];
  onValueChange: (criteriaId: string, sectionId: string, value: number | string) => void;
  readOnly?: boolean;
}

export function ReportCardForm({
  structure,
  values,
  onValueChange,
  readOnly = false,
}: ReportCardFormProps) {
  const getValue = (criteriaId: string): CriteriaValue | undefined => {
    return values.find(v => v.criteriaId === criteriaId);
  };

  // Calculate section totals
  const getSectionTotal = (sectionId: string) => {
    let total = 0;
    const section = structure.sections.find(s => s.id === sectionId);
    if (!section) return 0;
    for (const criteria of section.criteria) {
      const val = getValue(criteria.id);
      total += val?.numericValue || 0;
    }
    return total;
  };

  // Calculate totals
  const { totalScore, maxScore, percentage } = useMemo(() => {
    let total = 0;
    let max = 0;

    for (const section of structure.sections) {
      for (const criteria of section.criteria) {
        const val = getValue(criteria.id);
        if (criteria.type === 'numeric' && criteria.maxMarks) {
          max += criteria.maxMarks;
          total += val?.numericValue || 0;
        } else if (criteria.type === 'skill') {
          max += 3; // Skill levels are 1-3
          total += val?.numericValue || 0;
        } else if (criteria.type === 'star') {
          max += criteria.starMax || DEFAULT_STAR_MAX;
          total += val?.numericValue || 0;
        } else if (criteria.type === 'grade') {
          max += (criteria.gradeLabels?.length || DEFAULT_GRADE_LABELS.length) - 1;
          total += val?.numericValue || 0;
        }
      }
    }

    return {
      totalScore: total,
      maxScore: max,
      percentage: max > 0 ? Math.round((total / max) * 100) : 0,
    };
  }, [structure, values]);

  const getGrade = (pct: number): { label: string; variant: 'default' | 'secondary' | 'destructive' } => {
    if (pct >= 90) return { label: 'Excellent', variant: 'default' };
    if (pct >= 75) return { label: 'Good', variant: 'default' };
    if (pct >= 60) return { label: 'Satisfactory', variant: 'secondary' };
    if (pct >= 40) return { label: 'Needs Work', variant: 'secondary' };
    return { label: 'Needs Improvement', variant: 'destructive' };
  };

  const grade = getGrade(percentage);

  if (structure.sections.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>This template has no sections defined.</p>
          <p className="text-sm">Please edit the template to add sections and criteria.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sections */}
      {structure.sections.map((section) => {
        const sectionMax = calculateSectionMaxScore(section);
        const sectionTotal = getSectionTotal(section.id);

        return (
          <Card key={section.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{section.title || 'Untitled Section'}</CardTitle>
                {section.showSubtotal !== false && sectionMax > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Award className="h-3 w-3" />
                    {sectionTotal} / {sectionMax}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {section.criteria.map((criteria) => {
                  const currentValue = getValue(criteria.id);
                  const skillLabels = criteria.skillLabels || DEFAULT_SKILL_LABELS;
                  const gradeLabels = criteria.gradeLabels || DEFAULT_GRADE_LABELS;
                  const starMax = criteria.starMax || DEFAULT_STAR_MAX;

                  return (
                    <div key={criteria.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Label className="font-medium">{criteria.title || 'Untitled Criteria'}</Label>
                            {!criteria.isPublic && (
                              <Badge variant="secondary" className="text-xs">Internal</Badge>
                            )}
                          </div>

                          {criteria.type === 'numeric' ? (
                            <div className="flex items-center gap-3">
                              <Input
                                type="number"
                                min={0}
                                max={criteria.maxMarks}
                                value={currentValue?.numericValue ?? ''}
                                onChange={(e) => {
                                  let val = parseInt(e.target.value) || 0;
                                  if (val > (criteria.maxMarks || 100)) val = criteria.maxMarks || 100;
                                  if (val < 0) val = 0;
                                  onValueChange(criteria.id, section.id, val);
                                }}
                                className="w-24"
                                disabled={readOnly}
                              />
                              <span className="text-muted-foreground">/ {criteria.maxMarks}</span>
                              {currentValue?.numericValue !== undefined && criteria.maxMarks && (
                                <Badge variant="outline">
                                  {Math.round((currentValue.numericValue / criteria.maxMarks) * 100)}%
                                </Badge>
                              )}
                            </div>
                          ) : criteria.type === 'star' ? (
                            <div className="flex items-center gap-1">
                              {Array.from({ length: starMax }, (_, i) => {
                                const starValue = i + 1;
                                const isFilled = (currentValue?.numericValue || 0) >= starValue;
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => !readOnly && onValueChange(criteria.id, section.id, starValue)}
                                    disabled={readOnly}
                                    className={cn(
                                      "p-0.5 transition-colors",
                                      !readOnly && "hover:scale-110 cursor-pointer"
                                    )}
                                  >
                                    <Star
                                      className={cn(
                                        "h-6 w-6 transition-colors",
                                        isFilled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
                                      )}
                                    />
                                  </button>
                                );
                              })}
                              <span className="ml-2 text-sm text-muted-foreground">
                                {currentValue?.numericValue || 0} / {starMax}
                              </span>
                            </div>
                          ) : criteria.type === 'grade' ? (
                            <RadioGroup
                              value={currentValue?.value?.toString() || ''}
                              onValueChange={(val) => onValueChange(criteria.id, section.id, val)}
                              className="flex flex-wrap gap-2"
                              disabled={readOnly}
                            >
                              {gradeLabels.map((label, idx) => (
                                <div key={idx} className="flex items-center">
                                  <RadioGroupItem 
                                    value={label} 
                                    id={`${criteria.id}-grade-${idx}`}
                                    disabled={readOnly}
                                    className="sr-only"
                                  />
                                  <Label 
                                    htmlFor={`${criteria.id}-grade-${idx}`}
                                    className={cn(
                                      "px-3 py-1.5 rounded-full border cursor-pointer transition-colors text-sm font-medium",
                                      currentValue?.value === label 
                                        ? "bg-accent text-accent-foreground border-accent" 
                                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                                    )}
                                  >
                                    {label}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          ) : (
                            <RadioGroup
                              value={currentValue?.value?.toString() || ''}
                              onValueChange={(val) => onValueChange(criteria.id, section.id, val)}
                              className="flex flex-wrap gap-4"
                              disabled={readOnly}
                            >
                              {skillLabels.map((label, idx) => (
                                <div key={idx} className="flex items-center space-x-2">
                                  <RadioGroupItem 
                                    value={label} 
                                    id={`${criteria.id}-${idx}`}
                                    disabled={readOnly}
                                  />
                                  <Label 
                                    htmlFor={`${criteria.id}-${idx}`}
                                    className={cn(
                                      "cursor-pointer",
                                      currentValue?.value === label && "font-semibold text-primary"
                                    )}
                                  >
                                    {label}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {section.criteria.length === 0 && (
                  <p className="text-center py-4 text-muted-foreground">
                    No criteria in this section
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Grand Total Footer */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Grand Total</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-primary">{totalScore}</span>
                <span className="text-xl text-muted-foreground">/ {maxScore}</span>
              </div>
            </div>
            
            <Separator orientation="vertical" className="h-12 hidden sm:block" />
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Percentage</p>
              <span className="text-3xl font-bold">{percentage}%</span>
            </div>
            
            <Separator orientation="vertical" className="h-12 hidden sm:block" />
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Overall Grade</p>
              <Badge variant={grade.variant} className="text-lg px-4 py-1">
                {grade.label}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
