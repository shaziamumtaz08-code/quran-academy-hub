import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  MessageCircle, CalendarOff, FolderOpen, Users, Video, FileText, ClipboardList,
  Clock, ExternalLink, CheckCircle2, XCircle, AlertCircle, Tag, Bell, Flame, CheckCircle,
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { reserveTab, navigateTab, closeTab } from '@/lib/popupWindow';
import { useKidContext } from '@/contexts/KidContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchIslamicDate } from '@/lib/islamicDate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DMChatSheet } from '@/components/chat/DMChatSheet';
import { PrayerBar } from '@/components/dashboard/teacher/PrayerBar';
import { findOrCreateAssignmentDM } from '@/lib/messaging';
import { toast } from 'sonner';
import { ensureFreshSession } from '@/lib/ensureSession';


const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

function getActivePrayer(prayers: Record<string, string>, tz: string): string | null {
  if (!prayers?.Fajr) return null;
  const now = new Date();
  const partsFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const h = +(partsFmt.find(p => p.type === 'hour')?.value || 0);
  const m = +(partsFmt.find(p => p.type === 'minute')?.value || 0);
  const nowMin = h * 60 + m;
  let active: string | null = null;
  for (const p of PRAYERS) {
    const t = prayers[p]; if (!t) continue;
    const [ph, pm] = t.split(':').map(Number);
    if (nowMin >= ph * 60 + pm) active = p;
  }
  return active;
}

function fmtTime12(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

export function StudentDashboard() {
  const { user, profile } = useAuth();
  const { activeKidId } = useKidContext();
  const navigate = useNavigate();

  // Active student id: if parent acting on a kid, use the kid; else self.
  const activeStudentId = activeKidId || user?.id || null;

  const [dmOpen, setDmOpen] = useState(false);
  const [dmGroupId, setDmGroupId] = useState<string | null>(null);
  const [dmTeacherName, setDmTeacherName] = useState<string>('Teacher');
  const [openingDm, setOpeningDm] = useState(false);

  // Assigned teacher for "Message Teacher" quick action
  const { data: assignedTeacher } = useQuery({
    queryKey: ['sd-assigned-teacher', activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select('teacher_id, teacher:profiles!student_teacher_assignments_teacher_id_fkey(id, full_name)')
        .eq('student_id', activeStudentId!)
        .in('status', ['active', 'on_hold'])
        .order('status', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const t: any = (data as any)?.teacher;
      return t ? { id: t.id, name: t.full_name || 'Teacher' } : null;
    },
  });

  const handleMessageTeacher = async () => {
    if (!activeStudentId) return;
    const ctxTeacherForDm = (dashCtx?.teachers || [])[0] || null;
    const teacherForDm = assignedTeacher || (ctxTeacherForDm?.teacher_id
      ? { id: ctxTeacherForDm.teacher_id as string, name: (ctxTeacherForDm.teacher_name as string) || 'Teacher' }
      : null);
    if (!teacherForDm) {
      toast.error('No assigned teacher found yet.');
      return;
    }
    setOpeningDm(true);
    try {
      const studentName = (studentProfile?.full_name as string) || 'Student';
      const groupId = await findOrCreateAssignmentDM(
        activeStudentId,
        teacherForDm.id,
        studentName,
        teacherForDm.name,
      );
      if (!groupId) {
        toast.error('Could not open conversation');
        return;
      }
      setDmGroupId(groupId);
      setDmTeacherName(teacherForDm.name);
      setDmOpen(true);
    } finally {
      setOpeningDm(false);
    }
  };


  // Profile of the active student (for header name + tz)
  const { data: studentProfile } = useQuery({
    queryKey: ['sd-profile', activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles').select('id, full_name, timezone')
        .eq('id', activeStudentId!).single();
      return data as any;
    },
  });

  const tz = studentProfile?.timezone || (profile as any)?.timezone || 'Asia/Karachi';
  const displayName = profile?.full_name || studentProfile?.full_name || 'Student';

  // Hijri + prayer times
  const { data: islamic } = useQuery({
    queryKey: ['sd-islamic', tz],
    queryFn: () => fetchIslamicDate(tz),
    staleTime: 30 * 60 * 1000,
  });

  const gregorian = useMemo(
    () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    []
  );
  const hijriStr = islamic?.formatted ||
    (() => {
      try {
        return new Intl.DateTimeFormat('en-TN-u-ca-islamic', {
          day: 'numeric', month: 'long', year: 'numeric',
        }).format(new Date()) + ' AH';
      } catch { return ''; }
    })();
  const activePrayer = islamic?.prayers ? getActivePrayer(islamic.prayers, tz) : null;

  // All active assignments (a student may have multiple: Nazra + Tarbiyah, etc.)
  const { data: assignments = [] } = useQuery({
    queryKey: ['sd-assignments', activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, subject:subject_id(name), schedules(id, day_of_week, student_local_time, duration_minutes, is_active)')
        .eq('student_id', activeStudentId!)
        .eq('status', 'active');
      const rows = (data || []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.teacher_id).filter(Boolean)));
      if (ids.length) {
        // Safe-column peer lookup (profiles peer reads go through this RPC).
        const { data: safe } = await supabase.rpc('get_safe_profiles', { p_ids: ids as string[] });
        const byId = new Map((safe as any[] | null || []).map((p: any) => [p.id, p]));
        rows.forEach((r) => { r.teacher = byId.get(r.teacher_id) || null; });
      }
      return rows;
    },
  });


  // Pick the assignment whose next active schedule occurrence is soonest.
  const nextSlot = useMemo(() => {
    const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const now = new Date();
    let best: { assignment: any; schedule: any; when: Date; minsUntil: number } | null = null;
    for (const a of (assignments as any[])) {
      for (const s of (a?.schedules || [])) {
        if (!s?.is_active || !s?.day_of_week || !s?.student_local_time) continue;
        const dow = DAYS.indexOf(String(s.day_of_week).toLowerCase());
        if (dow < 0) continue;
        const [hh, mm] = String(s.student_local_time).split(':').map(Number);
        const target = new Date(now);
        const diff = (dow - now.getDay() + 7) % 7;
        target.setDate(now.getDate() + diff);
        target.setHours(hh, mm || 0, 0, 0);
        if (target.getTime() <= now.getTime() - 60 * 60 * 1000) target.setDate(target.getDate() + 7);
        const mins = Math.round((target.getTime() - now.getTime()) / 60000);
        if (!best || mins < best.minsUntil) best = { assignment: a, schedule: s, when: target, minsUntil: mins };
      }
    }
    return best;
  }, [assignments]);

  const assignment = nextSlot?.assignment || (assignments as any[])[0] || null;

  // Live session for any of the student's active teachers (RPC bypasses RLS gaps
  // on live_sessions / zoom_accounts for students and parents).
  const { data: liveSession } = useQuery({
    queryKey: ['sd-live', activeStudentId],
    enabled: !!activeStudentId,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data } = await supabase.rpc('get_student_live_class', {
        p_student_id: activeStudentId!,
      });
      const row = (data as any[])?.[0];
      return row ? { ...row, id: row.session_id } : null;
    },
  });


  // Fallback teacher/subject via SECURITY DEFINER RPC (covers parent-role RLS gaps).
  const { data: dashCtx } = useQuery({
    queryKey: ['sd-ctx', activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc('get_student_dashboard_context', { _student_id: activeStudentId });
      return (data as any) || null;
    },
  });


  // Attendance (recent + stats)
  const { data: attendance = [] } = useQuery({
    queryKey: ['sd-attendance', activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance')
        .select('id, status, class_date, lesson_covered, homework')
        .eq('student_id', activeStudentId!)
        .order('class_date', { ascending: false })
        .limit(200);
      return (data || []) as any[];
    },
  });

  const stats = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'present').length;
    const pct = total ? Math.round((present / total) * 100) : 0;
    return { total, present, pct };
  }, [attendance]);

  const recentLessons = attendance.slice(0, 3);

  // Last payment + next pending invoice
  const { data: lastPayment } = useQuery({
    queryKey: ['sd-payment', activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_transactions')
        .select('amount_local, currency_local, payment_date, created_at')
        .eq('student_id', activeStudentId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: nextInvoice } = useQuery({
    queryKey: ['sd-invoice', activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('fee_invoices')
        .select('id, amount, currency, billing_month, due_date, status')
        .eq('student_id', activeStudentId!)
        .is('voided_at', null)
        .eq('is_archived', false)
        .in('status', ['pending', 'partially_paid', 'overdue'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('billing_month', { ascending: true })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: latestDueInvoice } = useQuery({
    queryKey: ['sd-latest-invoice-due', activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('fee_invoices')
        .select('id, amount, currency, billing_month, due_date, status')
        .eq('student_id', activeStudentId!)
        .is('voided_at', null)
        .eq('is_archived', false)
        .neq('status', 'voided')
        .order('billing_month', { ascending: false })
        .order('due_date', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  // Recent exams
  const { data: exams = [] } = useQuery({
    queryKey: ['sd-exams', activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('exams')
        .select('id, exam_date, percentage, template:template_id(name)')
        .eq('student_id', activeStudentId!)
        .order('exam_date', { ascending: false })
        .limit(3);
      return (data || []) as any[];
    },
  });

  // Priority inbox: notifications + recent chat msgs (sender != self) + open ticket comments
  const { data: inbox = [] } = useQuery({
    queryKey: ['sd-inbox', activeStudentId, user?.id],
    enabled: !!activeStudentId && !!user?.id,
    queryFn: async () => {
      const items: Array<{ kind: 'chat' | 'notif' | 'ticket'; title: string; preview: string; ts: string; href: string }> = [];

      const { data: notifs } = await supabase
        .from('notification_queue')
        .select('id, title, message, created_at, status')
        .eq('recipient_id', activeStudentId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);
      (notifs || []).forEach((n: any) =>
        items.push({ kind: 'notif', title: n.title || 'Notification', preview: n.message || '', ts: n.created_at, href: '/notifications' })
      );

      const { data: members } = await supabase
        .from('chat_members').select('group_id').eq('user_id', user!.id);
      const groupIds = (members || []).map((m: any) => m.group_id);
      if (groupIds.length) {
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('id, group_id, content, created_at, sender:sender_id(full_name)')
          .in('group_id', groupIds)
          .neq('sender_id', user!.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(5);
        (msgs || []).forEach((m: any) =>
          items.push({
            kind: 'chat',
            title: m.sender?.full_name || 'Message',
            preview: m.content || '',
            ts: m.created_at,
            href: `/chat?group=${m.group_id}`,
          })
        );
      }

      const { data: tickets } = await supabase
        .from('tickets')
        .select('id, subject, status, updated_at')
        .eq('creator_id', user!.id)
        .in('status', ['open', 'in_progress', 'pending'])
        .order('updated_at', { ascending: false })
        .limit(5);
      (tickets || []).forEach((t: any) =>
        items.push({ kind: 'ticket', title: t.subject || 'Ticket', preview: `Status: ${t.status}`, ts: t.updated_at, href: '/hub' })
      );

      return items.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 5);
    },
  });

  // Action Center counts
  const overdueInvoice = nextInvoice && nextInvoice.due_date && parseISO(nextInvoice.due_date) < new Date();
  const unreadChatCount = inbox.filter(i => i.kind === 'chat').length;
  const openTicketCount = inbox.filter(i => i.kind === 'ticket').length;

  // Spotlight
  const { data: spotlight } = useQuery({
    queryKey: ['sd-spotlight'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings').select('setting_value')
        .eq('setting_key', 'featured_spotlight').maybeSingle();
      const raw = (data as any)?.setting_value;
      if (!raw) return null;
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
    },
  });

  // Pieces -------------------------------------------------------------
  const firstName = (displayName || 'Student').split(' ')[0];
  const Header = (
    <PrayerBar
      firstName={firstName}
      islamicDate={islamic ?? null}
      timezone={tz}
    />
  );

  const sched = nextSlot?.schedule || (assignment?.schedules || []).find((s: any) => s.is_active);
  const ctxTeacher = (dashCtx?.teachers || [])[0] || null;
  const teacherName = assignment?.teacher?.full_name || ctxTeacher?.teacher_name || '—';
  const subjectName = assignment?.subject?.name || ctxTeacher?.subject_name || 'No subject assigned';
  const teacherInitial = (teacherName && teacherName !== '—' ? teacherName.charAt(0).toUpperCase() : 'T');

  const meetingLink = (liveSession as any)?.meeting_link;


  const isLive = !!(liveSession && meetingLink);

  // Join window: allow click 15 min before → 60 min after class start.
  const minsUntil = nextSlot?.minsUntil ?? null;
  const withinJoinWindow = minsUntil !== null && minsUntil <= 15 && minsUntil >= -60;
  const canClickJoin = isLive || withinJoinWindow;
  const [joining, setJoining] = useState(false);

  const handleJoinClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLive && meetingLink) {
      window.open(meetingLink, '_blank', 'noopener');
      return;
    }
    if (!assignment?.teacher_id) {
      toast.error('No assigned teacher yet.');
      return;
    }
    if (!withinJoinWindow) {
      toast.info('Join opens 15 minutes before class.');
      return;
    }
    // Reserve the tab within the click gesture — popup blockers reject
    // window.open() that happens after an await.
    const tab = reserveTab();
    try {
      setJoining(true);
      await ensureFreshSession();
      const { data, error } = await supabase.functions.invoke('zoom-join-class', {
        body: {
          teacherId: assignment.teacher_id,
          studentId: activeStudentId,
          assignmentId: assignment.id,
          scheduleId: sched?.id || null,
          scheduledStart: nextSlot?.when?.toISOString() || new Date().toISOString(),
        },
      });
      if (error) throw error;
      if (data?.ready && data?.joinUrl) {
        navigateTab(tab, data.joinUrl);
      } else {
        closeTab(tab);
        toast.info(data?.message || 'Waiting for teacher to open the class.');
      }
    } catch (err: any) {
      closeTab(tab);
      toast.error(err?.message || 'Could not join class');
    } finally {
      setJoining(false);
    }
  };


  // Time until next class
  const timeUntil = useMemo(() => {
    if (!sched?.day_of_week || !sched?.student_local_time) return null;
    const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const targetDow = DAYS.indexOf(String(sched.day_of_week).toLowerCase());
    if (targetDow < 0) return null;
    const [hh, mm] = String(sched.student_local_time).split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    let diff = (targetDow - now.getDay() + 7) % 7;
    target.setDate(now.getDate() + diff);
    target.setHours(hh, mm || 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 7);
    const mins = Math.round((target.getTime() - now.getTime()) / 60000);
    if (mins < 60) return `${mins}m away`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return `${h}h ${m}m away`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h away`;
  }, [sched]);

  const lastLessonText = (recentLessons[0] as any)?.lesson_covered || null;
  const scheduleStr = sched ? `${String(sched.day_of_week).charAt(0).toUpperCase()}${String(sched.day_of_week).slice(1)} ${fmtTime12(sched.student_local_time)}` : null;
  const hasUpcoming = !!sched || isLive;

  const NextClassCard = (
    <div
      className="rounded-xl border px-4 py-3 md:px-5 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
      style={{
        background: 'linear-gradient(135deg, #0f2a3a 60%, #1a3d4f)',
        borderColor: '#1e4a5e',
      }}
    >
      {/* Left */}
      <div className="flex flex-col gap-1 min-w-0">
        {hasUpcoming ? (
          <>
            <span
              className="inline-flex items-center gap-1.5 self-start text-[10px] font-semibold uppercase tracking-wider rounded-full px-2.5 py-1 border"
              style={{
                background: 'rgba(126,207,196,0.15)',
                color: '#7ecfc4',
                borderColor: 'rgba(126,207,196,0.25)',
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              {isLive ? 'LIVE NOW' : 'NEXT CLASS'}
            </span>
            <div className="text-[16px] font-medium truncate" style={{ color: '#f0f8fa' }}>
              {teacherName}
            </div>
            <div className="text-[12px] truncate" style={{ color: '#7ecfc4' }}>
              {subjectName}{scheduleStr ? ` · ${scheduleStr}` : ''}
            </div>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-1.5 text-[11px]" style={{ color: '#a8d8e0' }}>
              {timeUntil && !isLive && (
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {timeUntil}</span>
              )}
              {lastLessonText && (
                <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {lastLessonText}</span>
              )}
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {stats.present} of {stats.total} sessions</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-[13px]" style={{ color: '#7ecfc4' }}>
            <Clock className="h-4 w-4" /> No class scheduled today
          </div>
        )}
      </div>

      {/* Right */}
      {hasUpcoming && (
        <div className="flex flex-col items-stretch md:items-end gap-1.5 shrink-0 w-full md:w-auto">
          <button
            type="button"
            disabled={!canClickJoin || joining}
            onClick={handleJoinClick}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-5 py-2.5 text-[13px] font-medium text-white transition-colors w-full md:w-auto ${
              isLive ? 'animate-pulse' : ''
            } ${!canClickJoin || joining ? 'opacity-60 cursor-not-allowed' : ''}`}
            style={{ background: '#1d9e75' }}
            onMouseEnter={(e) => { if (canClickJoin && !joining) (e.currentTarget as HTMLButtonElement).style.background = '#0f6e56'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1d9e75'; }}
          >
            {joining ? 'Opening…' : isLive ? 'Join Now' : 'Join Class'} <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <div className="text-[11px] text-right" style={{ color: '#a8d8e0' }}>
            {isLive ? 'Class in progress' : 'Link goes live 15 min before'}
          </div>

        </div>
      )}
    </div>
  );

  const PerformanceCard = (
    <div className="bg-card border border-border rounded-xl p-3 md:p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Performance</div>
        <div className="text-[10px] text-muted-foreground">{format(new Date(), 'MMMM yyyy')}</div>
      </div>
      <div className="relative h-20 md:h-28">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%" outerRadius="100%"
            data={[{ name: 'Att', value: stats.total === 0 ? 100 : stats.pct, fill: stats.total === 0 ? 'hsl(var(--muted))' : '#1d9e75' }]}
            startAngle={90} endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'hsl(var(--muted))' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {stats.total === 0 ? (
            <>
              <div className="text-sm font-semibold text-muted-foreground">—</div>
              <div className="text-[10px] text-muted-foreground">No sessions yet</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-[hsl(var(--navy))]">{stats.pct}%</div>
              <div className="text-[10px] text-muted-foreground">Attendance</div>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Sessions attended</span>
          <span className="font-semibold" style={{ color: '#1d9e75' }}>{stats.present}/{stats.total}</span>
        </div>
        {(() => {
          const ym = format(new Date(), 'yyyy-MM');
          const monthAtt = (attendance as any[]).filter(a => (a.class_date || '').startsWith(ym));
          const monthPresent = monthAtt.filter(a => a.status === 'present').length;
          return (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">This month</span>
              <span className="font-medium">{monthPresent}/{monthAtt.length} sessions</span>
            </div>
          );
        })()}
        {(() => {
          let streak = 0;
          for (const a of attendance as any[]) {
            if (a.status === 'present') streak++; else break;
          }
          if (streak < 2) return null;
          return (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Streak</span>
              <span className="inline-flex items-center gap-1 font-medium text-amber-600">
                <Flame className="h-3 w-3" /> {streak} in a row
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );

  const quickLinks: Array<{ icon: any; label: string; iconBg: string; iconCol: string; to?: string; onClick?: () => void; disabled?: boolean }> = [
    { icon: MessageCircle, label: 'Message teacher', iconBg: 'bg-teal-50', iconCol: 'text-teal-600', onClick: handleMessageTeacher, disabled: openingDm },
    { icon: CalendarOff, label: 'Leave Request', iconBg: 'bg-amber-50', iconCol: 'text-amber-600', to: '/work-hub?new=1&category=leave_request' },
    { icon: FolderOpen, label: 'My files', iconBg: 'bg-violet-50', iconCol: 'text-violet-600', to: '/library' },
    { icon: Users, label: 'My network', iconBg: 'bg-blue-50', iconCol: 'text-blue-600', to: user?.id ? `/connections/student/${user.id}` : '/dashboard' },
    { icon: Video, label: 'Recordings', iconBg: 'bg-rose-50', iconCol: 'text-rose-600', to: '/recordings' },
    { icon: ClipboardList, label: 'Exam results', iconBg: 'bg-emerald-50', iconCol: 'text-emerald-600', to: '/student-reports' },
  ];

  const QuickLinksCard = (
    <div className="bg-card border border-border rounded-xl p-3 md:p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Quick links</div>
      <div className="grid grid-cols-3 gap-2">
        {quickLinks.map(q => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              disabled={q.disabled}
              onClick={() => (q.onClick ? q.onClick() : q.to && navigate(q.to))}
              className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              <span className={`flex items-center justify-center w-[30px] h-[30px] rounded-md ${q.iconBg}`}>
                <Icon size={16} className={q.iconCol} />
              </span>
              <span className="text-[10px] font-medium text-foreground text-center leading-tight">{q.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const displayDueInvoice = nextInvoice || latestDueInvoice;
  const displayDueDate = displayDueInvoice?.due_date || (displayDueInvoice?.billing_month ? `${displayDueInvoice.billing_month}-10` : null);
  const dueDays = displayDueDate ? differenceInDays(parseISO(displayDueDate), new Date()) : null;
  const dueColor =
    dueDays !== null && dueDays < 0 ? 'text-red-600' :
    dueDays !== null && dueDays <= 7 ? 'text-amber-600' : 'text-[hsl(var(--navy))]';

  const hasAnyFee = !!(lastPayment || displayDueInvoice);

  const FeeStatusCard = !hasAnyFee ? null : (
    <div className="bg-card border border-border rounded-xl p-3 md:p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Fee status</div>
      {!displayDueInvoice && lastPayment ? (
        <div className="flex items-center gap-2 py-1">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <span className="text-[12px] text-muted-foreground">No fees due</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/40 p-2.5">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-0.5">Last payment</div>
            {lastPayment ? (
              <>
                <div className="text-sm font-semibold text-[hsl(var(--navy))]">
                  {lastPayment.currency_local} {Number(lastPayment.amount_local || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {lastPayment.payment_date ? format(parseISO(lastPayment.payment_date), 'd MMM yyyy') : ''}
                </div>
              </>
            ) : (
              <div className="text-[12px] text-muted-foreground">No payments yet</div>
            )}
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-0.5">Next due</div>
            {displayDueInvoice ? (
              <>
                <div className={`text-sm font-semibold ${dueColor}`}>
                  {nextInvoice
                    ? `${nextInvoice.currency} ${Number(nextInvoice.amount || 0).toLocaleString()}`
                    : 'Paid'}
                </div>
                <div className={`text-[10px] mt-0.5 ${dueColor}`}>
                  {displayDueDate ? format(parseISO(displayDueDate), 'd MMM yyyy') : '—'}
                  {nextInvoice && dueDays !== null && (dueDays < 0 ? ` · ${Math.abs(dueDays)}d overdue` : dueDays === 0 ? ' · today' : ` · in ${dueDays}d`)}
                </div>
                {nextInvoice && (
                  <button
                    onClick={() => navigate('/finance')}
                    className="mt-1.5 text-[10px] font-medium text-white rounded px-2 py-0.5"
                    style={{ background: '#1d9e75' }}
                  >
                    Pay →
                  </button>
                )}
              </>
            ) : (
              <div className="text-[12px] text-muted-foreground">All clear</div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const actionItems: Array<{ icon: any; iconCol: string; dotCol: string; label: string; href: string }> = [];
  if (overdueInvoice) actionItems.push({ icon: AlertCircle, iconCol: 'text-amber-600', dotCol: 'bg-amber-500', label: 'Fee overdue — Pay now', href: '/finance' });
  if (unreadChatCount > 0) actionItems.push({ icon: MessageCircle, iconCol: 'text-blue-600', dotCol: 'bg-blue-500', label: `${unreadChatCount} unread message${unreadChatCount > 1 ? 's' : ''}`, href: '/chat' });
  if (openTicketCount > 0) actionItems.push({ icon: Tag, iconCol: 'text-slate-600', dotCol: 'bg-slate-400', label: `${openTicketCount} open request${openTicketCount > 1 ? 's' : ''}`, href: '/hub' });

  const ActionCenterCard = (
    <div className="bg-card border border-border rounded-xl px-3 py-3 md:px-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Action centre</div>
      {actionItems.length === 0 ? (
        <div className="flex items-center gap-2 py-0.5">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <span className="text-[13px] text-foreground">All caught up</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {actionItems.map((a, i) => (
            <button
              key={i}
              onClick={() => navigate(a.href)}
              className="flex items-center justify-between gap-2 py-1.5 text-left hover:bg-muted/40 rounded-md px-1 -mx-1"
            >
              <span className="flex items-center gap-2 text-[12px] text-foreground">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${a.dotCol}`} />
                {a.label}
              </span>
              <span className="text-muted-foreground text-xs">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const syllabusPct = stats.total
    ? Math.round(((attendance as any[]).filter(a => a.lesson_covered).length / stats.total) * 100)
    : 0;

  const RecentLessonsCard = (
    <div className="bg-card border border-border rounded-xl p-3 md:p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent lessons</div>
        <button onClick={() => navigate('/my-courses')} className="text-[11px] text-teal-600 hover:underline">View all →</button>
      </div>
      {recentLessons.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-3">No lessons recorded yet</div>
      ) : (
        <div className="flex flex-col">
          {recentLessons.map((l: any, idx: number) => (
            <div key={l.id} className={`flex items-start gap-2.5 py-2 ${idx < recentLessons.length - 1 ? 'border-b border-border/60' : ''}`}>
              <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-foreground truncate">{l.lesson_covered || 'No lesson recorded'}</div>
                {l.homework && (
                  <div
                    className="text-[13px] text-foreground/80 truncate"
                    style={{ fontFamily: '"Noto Naskh Arabic", "Noto Nastaliq Urdu", serif' }}
                  >
                    {l.homework}
                  </div>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground shrink-0 pt-0.5">{format(parseISO(l.class_date), 'd MMM')}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
          <span>Syllabus progress</span>
          <span>{syllabusPct}% complete</span>
        </div>
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${syllabusPct}%`, background: '#1d9e75' }} />
        </div>
      </div>
    </div>
  );

  const RecentResultsCard = (
    <div className="bg-card border border-border rounded-xl p-3 md:p-3.5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent results</div>
        <button onClick={() => navigate('/student-reports')} className="text-[11px] text-teal-600 hover:underline">View all →</button>
      </div>
      {exams.length === 0 ? (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-3">
          <ClipboardList className="h-3.5 w-3.5" /> No exams recorded yet
        </div>
      ) : (
        exams.slice(0, 3).map((e: any) => {
          const passed = (e.percentage || 0) >= 50;
          return (
            <div key={e.id} className="flex items-center justify-between py-1.5 border-b last:border-0 border-border/60 gap-2">
              <div className="min-w-0">
                <div className="text-[12px] font-medium truncate">{e.template?.name || 'Exam'}</div>
                <div className="text-[10px] text-muted-foreground">
                  {e.exam_date ? format(parseISO(e.exam_date), 'd MMM yyyy') : ''}
                </div>
              </div>
              <Badge className={passed ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                {passed ? 'PASS' : 'FAIL'}
              </Badge>
            </div>
          );
        })
      )}
    </div>
  );

  const SpotlightCard = (
    <div
      className="rounded-xl border p-3.5 flex flex-col items-center justify-center text-center"
      style={{
        background: 'linear-gradient(135deg, #eeedfe, #e1f5ee)',
        borderColor: 'rgba(126,207,196,0.35)',
        minHeight: 100,
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Spotlight</div>
      <div className="text-[12px] text-muted-foreground mb-2">Announcements &amp; featured items</div>
      <span className="inline-flex items-center text-[11px] text-muted-foreground rounded-md border border-border px-2 py-0.5">
        Coming soon
      </span>
    </div>
  );

  // Mobile bottom quick-links bar removed — the Quick Links card already covers these actions.

  return (
    <div className="flex flex-col gap-3 p-3 lg:p-4 pb-24 lg:pb-4">
      {Header}
      {NextClassCard}

      {/* 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Column 1 */}
        <div className="flex flex-col gap-3">
          {QuickLinksCard}
          {FeeStatusCard}
        </div>

        {/* Column 2 */}
        <div className="flex flex-col gap-3">
          {RecentLessonsCard}
          {RecentResultsCard}
        </div>

        {/* Column 3 */}
        <div className="flex flex-col gap-3">
          {PerformanceCard}
          {ActionCenterCard}
          {SpotlightCard}
        </div>
      </div>

      {MobileQuickLinksBar}

      <DMChatSheet
        open={dmOpen}
        onOpenChange={setDmOpen}
        groupId={dmGroupId}
        recipientName={dmTeacherName}
        whatsappProfileId={activeStudentId}
      />
    </div>
  );
}

export default StudentDashboard;
