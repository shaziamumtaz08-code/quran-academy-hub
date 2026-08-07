import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format, subMonths, startOfMonth, endOfMonth, isAfter, isBefore, addDays } from 'date-fns';
import {
  Network, MessageSquare, FileText, FolderOpen, Video, Award,
  Inbox, Send, Bell, Wallet, Image as ImageIcon, ExternalLink, PhoneCall,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import { DashboardShell } from './DashboardShell';
import { UnifiedHeaderBanner } from './UnifiedHeaderBanner';
import { FamilyManagement } from '@/components/parent/FamilyManagement';

// ── Date helpers (local TZ) ──────────────────────────────
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SHORT_DAYS: Record<string,string> = {
  Sunday:'Sun',Monday:'Mon',Tuesday:'Tue',Wednesday:'Wed',Thursday:'Thu',Friday:'Fri',Saturday:'Sat'
};

function getNowInTimezone(tz: string) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday:'short', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '0';
  const dayMap: Record<string,number> = { Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6 };
  return {
    dayIndex: dayMap[get('weekday')] ?? 0,
    hours: parseInt(get('hour'),10),
    minutes: parseInt(get('minute'),10),
    seconds: parseInt(get('second'),10),
    absoluteMs: now.getTime(),
  };
}
function buildNextOccurrence(dayName: string, timeStr: string, durationMinutes: number, tz: string): Date {
  const tzNow = getNowInTimezone(tz);
  const targetDayIndex = DAY_NAMES.indexOf(dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase());
  if (targetDayIndex === -1) return new Date(tzNow.absoluteMs + 7*86400000);
  const [tH,tM] = (timeStr || '00:00').split(':').map(Number);
  let daysUntil = targetDayIndex - tzNow.dayIndex;
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0) {
    const nowMins = tzNow.hours * 60 + tzNow.minutes;
    const endMins = tH * 60 + tM + durationMinutes;
    if (nowMins >= endMins) daysUntil = 7;
  }
  const nowSecs = tzNow.hours*3600 + tzNow.minutes*60 + tzNow.seconds;
  const targetSecs = tH*3600 + tM*60;
  return new Date(tzNow.absoluteMs + (daysUntil*86400 + (targetSecs - nowSecs))*1000);
}

// ── Types ────────────────────────────────────────────────
interface DashboardContext {
  teachers: Array<{ assignment_id: string; teacher_id: string; teacher_name: string | null; subject_name: string | null }>;
  live_session: { session_id: string; meeting_link: string | null; teacher_id: string } | null;
}
interface ChildData {
  id: string;
  full_name: string;
  timezone: string;
  context: DashboardContext;
  totalClasses: number;
  attended: number;
  attendanceRate: number;
  recentLessons: Array<{ date: string; lesson: string; homework: string; status: string }>;
  monthlyAttendance: Array<{ month: string; planned: number; achieved: number }>;
  nextClass: { dayOfWeek: string; time: string; teacherName: string; subject: string; dateTime: Date } | null;
  pendingInvoice: { amount: number; currency: string; due_date: string | null } | null;
  lastPayment: { amount: number; currency: string; date: string } | null;
  recentExams: Array<{ id: string; name: string; date: string; percentage: number; passed: boolean }>;
}

// ── Per-child fetcher ────────────────────────────────────
async function fetchChildData(studentId: string): Promise<ChildData> {
  const { data: student } = await supabase
    .from('profiles').select('id, full_name, timezone').eq('id', studentId).single();

  const studentName = (student as any)?.full_name || 'Unknown';
  const studentTz = (student as any)?.timezone || 'Asia/Karachi';

  // ── Teacher + live session via security-definer RPC (works for parent role too)
  const { data: ctxRaw } = await (supabase as any).rpc('get_student_dashboard_context', { _student_id: studentId });
  const context: DashboardContext = (ctxRaw as any) || { teachers: [], live_session: null };

  // ── Attendance (last 6 months for stats + chart) ──
  const sinceMonths = subMonths(new Date(), 6);
  const { data: attendance } = await supabase
    .from('attendance')
    .select('status, class_date, lesson_covered, homework, surah_name, ayah_from')
    .eq('student_id', studentId)
    .gte('class_date', sinceMonths.toISOString().slice(0,10))
    .order('class_date', { ascending: false });
  const records = attendance || [];
  const present = records.filter(a => a.status === 'present').length;

  // ── Schedules for next class + planned counts ──
  const assignmentIds = context.teachers.map(t => t.assignment_id);
  let nextClass: ChildData['nextClass'] = null;
  let weeklyPlannedPerWeek = 0;
  if (assignmentIds.length) {
    const { data: schedules } = await supabase
      .from('schedules')
      .select('day_of_week, student_local_time, duration_minutes, assignment_id')
      .in('assignment_id', assignmentIds)
      .eq('is_active', true);
    if (schedules?.length) {
      weeklyPlannedPerWeek = schedules.length;
      const tMap = new Map(context.teachers.map(t => [t.assignment_id, t]));
      const upcoming = schedules.map(s => {
        const t = tMap.get(s.assignment_id!);
        const norm = s.day_of_week ? s.day_of_week.charAt(0).toUpperCase() + s.day_of_week.slice(1).toLowerCase() : '';
        return {
          dayOfWeek: norm,
          time: s.student_local_time || '00:00',
          teacherName: t?.teacher_name || 'Teacher',
          subject: t?.subject_name || 'Quran',
          dateTime: buildNextOccurrence(s.day_of_week!, s.student_local_time || '00:00', s.duration_minutes, studentTz),
        };
      }).sort((a,b)=>a.dateTime.getTime()-b.dateTime.getTime());
      nextClass = upcoming[0] || null;
    }
  }

  // ── Monthly attendance: last 4 months planned vs achieved ──
  const monthlyAttendance: ChildData['monthlyAttendance'] = [];
  for (let i = 3; i >= 0; i--) {
    const ref = subMonths(new Date(), i);
    const ms = startOfMonth(ref);
    const me = endOfMonth(ref);
    const inMonth = records.filter(a => {
      const d = new Date(a.class_date);
      return d >= ms && d <= me;
    });
    const achieved = inMonth.filter(a => a.status === 'present').length;
    // Planned ~ schedules per week × ≈4.3 weeks (approximation for chart)
    const planned = Math.max(achieved, Math.round(weeklyPlannedPerWeek * 4.3));
    monthlyAttendance.push({ month: format(ref, 'MMM'), planned, achieved });
  }

  // ── Pending invoice (next due) ──
  const { data: invoices } = await supabase
    .from('fee_invoices')
    .select('amount, currency, due_date')
    .eq('student_id', studentId)
    .is('voided_at', null)
    .eq('is_archived', false)
    .eq('status', 'pending')
    .order('billing_month', { ascending: true })
    .limit(1);
  const pendingInvoice = invoices?.[0]
    ? { amount: invoices[0].amount, currency: invoices[0].currency, due_date: invoices[0].due_date }
    : null;

  // ── Last payment ──
  const { data: payments } = await supabase
    .from('payment_transactions')
    .select('amount_local, currency_local, payment_date, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1);
  const lastPayment = payments?.[0]
    ? {
        amount: (payments[0] as any).amount_local || 0,
        currency: (payments[0] as any).currency_local || 'PKR',
        date: (payments[0] as any).payment_date || (payments[0] as any).created_at,
      }
    : null;

  // ── Exams ──
  const { data: exams } = await supabase
    .from('exams')
    .select('id, exam_date, percentage, total_marks, max_total_marks, template:exam_templates(name)')
    .eq('student_id', studentId)
    .order('exam_date', { ascending: false })
    .limit(3);
  const recentExams: ChildData['recentExams'] = (exams || []).map((e: any) => ({
    id: e.id,
    name: e.template?.name || 'Exam',
    date: e.exam_date,
    percentage: Number(e.percentage) || 0,
    passed: (Number(e.percentage) || 0) >= 50,
  }));

  return {
    id: studentId,
    full_name: studentName,
    timezone: studentTz,
    context,
    totalClasses: records.length,
    attended: present,
    attendanceRate: records.length > 0 ? Math.round((present / records.length) * 100) : 0,
    recentLessons: records.slice(0, 4).map(a => ({
      date: format(new Date(a.class_date), 'MMM dd'),
      lesson: a.lesson_covered || 'No lesson recorded',
      homework: a.homework || 'No homework',
      status: a.status,
    })),
    monthlyAttendance,
    nextClass,
    pendingInvoice,
    lastPayment,
    recentExams,
  };
}

// ── Inbox fetcher (parent/student perspective) ───────────
interface InboxItem {
  id: string;
  kind: 'message' | 'ticket' | 'notification';
  sender: string;
  preview: string;
  ts: string;
  thumb?: string;
  href: string;
}
async function fetchInbox(userId: string): Promise<InboxItem[]> {
  const items: InboxItem[] = [];

  // Notifications
  const { data: notifs } = await supabase
    .from('notification_queue')
    .select('id, title, body, created_at, status')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  (notifs || []).forEach((n: any) => items.push({
    id: 'n-' + n.id,
    kind: 'notification',
    sender: n.title || 'System',
    preview: (n.body || '').slice(0, 40),
    ts: n.created_at,
    href: '/notifications',
  }));

  // Chat messages: latest from groups the user belongs to (not by self)
  const { data: members } = await supabase
    .from('chat_members').select('group_id').eq('user_id', userId).limit(50);
  const groupIds = (members || []).map((m: any) => m.group_id);
  if (groupIds.length) {
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, content, attachment_url, created_at, group_id, sender_id, sender:profiles!chat_messages_sender_id_fkey(full_name)')
      .in('group_id', groupIds)
      .neq('sender_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(10);
    (msgs || []).forEach((m: any) => items.push({
      id: 'm-' + m.id,
      kind: 'message',
      sender: m.sender?.full_name || 'Member',
      preview: (m.content || (m.attachment_url ? '📎 Attachment' : '')).slice(0, 40),
      ts: m.created_at,
      thumb: m.attachment_url && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(m.attachment_url) ? m.attachment_url : undefined,
      href: `/chat?group=${m.group_id}`,
    }));
  }

  // Tickets assigned to me
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, subject, description, created_at')
    .eq('assignee_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  (tickets || []).forEach((t: any) => items.push({
    id: 't-' + t.id,
    kind: 'ticket',
    sender: 'Ticket',
    preview: (t.subject || t.description || '').slice(0, 40),
    ts: t.created_at,
    href: `/work-hub?ticket=${t.id}`,
  }));

  return items.sort((a,b) => +new Date(b.ts) - +new Date(a.ts)).slice(0, 5);
}

// ── Spotlight fetcher ────────────────────────────────────
async function fetchSpotlight() {
  const { data } = await supabase
    .from('app_settings').select('setting_value').eq('setting_key', 'featured_spotlight').maybeSingle();
  if (!data) return null;
  const v: any = (data as any).setting_value;
  if (!v || typeof v !== 'object' || !v.title) return null;
  return v as { title: string; description?: string; image_url?: string; link?: string };
}

// ── Component ────────────────────────────────────────────
interface ChildrenDashboardViewProps {
  studentIds: string[];
  showFamilyManagement?: boolean;
  showChildToggle?: boolean;
  emptyMessage?: string;
}

export function ChildrenDashboardView({
  studentIds,
  showFamilyManagement = false,
  showChildToggle = true,
  emptyMessage = 'No data available',
}: ChildrenDashboardViewProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeChildIdx, setActiveChildIdx] = useState(0);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['children-dashboard-view', studentIds.join(',')],
    queryFn: async () => Promise.all(studentIds.map(fetchChildData)),
    enabled: studentIds.length > 0,
  });

  const { data: inbox = [] } = useQuery({
    queryKey: ['dashboard-inbox', user?.id],
    queryFn: () => fetchInbox(user!.id),
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  const { data: spotlight } = useQuery({
    queryKey: ['dashboard-spotlight'],
    queryFn: fetchSpotlight,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 space-y-3 max-w-[1100px] mx-auto pt-16">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-14 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
        </div>
      </div>
    );
  }

  if (!children.length) {
    return (
      <DashboardShell
        topContent={<UnifiedHeaderBanner />}
        hideHeader
        leftContent={
          <div className="bg-card rounded-md border border-border p-6 text-center text-muted-foreground">
            <p className="text-lg font-bold">{emptyMessage}</p>
          </div>
        }
        rightContent={null}
      />
    );
  }

  const child = children[activeChildIdx] || children[0];
  const nc = child.nextClass;
  const live = child.context.live_session;

  let timeDisplay = ''; let shortDay = '';
  if (nc) {
    const [hh, mm] = nc.time.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    timeDisplay = `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
    shortDay = SHORT_DAYS[nc.dayOfWeek] || nc.dayOfWeek;
  }

  // Fee status colour logic
  const dueDate = child.pendingInvoice?.due_date ? new Date(child.pendingInvoice.due_date) : null;
  const today = new Date();
  let dueTone: 'overdue' | 'amber' | 'neutral' = 'neutral';
  if (dueDate) {
    if (isBefore(dueDate, today)) dueTone = 'overdue';
    else if (isBefore(dueDate, addDays(today, 7))) dueTone = 'amber';
  }

  // Find primary teacher for "Message Teacher"
  const primaryTeacher = child.context.teachers[0] || null;

  const messageTeacher = () => {
    if (!primaryTeacher) {
      navigate('/chat');
      return;
    }
    // Reuse DM deep-link convention used by app
    navigate(`/chat?dm=${primaryTeacher.teacher_id}`);
  };
  const requestLeave = () => navigate('/work-hub?new=1&category=leave_request');
  const viewFees = () => navigate('/finance?view=payments');

  // ── LEFT COLUMN ──
  const leftContent = (
    <>
      {showChildToggle && children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {children.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => setActiveChildIdx(idx)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap border transition-colors ${
                idx === activeChildIdx
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-secondary'
              }`}
            >
              {c.full_name}
            </button>
          ))}
        </div>
      )}

      {/* Next class with optional Join button */}
      {nc ? (
        <div className="bg-gradient-to-br from-primary to-[hsl(var(--navy-light))] rounded-md px-3 py-2.5 text-primary-foreground shadow-card">
          <div className="flex items-center gap-2">
            <p className="text-[10px] opacity-80 font-extrabold tracking-wide uppercase flex items-center gap-1 shrink-0">
              <span>📚</span> Next Class
            </p>
            <p className="text-[15px] leading-tight font-extrabold truncate flex-1 min-w-0">
              {nc.teacherName}
            </p>
            {live?.meeting_link && (
              <a
                href={live.meeting_link} target="_blank" rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1 text-[11px] font-extrabold text-white shadow animate-pulse"
              >
                <PhoneCall className="h-3 w-3" /> Join Class →
              </a>
            )}
          </div>
          <p className="text-[11px] text-primary-foreground/75 font-semibold truncate mt-1.5">
            {nc.subject} · {shortDay.toLowerCase()} · {timeDisplay}
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-md border border-border p-3 text-center">
          <p className="text-xs text-muted-foreground">No upcoming class scheduled</p>
        </div>
      )}

      {/* Performance (renamed from Stats) with attendance bar chart */}
      <div className="bg-card rounded-md border border-border p-3.5 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-3">📈 Performance</p>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center bg-secondary/40 rounded-md p-2">
            <p className="text-2xl font-black text-teal leading-none">{child.totalClasses}</p>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Total</p>
            <p className="text-[9px] text-muted-foreground">Classes</p>
          </div>
          <div className="text-center bg-secondary/40 rounded-md p-2">
            <p className="text-2xl font-black text-sky leading-none">{child.attended}</p>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Attended</p>
            <p className="text-[9px] text-muted-foreground">Present</p>
          </div>
          <div className="text-center bg-secondary/40 rounded-md p-2">
            <p className="text-2xl font-black text-gold leading-none">{child.attendanceRate}%</p>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Rate</p>
            <p className="text-[9px] text-muted-foreground">Attendance</p>
          </div>
          <div className="bg-secondary/40 rounded-md p-1.5 h-[72px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={child.monthlyAttendance} margin={{ top: 2, right: 2, bottom: 0, left: -28 }}>
                <XAxis dataKey="month" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: 10, padding: 4 }} />
                <Bar dataKey="planned" fill="hsl(var(--muted-foreground))" radius={[2,2,0,0]} />
                <Bar dataKey="achieved" fill="hsl(var(--primary))" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-1 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 bg-muted-foreground rounded-sm" /> Planned</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 bg-primary rounded-sm" /> Achieved</span>
        </div>
      </div>

      {/* Recent Lessons (last 4) */}
      <div>
        <p className="text-[13px] font-extrabold text-foreground mb-2">📋 Recent Lessons</p>
        {!child.recentLessons.length ? (
          <div className="bg-card rounded-md border border-border p-4 text-center text-muted-foreground">
            <p className="text-xs">No lessons recorded yet</p>
          </div>
        ) : (
          <div className="bg-card rounded-md border border-border overflow-hidden divide-y divide-border">
            {child.recentLessons.map((lesson, idx) => (
              <div key={idx} className="px-3 py-2.5 flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  lesson.status === 'present' ? 'bg-teal/10 text-teal' : 'bg-destructive/10 text-destructive'
                }`}>
                  {lesson.status === 'present' ? '✅' : '❌'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13px] text-foreground truncate">{lesson.lesson}</p>
                  <p className="text-[11px] text-muted-foreground truncate">📝 {lesson.homework}</p>
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">{lesson.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fee Status: Last Payment + Next Due */}
      <div className={`rounded-md border shadow-card overflow-hidden ${
        dueTone === 'overdue' ? 'bg-destructive/10 border-destructive/30'
        : dueTone === 'amber' ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-card border-border'
      }`}>
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-3">
            <p className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1">💵 Last Payment</p>
            {child.lastPayment ? (
              <>
                <p className="text-base font-black text-teal">
                  {child.lastPayment.currency} {Number(child.lastPayment.amount).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">{format(new Date(child.lastPayment.date), 'MMM dd, yyyy')}</p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">No payments yet</p>
            )}
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1">📅 Next Due</p>
              {dueTone === 'overdue' && (
                <span className="text-[9px] font-extrabold text-destructive bg-destructive/15 px-1.5 py-0.5 rounded">OVERDUE</span>
              )}
            </div>
            {child.pendingInvoice ? (
              <>
                <p className="text-base font-black text-foreground">
                  {child.pendingInvoice.currency} {Number(child.pendingInvoice.amount).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {child.pendingInvoice.due_date ? format(new Date(child.pendingInvoice.due_date), 'MMM dd, yyyy') : 'N/A'}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">No pending invoice</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: 'Message Teacher', icon: MessageSquare, onClick: messageTeacher },
          { label: 'Leave Request',   icon: Send,          onClick: requestLeave },
          { label: 'My Files',        icon: FolderOpen,    onClick: () => navigate('/library') },
          { label: 'My Network',      icon: Network,       onClick: () => navigate(`/connections/parent/${user?.id}`) },
          { label: 'Recordings',      icon: Video,         onClick: () => navigate('/my-courses?tab=recordings') },
          { label: 'Exam Results',    icon: Award,         onClick: () => navigate('/student-reports') },
        ].map((q, i) => (
          <Button
            key={i} variant="outline" size="sm"
            onClick={q.onClick}
            className="flex-col h-auto py-2 gap-1 text-[10px] font-bold"
          >
            <q.icon className="h-4 w-4" />
            <span className="leading-tight text-center">{q.label}</span>
          </Button>
        ))}
      </div>

      {/* Recent Results */}
      <div>
        <p className="text-[13px] font-extrabold text-foreground mb-2">🏆 Recent Results</p>
        {!child.recentExams.length ? (
          <div className="bg-card rounded-md border border-border p-4 text-center text-muted-foreground">
            <p className="text-xs">No exam results yet</p>
          </div>
        ) : (
          <div className="bg-card rounded-md border border-border overflow-hidden divide-y divide-border">
            {child.recentExams.map(e => (
              <div key={e.id} className="px-3 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground truncate">{e.name}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(e.date), 'MMM dd, yyyy')}</p>
                </div>
                <span className="text-[13px] font-black text-foreground">{e.percentage.toFixed(0)}%</span>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                  e.passed ? 'bg-teal/15 text-teal' : 'bg-destructive/15 text-destructive'
                }`}>
                  {e.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // ── RIGHT COLUMN ──
  const rightContent = (
    <>
      {/* Priority Inbox */}
      <div className="bg-card rounded-md border border-border shadow-card">
        <div className="px-3 py-2 border-b border-border flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />
          <p className="text-[12px] font-extrabold text-foreground">Priority Inbox</p>
        </div>
        {inbox.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-muted-foreground">No new items</div>
        ) : (
          <div className="divide-y divide-border">
            {inbox.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.href)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-secondary/40 transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {item.kind === 'notification' ? <Bell className="h-3.5 w-3.5" />
                    : item.kind === 'ticket' ? <FileText className="h-3.5 w-3.5" />
                    : (item.sender[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-foreground truncate">{item.sender}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.preview || '—'}</p>
                </div>
                {item.thumb ? (
                  <img src={item.thumb} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                ) : null}
                <span className="text-[9px] text-muted-foreground shrink-0">
                  {format(new Date(item.ts), 'MMM dd')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Center */}
      <div className="bg-primary text-primary-foreground rounded-md p-3 shadow-navy space-y-1.5">
        <p className="text-[11px] font-extrabold tracking-wider uppercase text-cyan-light mb-1">⚡ Action Center</p>
        {[
          { label: 'Message Teacher', icon: MessageSquare, onClick: messageTeacher },
          { label: 'Request Leave',   icon: Send,          onClick: requestLeave },
          { label: 'View Fees',       icon: Wallet,        onClick: viewFees },
        ].map((a, i) => (
          <button
            key={i} onClick={a.onClick}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-left"
          >
            <a.icon className="h-3.5 w-3.5 text-cyan-light" />
            <span className="text-[12px] font-bold flex-1">{a.label}</span>
            <span className="text-cyan-light">→</span>
          </button>
        ))}
      </div>

      {/* Spotlight banner */}
      {spotlight && (
        <div className="bg-card rounded-md border border-border shadow-card overflow-hidden">
          <div className="flex items-stretch">
            <div className="flex-1 p-3">
              <p className="text-[10px] font-bold tracking-wider uppercase text-primary mb-1">✨ Spotlight</p>
              <p className="text-[13px] font-extrabold text-foreground leading-tight">{spotlight.title}</p>
              {spotlight.description && (
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{spotlight.description}</p>
              )}
              {spotlight.link && (
                <a
                  href={spotlight.link} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary mt-2 hover:underline"
                >
                  Learn More <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {spotlight.image_url && (
              <div className="w-20 shrink-0 bg-secondary/40 flex items-center justify-center">
                <img src={spotlight.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      )}

      {showFamilyManagement && <FamilyManagement />}
    </>
  );

  return (
    <DashboardShell
      hideHeader
      topContent={<UnifiedHeaderBanner />}
      leftContent={leftContent}
      rightContent={rightContent}
      brandLabel="AQA"
    />
  );
}
