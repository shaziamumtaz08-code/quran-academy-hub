import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Target, User, Calendar, Clock } from 'lucide-react';

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

  return (
    <Card className="hover:border-primary/50 hover:shadow-md transition-all duration-200 group flex flex-col">
      <CardContent className="p-4 flex flex-col flex-1">
        {/* Header: Avatar + Name + Subject Badge + Schedule Icon */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                {student.full_name}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewSchedule();
                }}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="View Full Schedule"
              >
                <Calendar className="h-4 w-4" />
              </button>
            </div>
            {student.subject_name && (
              <Badge variant="secondary" className="text-xs font-normal gap-1 mt-1">
                <BookOpen className="h-3 w-3" />
                {student.subject_name}
              </Badge>
            )}
          </div>
        </div>

        {/* Info Row: Age, Gender, Target */}
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {student.age ? `${student.age} Yrs` : 'Age N/A'}
          </span>
          <span>•</span>
          <span>{getGenderLabel(student.gender)}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            {student.daily_target_lines} {student.preferred_unit}/day
          </span>
        </div>

        {/* History Section: Last Lesson - Light Blue Accent */}
        <div className="mt-3 p-2.5 rounded-md bg-[hsl(210,100%,95%)] dark:bg-[hsl(210,50%,20%)] border border-[hsl(210,100%,85%)] dark:border-[hsl(210,50%,30%)]">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Last Lesson:</p>
          <p className="text-sm text-foreground line-clamp-2">
            {student.last_lesson || 'No lesson recorded yet'}
          </p>
        </div>

        {/* Footer: Mark Attendance Button */}
        <div className="mt-auto pt-3">
          <Button
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAttendance();
            }}
          >
            <Clock className="h-4 w-4 mr-2" />
            Mark Attendance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}