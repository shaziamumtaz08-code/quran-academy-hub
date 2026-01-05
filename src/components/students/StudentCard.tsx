import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Target, User, Calendar, Clock, BookMarked } from 'lucide-react';

interface StudentCardProps {
  student: {
    id: string;
    full_name: string;
    email: string | null;
    subject_name: string | null;
    daily_target_lines: number;
    preferred_unit: string;
    last_lesson: string | null;
    homework: string | null;
    age: number | null;
    gender: string | null;
  };
  onViewHistory: () => void;
  onViewSchedule: () => void;
  onMarkAttendance: () => void;
}

export function StudentCard({ student, onViewHistory, onViewSchedule, onMarkAttendance }: StudentCardProps) {

  // Check if we have any info to display
  const hasAge = student.age !== null && student.age !== undefined;
  const hasGender = student.gender !== null && student.gender !== undefined && student.gender !== '';
  const hasTarget = student.daily_target_lines > 0;
  const hasInfoRow = hasAge || hasGender || hasTarget;

  return (
    <Card className="hover:border-sky/50 hover:shadow-lg transition-all duration-200 group flex flex-col border-l-4 border-l-navy dark:border-l-sky overflow-hidden">
      <CardContent className="p-4 flex flex-col flex-1 min-h-0">
        {/* Header: Name + Subject (Left) | History Icon (Right) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight truncate text-navy dark:text-sky-light">
              {student.full_name}
            </h3>
            {student.subject_name && (
              <Badge className="text-xs font-normal gap-1 mt-1.5 bg-sky/10 text-sky-dark dark:bg-sky/20 dark:text-sky-light border-0">
                <BookOpen className="h-3 w-3" />
                {student.subject_name}
              </Badge>
            )}
          </div>
          
          {/* Large History Button (Book icon) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewHistory();
            }}
            className="flex-shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-navy to-navy-light dark:from-sky dark:to-sky-dark flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all"
            title="View Lesson History"
          >
            <BookMarked className="h-7 w-7 text-white" />
          </button>
        </div>

        {/* Info Row - Only render if we have data */}
        {hasInfoRow && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground flex-wrap bg-cream dark:bg-navy-dark/50 p-2 rounded-md">
            {hasAge && (
              <>
                <span className="flex items-center gap-1 font-medium">
                  <User className="h-3 w-3 text-navy dark:text-sky" />
                  {student.age} Yrs
                </span>
                {(hasGender || hasTarget) && <span className="text-navy/30 dark:text-sky/30">•</span>}
              </>
            )}
            {hasGender && (
              <>
                <span className="font-medium capitalize">{student.gender}</span>
                {hasTarget && <span className="text-navy/30 dark:text-sky/30">•</span>}
              </>
            )}
            {hasTarget && (
              <span className="flex items-center gap-1 font-medium">
                <Target className="h-3 w-3 text-sky" />
                {student.daily_target_lines} {student.preferred_unit}/day
              </span>
            )}
          </div>
        )}

        {/* Last Lesson Box */}
        <div className="mt-3 p-3 rounded-lg bg-gradient-to-br from-sky/15 to-sky/5 dark:from-sky/25 dark:to-sky/10 border border-sky/20 flex-1">
          <p className="text-xs font-semibold text-navy dark:text-sky-light mb-1">Last Lesson:</p>
          <p className="text-sm text-foreground line-clamp-3">
            {student.last_lesson || 'No lesson recorded yet'}
          </p>
        </div>

        {/* Footer: Action Buttons - Properly contained */}
        <div className="flex gap-2.5 pt-4 mt-auto">
          <Button
            variant="outline"
            className="flex-1 h-12 text-sm border-navy/20 dark:border-sky/20 hover:bg-cream dark:hover:bg-navy-light/20"
            onClick={(e) => {
              e.stopPropagation();
              onViewSchedule();
            }}
          >
            <Calendar className="h-4 w-4 mr-1.5 text-navy dark:text-sky" />
            Schedule
          </Button>
          <Button
            className="flex-1 h-12 text-sm bg-gradient-to-r from-navy to-navy-light dark:from-sky dark:to-sky-dark"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAttendance();
            }}
          >
            <Clock className="h-4 w-4 mr-1.5" />
            Mark
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}