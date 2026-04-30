import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Users, FileCheck, Bell } from 'lucide-react';

/**
 * Group/Recorded division widgets for TeacherDashboard.
 * Renders nothing for 1:1 (existing widgets cover that case).
 */
export function TeacherGroupAcademyWidgets() {
  const { user } = useAuth();
  const { activeDivision } = useDivision();
  const modelType = (activeDivision?.model_type as string) || null;

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-group-widgets', user?.id, activeDivision?.id],
    queryFn: async () => {
      if (!user?.id) return { classes: 0, todaySessions: [] as any[], pendingGrading: 0, recent: [] as any[] };

      // 1) Active classes the teacher staffs
      const { data: staff } = await (supabase as any)
        .from('course_class_staff')
        .select('class_id, course_classes!inner(id, name, course_id)')
        .eq('user_id', user.id);
      const classIds = (staff || []).map((s: any) => s.class_id).filter(Boolean);
      const courseIds = [...new Set((staff || []).map((s: any) => s.course_classes?.course_id).filter(Boolean))];

      // 2) Today's live sessions
      let todaySessions: any[] = [];
      try {
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date(); end.setHours(23,59,59,999);
        if (classIds.length) {
          const { data: ls } = await (supabase as any)
            .from('live_sessions')
            .select('id, class_id, scheduled_start, scheduled_end, status')
            .in('class_id', classIds)
            .gte('scheduled_start', start.toISOString())
            .lte('scheduled_start', end.toISOString())
            .order('scheduled_start', { ascending: true })
            .limit(5);
          todaySessions = ls || [];
        }
      } catch { /* table may not exist */ }

      // 3) Pending submissions to grade
      let pendingGrading = 0;
      try {
        if (courseIds.length) {
          const { data: assigns } = await (supabase as any)
            .from('course_assignments').select('id').in('course_id', courseIds);
          const assignIds = (assigns || []).map((a: any) => a.id);
          if (assignIds.length) {
            const { count } = await (supabase as any)
              .from('course_assignment_submissions')
              .select('id', { count: 'exact', head: true })
              .in('assignment_id', assignIds)
              .eq('status', 'submitted');
            pendingGrading = count || 0;
          }
        }
      } catch { /* ignore */ }

      // 4) Recent announcements (fall back to recent assignments if announcements table absent)
      let recent: any[] = [];
      try {
        if (courseIds.length) {
          const { data: ann } = await (supabase as any)
            .from('course_notifications')
            .select('id, title, created_at, course_id')
            .in('course_id', courseIds)
            .order('created_at', { ascending: false })
            .limit(3);
          recent = ann || [];
        }
      } catch { /* ignore */ }

      return {
        classes: classIds.length,
        todaySessions,
        pendingGrading,
        recent,
      };
    },
    enabled: !!user?.id && (modelType === 'group' || modelType === 'recorded'),
  });

  if (modelType !== 'group' && modelType !== 'recorded') return null;

  if (modelType === 'recorded') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Link to="/teaching" className="block">
          <Card className="p-3 hover:bg-muted/40 transition-colors">
            <BookOpen className="h-4 w-4 text-lms-accent mb-1" />
            <p className="text-[11px] text-muted-foreground">Recorded</p>
            <p className="text-sm font-semibold">Manage Courses</p>
          </Card>
        </Link>
        <Link to="/reports" className="block">
          <Card className="p-3 hover:bg-muted/40 transition-colors">
            <FileCheck className="h-4 w-4 text-lms-accent mb-1" />
            <p className="text-[11px] text-muted-foreground">Analytics</p>
            <p className="text-sm font-semibold">View Course Analytics</p>
          </Card>
        </Link>
      </div>
    );
  }

  // Group division
  if (isLoading) {
    return <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <BookOpen className="h-4 w-4 text-lms-accent mb-1" />
          <p className="text-[11px] text-muted-foreground">Active Classes</p>
          <p className="text-base font-bold text-lms-navy">{data?.classes ?? 0}</p>
        </Card>
        <Card className="p-3">
          <Users className="h-4 w-4 text-lms-accent mb-1" />
          <p className="text-[11px] text-muted-foreground">My Classes Today</p>
          <p className="text-base font-bold text-lms-navy">{data?.todaySessions.length ?? 0}</p>
        </Card>
        <Card className="p-3">
          <FileCheck className="h-4 w-4 text-amber-600 mb-1" />
          <p className="text-[11px] text-muted-foreground">Pending Grading</p>
          <p className="text-base font-bold text-lms-navy">{data?.pendingGrading ?? 0}</p>
        </Card>
        <Card className="p-3">
          <Bell className="h-4 w-4 text-lms-accent mb-1" />
          <p className="text-[11px] text-muted-foreground">Recent Announcements</p>
          <p className="text-base font-bold text-lms-navy">{data?.recent.length ?? 0}</p>
        </Card>
      </div>

      {(data?.recent || []).length > 0 && (
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-muted-foreground mb-2">Latest announcements</p>
          <ul className="space-y-1">
            {data!.recent.map((r: any) => (
              <li key={r.id} className="text-xs flex items-center justify-between">
                <span className="truncate">{r.title}</span>
                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
