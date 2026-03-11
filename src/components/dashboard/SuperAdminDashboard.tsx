import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

import { DashboardShell } from './shared/DashboardShell';
import { QuickActionsGrid } from './shared/QuickActionsGrid';

const SUPER_ADMIN_TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'finance', icon: '💰', label: 'Finance', path: '/payments' },
  { id: 'teachers', icon: '👨‍🏫', label: 'Teachers', path: '/teachers' },
  { id: 'reports', icon: '📊', label: 'Reports', path: '/reports' },
];

export function SuperAdminDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['super-admin-dashboard-v2'],
    queryFn: async () => {
      const [profilesRes, rolesRes, feeRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('role'),
        supabase.from('fee_invoices').select('amount, amount_paid, status').eq('billing_month', format(new Date(), 'yyyy-MM')),
      ]);

      const roleCounts = (rolesRes.data || []).reduce((acc, r) => {
        acc[r.role] = (acc[r.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const fees = feeRes.data || [];
      const revenue = fees.reduce((s, f) => s + f.amount_paid, 0);
      const outstanding = fees.reduce((s, f) => s + (f.amount - f.amount_paid), 0);

      return {
        totalStudents: roleCounts['student'] || 0,
        totalTeachers: roleCounts['teacher'] || 0,
        revenue,
        outstanding,
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
    { icon: '💰', label: 'Finance', bg: 'bg-gold/10', textColor: 'text-gold', border: 'border-gold/15', onClick: () => navigate('/payments') },
    { icon: '📊', label: 'Reports', bg: 'bg-sky/10', textColor: 'text-sky', border: 'border-sky/15', onClick: () => navigate('/reports') },
    { icon: '⚙️', label: 'Settings', bg: 'bg-teal/10', textColor: 'text-teal', border: 'border-teal/15', onClick: () => navigate('/organization-settings') },
  ];

  const leftContent = (
    <>
      {/* KPI Boxes */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Total Students', value: stats?.totalStudents || 0, icon: '🎓', color: 'text-teal' },
          { label: 'Total Teachers', value: stats?.totalTeachers || 0, icon: '👨‍🏫', color: 'text-sky' },
          { label: 'Revenue', value: `${(stats?.revenue || 0).toLocaleString()}`, icon: '💰', color: 'text-gold' },
          { label: 'Outstanding', value: `${(stats?.outstanding || 0).toLocaleString()}`, icon: '⚠️', color: 'text-destructive' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-2xl border border-border p-3.5 shadow-card text-center">
            <span className="text-xl">{kpi.icon}</span>
            <p className={`text-2xl font-black ${kpi.color} mt-1`}>{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground font-bold">{kpi.label}</p>
          </div>
        ))}
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
            'Check unmarked attendance',
            'Review overdue fees',
            'Monitor teacher activity',
          ].map((issue, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="text-gold">⚠</span>
              <span className="text-foreground">{issue}</span>
            </div>
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
