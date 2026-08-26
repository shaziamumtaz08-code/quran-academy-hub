import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock } from 'lucide-react';
import { formatTime12h } from '@/lib/timezones';

const DAYS_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

interface Props {
  mode: 'teacher' | 'student';
}

/** Group/course-based divisions: classes the user teaches or is enrolled in. */
export default function GroupClassScheduleView({ mode }: Props) {
  const { user } = useAuth();
  const { activeDivision } = useDivision();

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['my-group-classes', mode, user?.id, activeDivision?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const table = mode === 'teacher' ? 'course_class_staff' : 'course_class_students';
      const { data: rows, error } = await (supabase as any)
        .from(table)
        .select('class_id, course_classes!inner(id, name, course_id, schedule_days, schedule_time, session_duration, courses!inner(name))')
        .eq(mode === 'teacher' ? 'user_id' : 'student_id', user!.id);
      if (error) throw error;
      if (!rows?.length) return [];

      const classIds = rows.map((r: any) => r.class_id).filter(Boolean);
      let liveSessions: any[] = [];
      if (classIds.length) {
        const { data: ls } = await (supabase as any)
          .from('live_sessions')
          .select('id, class_id, scheduled_start')
          .in('class_id', classIds)
          .gte('scheduled_start', new Date().toISOString())
          .order('scheduled_start', { ascending: true })
          .limit(200);
        liveSessions = ls || [];
      }

      return rows.map((r: any) => {
        const cls = r.course_classes;
        return {
          id: r.class_id,
          class_name: cls?.name || 'Unnamed Class',
          course_name: cls?.courses?.name || '—',
          schedule_days: Array.isArray(cls?.schedule_days) ? cls.schedule_days : [],
          schedule_time: cls?.schedule_time || null,
          duration_minutes: cls?.session_duration || null,
          next_session: liveSessions.find((l) => l.class_id === r.class_id)?.scheduled_start || null,
        };
      });
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  if (!classes.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-base font-medium">No classes yet</p>
        <p className="text-sm mt-1">
          {mode === 'teacher'
            ? "You aren't currently staffed on any group classes."
            : "You aren't enrolled in any group classes yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {classes.map((c: any) => (
        <Card key={c.id} className="border-border">
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{c.class_name}</div>
              <p className="text-xs text-muted-foreground truncate">{c.course_name}</p>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {c.schedule_time ? formatTime12h(String(c.schedule_time).slice(0, 5)) : '—'}
                {c.duration_minutes ? ` · ${c.duration_minutes}m` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {c.schedule_days.length === 0 && <span className="text-xs text-muted-foreground">No days set</span>}
              {c.schedule_days.map((d: string) => (
                <Badge key={d} variant="outline" className="text-[10px] px-1.5 py-0">
                  {DAYS_LABELS[String(d).toLowerCase()] || d}
                </Badge>
              ))}
              {c.next_session && (
                <Badge variant="secondary" className="text-[10px]">
                  Next {new Date(c.next_session).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
