import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SurahRangeSelector } from './SurahRangeSelector';

interface NazraAttendanceFieldsProps {
  // Sabaq (New Lesson) - Full Surah/Verse tracking
  sabaqSurahFrom: string;
  onSabaqSurahFromChange: (value: string) => void;
  sabaqAyahFrom: string;
  onSabaqAyahFromChange: (value: string) => void;
  sabaqSurahTo: string;
  onSabaqSurahToChange: (value: string) => void;
  sabaqAyahTo: string;
  onSabaqAyahToChange: (value: string) => void;
  
  // Manzil (Revision) - Yes/No only
  manzilDone: boolean;
  onManzilDoneChange: (value: boolean) => void;
}

export function NazraAttendanceFields({
  sabaqSurahFrom,
  onSabaqSurahFromChange,
  sabaqAyahFrom,
  onSabaqAyahFromChange,
  sabaqSurahTo,
  onSabaqSurahToChange,
  sabaqAyahTo,
  onSabaqAyahToChange,
  manzilDone,
  onManzilDoneChange,
}: NazraAttendanceFieldsProps) {
  return (
    <div className="space-y-6">
      {/* Sabaq Section - Full Tracking */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
        <SurahRangeSelector
          surahFrom={sabaqSurahFrom}
          onSurahFromChange={onSabaqSurahFromChange}
          ayahFrom={sabaqAyahFrom}
          onAyahFromChange={onSabaqAyahFromChange}
          surahTo={sabaqSurahTo}
          onSurahToChange={onSabaqSurahToChange}
          ayahTo={sabaqAyahTo}
          onAyahToChange={onSabaqAyahToChange}
          label="📖 Sabaq (New Lesson)"
          showToFields={true}
        />
      </div>
      
      {/* Manzil Section - Yes/No Only */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">📚 Manzil / Revision</Label>
            <p className="text-xs text-muted-foreground">
              Did the student complete their revision today?
            </p>
          </div>
          <Switch
            checked={manzilDone}
            onCheckedChange={onManzilDoneChange}
          />
        </div>
      </div>
    </div>
  );
}
