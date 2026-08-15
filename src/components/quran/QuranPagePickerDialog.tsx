import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { QuranPageView } from './QuranPageView';
import type { LessonMarkerType, LessonSegment } from '@/lib/lessonFormat';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markerType?: LessonMarkerType;
  initialPage?: number;
  /** Where the teacher last stopped — the mushaf opens there. */
  resumeAyah?: { surah: number; ayah: number } | null;
  /** Scopes the remembered page (e.g. per student). */
  resumeKey?: string;
  onUseLesson: (segment: LessonSegment) => void;
  onAddSegment?: (segment: LessonSegment) => void;
}

export function QuranPagePickerDialog({
  open,
  onOpenChange,
  markerType = 'ayah',
  initialPage = 1,
  resumeAyah = null,
  resumeKey,
  onUseLesson,
  onAddSegment,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>Pick lesson on the Quran page</DialogTitle>
          <DialogDescription>
            Qudratullah 15-line IndoPak Mushaf — tap the start and end lines of today's lesson.
          </DialogDescription>
        </DialogHeader>
        {open && (
        <QuranPageView
          markerType={markerType}
          initialPage={initialPage}
          resumeAyah={resumeAyah}
          resumeKey={resumeKey}
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
        )}

      </DialogContent>
    </Dialog>
  );
}

export default QuranPagePickerDialog;
