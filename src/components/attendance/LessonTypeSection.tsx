import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Repeat, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LessonType = 'new' | 'repeat' | '';
export type RepeatReason =
  | 'not_memorized'
  | 'menstrual'
  | 'unwell'
  | 'teacher_revised'
  | 'other';

const REPEAT_REASONS: { value: RepeatReason; label: string; femaleOnly?: boolean }[] = [
  { value: 'not_memorized', label: "Student didn't memorize" },
  { value: 'menstrual', label: 'Menstrual period', femaleOnly: true },
  { value: 'unwell', label: 'Student unwell / low energy' },
  { value: 'teacher_revised', label: 'Teacher revised instead' },
  { value: 'other', label: 'Other' },
];

interface Props {
  lessonType: LessonType;
  onLessonTypeChange: (v: LessonType) => void;
  repeatReason: RepeatReason | '';
  onRepeatReasonChange: (v: RepeatReason) => void;
  repeatReasonNote: string;
  onRepeatReasonNoteChange: (v: string) => void;
  previousLesson?: string | null;
  studentGender?: string | null;
  /** Show a hint when the entered Sabaq range matches the previous class. */
  autoDetectedRepeat?: boolean;
  onAcceptAutoDetect?: () => void;
}

export function LessonTypeSection({
  lessonType,
  onLessonTypeChange,
  repeatReason,
  onRepeatReasonChange,
  repeatReasonNote,
  onRepeatReasonNoteChange,
  previousLesson,
  studentGender,
  autoDetectedRepeat,
  onAcceptAutoDetect,
}: Props) {
  const isFemale = (studentGender || '').toLowerCase() === 'female';
  const visibleReasons = REPEAT_REASONS.filter((r) => !r.femaleOnly || isFemale);

  return (
    <div className="rounded-xl border border-border bg-background shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground">
          Lesson Today <span className="text-destructive">*</span>
        </Label>
        {previousLesson && (
          <span className="text-[11px] text-muted-foreground truncate max-w-[55%]" title={previousLesson}>
            Last: {previousLesson}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onLessonTypeChange('new')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
            lessonType === 'new'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-background text-foreground border-border hover:border-emerald-500/50',
          )}
        >
          <Sparkles className="h-4 w-4" />
          New Lesson
        </button>
        <button
          type="button"
          onClick={() => onLessonTypeChange('repeat')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
            lessonType === 'repeat'
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-background text-foreground border-border hover:border-amber-500/50',
          )}
        >
          <Repeat className="h-4 w-4" />
          Same as last class
        </button>
      </div>

      {autoDetectedRepeat && lessonType !== 'repeat' && (
        <button
          type="button"
          onClick={onAcceptAutoDetect}
          className="flex items-start gap-2 w-full text-left rounded-md border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        >
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Looks the same as the previous class — tap to switch to <strong>Same as last class</strong>.
          </span>
        </button>
      )}

      {lessonType === 'repeat' && (
        <div className="space-y-3 pt-1">
          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
            No new progress will be recorded
          </Badge>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Reason & what was done today <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={3}
              value={repeatReasonNote}
              onChange={(e) => onRepeatReasonNoteChange(e.target.value)}
              placeholder="e.g. Menstrual period — covered Tarbiyah topic on Salah etiquette. / Student couldn't recall, revised previous Ruku."
            />
            <p className="text-[11px] text-muted-foreground">
              Write briefly why the new lesson wasn't taught and what the student did instead. This replaces the dropdown so you can capture Tarbiyah or revision content.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
