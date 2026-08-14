import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export function RecentSessionsCard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['teacher-recent-sessions-card', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select(`
          id, status, class_date, class_time, surah_name, ayah_from, lesson_covered, lesson_display,
          student:profiles!attendance_student_id_fkey(full_name)
        `)
        .eq('teacher_id', user!.id)
        .order('class_date', { ascending: false })
        .limit(4);
      return data || [];
    },
  });

  return (
    <div className="bg-card rounded-2xl p-3 md:p-4 border border-border shadow-card h-full">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[12px] font-semibold text-muted-foreground">Recent sessions</p>
        <button
          onClick={() => navigate('/attendance')}
          className="text-[11px] text-primary hover:underline"
        >
          View all →
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      ) : records.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-3 text-center">No recent sessions</p>
      ) : (
        <div>
          {records.map((r: any, i) => {
            const isPresent = r.status === 'present' || r.status === 'late';
            return (
              <div
                key={r.id}
                className={`flex items-start justify-between gap-2 py-2 ${i < records.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-medium text-foreground truncate">
                      {r.student?.full_name || 'Student'}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                        isPresent
                          ? 'bg-teal/10 text-teal border-teal/20'
                          : 'bg-destructive/10 text-destructive border-destructive/20'
                      }`}
                    >
                      {isPresent ? 'Present' : 'Absent'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {format(new Date(r.class_date), 'EEE, MMM d')} · {r.class_time?.slice(0, 5)}
                    {(r.lesson_display || r.lesson_covered) ? ` · ${r.lesson_display || r.lesson_covered}` : ''}
                    {r.surah_name ? ` · ${r.surah_name}${r.ayah_from ? ` (Ayah ${r.ayah_from})` : ''}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/attendance')}
                  className="text-[11px] border border-border rounded-md px-2 py-0.5 text-muted-foreground hover:bg-secondary flex-shrink-0"
                >
                  Comment
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
