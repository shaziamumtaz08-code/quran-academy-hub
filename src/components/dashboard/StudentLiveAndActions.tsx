import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CalendarOff, MessageSquare, Video, User as UserIcon } from 'lucide-react';
import { CreateTicketDialog } from '@/components/hub/CreateTicketDialog';
import { toast } from 'sonner';

interface Props {
  studentId: string;
  studentName?: string;
}

/**
 * Real-data block for the unified Student/Parent dashboard:
 *  - Active teacher card
 *  - Latest fee invoice status
 *  - Live "Join Class" button (shown only when a session is live for the student's teacher)
 *  - Quick actions: Request Leave + Message Teacher
 */
export function StudentLiveAndActions({ studentId, studentName }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [creatingDm, setCreatingDm] = useState(false);

  // Active teacher assignment
  const { data: assignment } = useQuery({
    queryKey: ['dash-active-assignment', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, teacher:teacher_id(id, full_name)')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!studentId,
  });

  const teacherId: string | undefined = assignment?.teacher_id;
  const teacherName: string = assignment?.teacher?.full_name || '';

  // Latest fee invoice
  const { data: latestInvoice } = useQuery({
    queryKey: ['dash-latest-invoice', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_invoices')
        .select('id, status, amount, currency, billing_month, due_date, paid_at')
        .eq('student_id', studentId)
        .order('billing_month', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!studentId,
  });

  // Live session for this teacher
  const { data: liveSession } = useQuery({
    queryKey: ['dash-live-session', teacherId],
    queryFn: async () => {
      if (!teacherId) return null;
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, status, license_id, license:license_id(meeting_link)')
        .eq('teacher_id', teacherId)
        .eq('status', 'live')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!teacherId,
    refetchInterval: 30000,
  });

  const meetingLink: string | undefined = liveSession?.license?.meeting_link;

  const feeBadge = useMemo(() => {
    if (!latestInvoice) return null;
    const monthLabel = (() => {
      try {
        const d = new Date(latestInvoice.billing_month + '-01');
        return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      } catch { return latestInvoice.billing_month; }
    })();
    const amt = `${latestInvoice.currency || 'PKR'} ${Number(latestInvoice.amount || 0).toLocaleString()}`;
    if (latestInvoice.status === 'paid') {
      return { tone: 'green' as const, text: `Paid — ${monthLabel}` };
    }
    const due = latestInvoice.due_date ? new Date(latestInvoice.due_date) : null;
    const overdue = due ? due.getTime() < Date.now() : false;
    if (overdue) {
      return { tone: 'red' as const, text: `Overdue — ${amt}` };
    }
    const dueLabel = due ? due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
    return { tone: 'amber' as const, text: `Due ${dueLabel} — ${amt}` };
  }, [latestInvoice]);

  const toneStyles: Record<string, { bg: string; color: string; border: string }> = {
    green: { bg: '#e6f4ea', color: '#1a7340', border: '#bfe0c8' },
    amber: { bg: '#fff8e6', color: '#8a5c00', border: '#f5d485' },
    red: { bg: '#fde8e8', color: '#b42a2a', border: '#f3b5b5' },
  };

  const handleMessageTeacher = async () => {
    if (!teacherId || !user?.id) {
      toast.error('No active teacher assigned yet');
      return;
    }
    setCreatingDm(true);
    try {
      // Reuse helper but without course scoping — pass null-ish course
      // findOrCreateCourseDM requires courseId; do a lightweight search/create here instead.
      const { data: existing } = await supabase
        .from('chat_groups')
        .select('id, chat_members(user_id)')
        .eq('is_dm', true)
        .is('course_id', null);

      let groupId: string | null = null;
      for (const g of existing || []) {
        const ids: string[] = (g as any).chat_members?.map((m: any) => m.user_id) || [];
        if (ids.includes(user.id) && ids.includes(teacherId) && ids.length === 2) {
          groupId = g.id;
          break;
        }
      }

      if (!groupId) {
        const { data: newGroup, error } = await supabase
          .from('chat_groups')
          .insert({
            name: `${studentName || 'Student'} ↔ ${teacherName || 'Teacher'}`,
            type: 'dm',
            created_by: user.id,
            is_dm: true,
            is_active: true,
            channel_mode: 'private',
          })
          .select('id')
          .single();
        if (error || !newGroup) throw error || new Error('Failed to create DM');
        groupId = newGroup.id;
        await supabase.from('chat_members').insert([
          { group_id: groupId, user_id: user.id, role: 'member' },
          { group_id: groupId, user_id: teacherId, role: 'member' },
        ]);
      }

      navigate(`/chat?group=${groupId}`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not open chat');
    } finally {
      setCreatingDm(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Teacher + Fee + Join row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Teacher card */}
        <div className="bg-white rounded-[10px] p-3 flex items-center gap-3" style={{ border: '0.5px solid #e8e9eb' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#eef2fa', color: '#1a56b0' }}>
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 11, color: '#7a7f8a' }}>Assigned teacher</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#0f2044' }} className="truncate">
              {teacherName || 'Not yet assigned'}
            </div>
          </div>
        </div>

        {/* Fee status */}
        <div className="bg-white rounded-[10px] p-3 flex items-center gap-3" style={{ border: '0.5px solid #e8e9eb' }}>
          <div style={{ fontSize: 11, color: '#7a7f8a', minWidth: 60 }}>Fee status</div>
          {feeBadge ? (
            <span
              className="px-2.5 py-1 rounded-full"
              style={{
                fontSize: 12,
                fontWeight: 500,
                background: toneStyles[feeBadge.tone].bg,
                color: toneStyles[feeBadge.tone].color,
                border: `0.5px solid ${toneStyles[feeBadge.tone].border}`,
              }}
            >
              {feeBadge.text}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: '#aab0bc' }}>No invoices</span>
          )}
        </div>

        {/* Join class */}
        <div className="bg-white rounded-[10px] p-3 flex items-center justify-center" style={{ border: '0.5px solid #e8e9eb' }}>
          {liveSession && meetingLink ? (
            <a
              href={meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium animate-pulse"
              style={{ background: '#1a7340', fontSize: 13 }}
            >
              <Video className="w-4 h-4" /> Join Class
            </a>
          ) : (
            <span style={{ fontSize: 12, color: '#aab0bc' }}>No live class right now</span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#aab0bc', letterSpacing: 0.5, marginBottom: 6 }}>
          QUICK ACTIONS
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setLeaveOpen(true)} className="justify-start">
            <CalendarOff className="w-4 h-4 mr-2" /> Request Leave
          </Button>
          <Button
            variant="outline"
            onClick={handleMessageTeacher}
            disabled={creatingDm || !teacherId}
            className="justify-start"
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Message Teacher
          </Button>
        </div>
      </div>

      <CreateTicketDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        defaultCategory="leave_request"
      />
    </div>
  );
}
