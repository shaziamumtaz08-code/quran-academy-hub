import React from 'react';
import { Clock, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ClassItem {
  id: string;
  studentName: string;
  time: string;
  duration: number;
  status?: 'pending' | 'present' | 'absent' | 'late';
}

interface TodayClassesProps {
  classes: ClassItem[];
  onMarkAttendance?: (classId: string, status: 'present' | 'absent' | 'late') => void;
  isTeacher?: boolean;
}

export function TodayClasses({ classes, onMarkAttendance, isTeacher = false }: TodayClassesProps) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="font-serif text-xl font-bold text-foreground">Today's Classes</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>
      <div className="divide-y divide-border">
        {classes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No classes scheduled for today</p>
          </div>
        ) : (
          classes.map((classItem) => (
            <div key={classItem.id} className="p-4 hover:bg-secondary/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{classItem.studentName}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{classItem.time}</span>
                      <span>•</span>
                      <span>{classItem.duration} min</span>
                    </div>
                  </div>
                </div>
                {isTeacher && classItem.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-emerald-light border-emerald-light hover:bg-emerald-light/10"
                      onClick={() => onMarkAttendance?.(classItem.id, 'present')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Present
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-accent border-accent hover:bg-accent/10"
                      onClick={() => onMarkAttendance?.(classItem.id, 'late')}
                    >
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Late
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive hover:bg-destructive/10"
                      onClick={() => onMarkAttendance?.(classItem.id, 'absent')}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Absent
                    </Button>
                  </div>
                ) : (
                  <StatusBadge status={classItem.status || 'pending'} />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
      status === 'present' && "bg-emerald-light/10 text-emerald-light",
      status === 'absent' && "bg-destructive/10 text-destructive",
      status === 'late' && "bg-accent/10 text-accent",
      status === 'pending' && "bg-muted text-muted-foreground"
    )}>
      {status === 'present' && <CheckCircle className="h-3 w-3" />}
      {status === 'absent' && <XCircle className="h-3 w-3" />}
      {status === 'late' && <AlertCircle className="h-3 w-3" />}
      {status === 'pending' && <Clock className="h-3 w-3" />}
      <span className="capitalize">{status}</span>
    </span>
  );
}
