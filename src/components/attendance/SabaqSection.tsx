import React, { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Book, Hash, Grid3X3 } from 'lucide-react';
import { SURAHS, getSurahByName } from '@/lib/quranData';
import { JUZ_DATA, getRukuCountForJuz, calculateTotalRukus, calculateTotalQuarters } from '@/lib/juzData';

export type MarkerType = 'ruku' | 'ayah' | 'quarter';

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
                <SelectContent className="bg-white z-50">
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
            <Label className="text-muted-foreground text-xs font-medium">To</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={rukuToJuz} onValueChange={onRukuToJuzChange}>
                <SelectTrigger className="rounded-lg">
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
                <SelectTrigger className="rounded-lg">
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
            <Label className="text-muted-foreground text-xs font-medium">From</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={ayahFromSurah} onValueChange={onAyahFromSurahChange}>
                <SelectTrigger className="rounded-lg">
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
                <SelectTrigger className="rounded-lg">
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
            <Label className="text-muted-foreground text-xs font-medium">To</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={ayahToSurah} onValueChange={onAyahToSurahChange}>
                <SelectTrigger className="rounded-lg">
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
                <SelectTrigger className="rounded-lg">
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
            <Label className="text-muted-foreground text-xs font-medium">From</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={quarterFromJuz} onValueChange={onQuarterFromJuzChange}>
                <SelectTrigger className="rounded-lg">
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
                <SelectTrigger className="rounded-lg">
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
            <Label className="text-muted-foreground text-xs font-medium">To</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={quarterToJuz} onValueChange={onQuarterToJuzChange}>
                <SelectTrigger className="rounded-lg">
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
                <SelectTrigger className="rounded-lg">
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

      {/* Total Calculation Row */}
      <div className="pt-3 border-t border-sky-700">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-sky-900/50 rounded-lg px-4 py-3">
            <span className="text-muted-foreground text-sm font-medium">{totalCalculation.label}</span>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 text-center">
            <span className="text-foreground font-bold text-lg">
              {totalCalculation.value > 0 ? totalCalculation.value : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
