import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, Users, Calendar } from 'lucide-react';
import { StatusIndicator } from '@/components/shared/StatusIndicator';
import { cn } from '@/lib/utils';

interface TeacherCardProps {
  teacher: {
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    status?: string;
    student_count?: number;
    registration_id?: string | null;
  };
  onClick?: () => void;
  onViewSchedule?: () => void;
  compact?: boolean;
  className?: string;
}

export function TeacherCard({ teacher, onClick, onViewSchedule, compact = false, className }: TeacherCardProps) {
  const initials = teacher.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-all cursor-pointer",
          className
        )}
        onClick={onClick}
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate text-foreground">{teacher.full_name}</p>
          {teacher.student_count !== undefined && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {teacher.student_count} student{teacher.student_count !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {teacher.status && teacher.status !== 'active' && (
          <StatusIndicator status={teacher.status} size="sm" />
        )}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-primary">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground truncate">{teacher.full_name}</h3>
              {teacher.registration_id && (
                <Badge variant="outline" className="text-[10px] h-5 font-mono">
                  {teacher.registration_id}
                </Badge>
              )}
              {teacher.status && (
                <StatusIndicator status={teacher.status} size="sm" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              {teacher.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {teacher.email}
                </span>
              )}
              {teacher.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {teacher.phone}
                </span>
              )}
              {teacher.student_count !== undefined && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {teacher.student_count} student{teacher.student_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {onViewSchedule && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5"
                onClick={(e) => { e.stopPropagation(); onViewSchedule(); }}
              >
                <Calendar className="h-3.5 w-3.5" />
                View Schedule
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
