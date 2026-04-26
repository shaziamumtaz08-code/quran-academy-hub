import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, parseISO } from 'date-fns';
import { BookOpen, CheckCircle, XCircle, Clock } from 'lucide-react';

interface StudentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
}

interface AttendanceRecord {
  id: string;
  class_date: string;
  class_time: string;
  status: string;
  lesson_covered: string | null;
  surah_name: string | null;
  ayah_from: number | null;
  ayah_to: number | null;
  lines_completed: number | null;
  homework: string | null;
}

export function StudentHistoryDialog({ open, onOpenChange, studentId, studentName }: StudentHistoryDialogProps) {
  // Fetch last 7 days of attendance
  const { data: records, isLoading } = useQuery({
    queryKey: ['student-history', studentId],
    queryFn: async () => {
      const today = new Date();
      const weekAgo = subDays(today, 7);
      
      const { data, error } = await supabase
        .from('attendance')
        .select('id, class_date, class_time, status, lesson_covered, surah_name, ayah_from, ayah_to, lines_completed, homework')
        .eq('student_id', studentId)
        .gte('class_date', format(weekAgo, 'yyyy-MM-dd'))
        .lte('class_date', format(today, 'yyyy-MM-dd'))
        .order('class_date', { ascending: false });
      
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: open && !!studentId,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'student_absent':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      present: 'Present',
      student_absent: 'Student Absent',
      student_leave: 'Student Leave',
      teacher_absent: 'Teacher Absent',
      teacher_leave: 'Teacher Leave',
      rescheduled: 'Rescheduled',
      student_rescheduled: 'Student Rescheduled',
      holiday: 'Holiday',
    };
    return labels[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {studentName} - Past Week Lessons
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !records || records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No lessons in the past week</p>
            </div>
          ) : (
            records.map((record) => (
              <div 
                key={record.id} 
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(record.status)}
                    <span className="font-medium text-sm">
                      {format(parseISO(record.class_date), 'EEE, MMM d')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {record.class_time}
                    </span>
                  </div>
                  <Badge variant={record.status === 'present' ? 'default' : 'secondary'} className="text-xs">
                    {getStatusLabel(record.status)}
                  </Badge>
                </div>
                
                {record.status === 'present' && (
                  <div className="space-y-1 text-sm">
                    {record.surah_name && (
                      <p className="text-foreground">
                        <span className="text-muted-foreground">Lesson: </span>
                        {record.surah_name}
                        {record.ayah_from && ` (Ayah ${record.ayah_from}${record.ayah_to ? `-${record.ayah_to}` : ''})`}
                      </p>
                    )}
                    {record.lines_completed && (
                      <p className="text-muted-foreground">
                        Lines: {record.lines_completed}
                      </p>
                    )}
                    {record.homework && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">Homework:</span> {record.homework}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}