import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Bell, ClipboardList, MessageSquare } from 'lucide-react';

interface PlanReminder {
  studentName: string;
  studentId: string;
}

interface WorkHubNotification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  category: string;
}

export function TeacherNotificationsSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const currentMonth = format(now, 'MM'); // DB stores as '01','02',...'12'
  const currentYear = format(now, 'yyyy');
  const currentMonthLabel = format(now, 'MMMM'); // For display only

  // Plan reminders for current month
  const { data: planReminders } = useQuery({
    queryKey: ['plan-reminders-dashboard', user?.id, currentMonth, currentYear],
    queryFn: async (): Promise<PlanReminder[]> => {
      if (!user?.id) return [];

      const { data: assignments } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, requires_planning, student:profiles!student_teacher_assignments_student_id_fkey(id, full_name)')
        .eq('teacher_id', user.id)
        .eq('status', 'active')
        .eq('requires_planning', true);

      if (!assignments?.length) return [];

      const studentIds = assignments.map(a => (a.student as any)?.id).filter(Boolean);
      if (!studentIds.length) return [];
      if (!studentIds.length) return [];

      const { data: plans } = await supabase
        .from('student_monthly_plans')
        .select('student_id')
        .eq('teacher_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .in('student_id', studentIds);

      const filledIds = new Set((plans || []).map(p => p.student_id));

      return assignments
        .filter(a => {
          const sid = (a.student as any)?.id;
          return sid && !filledIds.has(sid);
        })
        .map(a => ({
          studentName: (a.student as any)?.full_name || 'Student',
          studentId: (a.student as any)?.id,
        }));
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // WorkHub notifications (tickets/announcements sent to this teacher)
  const { data: workHubNotifs } = useQuery({
    queryKey: ['teacher-workhub-notifs', user?.id],
    queryFn: async (): Promise<WorkHubNotification[]> => {
      if (!user?.id) return [];

      const { data: tickets } = await supabase
        .from('tickets')
        .select('id, subject, description, created_at, category')
        .or(`assignee_id.eq.${user.id},creator_id.eq.${user.id}`)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5);

      return (tickets || []).map(t => ({
        id: t.id,
        title: t.subject,
        message: t.description || '',
        created_at: t.created_at,
        category: t.category || 'general',
      }));
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const hasPlanReminders = (planReminders?.length || 0) > 0;
  const hasWorkHub = (workHubNotifs?.length || 0) > 0;

  if (!hasPlanReminders && !hasWorkHub) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 text-center">
        <p className="text-xs text-muted-foreground">✨ All caught up! No pending items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Plan Reminders */}
      {hasPlanReminders && (
        <div className="bg-gradient-to-br from-gold/5 to-gold/10 border border-gold/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="h-4 w-4 text-gold" />
            <p className="font-extrabold text-[13px] text-gold">
              {currentMonth} Plan Pending ({planReminders!.length})
            </p>
          </div>
          <div className="space-y-1">
            {planReminders!.slice(0, 3).map((r, i) => (
              <p key={i} className="text-xs text-gold/80 pl-6">
                • {r.studentName}
              </p>
            ))}
            {planReminders!.length > 3 && (
              <p className="text-xs font-semibold text-gold pl-6">
                +{planReminders!.length - 3} more
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/planning')}
            className="mt-2.5 ml-6 bg-gold text-primary-foreground border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-gold/90 transition-colors"
          >
            Fill Plan Now →
          </button>
        </div>
      )}

      {/* WorkHub Notifications */}
      {hasWorkHub && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
            <MessageSquare className="h-4 w-4 text-primary" />
            <p className="font-extrabold text-[13px] text-foreground">Messages & Alerts</p>
            <button
              onClick={() => navigate('/workhub')}
              className="ml-auto text-[11px] text-teal font-bold bg-transparent border-none cursor-pointer hover:underline"
            >
              View All →
            </button>
          </div>
          <div className="divide-y divide-border">
            {workHubNotifs!.slice(0, 3).map(n => (
              <div
                key={n.id}
                className="px-3 py-2.5 hover:bg-secondary/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/workhub`)}
              >
                <p className="text-[13px] font-bold text-foreground truncate">{n.title}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {n.message.slice(0, 80)}{n.message.length > 80 ? '…' : ''}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {format(new Date(n.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
