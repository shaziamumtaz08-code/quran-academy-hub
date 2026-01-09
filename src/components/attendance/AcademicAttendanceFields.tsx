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
    <div className="bg-[#1e3a5f] rounded-xl p-5 border border-[#2d4a6f] shadow-lg space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-cyan-400" />
        <h3 className="font-semibold text-base text-cyan-300">Academic Progress</h3>
      </div>

      {/* Lesson/Topic Taught */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-slate-400" />
          Lesson/Topic Taught
        </Label>
        <Input
          placeholder="e.g., Chapter 5: Fractions, Verb conjugation, etc."
          value={lessonTopic}
          onChange={(e) => onLessonTopicChange(e.target.value)}
          className="bg-white text-navy-900 border-0 placeholder:text-slate-400"
        />
      </div>

      {/* Status Update */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-slate-400" />
          Status Update
        </Label>
        <Select value={lessonStatus} onValueChange={onLessonStatusChange}>
          <SelectTrigger className="bg-white text-navy-900 border-0">
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
        <Label className="text-sm font-medium text-slate-200">Homework</Label>
        <Textarea
          placeholder="Enter homework or notes..."
          value={homework}
          onChange={(e) => onHomeworkChange(e.target.value)}
          rows={3}
          className="bg-white text-navy-900 border-0 placeholder:text-slate-400 resize-none"
        />
      </div>

      {/* Follow-up Suggestion Pills */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4 text-slate-400" />
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
                  "border focus:outline-none focus:ring-2 focus:ring-cyan-400/30",
                  isSelected
                    ? "bg-cyan-500 text-white border-cyan-500 shadow-sm"
                    : "bg-white/10 text-white border-slate-500 hover:border-cyan-400 hover:bg-white/20"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {followupSuggestions.length > 0 && (
          <p className="text-xs text-slate-400 mt-1">
            Selected: {followupSuggestions.map(s => 
              FOLLOWUP_OPTIONS.find(o => o.value === s)?.label
            ).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
