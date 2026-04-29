import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { BookOpen } from 'lucide-react';

interface QaidaProgressInputProps {
  lessonNumber: string;
  onLessonNumberChange: (value: string) => void;
  pageNumber: string;
  onPageNumberChange: (value: string) => void;
  // Optional range inputs for planning mode
  lessonNumberTo?: string;
  onLessonNumberToChange?: (value: string) => void;
  pageNumberTo?: string;
  onPageNumberToChange?: (value: string) => void;
  isPlanning?: boolean;
}

export function QaidaProgressInput({
  lessonNumber,
  onLessonNumberChange,
  pageNumber,
  onPageNumberChange,
  lessonNumberTo,
  onLessonNumberToChange,
  pageNumberTo,
  onPageNumberToChange,
  isPlanning = false,
}: QaidaProgressInputProps) {
  if (isPlanning && onLessonNumberToChange && onPageNumberToChange) {
    return (
      <div className="bg-card rounded-xl p-5 border border-border shadow-lg space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-cyan-400" />
          <h3 className="font-semibold text-base text-cyan-300">Qaida Progress (Range)</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* From */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-200">From</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-slate-400">Lesson No.</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g., 1"
                  value={lessonNumber}
                  onChange={(e) => onLessonNumberChange(e.target.value)}
                  className="bg-background text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Page No.</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g., 5"
                  value={pageNumber}
                  onChange={(e) => onPageNumberChange(e.target.value)}
                  className="bg-background text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>
          
          {/* To */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-200">To</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-slate-400">Lesson No.</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g., 5"
                  value={lessonNumberTo}
                  onChange={(e) => onLessonNumberToChange(e.target.value)}
                  className="bg-background text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Page No.</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g., 15"
                  value={pageNumberTo}
                  onChange={(e) => onPageNumberToChange(e.target.value)}
                  className="bg-background text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Attendance mode - single inputs only (no Surah/Verse fields)
  return (
    <div className="bg-card rounded-xl p-5 border border-border shadow-lg space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-cyan-400" />
        <h3 className="font-semibold text-base text-cyan-300">Qaida Progress</h3>
      </div>
      <p className="text-xs text-slate-400">
        Record lesson and page number only (Surah/Verse tracking not applicable for Qaida)
      </p>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-200">Lesson Number</Label>
          <Input
            type="number"
            min="1"
            max="65"
            placeholder="e.g., 12"
            value={lessonNumber}
            onChange={(e) => onLessonNumberChange(e.target.value)}
            className="bg-background text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-200">Page Number</Label>
          <Input
            type="number"
            min="1"
            max="100"
            placeholder="e.g., 25"
            value={pageNumber}
            onChange={(e) => onPageNumberChange(e.target.value)}
            className="bg-background text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}
