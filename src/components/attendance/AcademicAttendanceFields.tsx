import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BookOpen, FileText, Lightbulb, CheckCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'needs_revision', label: 'Needs Revision' },
  { value: 'topic_continuing', label: 'Topic Continuing' },
  { value: 'struggling', label: 'Struggling' },
] as const;

const FOLLOWUP_OPTIONS = [
  { value: 'pre_reading', label: 'Pre-reading' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'research', label: 'Research' },
  { value: 'voice_note', label: 'Voice Note' },
  { value: 'written_practice', label: 'Written Practice' },
  { value: 'others', label: 'Others' },
] as const;

export type LessonStatus = typeof STATUS_OPTIONS[number]['value'];
export type FollowupSuggestion = typeof FOLLOWUP_OPTIONS[number]['value'];

interface AcademicAttendanceFieldsProps {
  lessonTopic: string;
  onLessonTopicChange: (value: string) => void;
  lessonStatus: LessonStatus | '';
  onLessonStatusChange: (value: LessonStatus) => void;
  homework: string;
  onHomeworkChange: (value: string) => void;
  followupSuggestions: FollowupSuggestion[];
  onFollowupSuggestionsChange: (value: FollowupSuggestion[]) => void;
}

export function AcademicAttendanceFields({
  lessonTopic,
  onLessonTopicChange,
  lessonStatus,
  onLessonStatusChange,
  homework,
  onHomeworkChange,
  followupSuggestions,
  onFollowupSuggestionsChange,
}: AcademicAttendanceFieldsProps) {
  const toggleFollowup = (value: FollowupSuggestion) => {
    if (followupSuggestions.includes(value)) {
      onFollowupSuggestionsChange(followupSuggestions.filter(f => f !== value));
    } else {
      onFollowupSuggestionsChange([...followupSuggestions, value]);
    }
  };

  return (
    <div className="bg-card rounded-xl p-5 border border-border shadow-sm space-y-5">
      <div className="flex items-center gap-2 text-foreground">
        <BookOpen className="h-5 w-5 text-emerald-600" />
        <h3 className="font-semibold text-base">Academic Progress</h3>
      </div>

      {/* Lesson/Topic Taught */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Lesson/Topic Taught
        </Label>
        <Input
          placeholder="e.g., Chapter 5: Fractions, Verb conjugation, etc."
          value={lessonTopic}
          onChange={(e) => onLessonTopicChange(e.target.value)}
          className="bg-background border-input focus:border-emerald-500 focus:ring-emerald-500/20"
        />
      </div>

      {/* Status Update */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
          Status Update
        </Label>
        <Select value={lessonStatus} onValueChange={onLessonStatusChange}>
          <SelectTrigger className="bg-background border-input focus:border-emerald-500 focus:ring-emerald-500/20">
            <SelectValue placeholder="Select lesson status..." />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Homework */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Homework</Label>
        <Textarea
          placeholder="Enter homework or notes..."
          value={homework}
          onChange={(e) => onHomeworkChange(e.target.value)}
          rows={3}
          className="bg-background border-input focus:border-emerald-500 focus:ring-emerald-500/20 resize-none"
        />
      </div>

      {/* Follow-up Suggestion Pills */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          Follow-up Suggestions
        </Label>
        <div className="flex flex-wrap gap-2">
          {FOLLOWUP_OPTIONS.map((opt) => {
            const isSelected = followupSuggestions.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleFollowup(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                  "border focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-background text-foreground border-input hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {followupSuggestions.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Selected: {followupSuggestions.map(s => 
              FOLLOWUP_OPTIONS.find(o => o.value === s)?.label
            ).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
