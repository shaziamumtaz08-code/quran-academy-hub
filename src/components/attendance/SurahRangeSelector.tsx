import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SurahSearchSelect } from './SurahSearchSelect';
import { getSurahByName, SURAHS } from '@/lib/quranData';

interface SurahRangeSelectorProps {
  surahFrom: string;
  onSurahFromChange: (value: string) => void;
  ayahFrom: string;
  onAyahFromChange: (value: string) => void;
  surahTo: string;
  onSurahToChange: (value: string) => void;
  ayahTo: string;
  onAyahToChange: (value: string) => void;
  label?: string;
  showToFields?: boolean;
}

export function SurahRangeSelector({
  surahFrom,
  onSurahFromChange,
  ayahFrom,
  onAyahFromChange,
  surahTo,
  onSurahToChange,
  ayahTo,
  onAyahToChange,
  label = 'Sabaq (New Lesson)',
  showToFields = true,
}: SurahRangeSelectorProps) {
  // Get max ayahs for validation
  const fromSurah = getSurahByName(surahFrom);
  const toSurah = getSurahByName(surahTo);
  const maxAyahFrom = fromSurah?.totalAyahs || 999;
  const maxAyahTo = toSurah?.totalAyahs || 999;

  // Validate that "To" comes after "From" in Quran order
  const isValidRange = React.useMemo(() => {
    if (!surahFrom || !surahTo) return true;
    
    const fromIndex = SURAHS.findIndex(s => s.name === surahFrom);
    const toIndex = SURAHS.findIndex(s => s.name === surahTo);
    
    if (fromIndex === -1 || toIndex === -1) return true;
    
    // If same surah, check ayah order
    if (fromIndex === toIndex) {
      const fromAyah = parseInt(ayahFrom) || 0;
      const toAyah = parseInt(ayahTo) || 0;
      if (fromAyah > 0 && toAyah > 0) {
        return toAyah >= fromAyah;
      }
    }
    
    return toIndex >= fromIndex;
  }, [surahFrom, surahTo, ayahFrom, ayahTo]);

  return (
    <div className="space-y-4">
      {label && (
        <Label className="text-sm font-medium">{label}</Label>
      )}
      
      <div className="grid grid-cols-1 gap-4">
        {/* From Section */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">From</Label>
          <div className="grid grid-cols-2 gap-2">
            <SurahSearchSelect
              value={surahFrom}
              onChange={onSurahFromChange}
              placeholder="Select Surah"
            />
            <Input
              type="number"
              min="1"
              max={maxAyahFrom}
              placeholder="Ayah"
              value={ayahFrom}
              onChange={(e) => onAyahFromChange(e.target.value)}
            />
          </div>
        </div>
        
        {/* To Section */}
        {showToFields && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">To</Label>
            <div className="grid grid-cols-2 gap-2">
              <SurahSearchSelect
                value={surahTo}
                onChange={onSurahToChange}
                placeholder="Select Surah"
              />
              <Input
                type="number"
                min="1"
                max={maxAyahTo}
                placeholder="Ayah"
                value={ayahTo}
                onChange={(e) => onAyahToChange(e.target.value)}
                className={!isValidRange ? 'border-destructive' : ''}
              />
            </div>
            {!isValidRange && (
              <p className="text-xs text-destructive">
                "To" must come after "From" in Quran order
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
