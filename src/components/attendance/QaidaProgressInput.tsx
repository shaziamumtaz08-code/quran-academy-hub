import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';
import { useQaidaReference, baabsForPage, unitLabel } from '@/hooks/useQaidaProgress';

interface QaidaProgressInputProps {
  lessonNumber: string;
  onLessonNumberChange: (value: string) => void;
  pageNumber: string;
  onPageNumberChange: (value: string) => void;
  // Noorani Qaida baab/unit tracking (attendance mode)
  qaidaPageId?: string;
  onQaidaPageIdChange?: (value: string) => void;
  unitFrom?: string;
  onUnitFromChange?: (value: string) => void;
  unitTo?: string;
  onUnitToChange?: (value: string) => void;
  // Optional range inputs for planning mode
  lessonNumberTo?: string;
  onLessonNumberToChange?: (value: string) => void;
  pageNumberTo?: string;
  onPageNumberToChange?: (value: string) => void;
  isPlanning?: boolean;
}

export function QaidaProgressInput({
  lessonNumber,
  onLessonNumberChange,
  pageNumber,
  onPageNumberChange,
  qaidaPageId = '',
  onQaidaPageIdChange,
  unitFrom = '',
  onUnitFromChange,
  unitTo = '',
  onUnitToChange,
  lessonNumberTo,
  onLessonNumberToChange,
  pageNumberTo,
  onPageNumberToChange,
  isPlanning = false,
}: QaidaProgressInputProps) {
  const { data: ref } = useQaidaReference();

  // One selectable option per (page, baab) pair — transition pages appear twice.
  const options = useMemo(() => {
    if (!ref) return [] as { id: string; page: number; baabNumber: number; label: string; totalUnits: number; unitType: string }[];
    return ref.pages
      .filter(p => p.page_number >= 2 && p.page_number <= 31)
      .flatMap(p => {
        const covering = baabsForPage(ref.baabs, p.page_number);
        return covering.map(b => ({
          id: `${p.id}::${b.baab_number}`,
          pageId: p.id,
          page: p.page_number,
          baabNumber: b.baab_number,
          totalUnits: b.total_units,
          unitType: b.unit_type,
          label: `Page ${p.page_number} — Baab ${b.baab_number}: ${b.name_urdu} / ${b.name_english}`,
        }));
      });
  }, [ref]);

  const selected = options.find(o => (o as any).pageId === qaidaPageId && String((o as any).baabNumber) === (lessonNumber || String((o as any).baabNumber)))
    || options.find(o => (o as any).pageId === qaidaPageId);
  const uLabel = unitLabel(selected?.unitType);
  const max = selected?.totalUnits;

  if (isPlanning && onLessonNumberToChange && onPageNumberToChange) {
    return (
      <div className="bg-card rounded-xl p-5 border border-border shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-cyan-400" />
          <h3 className="font-semibold text-base text-cyan-300">Qaida Progress (Range)</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-200">From</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-slate-400">Lesson No.</Label>
                <Input type="number" min="1" placeholder="e.g., 1" value={lessonNumber}
                  onChange={(e) => onLessonNumberChange(e.target.value)}
                  className="bg-background text-foreground placeholder:text-muted-foreground" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Page No.</Label>
                <Input type="number" min="1" placeholder="e.g., 5" value={pageNumber}
                  onChange={(e) => onPageNumberChange(e.target.value)}
                  className="bg-background text-foreground placeholder:text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-200">To</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-slate-400">Lesson No.</Label>
                <Input type="number" min="1" placeholder="e.g., 5" value={lessonNumberTo}
                  onChange={(e) => onLessonNumberToChange(e.target.value)}
                  className="bg-background text-foreground placeholder:text-muted-foreground" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Page No.</Label>
                <Input type="number" min="1" placeholder="e.g., 15" value={pageNumberTo}
                  onChange={(e) => onPageNumberToChange(e.target.value)}
                  className="bg-background text-foreground placeholder:text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Attendance mode — Noorani Qaida page/baab + unit range
  const invalidRange =
    unitFrom && unitTo && Number(unitFrom) > Number(unitTo);
  const overMax = max && unitTo && Number(unitTo) > max;

  return (
    <div className="bg-card rounded-xl p-5 border border-border shadow-lg space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-cyan-400" />
        <h3 className="font-semibold text-base text-cyan-300">Noorani Qaida Progress</h3>
        {selected && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            Baab {selected.baabNumber} · {selected.totalUnits} {uLabel.toLowerCase()}s
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Page / Baab <span className="text-destructive">*</span></Label>
        <Select
          value={selected ? selected.id : ''}
          onValueChange={(v) => {
            const opt = options.find(o => o.id === v) as any;
            if (!opt) return;
            onQaidaPageIdChange?.(opt.pageId);
            onPageNumberChange(String(opt.page));
            onLessonNumberChange(String(opt.baabNumber));
          }}
        >
          <SelectTrigger><SelectValue placeholder="Select page and baab" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {options.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">{uLabel} from</Label>
          <Input type="number" min="1" max={max} placeholder="e.g., 12" value={unitFrom}
            onChange={(e) => onUnitFromChange?.(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">{uLabel} to <span className="text-destructive">*</span></Label>
          <Input type="number" min="1" max={max} placeholder="e.g., 24" value={unitTo}
            onChange={(e) => onUnitToChange?.(e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {uLabel} numbers run continuously through the whole baab (they don't reset per page)
        {max ? ` — 1 to ${max} for this baab.` : '.'}
      </p>
      {invalidRange && <p className="text-xs text-destructive">"{uLabel} to" must be greater than or equal to "{uLabel} from".</p>}
      {overMax && <p className="text-xs text-destructive">This baab only has {max} {uLabel.toLowerCase()}s.</p>}
    </div>
  );
}
