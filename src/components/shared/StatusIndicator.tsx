import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, Ban, AlertTriangle, Pause, Tag, CalendarClock, UserX, Palmtree } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatusVariant = 'paid' | 'partially_paid' | 'pending' | 'overdue' | 'waived' | 'adjusted' |
  'present' | 'student_absent' | 'teacher_absent' | 'teacher_leave' | 'rescheduled' | 'student_rescheduled' | 'holiday' |
  'active' | 'paused' | 'completed' | 'left' | 'inactive' |
  'live' | 'scheduled' | 'cooldown';

const STATUS_MAP: Record<StatusVariant, { label: string; icon: typeof CheckCircle; className: string }> = {
  // Payment statuses
  paid: { label: 'Paid', icon: CheckCircle, className: 'bg-primary/10 text-primary border-primary/20' },
  partially_paid: { label: 'Partial', icon: Clock, className: 'bg-accent/20 text-accent-foreground border-accent/30' },
  pending: { label: 'Pending', icon: Clock, className: 'bg-muted text-muted-foreground border-border' },
  overdue: { label: 'Overdue', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
  waived: { label: 'Waived', icon: Ban, className: 'bg-muted text-muted-foreground border-border' },
  adjusted: { label: 'Adjusted', icon: Tag, className: 'bg-secondary text-secondary-foreground border-border' },
  // Attendance statuses
  present: { label: 'Present', icon: CheckCircle, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  student_absent: { label: 'Student Absent', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
  teacher_absent: { label: 'Teacher Absent', icon: UserX, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  teacher_leave: { label: 'Teacher Leave', icon: Palmtree, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  rescheduled: { label: 'Rescheduled', icon: CalendarClock, className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20' },
  student_rescheduled: { label: 'Student Rescheduled', icon: CalendarClock, className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20' },
  holiday: { label: 'Holiday', icon: Palmtree, className: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20' },
  // Assignment statuses
  active: { label: 'Active', icon: CheckCircle, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  paused: { label: 'Paused', icon: Pause, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  completed: { label: 'Completed', icon: CheckCircle, className: 'bg-muted text-muted-foreground border-border' },
  left: { label: 'Left', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
  inactive: { label: 'Inactive', icon: Pause, className: 'bg-muted text-muted-foreground border-border' },
  // Zoom statuses
  live: { label: 'Live', icon: CheckCircle, className: 'bg-destructive/10 text-destructive border-destructive/20 animate-pulse' },
  scheduled: { label: 'Scheduled', icon: Clock, className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20' },
  cooldown: { label: 'Cooldown', icon: Clock, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
};

interface StatusIndicatorProps {
  status: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
  label?: string; // override label
}

export function StatusIndicator({ status, size = 'sm', showIcon = true, className, label }: StatusIndicatorProps) {
  const config = STATUS_MAP[status as StatusVariant] || {
    label: status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: AlertTriangle,
    className: 'bg-muted text-muted-foreground border-border',
  };
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        config.className,
        size === 'sm' ? 'text-[10px] px-1.5 py-0 h-5' : 'text-xs px-2 py-0.5',
        className
      )}
    >
      {showIcon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
      {label || config.label}
    </Badge>
  );
}
