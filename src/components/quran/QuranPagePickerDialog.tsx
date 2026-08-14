import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { QuranPageView } from './QuranPageView';
import type { LessonMarkerType, LessonSegment } from '@/lib/lessonFormat';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markerType?: LessonMarkerType;
  initialPage?: number;
  onUseLesson: (segment: LessonSegment) => void;
  onAddSegment?: (segment: LessonSegment) => void;
}

export function QuranPagePickerDialog({
  open,
  onOpenChange,
  markerType = 'ayah',
  initialPage = 1,
  onUseLesson,
  onAddSegment,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pick lesson on the Quran page</DialogTitle>
          <DialogDescription>
            Qudratullah 15-line IndoPak Mushaf — tap the start and end lines of today's lesson.
          </DialogDescription>
        </DialogHeader>
        <QuranPageView
          markerType={markerType}
          initialPage={initialPage}
          onUseLesson={(seg) => {
            onUseLesson(seg);
            onOpenChange(false);
          }}
          onAddSegment={
            onAddSegment
              ? (seg) => {
                  onAddSegment(seg);
                  onOpenChange(false);
                }
              : undefined
          }
        />
      </DialogContent>
    </Dialog>
  );
}

export default QuranPagePickerDialog;
