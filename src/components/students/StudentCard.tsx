import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Target, User, Calendar, Clock, History } from 'lucide-react';

interface StudentCardProps {
  student: {
    id: string;
    full_name: string;
    email: string | null;
    subject_name: string | null;
    schedule_day: string | null;
    schedule_time: string | null;
    daily_target_lines: number;
    preferred_unit: string;
    last_lesson: string | null;
    homework: string | null;
    age: number | null;
    gender: string | null;
  };
  onViewSchedule: () => void;
  onMarkAttendance: () => void;
}

export function StudentCard({ student, onViewSchedule, onMarkAttendance }: StudentCardProps) {
  const getGenderLabel = (gender: string | null) => {
    if (!gender) return 'Not set';
    return gender.charAt(0).toUpperCase() + gender.slice(1);
  };

  // Check if today matches the schedule day
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const isClassToday = student.schedule_day?.toLowerCase() === today.toLowerCase();
  
  // Format time with PK timezone
  const formatTimeWithTZ = (time: string | null) => {
    if (!time) return null;
    return `${time} (PK)`;
  };

  return (
    <Card className="hover:border-sky/50 hover:shadow-lg transition-all duration-200 group flex flex-col border-l-4 border-l-navy dark:border-l-sky min-h-[320px] sm:min-h-[300px]">
      <CardContent className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Header: Avatar + Name + Subject Badge */}
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-navy to-navy-light dark:from-sky dark:to-sky-dark flex items-center justify-center flex-shrink-0 shadow-md">
            <User className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate text-navy dark:text-sky-light group-hover:text-sky transition-colors">
              {student.full_name}
            </h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {student.subject_name && (
                <Badge className="text-xs font-normal gap-1 bg-sky/10 text-sky-dark dark:bg-sky/20 dark:text-sky-light border-0">
                  <BookOpen className="h-3 w-3" />
                  {student.subject_name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Today's Class Time */}
        {isClassToday && student.schedule_time && (
          <div className="mt-3 p-2 rounded-md bg-gradient-to-r from-sky/20 to-sky/10 dark:from-sky/30 dark:to-sky/20 border border-sky/30">
            <div className="flex items-center gap-2 text-sm font-medium text-navy dark:text-sky-light">
              <Clock className="h-4 w-4 text-sky" />
              <span>Today's Class: {formatTimeWithTZ(student.schedule_time)}</span>
            </div>
          </div>
        )}

        {/* Info Row: Age, Gender, Target */}
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground flex-wrap bg-cream dark:bg-navy-dark/50 p-2 rounded-md">
          <span className="flex items-center gap-1 font-medium">
            <User className="h-3 w-3 text-navy dark:text-sky" />
            {student.age ? `${student.age} Yrs` : 'Age N/A'}
          </span>
          <span className="text-navy/30 dark:text-sky/30">•</span>
          <span className="font-medium">{getGenderLabel(student.gender)}</span>
          <span className="text-navy/30 dark:text-sky/30">•</span>
          <span className="flex items-center gap-1 font-medium">
            <Target className="h-3 w-3 text-sky" />
            {student.daily_target_lines} {student.preferred_unit}/day
          </span>
        </div>

        {/* History Section: Last Lesson - Sky Blue Accent */}
        <div className="mt-3 p-3 rounded-lg bg-gradient-to-br from-sky/15 to-sky/5 dark:from-sky/25 dark:to-sky/10 border border-sky/20">
          <div className="flex items-center gap-1.5 mb-1">
            <History className="h-3.5 w-3.5 text-sky" />
            <p className="text-xs font-semibold text-navy dark:text-sky-light">Last Lesson:</p>
          </div>
          <p className="text-sm text-foreground line-clamp-2 pl-5">
            {student.last_lesson || 'No lesson recorded yet'}
          </p>
        </div>

        {/* Footer: Action Buttons */}
        <div className="mt-auto pt-4 flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-14 text-base border-navy/20 dark:border-sky/20 hover:bg-cream dark:hover:bg-navy-light/20 hover:border-navy dark:hover:border-sky"
            onClick={(e) => {
              e.stopPropagation();
              onViewSchedule();
            }}
          >
            <Calendar className="h-5 w-5 mr-2 text-navy dark:text-sky" />
            Schedule
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 text-base bg-gradient-to-r from-navy to-navy-light dark:from-sky dark:to-sky-dark hover:from-navy-dark hover:to-navy dark:hover:from-sky-dark dark:hover:to-sky shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAttendance();
            }}
          >
            <Clock className="h-5 w-5 mr-2" />
            Mark
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}