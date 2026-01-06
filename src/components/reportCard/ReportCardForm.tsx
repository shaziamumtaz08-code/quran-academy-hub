import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Award } from 'lucide-react';
import { TemplateStructure, CriteriaValue, calculateSectionMaxScore } from '@/types/reportCard';

interface ReportCardFormProps {
  structure: TemplateStructure;
  values: CriteriaValue[];
  onEntryChange: (
    criteriaId: string,
    sectionId: string,
    patch: Partial<Pick<CriteriaValue, 'obtained_marks' | 'remarks'>>
  ) => void;
  readOnly?: boolean;
  showRowPercentage?: boolean;
}

export function ReportCardForm({
  structure,
  values,
  onEntryChange,
  readOnly = false,
  showRowPercentage = true,
}: ReportCardFormProps) {
  const getEntry = (criteriaId: string): CriteriaValue | undefined => {
    return values.find(v => v.criteriaId === criteriaId);
  };

  const getSectionTotal = (sectionId: string) => {
    const section = structure.sections.find(s => s.id === sectionId);
    if (!section) return 0;
    return section.criteria.reduce((sum, c) => {
      const entry = getEntry(c.id);
      return sum + (entry?.obtained_marks ?? 0);
    }, 0);
  };

  const { totalObtained, totalMax, percentage } = useMemo(() => {
    const max = structure.sections.reduce((sum, s) => sum + calculateSectionMaxScore(s), 0);
    const obtained = structure.sections.reduce((sum, s) => sum + getSectionTotal(s.id), 0);
    return {
      totalObtained: obtained,
      totalMax: max,
      percentage: max > 0 ? Math.round((obtained / max) * 100) : 0,
    };
  }, [structure, values]);

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
      {structure.sections.map((section) => {
        const sectionMax = calculateSectionMaxScore(section);
        const sectionObtained = getSectionTotal(section.id);

        return (
          <Card key={section.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{section.title || 'Untitled Section'}</CardTitle>
                {section.showSubtotal !== false && sectionMax > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <Award className="h-3 w-3" />
                    {sectionObtained} / {sectionMax}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {section.criteria.map((criteria) => {
                  const entry = getEntry(criteria.id);
                  const obtained = entry?.obtained_marks;
                  const max = criteria.max_marks;
                  const rowPct = obtained !== null && max > 0 ? Math.round((obtained / max) * 100) : null;

                  return (
                    <div key={criteria.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <Label className="font-medium">{criteria.criteria_name || 'Untitled Criteria'}</Label>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={max}
                                  value={obtained ?? ''}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === '') {
                                      onEntryChange(criteria.id, section.id, { obtained_marks: null });
                                      return;
                                    }
                                    let next = Number(raw);
                                    if (Number.isNaN(next)) next = 0;
                                    next = Math.max(0, Math.min(max, next));
                                    onEntryChange(criteria.id, section.id, { obtained_marks: next });
                                  }}
                                  className="w-28"
                                  disabled={readOnly}
                                  aria-label={`Obtained marks for ${criteria.criteria_name}`}
                                />
                                <span className="text-muted-foreground">/ {max}</span>
                              </div>
                              {showRowPercentage && rowPct !== null && (
                                <Badge variant="outline">{rowPct}%</Badge>
                              )}
                            </div>
                          </div>

                          <Textarea
                            placeholder="Optional teacher remarks for this criteria..."
                            value={entry?.remarks ?? ''}
                            onChange={(e) => onEntryChange(criteria.id, section.id, { remarks: e.target.value })}
                            disabled={readOnly}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {section.criteria.length === 0 && (
                  <p className="text-center py-4 text-muted-foreground">No criteria in this section</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Grand Total</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-primary">{totalObtained}</span>
                <span className="text-xl text-muted-foreground">/ {totalMax}</span>
              </div>
            </div>

            <Separator orientation="vertical" className="h-12 hidden sm:block" />

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Percentage</p>
              <span className="text-3xl font-bold">{percentage}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}