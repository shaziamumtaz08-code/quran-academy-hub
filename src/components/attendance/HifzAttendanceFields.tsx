import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SurahRangeSelector } from './SurahRangeSelector';

interface HifzAttendanceFieldsProps {
  // Sabaq (New Lesson) - Full Surah/Verse tracking
  sabaqSurahFrom: string;
  onSabaqSurahFromChange: (value: string) => void;
  sabaqAyahFrom: string;
  onSabaqAyahFromChange: (value: string) => void;
  sabaqSurahTo: string;
  onSabaqSurahToChange: (value: string) => void;
  sabaqAyahTo: string;
  onSabaqAyahToChange: (value: string) => void;
  
  // Sabqi (Recent Revision) - Yes/No only
  sabqiDone: boolean;
  onSabqiDoneChange: (value: boolean) => void;
  
  // Manzil (Old Revision) - Yes/No only
  manzilDone: boolean;
  onManzilDoneChange: (value: boolean) => void;
}

export function HifzAttendanceFields({
  sabaqSurahFrom,
  onSabaqSurahFromChange,
  sabaqAyahFrom,
  onSabaqAyahFromChange,
  sabaqSurahTo,
  onSabaqSurahToChange,
  sabaqAyahTo,
  onSabaqAyahToChange,
  sabqiDone,
  onSabqiDoneChange,
  manzilDone,
  onManzilDoneChange,
}: HifzAttendanceFieldsProps) {
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
      
      {/* Sabqi Section - Yes/No Only */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">🔄 Sabqi (Recent Revision)</Label>
            <p className="text-xs text-muted-foreground">
              Did the student revise their recent lessons?
            </p>
          </div>
          <Switch
            checked={sabqiDone}
            onCheckedChange={onSabqiDoneChange}
          />
        </div>
      </div>
      
      {/* Manzil Section - Yes/No Only */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">📚 Manzil (Old Revision)</Label>
            <p className="text-xs text-muted-foreground">
              Did the student complete their manzil revision?
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
