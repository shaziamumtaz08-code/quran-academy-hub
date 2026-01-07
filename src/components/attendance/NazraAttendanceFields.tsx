import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SurahRangeSelector } from './SurahRangeSelector';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

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

  // Repeat lesson flag (optional)
  isRepeatLesson?: boolean;
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
  isRepeatLesson = false,
}: NazraAttendanceFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Repeat Lesson Warning */}
      {isRepeatLesson && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            Repeat Lesson Detected
          </span>
          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
            Same as last class
          </Badge>
        </div>
      )}

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
          label="📖 Sabaq (New Reading)"
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
