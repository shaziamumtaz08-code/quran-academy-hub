import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { DashboardShell } from './shared/DashboardShell';
import { QuickActionsGrid } from './shared/QuickActionsGrid';

const SUPER_ADMIN_TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'finance', icon: '💰', label: 'Finance', path: '/payments' },
  { id: 'teachers', icon: '👨‍🏫', label: 'Teachers', path: '/teachers' },
  { id: 'reports', icon: '📊', label: 'Reports', path: '/reports' },
];

interface DivisionBreakdown {
  name: string;
  count: number;
}

function KPIWithBreakdown({ label, value, icon, color, breakdown, onClick }: {
  label: string; value: string | number; icon: string; color: string; breakdown: DivisionBreakdown[]; onClick?: () => void;
}) {
  const card = (
    <div
      className={`bg-card rounded-2xl border border-border p-3.5 shadow-card text-center ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <span className="text-xl">{icon}</span>
      <p className={`text-2xl font-black ${color} mt-1`}>{value}</p>
      <p className="text-[10px] text-muted-foreground font-bold">{label}</p>
      {breakdown.length > 0 && (
        <p className="text-[9px] text-muted-foreground mt-1 truncate">
          {breakdown.map(b => `${b.name}: ${b.count}`).join(' | ')}
        </p>
      )}
    </div>
  );

  if (breakdown.length === 0) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="space-y-1">
          {breakdown.map(b => (
            <div key={b.name} className="flex justify-between gap-4">
              <span>{b.name}</span>
              <span className="font-semibold">{b.count}</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function SuperAdminDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['super-admin-dashboard-v3'],
    queryFn: async () => {
      const [rolesWithCtx, feeRes, divisionsRes] = await Promise.all([
        supabase.from('user_roles').select('role, user_id'),
        supabase.from('fee_invoices').select('amount, amount_paid, status, division_id').eq('billing_month', format(new Date(), 'yyyy-MM')),
        supabase.from('divisions').select('id, name').eq('is_active', true),
      ]);

      const divMap = new Map((divisionsRes.data || []).map(d => [d.id, d.name]));

      // Get user_context for division breakdown
      const studentIds = (rolesWithCtx.data || []).filter(r => r.role === 'student').map(r => r.user_id);
      const teacherIds = (rolesWithCtx.data || []).filter(r => r.role === 'teacher').map(r => r.user_id);

      const { data: contexts } = await supabase.from('user_context').select('user_id, division_id');
      const ctxMap = new Map<string, string>();
      (contexts || []).forEach(c => ctxMap.set(c.user_id, c.division_id));

      // Count per division
      const studentByDiv: Record<string, number> = {};
      const teacherByDiv: Record<string, number> = {};

      studentIds.forEach(id => {
        const div = ctxMap.get(id);
        if (div) {
          const name = divMap.get(div) || 'Other';
          studentByDiv[name] = (studentByDiv[name] || 0) + 1;
        }
      });

      teacherIds.forEach(id => {
        const div = ctxMap.get(id);
        if (div) {
          const name = divMap.get(div) || 'Other';
          teacherByDiv[name] = (teacherByDiv[name] || 0) + 1;
        }
      });

      const fees = feeRes.data || [];
      const revenue = fees.reduce((s, f) => s + f.amount_paid, 0);
      const outstanding = fees.reduce((s, f) => s + (f.amount - f.amount_paid), 0);

      const revenueByDiv: Record<string, number> = {};
      const outstandingByDiv: Record<string, number> = {};
      fees.forEach(f => {
        const name = divMap.get(f.division_id) || 'Other';
        revenueByDiv[name] = (revenueByDiv[name] || 0) + f.amount_paid;
        outstandingByDiv[name] = (outstandingByDiv[name] || 0) + (f.amount - f.amount_paid);
      });

      return {
        totalStudents: studentIds.length,
        totalTeachers: teacherIds.length,
        revenue,
        outstanding,
        studentBreakdown: Object.entries(studentByDiv).map(([name, count]) => ({ name, count })),
        teacherBreakdown: Object.entries(teacherByDiv).map(([name, count]) => ({ name, count })),
        revenueBreakdown: Object.entries(revenueByDiv).map(([name, count]) => ({ name, count: Math.round(count) })),
        outstandingBreakdown: Object.entries(outstandingByDiv).map(([name, count]) => ({ name, count: Math.round(count) })),
      };
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-12 bg-primary md:hidden" />
        <div className="p-4 space-y-3 max-w-[680px] mx-auto pt-16">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  const quickActions = [
    { icon: '👥', label: 'User Mgmt', bg: 'bg-primary', textColor: 'text-primary-foreground', border: 'border-transparent', onClick: () => navigate('/user-management') },
    { icon: '💰', label: 'Finance', bg: 'bg-gold/10', textColor: 'text-gold', border: 'border-gold/15', onClick: () => navigate('/finance') },
    { icon: '📊', label: 'Reports', bg: 'bg-sky/10', textColor: 'text-sky', border: 'border-sky/15', onClick: () => navigate('/reports-hub') },
    { icon: '⚙️', label: 'Settings', bg: 'bg-teal/10', textColor: 'text-teal', border: 'border-teal/15', onClick: () => navigate('/settings') },
  ];

  const leftContent = (
    <>
      {/* KPI Boxes */}
      <div className="grid grid-cols-2 gap-2.5">
        <KPIWithBreakdown label="Total Students" value={stats?.totalStudents || 0} icon="🎓" color="text-teal" breakdown={stats?.studentBreakdown || []} onClick={() => navigate('/students')} />
        <KPIWithBreakdown label="Total Teachers" value={stats?.totalTeachers || 0} icon="👨‍🏫" color="text-sky" breakdown={stats?.teacherBreakdown || []} onClick={() => navigate('/teachers')} />
        <KPIWithBreakdown label="Revenue" value={(stats?.revenue || 0).toLocaleString()} icon="💰" color="text-gold" breakdown={stats?.revenueBreakdown || []} onClick={() => navigate('/finance')} />
        <KPIWithBreakdown label="Outstanding" value={(stats?.outstanding || 0).toLocaleString()} icon="⚠️" color="text-destructive" breakdown={stats?.outstandingBreakdown || []} onClick={() => navigate('/finance')} />
      </div>

      {/* Revenue placeholder */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-3">📈 Revenue — This Month</p>
        <div className="flex items-end gap-1 h-20">
          {[40, 65, 55, 80, 70, 90].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div className="bg-teal/20 rounded-t" style={{ height: `${h}%` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map(m => (
            <span key={m} className="text-[9px] text-muted-foreground flex-1 text-center">{m}</span>
          ))}
        </div>
      </div>
    </>
  );

  const rightContent = (
    <>
      {/* Quick Actions */}
      <QuickActionsGrid actions={quickActions} />

      {/* Top Issues */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">🔍 Top Issues</p>
        <div className="space-y-2">
          {[
            { label: 'Check unmarked attendance', path: '/attendance' },
            { label: 'Review overdue fees', path: '/payments' },
            { label: 'Monitor teacher activity', path: '/reports-hub' },
          ].map((issue, i) => (
            <button
              key={i}
              onClick={() => navigate(issue.path)}
              className="flex items-center gap-2 text-[12px] w-full text-left hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors"
            >
              <span className="text-gold">⚠</span>
              <span className="text-foreground hover:underline">{issue.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <DashboardShell
      tabs={SUPER_ADMIN_TABS}
      leftContent={leftContent}
      rightContent={rightContent}
      brandLabel="AQA"
    />
  );
}
