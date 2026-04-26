import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, BookOpen } from 'lucide-react';
import { AttendanceCommentThread } from './AttendanceCommentThread';

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  present: { icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Present', color: 'text-teal bg-teal/10 border-teal/20' },
  late: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Late', color: 'text-gold bg-gold/10 border-gold/20' },
  absent: { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Absent', color: 'text-destructive bg-destructive/10 border-destructive/20' },
  student_absent: { icon: <XCircle className="h-3.5 w-3.5" />, label: 'Absent', color: 'text-destructive bg-destructive/10 border-destructive/20' },
  rescheduled: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Rescheduled', color: 'text-sky bg-sky/10 border-sky/20' },
  student_leave: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Student Leave', color: 'text-orange-600 bg-orange-100/50 border-orange-200' },
  teacher_leave: { icon: <Clock className="h-3.5 w-3.5" />, label: 'Teacher Leave', color: 'text-purple-600 bg-purple-100/50 border-purple-200' },
};

interface Props {
  role: 'student' | 'teacher';
  limit?: number;
}

export function RecentAttendanceCards({ role, limit = 3 }: Props) {
  const { user } = useAuth();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['recent-attendance', user?.id, role, limit],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('attendance')
        .select(`
          id,
          status,
          class_date,
          class_time,
          lesson_notes,
          homework,
          lesson_covered,
          surah_name,
          ayah_from,
          teacher_id,
          student_id,
          student:profiles!attendance_student_id_fkey(full_name),
          teacher:profiles!attendance_teacher_id_fkey(full_name)
        `)
        .order('class_date', { ascending: false })
        .limit(limit);

      if (role === 'student') {
        query = query.eq('student_id', user.id);
      } else {
        query = query.eq('teacher_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((r: any) => ({
        ...r,
        otherName: role === 'student'
          ? r.teacher?.full_name || 'Teacher'
          : r.student?.full_name || 'Student',
      }));
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(limit)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 text-center">
        <BookOpen className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">No attendance records yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {records.map((rec: any) => {
        const sc = statusConfig[rec.status] || statusConfig.present;
        return (
          <div key={rec.id} className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-start justify-between mb-1">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[12px] font-bold text-foreground truncate">{rec.otherName}</p>
                  <Badge className={`text-[9px] px-1.5 py-0 h-4 border ${sc.color}`}>
                    {sc.icon}
                    <span className="ml-0.5">{sc.label}</span>
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(rec.class_date), 'EEE, MMM d')} · {rec.class_time?.slice(0, 5)}
                </p>
              </div>
            </div>

            {/* Lesson notes */}
            {(rec.lesson_notes || rec.lesson_covered || rec.surah_name) && (
              <div className="mt-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5">
                {rec.lesson_covered && (
                  <p className="text-[11px] text-foreground"><span className="font-semibold">Lesson:</span> {rec.lesson_covered}</p>
                )}
                {rec.surah_name && (
                  <p className="text-[11px] text-foreground"><span className="font-semibold">Surah:</span> {rec.surah_name} {rec.ayah_from ? `(Ayah ${rec.ayah_from})` : ''}</p>
                )}
                {rec.lesson_notes && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{rec.lesson_notes}</p>
                )}
                {rec.homework && (
                  <p className="text-[11px] text-primary font-semibold mt-0.5">📝 HW: {rec.homework}</p>
                )}
              </div>
            )}

            {/* Comment thread */}
            <AttendanceCommentThread attendanceId={rec.id} compact />
          </div>
        );
      })}
    </div>
  );
}
