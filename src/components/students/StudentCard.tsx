import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, Target, User } from 'lucide-react';

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
  };
  onClick: () => void;
}

export function StudentCard({ student, onClick }: StudentCardProps) {
  const formatSchedule = (day: string | null, time: string | null) => {
    if (!day && !time) return null;
    if (day && time) return `${day} @ ${time}`;
    return day || time;
  };

  return (
    <Card 
      className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {student.full_name}
            </h3>
            
            <div className="flex flex-wrap gap-1.5 mt-2">
              {student.subject_name && (
                <Badge variant="secondary" className="text-xs font-normal gap-1">
                  <BookOpen className="h-3 w-3" />
                  {student.subject_name}
                </Badge>
              )}
              {formatSchedule(student.schedule_day, student.schedule_time) && (
                <Badge variant="outline" className="text-xs font-normal gap-1">
                  <Clock className="h-3 w-3" />
                  {formatSchedule(student.schedule_day, student.schedule_time)}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <Target className="h-3 w-3" />
              <span>{student.daily_target_lines} {student.preferred_unit}/day</span>
            </div>

            {student.last_lesson && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                Last: {student.last_lesson}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}