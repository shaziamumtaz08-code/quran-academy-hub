import React, { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Book, Hash, Grid3X3, Layers, Plus, BookOpenCheck } from 'lucide-react';
import { SURAHS, getSurahByName } from '@/lib/quranData';
import { JUZ_DATA, getRukuCountForJuz, calculateTotalRukus, calculateTotalQuarters } from '@/lib/juzData';
import { LessonSegmentEditor } from './LessonSegmentEditor';
import { QuranPagePickerDialog } from '@/components/quran/QuranPagePickerDialog';
import {
  formatLessonSegments,
  emptySegment,
  type LessonSegment,
  type LessonMarkerType,
} from '@/lib/lessonFormat';

export type MarkerType = LessonMarkerType;


interface SabaqSectionProps {
  // Marker type
  markerType: MarkerType;
  onMarkerTypeChange: (type: MarkerType) => void;
  
  // Ruku mode values
  rukuFromJuz: string;
  onRukuFromJuzChange: (value: string) => void;
  rukuFromNumber: string;
  onRukuFromNumberChange: (value: string) => void;
  rukuToJuz: string;
  onRukuToJuzChange: (value: string) => void;
  rukuToNumber: string;
  onRukuToNumberChange: (value: string) => void;
  
  // Ayah mode values
  ayahFromSurah: string;
  onAyahFromSurahChange: (value: string) => void;
  ayahFromNumber: string;
  onAyahFromNumberChange: (value: string) => void;
  ayahToSurah: string;
  onAyahToSurahChange: (value: string) => void;
  ayahToNumber: string;
  onAyahToNumberChange: (value: string) => void;
  
  // Quarter mode values
  quarterFromJuz: string;
  onQuarterFromJuzChange: (value: string) => void;
  quarterFromNumber: string;
  onQuarterFromNumberChange: (value: string) => void;
  quarterToJuz: string;
  onQuarterToJuzChange: (value: string) => void;
  quarterToNumber: string;
  onQuarterToNumberChange: (value: string) => void;

  // Whole-Juz mode (Hifz only)
  allowJuz?: boolean;
  juzFrom?: string;
  onJuzFromChange?: (value: string) => void;
  juzTo?: string;
  onJuzToChange?: (value: string) => void;

  // Additional lesson segments (same sitting, non-contiguous portions)
  extraSegments?: LessonSegment[];
  onExtraSegmentsChange?: (segments: LessonSegment[]) => void;
}

export function SabaqSection({
  markerType,
  onMarkerTypeChange,
  rukuFromJuz,
  onRukuFromJuzChange,
  rukuFromNumber,
  onRukuFromNumberChange,
  rukuToJuz,
  onRukuToJuzChange,
  rukuToNumber,
  onRukuToNumberChange,
  ayahFromSurah,
  onAyahFromSurahChange,
  ayahFromNumber,
  onAyahFromNumberChange,
  ayahToSurah,
  onAyahToSurahChange,
  ayahToNumber,
  onAyahToNumberChange,
  quarterFromJuz,
  onQuarterFromJuzChange,
  quarterFromNumber,
  onQuarterFromNumberChange,
  quarterToJuz,
  onQuarterToJuzChange,
  quarterToNumber,
  onQuarterToNumberChange,
  allowJuz = false,
  juzFrom = '',
  onJuzFromChange,
  juzTo = '',
  onJuzToChange,
  extraSegments = [],
  onExtraSegmentsChange,
}: SabaqSectionProps) {

  
  // Calculate total based on marker type
  const totalCalculation = useMemo(() => {
    if (markerType === 'ruku') {
      const total = calculateTotalRukus(
        parseInt(rukuFromJuz) || 0,
        parseInt(rukuFromNumber) || 0,
        parseInt(rukuToJuz) || 0,
        parseInt(rukuToNumber) || 0
      );
      return { label: 'Total Rukus', value: total };
    }
    
    if (markerType === 'ayah') {
      const fromSurah = getSurahByName(ayahFromSurah);
      const toSurah = getSurahByName(ayahToSurah);
      const fromAyah = parseInt(ayahFromNumber) || 0;
      const toAyah = parseInt(ayahToNumber) || 0;
      
      if (fromSurah && toSurah && fromAyah && toAyah) {
        if (fromSurah.number === toSurah.number) {
          return { label: 'Total Ayahs', value: Math.max(0, toAyah - fromAyah + 1) };
        } else {
          // Cross-surah calculation
          let total = fromSurah.totalAyahs - fromAyah + 1;
          for (let i = fromSurah.number + 1; i < toSurah.number; i++) {
            const midSurah = SURAHS.find(s => s.number === i);
            if (midSurah) total += midSurah.totalAyahs;
          }
          total += toAyah;
          return { label: 'Total Ayahs', value: total };
        }
      }
      return { label: 'Total Ayahs', value: 0 };
    }
    
    if (markerType === 'quarter') {
      const total = calculateTotalQuarters(
        parseInt(quarterFromJuz) || 0,
        parseInt(quarterFromNumber) || 0,
        parseInt(quarterToJuz) || 0,
        parseInt(quarterToNumber) || 0
      );
      return { label: 'Total Quarters', value: total };
    }

    if (markerType === 'juz') {
      const from = parseInt(juzFrom) || 0;
      const to = parseInt(juzTo) || from;
      const total = from ? Math.max(0, to - from + 1) : 0;
      return { label: 'Total Juz', value: total };
    }

    return { label: 'Total', value: 0 };
  }, [
    markerType,
    rukuFromJuz, rukuFromNumber, rukuToJuz, rukuToNumber,
    ayahFromSurah, ayahFromNumber, ayahToSurah, ayahToNumber,
    quarterFromJuz, quarterFromNumber, quarterToJuz, quarterToNumber,
    juzFrom, juzTo
  ]);

  // The first segment mirrors the primary (flat) inputs above.
  const primarySegment: LessonSegment = useMemo(() => {
    if (markerType === 'ruku') return { markerType, juzFrom: rukuFromJuz, unitFrom: rukuFromNumber, juzTo: rukuToJuz, unitTo: rukuToNumber };
    if (markerType === 'quarter') return { markerType, juzFrom: quarterFromJuz, unitFrom: quarterFromNumber, juzTo: quarterToJuz, unitTo: quarterToNumber };
    if (markerType === 'juz') return { markerType, juzFrom, juzTo };
    return { markerType: 'ayah', surahFrom: ayahFromSurah, ayahFrom: ayahFromNumber, surahTo: ayahToSurah, ayahTo: ayahToNumber };
  }, [markerType, rukuFromJuz, rukuFromNumber, rukuToJuz, rukuToNumber, quarterFromJuz, quarterFromNumber, quarterToJuz, quarterToNumber, juzFrom, juzTo, ayahFromSurah, ayahFromNumber, ayahToSurah, ayahToNumber]);

  const normalizedPreview = formatLessonSegments([primarySegment, ...extraSegments]);

  const updateSegment = (idx: number, seg: LessonSegment) => {
    const next = [...extraSegments];
    next[idx] = seg;
    onExtraSegmentsChange?.(next);
  };
  const removeSegment = (idx: number) => onExtraSegmentsChange?.(extraSegments.filter((_, i) => i !== idx));
  const addSegment = () => onExtraSegmentsChange?.([...extraSegments, emptySegment(markerType)]);

  // Get max ruku for selected Juz
  const maxRukuFrom = getRukuCountForJuz(parseInt(rukuFromJuz) || 0);
  const maxRukuTo = getRukuCountForJuz(parseInt(rukuToJuz) || 0);
  
  // Get max ayah for selected Surah
  const maxAyahFrom = getSurahByName(ayahFromSurah)?.totalAyahs || 0;
  const maxAyahTo = getSurahByName(ayahToSurah)?.totalAyahs || 0;


  return (
    <div className="bg-card rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Book className="h-5 w-5 text-primary" />
        <h3 className="text-primary font-semibold text-base">Sabaq (New Reading)</h3>
      </div>
      
      {/* Marker Toggle Row */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs font-medium">Select Marker</Label>
        <ToggleGroup 
          type="single" 
          value={markerType} 
          onValueChange={(v) => v && onMarkerTypeChange(v as MarkerType)}
          className="justify-start gap-2"
        >
          <ToggleGroupItem 
            value="ruku" 
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg px-4 py-2 font-medium"
          >
            <Grid3X3 className="h-4 w-4 mr-1.5" />
            Ruku
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="ayah" 
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg px-4 py-2 font-medium"
          >
            <Hash className="h-4 w-4 mr-1.5" />
            Ayah
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="quarter" 
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg px-4 py-2 font-medium"
          >
            <Grid3X3 className="h-4 w-4 mr-1.5" />
            Quarter
          </ToggleGroupItem>
          {allowJuz && (
            <ToggleGroupItem
              value="juz"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg px-4 py-2 font-medium"
            >
              <Layers className="h-4 w-4 mr-1.5" />
              Juz
            </ToggleGroupItem>
          )}
        </ToggleGroup>

      </div>

      {/* Ruku Mode Inputs */}
      {markerType === 'ruku' && (
        <div className="space-y-4">
          {/* From Row */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium">From</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={rukuFromJuz} onValueChange={onRukuFromJuzChange}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select Juz" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {JUZ_DATA.map((juz) => (
                    <SelectItem key={juz.number} value={juz.number.toString()}>
                      Juz {juz.number} - {juz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rukuFromNumber} onValueChange={onRukuFromNumberChange} disabled={!rukuFromJuz}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Ruku #" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {Array.from({ length: maxRukuFrom }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Ruku {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* To Row */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium">To</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={rukuToJuz} onValueChange={onRukuToJuzChange}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select Juz" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {JUZ_DATA.map((juz) => (
                    <SelectItem key={juz.number} value={juz.number.toString()}>
                      Juz {juz.number} - {juz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rukuToNumber} onValueChange={onRukuToNumberChange} disabled={!rukuToJuz}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Ruku #" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {Array.from({ length: maxRukuTo }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Ruku {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Ayah Mode Inputs */}
      {markerType === 'ayah' && (
        <div className="space-y-4">
          {/* From Row */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium">From</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={ayahFromSurah} onValueChange={onAyahFromSurahChange}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select Surah" />
                </SelectTrigger>
                <SelectContent className="z-50 max-h-[300px] bg-popover">
                  {SURAHS.map((surah) => (
                    <SelectItem key={surah.number} value={surah.name}>
                      {surah.number}. {surah.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ayahFromNumber} onValueChange={onAyahFromNumberChange} disabled={!ayahFromSurah}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Ayah" />
                </SelectTrigger>
                <SelectContent className="z-50 max-h-[300px] bg-popover">
                  {Array.from({ length: maxAyahFrom }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Ayah {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* To Row */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium">To</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={ayahToSurah} onValueChange={onAyahToSurahChange}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select Surah" />
                </SelectTrigger>
                <SelectContent className="z-50 max-h-[300px] bg-popover">
                  {SURAHS.map((surah) => (
                    <SelectItem key={surah.number} value={surah.name}>
                      {surah.number}. {surah.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ayahToNumber} onValueChange={onAyahToNumberChange} disabled={!ayahToSurah}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Ayah" />
                </SelectTrigger>
                <SelectContent className="z-50 max-h-[300px] bg-popover">
                  {Array.from({ length: maxAyahTo }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Ayah {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Quarter Mode Inputs */}
      {markerType === 'quarter' && (
        <div className="space-y-4">
          {/* From Row */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium">From</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={quarterFromJuz} onValueChange={onQuarterFromJuzChange}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select Juz" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {JUZ_DATA.map((juz) => (
                    <SelectItem key={juz.number} value={juz.number.toString()}>
                      Juz {juz.number} - {juz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={quarterFromNumber} onValueChange={onQuarterFromNumberChange} disabled={!quarterFromJuz}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="1">1st Quarter</SelectItem>
                  <SelectItem value="2">2nd Quarter</SelectItem>
                  <SelectItem value="3">3rd Quarter</SelectItem>
                  <SelectItem value="4">4th Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* To Row */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium">To</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={quarterToJuz} onValueChange={onQuarterToJuzChange}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select Juz" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {JUZ_DATA.map((juz) => (
                    <SelectItem key={juz.number} value={juz.number.toString()}>
                      Juz {juz.number} - {juz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={quarterToNumber} onValueChange={onQuarterToNumberChange} disabled={!quarterToJuz}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="1">1st Quarter</SelectItem>
                  <SelectItem value="2">2nd Quarter</SelectItem>
                  <SelectItem value="3">3rd Quarter</SelectItem>
                  <SelectItem value="4">4th Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Whole-Juz Mode Inputs (Hifz only) */}
      {markerType === 'juz' && allowJuz && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-medium">From Juz</Label>
              <Select value={juzFrom} onValueChange={(v) => onJuzFromChange?.(v)}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select Juz" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {JUZ_DATA.map((juz) => (
                    <SelectItem key={juz.number} value={juz.number.toString()}>
                      Juz {juz.number} - {juz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-medium">To Juz</Label>
              <Select value={juzTo} onValueChange={(v) => onJuzToChange?.(v)}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Same as From" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {JUZ_DATA.map((juz) => (
                    <SelectItem key={juz.number} value={juz.number.toString()}>
                      Juz {juz.number} - {juz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Use whole-Juz marking for complete Juz or a range of Juz.
          </p>
        </div>
      )}

      {/* Additional segments (non-contiguous portions in the same sitting) */}
      {onExtraSegmentsChange && (
        <div className="space-y-3">
          {extraSegments.length > 0 && (
            <div className="space-y-3">
              {extraSegments.map((seg, i) => (
                <LessonSegmentEditor
                  key={i}
                  index={i + 1}
                  segment={seg}
                  allowJuz={allowJuz}
                  onChange={(s) => updateSegment(i, s)}
                  onRemove={() => removeSegment(i)}
                />
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={addSegment}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add another segment
          </Button>
        </div>
      )}

      {/* Total Calculation Row */}
      <div className="pt-3 border-t border-sky-700">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-sky-900/50 rounded-lg px-4 py-3">
            <span className="text-muted-foreground text-sm font-medium">{totalCalculation.label}</span>
          </div>
          <div className="bg-card rounded-lg px-4 py-3 text-center">
            <span className="text-foreground font-bold text-lg">
              {totalCalculation.value > 0 ? totalCalculation.value : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Normalized preview — exactly what will be saved and shown everywhere */}
      {normalizedPreview && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Lesson will be recorded as</p>
          <p className="text-sm font-semibold text-foreground">{normalizedPreview}</p>
        </div>
      )}
    </div>

  );
}
