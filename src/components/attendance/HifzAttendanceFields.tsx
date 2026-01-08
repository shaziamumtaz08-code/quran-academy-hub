import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { SabaqSection, type MarkerType } from './SabaqSection';

interface HifzAttendanceFieldsProps {
  // Marker type selection
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
  
  // Sabqi (Recent Revision) - Yes/No only
  sabqiDone: boolean;
  onSabqiDoneChange: (value: boolean) => void;
  
  // Manzil (Old Revision) - Yes/No only
  manzilDone: boolean;
  onManzilDoneChange: (value: boolean) => void;

  // Repeat lesson flag (optional)
  isRepeatLesson?: boolean;
}

export function HifzAttendanceFields({
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
  sabqiDone,
  onSabqiDoneChange,
  manzilDone,
  onManzilDoneChange,
  isRepeatLesson = false,
}: HifzAttendanceFieldsProps) {
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

      {/* Sabaq Section - New Redesigned UI */}
      <SabaqSection
        markerType={markerType}
        onMarkerTypeChange={onMarkerTypeChange}
        rukuFromJuz={rukuFromJuz}
        onRukuFromJuzChange={onRukuFromJuzChange}
        rukuFromNumber={rukuFromNumber}
        onRukuFromNumberChange={onRukuFromNumberChange}
        rukuToJuz={rukuToJuz}
        onRukuToJuzChange={onRukuToJuzChange}
        rukuToNumber={rukuToNumber}
        onRukuToNumberChange={onRukuToNumberChange}
        ayahFromSurah={ayahFromSurah}
        onAyahFromSurahChange={onAyahFromSurahChange}
        ayahFromNumber={ayahFromNumber}
        onAyahFromNumberChange={onAyahFromNumberChange}
        ayahToSurah={ayahToSurah}
        onAyahToSurahChange={onAyahToSurahChange}
        ayahToNumber={ayahToNumber}
        onAyahToNumberChange={onAyahToNumberChange}
        quarterFromJuz={quarterFromJuz}
        onQuarterFromJuzChange={onQuarterFromJuzChange}
        quarterFromNumber={quarterFromNumber}
        onQuarterFromNumberChange={onQuarterFromNumberChange}
        quarterToJuz={quarterToJuz}
        onQuarterToJuzChange={onQuarterToJuzChange}
        quarterToNumber={quarterToNumber}
        onQuarterToNumberChange={onQuarterToNumberChange}
      />
      
      {/* Sabqi Section - Yes/No Only */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">🔄 Sabqi (Recent Revision)</Label>
            <p className="text-xs text-muted-foreground">
              Did the student revise yesterday's lesson?
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
              Did the student complete their manzil (1 para revision)?
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
