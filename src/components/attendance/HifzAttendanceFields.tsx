import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, BookOpenCheck, RotateCcw } from 'lucide-react';
import { SabaqSection, type MarkerType } from './SabaqSection';
import type { LessonSegment } from '@/lib/lessonFormat';


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
  // Whole-Juz mode (Hifz only)
  juzFrom?: string;
  onJuzFromChange?: (value: string) => void;
  juzTo?: string;
  onJuzToChange?: (value: string) => void;

  // Additional lesson segments
  extraSegments?: LessonSegment[];
  onExtraSegmentsChange?: (segments: LessonSegment[]) => void;

  // Repeat lesson flag (optional)
  isRepeatLesson?: boolean;
  resumeAyah?: { surah: number; ayah: number } | null;
  resumeKey?: string;
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
  juzFrom = '',
  onJuzFromChange,
  juzTo = '',
  onJuzToChange,
  extraSegments = [],
  onExtraSegmentsChange,
  sabqiDone,
  onSabqiDoneChange,
  manzilDone,
  onManzilDoneChange,
  isRepeatLesson = false,
  resumeAyah = null,
  resumeKey,

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
        allowJuz
        juzFrom={juzFrom}
        onJuzFromChange={onJuzFromChange}
        juzTo={juzTo}
        onJuzToChange={onJuzToChange}
        extraSegments={extraSegments}
        onExtraSegmentsChange={onExtraSegmentsChange}
        resumeAyah={resumeAyah}
        resumeKey={resumeKey}

      />
      
      <TooltipProvider>
        <div className="flex gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-muted px-2.5">
            <RotateCcw className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor="sabqi-done" className="min-w-0 flex-1 cursor-help truncate text-sm font-medium">Sabqi</Label>
              </TooltipTrigger>
              <TooltipContent>Did the student revise yesterday&apos;s lesson?</TooltipContent>
            </Tooltip>
            <Switch id="sabqi-done" checked={sabqiDone} onCheckedChange={onSabqiDoneChange} />
          </div>
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-muted px-2.5">
            <BookOpenCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor="manzil-done" className="min-w-0 flex-1 cursor-help truncate text-sm font-medium">Manzil</Label>
              </TooltipTrigger>
              <TooltipContent>Did the student complete their old revision (one Juz)?</TooltipContent>
            </Tooltip>
            <Switch id="manzil-done" checked={manzilDone} onCheckedChange={onManzilDoneChange} />
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
