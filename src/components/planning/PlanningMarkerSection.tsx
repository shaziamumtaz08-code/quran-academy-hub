import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Textarea } from '@/components/ui/textarea';
import { Target, Grid3X3, Hash, CalendarDays } from 'lucide-react';
import { SURAHS, getSurahByName } from '@/lib/quranData';
import { JUZ_DATA, getRukuCountForJuz, calculateTotalRukus, calculateTotalQuarters } from '@/lib/juzData';

export type PlanMarkerType = 'ruku' | 'ayah' | 'quarter';

interface PlanningMarkerSectionProps {
  // Marker type
  markerType: PlanMarkerType;
  onMarkerTypeChange: (type: PlanMarkerType) => void;
  
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
  
  // Teaching days info
  totalTeachingDays: number;
  monthLabel: string;
  year: string;
  
  // Notes
  notes: string;
  onNotesChange: (value: string) => void;
}

export function PlanningMarkerSection({
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
  totalTeachingDays,
  monthLabel,
  year,
  notes,
  onNotesChange,
}: PlanningMarkerSectionProps) {
  
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
    
    return { label: 'Total', value: 0 };
  }, [
    markerType,
    rukuFromJuz, rukuFromNumber, rukuToJuz, rukuToNumber,
    ayahFromSurah, ayahFromNumber, ayahToSurah, ayahToNumber,
    quarterFromJuz, quarterFromNumber, quarterToJuz, quarterToNumber
  ]);

  // Get max ruku for selected Juz
  const maxRukuFrom = getRukuCountForJuz(parseInt(rukuFromJuz) || 0);
  const maxRukuTo = getRukuCountForJuz(parseInt(rukuToJuz) || 0);
  
  // Get max ayah for selected Surah
  const maxAyahFrom = getSurahByName(ayahFromSurah)?.totalAyahs || 0;
  const maxAyahTo = getSurahByName(ayahToSurah)?.totalAyahs || 0;

  return (
    <div className="bg-[#1a365d] rounded-2xl p-5 space-y-5 border-2 border-[#2d4a7c]">
      {/* Header with Plan Icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-sky-300" />
          <h3 className="text-sky-300 font-semibold text-base">Monthly Target Plan</h3>
        </div>
        {totalTeachingDays > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/20 rounded-full">
            <CalendarDays className="h-3.5 w-3.5 text-sky-300" />
            <span className="text-sky-200 text-xs font-medium">
              {totalTeachingDays} days in {monthLabel} {year}
            </span>
          </div>
        )}
      </div>
      
      {/* Marker Toggle Row */}
      <div className="space-y-2">
        <Label className="text-sky-200 text-xs font-medium">Select Planning Marker</Label>
        <ToggleGroup 
          type="single" 
          value={markerType} 
          onValueChange={(v) => v && onMarkerTypeChange(v as PlanMarkerType)}
          className="justify-start gap-2"
        >
          <ToggleGroupItem 
            value="ruku" 
            className="bg-white text-[#1a365d] data-[state=on]:bg-sky-400 data-[state=on]:text-white rounded-lg px-4 py-2 font-medium"
          >
            <Grid3X3 className="h-4 w-4 mr-1.5" />
            Ruku
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="ayah" 
            className="bg-white text-[#1a365d] data-[state=on]:bg-sky-400 data-[state=on]:text-white rounded-lg px-4 py-2 font-medium"
          >
            <Hash className="h-4 w-4 mr-1.5" />
            Ayah
          </ToggleGroupItem>
          <ToggleGroupItem 
            value="quarter" 
            className="bg-white text-[#1a365d] data-[state=on]:bg-sky-400 data-[state=on]:text-white rounded-lg px-4 py-2 font-medium"
          >
            <Grid3X3 className="h-4 w-4 mr-1.5" />
            Quarter
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Ruku Mode Inputs */}
      {markerType === 'ruku' && (
        <div className="space-y-4">
          {/* From Row */}
          <div className="space-y-2">
            <Label className="text-sky-200 text-xs font-medium">From</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={rukuFromJuz} onValueChange={onRukuFromJuzChange}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Select Juz" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {JUZ_DATA.map((juz) => (
                    <SelectItem key={juz.number} value={juz.number.toString()}>
                      Juz {juz.number} - {juz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rukuFromNumber} onValueChange={onRukuFromNumberChange} disabled={!rukuFromJuz}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Ruku #" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
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
            <Label className="text-sky-200 text-xs font-medium">To</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={rukuToJuz} onValueChange={onRukuToJuzChange}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Select Juz" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {JUZ_DATA.map((juz) => (
                    <SelectItem key={juz.number} value={juz.number.toString()}>
                      Juz {juz.number} - {juz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rukuToNumber} onValueChange={onRukuToNumberChange} disabled={!rukuToJuz}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Ruku #" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
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
            <Label className="text-sky-200 text-xs font-medium">From</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={ayahFromSurah} onValueChange={onAyahFromSurahChange}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Select Surah" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50 max-h-[300px]">
                  {SURAHS.map((surah) => (
                    <SelectItem key={surah.number} value={surah.name}>
                      {surah.number}. {surah.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ayahFromNumber} onValueChange={onAyahFromNumberChange} disabled={!ayahFromSurah}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Ayah" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50 max-h-[300px]">
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
            <Label className="text-sky-200 text-xs font-medium">To</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={ayahToSurah} onValueChange={onAyahToSurahChange}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Select Surah" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50 max-h-[300px]">
                  {SURAHS.map((surah) => (
                    <SelectItem key={surah.number} value={surah.name}>
                      {surah.number}. {surah.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ayahToNumber} onValueChange={onAyahToNumberChange} disabled={!ayahToSurah}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Ayah" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50 max-h-[300px]">
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
            <Label className="text-sky-200 text-xs font-medium">From</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={quarterFromJuz} onValueChange={onQuarterFromJuzChange}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Select Juz" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {JUZ_DATA.map((juz) => (
                    <SelectItem key={juz.number} value={juz.number.toString()}>
                      Juz {juz.number} - {juz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={quarterFromNumber} onValueChange={onQuarterFromNumberChange} disabled={!quarterFromJuz}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
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
            <Label className="text-sky-200 text-xs font-medium">To</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={quarterToJuz} onValueChange={onQuarterToJuzChange}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Select Juz" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {JUZ_DATA.map((juz) => (
                    <SelectItem key={juz.number} value={juz.number.toString()}>
                      Juz {juz.number} - {juz.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={quarterToNumber} onValueChange={onQuarterToNumberChange} disabled={!quarterToJuz}>
                <SelectTrigger className="bg-white text-[#1a365d] border-0 rounded-lg">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
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

      {/* Monthly Target Total Row */}
      <div className="pt-3 border-t border-sky-700">
        <Label className="text-sky-200 text-xs font-medium mb-2 block">Monthly Target Total</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-sky-900/50 rounded-lg px-4 py-3">
            <span className="text-sky-200 text-sm font-medium">{totalCalculation.label}</span>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 text-center">
            <span className="text-[#1a365d] font-bold text-lg">
              {totalCalculation.value > 0 ? totalCalculation.value : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Notes Field */}
      <div className="space-y-2 pt-2">
        <Label className="text-sky-200 text-xs font-medium">Notes (Optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Any additional instructions for this plan..."
          className="bg-white text-[#1a365d] border-0 rounded-lg resize-none"
          rows={2}
        />
      </div>
    </div>
  );
}
