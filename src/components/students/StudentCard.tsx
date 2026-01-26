import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Target, User, Calendar, Clock, BookMarked, AlertTriangle, Pause, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UnifiedAttendanceForm, type StudentInfo } from '@/components/attendance/UnifiedAttendanceForm';

type AssignmentStatus = 'active' | 'paused' | 'completed';

const STATUS_CONFIG = {
  active: { label: 'Active', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  paused: { label: 'Paused', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  completed: { label: 'Completed', badgeClass: 'bg-slate-400/10 text-slate-600 border-slate-400/20' },
} as const;

interface StudentCardProps {
  student: {
    id: string;
    full_name: string;
    email: string | null;
    subject_name: string | null;
    subject_id?: string | null;
    assignment_status?: AssignmentStatus;
    daily_target_lines: number;
    preferred_unit: string;
    last_lesson: string | null;
    homework: string | null;
    age: number | null;
    gender: string | null;
    timezone?: string;
  };
  onViewHistory: () => void;
  onViewSchedule: () => void;
  // Remove the onMarkAttendance prop - we handle it internally now
}

export function StudentCard({ student, onViewHistory, onViewSchedule }: StudentCardProps) {
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const status = student.assignment_status || 'active';
  const isPaused = status === 'paused';
  const isCompleted = status === 'completed';
  const isInactive = isPaused || isCompleted;

  // Check if we have any info to display
  const hasAge = student.age !== null && student.age !== undefined;
  const hasGender = student.gender !== null && student.gender !== undefined && student.gender !== '';
  const hasTarget = student.daily_target_lines > 0;
  const hasInfoRow = hasAge || hasGender || hasTarget;

  return (
    <Card className={cn(
      "hover:border-sky/50 hover:shadow-lg transition-all duration-200 group flex flex-col overflow-hidden",
      isPaused ? "border-l-4 border-l-amber-500 opacity-75" : "border-l-4 border-l-navy dark:border-l-sky",
      isCompleted && "opacity-50"
    )}>
      <CardContent className="p-4 flex flex-col flex-1 min-h-0">
        {/* Paused Warning Banner */}
        {isPaused && (
          <div className="mb-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
            <Pause className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Assignment paused – actions disabled
            </span>
          </div>
        )}

        {/* Header: Name + Subject (Left) | History Icon (Right) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg leading-tight truncate text-navy dark:text-sky-light">
                {student.full_name}
              </h3>
              {status !== 'active' && (
                <Badge variant="outline" className={cn("text-[10px] h-5", STATUS_CONFIG[status].badgeClass)}>
                  {STATUS_CONFIG[status].label}
                </Badge>
              )}
            </div>
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

        {/* Footer: Action Buttons */}
        <div className="pt-4 mt-auto space-y-2">
          {/* Mark Attendance Button with Last Lesson Tooltip */}
          {!isInactive && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full h-12 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttendanceOpen(true);
                    }}
                  >
                    <PenLine className="h-4 w-4 mr-1.5" />
                    Mark Attendance
                  </Button>
                </TooltipTrigger>
                {student.last_lesson && (
                  <TooltipContent side="top" className="bg-navy text-white border-navy-light">
                    <p className="text-xs">Last: {student.last_lesson}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          
          <Button
            variant="outline"
            className="w-full h-10 text-sm border-navy/20 dark:border-sky/20 hover:bg-cream dark:hover:bg-navy-light/20"
            onClick={(e) => {
              e.stopPropagation();
              onViewSchedule();
            }}
          >
            <Calendar className="h-4 w-4 mr-1.5 text-navy dark:text-sky" />
            View Schedule
          </Button>
        </div>

        {/* Unified Attendance Form Dialog */}
        <UnifiedAttendanceForm
          open={attendanceOpen}
          onOpenChange={setAttendanceOpen}
          student={{
            id: student.id,
            full_name: student.full_name,
            subject_name: student.subject_name,
            subject_id: student.subject_id,
            last_lesson: student.last_lesson,
            daily_target_lines: student.daily_target_lines,
            preferred_unit: student.preferred_unit,
            timezone: student.timezone,
          }}
        />
      </CardContent>
    </Card>
  );
}