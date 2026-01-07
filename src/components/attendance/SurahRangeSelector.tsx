import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SurahSearchSelect } from './SurahSearchSelect';
import { getSurahByName, SURAHS } from '@/lib/quranData';
import { validateSurahRange, getMaxAyahs } from '@/lib/quranValidation';
import { AlertCircle } from 'lucide-react';

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
  label = '📖 Sabaq (New Lesson)',
  showToFields = true,
}: SurahRangeSelectorProps) {
  // Get max ayahs for validation display
  const maxAyahFrom = getMaxAyahs(surahFrom) || 999;
  const maxAyahTo = getMaxAyahs(surahTo) || 999;

  // Validate the complete range
  const validation = React.useMemo(() => {
    return validateSurahRange(surahFrom, ayahFrom, surahTo, ayahTo);
  }, [surahFrom, surahTo, ayahFrom, ayahTo]);

  // Auto-clamp ayah values when they exceed max
  React.useEffect(() => {
    if (surahFrom && ayahFrom) {
      const max = getMaxAyahs(surahFrom);
      const current = parseInt(ayahFrom) || 0;
      if (max > 0 && current > max) {
        onAyahFromChange(max.toString());
      }
    }
  }, [surahFrom, ayahFrom, onAyahFromChange]);

  React.useEffect(() => {
    if (surahTo && ayahTo) {
      const max = getMaxAyahs(surahTo);
      const current = parseInt(ayahTo) || 0;
      if (max > 0 && current > max) {
        onAyahToChange(max.toString());
      }
    }
  }, [surahTo, ayahTo, onAyahToChange]);

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
            <div className="relative">
              <Input
                type="number"
                min="1"
                max={maxAyahFrom}
                placeholder={surahFrom ? `1-${maxAyahFrom}` : 'Ayah'}
                value={ayahFrom}
                onChange={(e) => onAyahFromChange(e.target.value)}
                className={validation.fromError ? 'border-destructive pr-8' : ''}
              />
              {validation.fromError && (
                <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
              )}
            </div>
          </div>
          {validation.fromError && (
            <p className="text-xs text-destructive">{validation.fromError}</p>
          )}
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
              <div className="relative">
                <Input
                  type="number"
                  min="1"
                  max={maxAyahTo}
                  placeholder={surahTo ? `1-${maxAyahTo}` : 'Ayah'}
                  value={ayahTo}
                  onChange={(e) => onAyahToChange(e.target.value)}
                  className={validation.toError ? 'border-destructive pr-8' : ''}
                />
                {validation.toError && (
                  <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
            {validation.toError && (
              <p className="text-xs text-destructive">{validation.toError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
