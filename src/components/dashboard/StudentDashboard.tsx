import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  MessageCircle, Send, FolderOpen, Network, Video, FileText,
  Clock, ExternalLink, CheckCircle2, XCircle, AlertCircle, Tag, Bell,
} from 'lucide-react';
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useKidContext } from '@/contexts/KidContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchIslamicDate } from '@/lib/islamicDate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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

  // Next class assignment + schedules
  const { data: assignment } = useQuery({
    queryKey: ['sd-assignment', activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select('id, teacher_id, teacher:teacher_id(id, full_name), subject:subject_id(name), schedules(day_of_week, student_local_time, is_active)')
        .eq('student_id', activeStudentId!)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  // Live session for the assigned teacher
  const { data: liveSession } = useQuery({
    queryKey: ['sd-live', assignment?.teacher_id],
    enabled: !!assignment?.teacher_id,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from('live_sessions')
        .select('id, status, license:license_id(meeting_link)')
        .eq('teacher_id', assignment.teacher_id)
        .eq('status', 'live')
        .order('actual_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
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

  const recentLessons = attendance.slice(0, 4);

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
        .eq('status', 'pending')
        .order('billing_month', { ascending: true })
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
  const Header = (
    <div className="bg-[hsl(var(--navy))] text-white px-4 lg:px-6 py-4 rounded-md flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">Assalamu Alaikum, {displayName}</h1>
        <p className="text-xs text-cyan-400 mt-0.5">
          {gregorian} {hijriStr ? <> · {hijriStr}</> : null}
        </p>
      </div>
      {islamic?.prayers?.Fajr && (
        <div className="flex flex-wrap gap-2">
          {PRAYERS.map(p => {
            const isActive = activePrayer === p;
            return (
              <div
                key={p}
                className={`px-3 py-2 rounded-md text-xs text-white text-center min-w-[70px] ${
                  isActive ? 'bg-cyan-500/30 border border-cyan-400' : 'bg-white/5'
                }`}
              >
                <div className={`text-[10px] ${isActive ? 'text-cyan-300' : 'text-white/60'}`}>{p}</div>
                <div className="font-semibold">{fmtTime12(islamic.prayers[p])}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const sched = (assignment?.schedules || []).find((s: any) => s.is_active);
  const teacherName = assignment?.teacher?.full_name || '—';
  const teacherInitial = teacherName?.charAt(0)?.toUpperCase() || 'T';
  const meetingLink = (liveSession as any)?.license?.meeting_link;

  const NextClassCard = (
    <div className="p-4 border rounded-md bg-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Next Class</div>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[hsl(var(--navy))] text-white font-bold flex items-center justify-center">
          {teacherInitial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">Teacher</div>
          <div className="font-semibold text-sm truncate">{teacherName}</div>
          <div className="text-sm text-muted-foreground truncate">
            {assignment?.subject?.name || 'No subject assigned'}
          </div>
        </div>
        <div>
          {liveSession && meetingLink ? (
            <a
              href={meetingLink} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Join Now <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : sched ? (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Next: {sched.day_of_week} {fmtTime12(sched.student_local_time)}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No upcoming class</div>
          )}
        </div>
      </div>
    </div>
  );

  const PerformanceCard = (
    <div className="p-4 border rounded-md bg-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Performance</div>
      <div className="relative h-32">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%" outerRadius="100%"
            data={[{ name: 'Att', value: stats.pct, fill: 'hsl(189 94% 43%)' }]}
            startAngle={90} endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'hsl(var(--muted))' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-3xl font-bold text-[hsl(var(--navy))]">{stats.pct}%</div>
          <div className="text-[10px] text-muted-foreground">Attendance</div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-center mt-1">
        {stats.present}/{stats.total} Sessions
      </div>
    </div>
  );

  const quickLinks = [
    { icon: MessageCircle, label: 'Message Teacher', bg: 'bg-blue-50 hover:bg-blue-100', icCol: 'text-blue-500', txCol: 'text-blue-600', to: '/chat' },
    { icon: Send, label: 'Leave Request', bg: 'bg-amber-50 hover:bg-amber-100', icCol: 'text-amber-500', txCol: 'text-amber-600', to: '/hub' },
    { icon: FolderOpen, label: 'My Files', bg: 'bg-violet-50 hover:bg-violet-100', icCol: 'text-violet-500', txCol: 'text-violet-600', to: '/resources' },
    { icon: Network, label: 'My Network', bg: 'bg-emerald-50 hover:bg-emerald-100', icCol: 'text-emerald-500', txCol: 'text-emerald-600', to: '/connections' },
    { icon: Video, label: 'Recordings', bg: 'bg-rose-50 hover:bg-rose-100', icCol: 'text-rose-500', txCol: 'text-rose-600', to: '/my-courses' },
    { icon: FileText, label: 'Exam Results', bg: 'bg-cyan-50 hover:bg-cyan-100', icCol: 'text-cyan-500', txCol: 'text-cyan-600', to: '/student-reports' },
  ];

  const QuickLinksCard = (
    <div className="p-4 border rounded-md bg-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Quick Links</div>
      <div className="grid grid-cols-3 gap-2">
        {quickLinks.map(q => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              onClick={() => navigate(q.to)}
              className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-md cursor-pointer transition-all hover:scale-105 ${q.bg}`}
            >
              <Icon size={18} className={q.icCol} />
              <span className={`text-[11px] font-medium ${q.txCol} text-center leading-tight`}>{q.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const RecentLessonsCard = (
    <div className="p-4 border rounded-md bg-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent Lessons</div>
      {recentLessons.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">No lessons recorded yet</div>
      ) : (
        recentLessons.map((l: any) => {
          const present = l.status === 'present';
          return (
            <div key={l.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-3">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                {present
                  ? <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                  : <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <div className="text-sm truncate">{l.lesson_covered || <span className="text-muted-foreground">No lesson recorded</span>}</div>
                  <div className="text-xs text-muted-foreground truncate">{l.homework || 'No homework'}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground shrink-0">{format(parseISO(l.class_date), 'd MMM')}</div>
            </div>
          );
        })
      )}
    </div>
  );

  const dueDays = nextInvoice?.due_date ? differenceInDays(parseISO(nextInvoice.due_date), new Date()) : null;
  const dueColor =
    dueDays !== null && dueDays < 0 ? 'text-red-600' :
    dueDays !== null && dueDays <= 7 ? 'text-amber-500' : 'text-[hsl(var(--navy))]';

  const FeeStatusCard = (
    <div className="p-4 border rounded-md bg-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Fee Status</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
        <div className="text-center py-3 lg:py-0 lg:pr-4">
          <div className="text-xs text-muted-foreground mb-1">Last Payment</div>
          {lastPayment ? (
            <>
              <div className="text-2xl font-bold text-[hsl(var(--navy))]">
                {lastPayment.currency_local} {Number(lastPayment.amount_local || 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {lastPayment.payment_date ? format(parseISO(lastPayment.payment_date), 'd MMM yyyy') : ''}
              </div>
              <Badge className="mt-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>
            </>
          ) : (
            <div className="text-muted-foreground text-2xl">—</div>
          )}
        </div>
        <div className="text-center py-3 lg:py-0 lg:pl-4">
          <div className="text-xs text-muted-foreground mb-1">Next Due</div>
          {nextInvoice ? (
            <>
              <div className={`text-2xl font-bold ${dueColor}`}>
                {nextInvoice.currency} {Number(nextInvoice.amount || 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {nextInvoice.billing_month}
              </div>
              <button
                onClick={() => navigate('/finance')}
                className="mt-2 bg-[hsl(var(--navy))] text-white px-3 py-1 rounded text-xs"
              >
                Pay →
              </button>
            </>
          ) : (
            <div className="text-muted-foreground text-2xl">—</div>
          )}
        </div>
      </div>
    </div>
  );

  const PriorityInboxCard = (
    <div className="p-4 border rounded-md bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Priority Inbox</div>
        {inbox.length > 0 && <Badge variant="secondary">{inbox.length}</Badge>}
      </div>
      {inbox.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">No new items</div>
      ) : (
        inbox.map((it, i) => {
          const borderCol =
            it.kind === 'chat' ? 'border-blue-500'
            : it.kind === 'ticket' ? 'border-amber-500'
            : 'border-emerald-500';
          return (
            <div
              key={i}
              onClick={() => navigate(it.href)}
              className={`flex items-start gap-2 py-2 border-b last:border-0 border-l-[3px] ${borderCol} pl-2 cursor-pointer hover:bg-muted/50`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{it.title}</div>
                <div className="text-xs text-muted-foreground truncate">{(it.preview || '').slice(0, 50)}</div>
              </div>
              <div className="text-[10px] text-muted-foreground shrink-0">
                {format(parseISO(it.ts), 'd MMM')}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const actionItems: Array<{ icon: any; iconCol: string; label: string; href: string }> = [];
  if (overdueInvoice) actionItems.push({ icon: AlertCircle, iconCol: 'text-amber-400', label: 'Fee overdue — Pay Now', href: '/finance' });
  if (unreadChatCount > 0) actionItems.push({ icon: MessageCircle, iconCol: 'text-blue-400', label: `${unreadChatCount} unread message${unreadChatCount > 1 ? 's' : ''}`, href: '/chat' });
  if (openTicketCount > 0) actionItems.push({ icon: Tag, iconCol: 'text-slate-300', label: `${openTicketCount} open request${openTicketCount > 1 ? 's' : ''}`, href: '/hub' });

  const ActionCenterCard = (
    <div className="p-4 border rounded-md bg-[hsl(var(--navy))] text-white">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/60 mb-3">Action Center</div>
      {actionItems.length === 0 ? (
        <div className="text-emerald-400 text-sm text-center py-2">All caught up ✓</div>
      ) : (
        actionItems.map((a, i) => {
          const Icon = a.icon;
          return (
            <div
              key={i}
              onClick={() => navigate(a.href)}
              className="flex items-center justify-between py-2 border-b border-white/10 last:border-0 text-sm cursor-pointer hover:text-cyan-300"
            >
              <span className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${a.iconCol}`} /> {a.label}
              </span>
              <span>→</span>
            </div>
          );
        })
      )}
    </div>
  );

  const RecentResultsCard = (
    <div className="p-4 border rounded-md bg-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent Results</div>
      {exams.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">No results yet</div>
      ) : (
        exams.map((e: any) => {
          const passed = (e.percentage || 0) >= 50;
          return (
            <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{e.template?.name || 'Exam'}</div>
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

  const SpotlightCard = spotlight ? (
    <div className="p-0 border rounded-md bg-card overflow-hidden">
      {spotlight.image_url && (
        <img src={spotlight.image_url} alt={spotlight.title || 'Spotlight'} className="w-full h-28 object-cover" />
      )}
      <div className="p-3">
        {spotlight.title && <div className="font-semibold text-sm">{spotlight.title}</div>}
        {spotlight.description && (
          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{spotlight.description}</div>
        )}
        {spotlight.link && (
          <Button asChild className="w-full bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy-dark))] text-white mt-2 text-xs h-8">
            <a href={spotlight.link} target="_blank" rel="noreferrer">Open</a>
          </Button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-3 lg:gap-4 p-3 lg:p-4">
      {Header}

      {/* Desktop: 3-column layout matching reference */}
      <div className="hidden lg:grid lg:grid-cols-[280px_1fr_300px] gap-4">
        {/* TOP ROW spans all three columns */}
        <div className="lg:col-span-2 grid grid-cols-[1fr_280px] gap-4">
          {NextClassCard}
          {PerformanceCard}
        </div>
        {PriorityInboxCard}

        {/* SECOND ROW — left column: Quick Links + Fee Status */}
        <div className="flex flex-col gap-4">
          {QuickLinksCard}
          {FeeStatusCard}
        </div>
        {/* Middle column: Recent Lessons + Recent Results */}
        <div className="flex flex-col gap-4">
          {RecentLessonsCard}
          {RecentResultsCard}
        </div>
        {/* Right column: Action Center + Spotlight */}
        <div className="flex flex-col gap-4">
          {ActionCenterCard}
          {SpotlightCard}
        </div>
      </div>

      {/* Mobile: stacked single column */}
      <div className="flex flex-col gap-3 lg:hidden">
        {NextClassCard}
        {PerformanceCard}
        {QuickLinksCard}
        {PriorityInboxCard}
        {ActionCenterCard}
        {RecentLessonsCard}
        {FeeStatusCard}
        {RecentResultsCard}
        {SpotlightCard}
      </div>
    </div>
  );
}

export default StudentDashboard;
