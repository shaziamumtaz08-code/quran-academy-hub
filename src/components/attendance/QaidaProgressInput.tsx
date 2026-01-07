import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

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
      <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
        <Label className="text-sm font-medium">📘 Qaida Progress (Range)</Label>
        
        <div className="grid grid-cols-2 gap-4">
          {/* From */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">From</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Lesson No.</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g., 1"
                  value={lessonNumber}
                  onChange={(e) => onLessonNumberChange(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Page No.</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g., 5"
                  value={pageNumber}
                  onChange={(e) => onPageNumberChange(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          {/* To */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">To</Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Lesson No.</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g., 5"
                  value={lessonNumberTo}
                  onChange={(e) => onLessonNumberToChange(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Page No.</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g., 15"
                  value={pageNumberTo}
                  onChange={(e) => onPageNumberToChange(e.target.value)}
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
    <div className="space-y-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
      <Label className="text-sm font-medium">📘 Qaida Progress</Label>
      <p className="text-xs text-muted-foreground">
        Record lesson and page number only (Surah/Verse tracking not applicable for Qaida)
      </p>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Lesson Number</Label>
          <Input
            type="number"
            min="1"
            max="65"
            placeholder="e.g., 12"
            value={lessonNumber}
            onChange={(e) => onLessonNumberChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Page Number</Label>
          <Input
            type="number"
            min="1"
            max="100"
            placeholder="e.g., 25"
            value={pageNumber}
            onChange={(e) => onPageNumberChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
