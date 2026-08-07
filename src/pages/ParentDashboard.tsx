import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogIn, Users, AlertTriangle, CheckCircle2, Calendar, Video, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useKidContext } from '@/contexts/KidContext';
import { supabase } from '@/integrations/supabase/client';
import { ConditionalDashboardLayout } from '@/components/layout/ConditionalDashboardLayout';
import { StudentDashboard } from '@/components/dashboard/StudentDashboard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function nextOccurrenceMs(dayName: string, timeStr: string, durationMin: number) {
  const target = DAY_NAMES.indexOf((dayName || '').charAt(0).toUpperCase() + (dayName || '').slice(1).toLowerCase());
  if (target < 0) return Number.POSITIVE_INFINITY;
  const now = new Date();
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  let days = target - now.getDay();
  if (days < 0) days += 7;
  const candidate = new Date(now);
  candidate.setDate(now.getDate() + days);
  candidate.setHours(h, m, 0, 0);
  if (candidate.getTime() + durationMin * 60_000 < now.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }
  return candidate.getTime();
}

interface ChildRow {
  id: string;
  full_name: string;
  registration_id: string | null;
  due_amount: number;
  due_currency: string;
  due_count: number;
  next_class: { whenMs: number; teacher: string; subject: string; meetingLink: string | null } | null;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return 'Live now';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function ChildCard({ child, onOpen }: { child: ChildRow; onOpen: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const initial = (child.full_name || 'C').trim()[0].toUpperCase();
  const nc = child.next_class;
  const remaining = nc ? nc.whenMs - now : 0;
  const isLive = nc ? remaining <= 0 && remaining > -60 * 60_000 : false;
  const canJoin = !!nc?.meetingLink && remaining < 15 * 60_000; // 15-min join window

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4 hover:border-primary/60 hover:shadow-md transition-all">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-lg font-bold shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-foreground truncate">{child.full_name}</p>
          {child.registration_id && (
            <p className="text-xs text-muted-foreground font-mono">{child.registration_id}</p>
          )}
        </div>
      </div>

      {/* Primary CTA */}
      <Button className="w-full gap-2 font-semibold" onClick={onOpen}>
        <LogIn className="w-4 h-4" />
        Login to Child's Account
      </Button>

      {/* Due Fees */}
      <div
        className={`rounded-xl border-l-4 px-3 py-2.5 flex items-center gap-3 ${
          child.due_amount > 0
            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
            : 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
        }`}
      >
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            child.due_amount > 0 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
          }`}
        >
          {child.due_amount > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Fees</p>
          <p className="text-sm font-bold text-foreground truncate">
            {child.due_amount > 0
              ? `${child.due_currency} ${child.due_amount.toLocaleString()}`
              : 'All Cleared'}
          </p>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
            child.due_amount > 0 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {child.due_amount > 0 ? 'OUTSTANDING' : 'PAID'}
        </span>
      </div>

      {/* Next Class */}
      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next Class</p>
        </div>
        {nc ? (
          <>
            <p className="text-sm font-semibold text-foreground truncate">
              {nc.subject} · {nc.teacher}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(nc.whenMs).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs font-bold text-primary">
                <Clock className="w-3 h-3" />
                {isLive ? 'Live now' : formatCountdown(remaining)}
              </div>
              {canJoin && nc.meetingLink ? (
                <a
                  href={nc.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  <Video className="w-3 h-3" /> Join Class
                </a>
              ) : (
                <span className="text-[10px] text-muted-foreground font-semibold">
                  Opens 15 min before
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No upcoming class scheduled</p>
        )}
      </div>
    </div>
  );
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { setActiveKidId } = useKidContext();

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['parent-children-hub-v2', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ChildRow[]> => {
      const { data: links } = await supabase
        .from('student_parent_links')
        .select('student_id')
        .eq('parent_id', user!.id);
      const ids = (links || []).map((l: any) => l.student_id).filter(Boolean);
      if (!ids.length) return [];

      const cbm = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const [{ data: profiles }, { data: invoices }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, registration_id').in('id', ids),
        supabase
          .from('fee_invoices')
          .select('student_id, amount, amount_paid, forgiven_amount, currency, status, billing_month')
          .in('student_id', ids)
          .in('status', ['pending', 'partially_paid', 'overdue'])
          .is('voided_at', null)
          .eq('is_archived', false)
          .lte('billing_month', cbm),
      ]);

      // Next class via RPC + schedules.
      const nextClassMap = new Map<string, ChildRow['next_class']>();
      await Promise.all(
        ids.map(async (sid) => {
          const { data: ctxRaw } = await (supabase as any).rpc('get_student_dashboard_context', { _student_id: sid });
          const ctx: any = ctxRaw || { teachers: [], live_session: null };
          const teachers: any[] = ctx.teachers || [];
          if (!teachers.length) return;
          const tMap = new Map(teachers.map((t: any) => [t.assignment_id, t]));
          const { data: schedules } = await supabase
            .from('schedules')
            .select('day_of_week, student_local_time, duration_minutes, assignment_id')
            .in('assignment_id', teachers.map((t: any) => t.assignment_id))
            .eq('is_active', true);
          if (!schedules?.length) return;
          const sorted = schedules
            .map((s: any) => {
              const t: any = tMap.get(s.assignment_id);
              return {
                whenMs: nextOccurrenceMs(s.day_of_week, s.student_local_time || '00:00', s.duration_minutes || 30),
                teacher: t?.teacher_name || 'Teacher',
                subject: t?.subject_name || 'Class',
                meetingLink: ctx.live_session?.meeting_link || null,
              };
            })
            .sort((a, b) => a.whenMs - b.whenMs);
          nextClassMap.set(sid, sorted[0] || null);
        }),
      );

      const dueMap = new Map<string, { amount: number; currency: string; count: number }>();
      (invoices || []).forEach((inv: any) => {
        const remaining = Math.max(
          0,
          (Number(inv.amount) || 0) - (Number(inv.amount_paid) || 0) - (Number(inv.forgiven_amount) || 0)
        );
        if (remaining <= 0.01) return;
        const cur = dueMap.get(inv.student_id) || { amount: 0, currency: inv.currency || 'PKR', count: 0 };
        cur.amount += remaining;
        cur.count += 1;
        cur.currency = inv.currency || cur.currency;
        dueMap.set(inv.student_id, cur);
      });

      const byId = new Map((profiles || []).map((p: any) => [p.id, p]));
      return ids.map((id) => {
        const p: any = byId.get(id) || { id, full_name: 'Child', registration_id: null };
        const d = dueMap.get(id);
        return {
          id,
          full_name: p.full_name || 'Child',
          registration_id: p.registration_id || null,
          due_amount: d?.amount || 0,
          due_currency: d?.currency || 'PKR',
          due_count: d?.count || 0,
          next_class: nextClassMap.get(id) || null,
        };
      });
    },
  });

  useEffect(() => {
    if (studentId) setActiveKidId(studentId);
  }, [studentId, setActiveKidId]);

  if (!user?.id) return null;

  if (studentId) {
    return (
      <ConditionalDashboardLayout>
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/parent')}>
            ← Back to My Children
          </Button>
          <StudentDashboard />
        </div>
      </ConditionalDashboardLayout>
    );
  }

  return (
    <ConditionalDashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">My Children</h1>
              <p className="text-sm text-muted-foreground">
                Login to a child's account to view attendance, fees, lessons and reports.
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : children.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No linked children on your account yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((c) => (
              <ChildCard key={c.id} child={c} onOpen={() => navigate(`/parent/child/${c.id}`)} />
            ))}
          </div>
        )}
      </div>
    </ConditionalDashboardLayout>
  );
}
