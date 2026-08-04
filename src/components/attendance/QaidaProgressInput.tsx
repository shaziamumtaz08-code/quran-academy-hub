import React, { useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';
import { useQaidaReference, useQaidaWords, unitLabel } from '@/hooks/useQaidaProgress';

interface QaidaProgressInputProps {
  lessonNumber: string;
  onLessonNumberChange: (value: string) => void;
  pageNumber: string;
  onPageNumberChange: (value: string) => void;
  // Noorani Qaida baab/unit tracking (attendance mode)
  qaidaBaabId?: string;
  onQaidaBaabIdChange?: (value: string) => void;
  qaidaPageId?: string;
  onQaidaPageIdChange?: (value: string) => void;
  wordFromId?: string;
  onWordFromIdChange?: (value: string) => void;
  wordToId?: string;
  onWordToIdChange?: (value: string) => void;
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
  qaidaBaabId = '',
  onQaidaBaabIdChange,
  qaidaPageId = '',
  onQaidaPageIdChange,
  wordFromId = '',
  onWordFromIdChange,
  wordToId = '',
  onWordToIdChange,
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
  const baabs = ref?.baabs || [];
  const selectedBaab = baabs.find(b => b.id === qaidaBaabId) || null;
  const isWordMode = selectedBaab?.picker_mode === 'word_dropdown';

  const { data: words } = useQaidaWords(isWordMode ? qaidaBaabId : null);
  const wordList = words || [];
  const hasWordData = isWordMode && wordList.length > 0;

  // Baabs 1 & 3 are a single short page — flat list, no line grouping.
  const flatWordList = selectedBaab
    ? [1, 3].includes(selectedBaab.baab_number)
    : false;

  const lines = useMemo(() => {
    const set = new Set(wordList.map(w => w.line_number));
    return [...set].sort((a, b) => a - b);
  }, [wordList]);

  const ordinal = useMemo(() => {
    const m = new Map<string, number>();
    wordList.forEach((w, i) => m.set(w.id, i + 1));
    return m;
  }, [wordList]);

  const selectedLine = useMemo(() => {
    const w = wordList.find(x => x.id === (wordFromId || wordToId));
    return w?.line_number ?? null;
  }, [wordList, wordFromId, wordToId]);

  const lineWords = useMemo(
    () => (flatWordList ? wordList : wordList.filter(w => w.line_number === selectedLine)),
    [wordList, selectedLine, flatWordList],
  );

  // Keep the numeric unit range in sync so all progress maths stays uniform.
  useEffect(() => {
    if (!hasWordData) return;
    const from = wordFromId ? ordinal.get(wordFromId) : undefined;
    const to = wordToId ? ordinal.get(wordToId) : undefined;
    onUnitFromChange?.(from ? String(from) : '');
    onUnitToChange?.(to ? String(to) : '');
  }, [hasWordData, wordFromId, wordToId, ordinal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPlanning && onLessonNumberToChange && onPageNumberToChange) {
    return (
      <div className="bg-card rounded-xl p-5 border border-border shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base text-primary">Qaida Progress (Range)</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">From</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Lesson No.</Label>
                <Input type="number" min="1" placeholder="e.g., 1" value={lessonNumber}
                  onChange={(e) => onLessonNumberChange(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Page No.</Label>
                <Input type="number" min="1" placeholder="e.g., 5" value={pageNumber}
                  onChange={(e) => onPageNumberChange(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">To</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Lesson No.</Label>
                <Input type="number" min="1" placeholder="e.g., 5" value={lessonNumberTo}
                  onChange={(e) => onLessonNumberToChange(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Page No.</Label>
                <Input type="number" min="1" placeholder="e.g., 15" value={pageNumberTo}
                  onChange={(e) => onPageNumberToChange(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const uLabel = unitLabel(selectedBaab?.unit_label);
  const max = selectedBaab?.total_units;
  const invalidRange = unitFrom && unitTo && Number(unitFrom) > Number(unitTo);
  const overMax = max && unitTo && Number(unitTo) > max;

  return (
    <div className="bg-card rounded-xl p-5 border border-border shadow-lg space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-base text-primary">Noorani Qaida Progress</h3>
        {selectedBaab && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            Pages {selectedBaab.start_page}–{selectedBaab.end_page} · {selectedBaab.total_units} {uLabel.toLowerCase()}s
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Baab <span className="text-destructive">*</span></Label>
        <Select
          value={qaidaBaabId}
          onValueChange={(v) => {
            const b = baabs.find(x => x.id === v);
            onQaidaBaabIdChange?.(v);
            onWordFromIdChange?.('');
            onWordToIdChange?.('');
            onUnitFromChange?.('');
            onUnitToChange?.('');
            if (b) {
              onLessonNumberChange(String(b.baab_number));
              onPageNumberChange(String(b.start_page));
              const page = ref?.pages.find(p => p.page_number === b.start_page);
              onQaidaPageIdChange?.(page?.id || '');
            }
          }}
        >
          <SelectTrigger><SelectValue placeholder="Select baab" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {baabs.map(b => (
              <SelectItem key={b.id} value={b.id}>
                Baab {b.baab_number}: {b.name_urdu} / {b.name_english}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasWordData ? (
        <div className="space-y-4">
          {!flatWordList && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Line <span className="text-destructive">*</span></Label>
              <Select
                value={selectedLine ? String(selectedLine) : ''}
                onValueChange={(v) => {
                  const first = wordList.find(w => w.line_number === Number(v));
                  onWordFromIdChange?.(first?.id || '');
                  onWordToIdChange?.(first?.id || '');
                  const page = ref?.pages.find(p => p.page_number === first?.page_number);
                  if (page) onQaidaPageIdChange?.(page.id);
                  if (first) onPageNumberChange(String(first.page_number));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select line" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {lines.map(l => <SelectItem key={l} value={String(l)}>Line {l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{uLabel} from</Label>
              <Select value={wordFromId} onValueChange={(v) => onWordFromIdChange?.(v)}>
                <SelectTrigger><SelectValue placeholder={`Select ${uLabel.toLowerCase()}`} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {lineWords.map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      <span className="font-arabic text-base" dir="rtl">{w.word_text}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{uLabel} to <span className="text-destructive">*</span></Label>
              <Select value={wordToId} onValueChange={(v) => onWordToIdChange?.(v)}>
                <SelectTrigger><SelectValue placeholder={`Select ${uLabel.toLowerCase()}`} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {lineWords.map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      <span className="font-arabic text-base" dir="rtl">{w.word_text}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pick a single {uLabel.toLowerCase()} (from = to) or a range within the line.
          </p>
        </div>
      ) : (
        <>
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
            {isWordMode && ' Word list for this baab is not loaded yet — use numeric positions for now.'}
          </p>
          {invalidRange && <p className="text-xs text-destructive">"{uLabel} to" must be greater than or equal to "{uLabel} from".</p>}
          {overMax && <p className="text-xs text-destructive">This baab only has {max} {uLabel.toLowerCase()}s.</p>}
        </>
      )}
    </div>
  );
}
