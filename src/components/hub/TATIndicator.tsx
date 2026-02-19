import React from 'react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { Clock, AlertTriangle } from 'lucide-react';

interface TATIndicatorProps {
  deadline: string | null;
  isOverdue: boolean;
}

export function TATIndicator({ deadline, isOverdue }: TATIndicatorProps) {
  if (!deadline) return <span className="text-xs text-muted-foreground">No TAT</span>;

  const deadlineDate = new Date(deadline);
  const overdue = isOverdue || isPast(deadlineDate);

  if (overdue) {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive font-medium">
        <AlertTriangle className="h-3 w-3" />
        Overdue {formatDistanceToNow(deadlineDate, { addSuffix: false })}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      {formatDistanceToNow(deadlineDate, { addSuffix: true })}
    </span>
  );
}
