import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth } from 'date-fns';

export function TeacherActionCentre() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['teacher-action-centre', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('id, student_id, profile:student_id(full_name)')
        .eq('teacher_id', user!.id)
        .eq('status', 'active');

      const assignmentIds = (assignments || []).map((a: any) => a.id);
      let plannedIds = new Set<string>();
      if (assignmentIds.length) {
        const { data: plans } = await supabase
          .from('student_monthly_plans')
          .select('assignment_id')
          .in('assignment_id', assignmentIds)
          .gte('month', monthStart);
        plannedIds = new Set((plans || []).map((p: any) => p.assignment_id));
      }

      const pending = (assignments || []).filter((a: any) => !plannedIds.has(a.id));
      const pendingNames = pending.slice(0, 3).map((a: any) => a.profile?.full_name).filter(Boolean);
      const extra = pending.length - pendingNames.length;

      return {
        pendingCount: pending.length,
        pendingNames: pendingNames.join(', ') + (extra > 0 ? ` +${extra}` : ''),
      };
    },
  });

  const pendingCount = data?.pendingCount ?? 0;

  return (
    <div className="flex flex-col gap-2.5 h-full">
      <div className="bg-card rounded-2xl p-3 md:p-4 border border-border shadow-card flex-1">
        <p className="text-[12px] font-semibold text-muted-foreground mb-2">Action centre</p>

        <div className="flex items-start gap-2 py-2 border-b border-border">
          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${pendingCount > 0 ? 'bg-gold' : 'bg-teal'}`} />
          <div className="flex-1">
            <p className="text-[12px] text-foreground leading-tight">
              {pendingCount > 0
                ? `Lesson plans pending (${pendingCount})`
                : 'All lesson plans complete'}
            </p>
            {pendingCount > 0 && (
              <>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {data?.pendingNames}
                </p>
                <button
                  onClick={() => navigate('/planning')}
                  className="mt-1 text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-md px-2 py-0.5 hover:bg-primary/15"
                >
                  Fill now →
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 py-2 border-b border-border">
          <span className="w-2 h-2 rounded-full mt-1.5 bg-teal flex-shrink-0" />
          <div>
            <p className="text-[12px] text-foreground leading-tight">All caught up on attendance</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tap Mark attendance to log today</p>
          </div>
        </div>

        <div className="flex items-start gap-2 py-2">
          <span className="w-2 h-2 rounded-full mt-1.5 bg-sky flex-shrink-0" />
          <div>
            <p className="text-[12px] text-foreground leading-tight">0 missed classes this month</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Teacher absent / leave</p>
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl border border-primary/20 p-3 text-center"
        style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(var(--teal)/0.08))' }}
      >
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Spotlight</p>
        <p className="text-[12px] text-foreground">Announcements & featured items</p>
        <span className="inline-block mt-1.5 text-[10px] text-muted-foreground bg-secondary border border-border rounded-md px-2 py-0.5">
          Coming soon
        </span>
      </div>
    </div>
  );
}
