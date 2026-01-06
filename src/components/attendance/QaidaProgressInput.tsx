import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface QaidaProgressInputProps {
  lessonNumber: string;
  onLessonNumberChange: (value: string) => void;
  pageNumber: string;
  onPageNumberChange: (value: string) => void;
  isPlanning?: boolean;
  lessonNumberTo?: string;
  onLessonNumberToChange?: (value: string) => void;
  pageNumberTo?: string;
  onPageNumberToChange?: (value: string) => void;
}

export function QaidaProgressInput({
  lessonNumber,
  onLessonNumberChange,
  pageNumber,
  onPageNumberChange,
  isPlanning = false,
  lessonNumberTo,
  onLessonNumberToChange,
  pageNumberTo,
  onPageNumberToChange,
}: QaidaProgressInputProps) {
  if (isPlanning) {
    // Planning mode: show From/To ranges
    return (
      <div className="space-y-4">
        <div className="p-4 bg-secondary/30 rounded-lg space-y-4">
          <h4 className="font-medium text-sm text-foreground">Qaida Progress Range</h4>
          
          {/* Lesson Range */}
          <div className="space-y-2">
            <Label className="text-sm">Lesson Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Lesson #"
                  value={lessonNumber}
                  onChange={(e) => onLessonNumberChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Lesson #"
                  value={lessonNumberTo || ''}
                  onChange={(e) => onLessonNumberToChange?.(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          {/* Page Range */}
          <div className="space-y-2">
            <Label className="text-sm">Page Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Page #"
                  value={pageNumber}
                  onChange={(e) => onPageNumberChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Page #"
                  value={pageNumberTo || ''}
                  onChange={(e) => onPageNumberToChange?.(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Attendance mode: single values
  return (
    <div className="p-4 bg-secondary/30 rounded-lg space-y-4">
      <h4 className="font-medium text-sm text-foreground">Qaida Progress</h4>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lessonNumber">Lesson Number</Label>
          <Input
            id="lessonNumber"
            type="number"
            min="1"
            placeholder="e.g., 5"
            value={lessonNumber}
            onChange={(e) => onLessonNumberChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pageNumber">Page Number</Label>
          <Input
            id="pageNumber"
            type="number"
            min="1"
            placeholder="e.g., 12"
            value={pageNumber}
            onChange={(e) => onPageNumberChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
