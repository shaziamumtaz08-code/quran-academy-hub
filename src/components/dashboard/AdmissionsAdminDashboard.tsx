import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

import { DashboardShell } from './shared/DashboardShell';
import { QuickActionsGrid } from './shared/QuickActionsGrid';

const ADMISSIONS_TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'applications', icon: '📋', label: 'Applications', path: '/students' },
  { id: 'followups', icon: '📞', label: 'Follow-ups', path: '/hub' },
  { id: 'reports', icon: '📊', label: 'Reports', path: '/reports' },
];

export function AdmissionsAdminDashboard() {
  const navigate = useNavigate();

  const quickActions = [
    { icon: '📝', label: 'New Inquiry', bg: 'bg-teal/10', textColor: 'text-teal', border: 'border-teal/15', onClick: () => navigate('/students') },
    { icon: '🎓', label: 'Book Trial', bg: 'bg-sky/10', textColor: 'text-sky', border: 'border-sky/15', onClick: () => navigate('/schedules') },
    { icon: '📦', label: 'Welcome Kit', bg: 'bg-gold/10', textColor: 'text-gold', border: 'border-gold/15', onClick: () => navigate('/hub') },
    { icon: '📊', label: 'Reports', bg: 'bg-primary/10', textColor: 'text-primary', border: 'border-primary/15', onClick: () => navigate('/reports') },
  ];

  const leftContent = (
    <>
      {/* Pipeline Funnel */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-3">📊 Admissions Pipeline</p>
        <div className="space-y-2">
          {[
            { stage: 'Inquiries', count: 0, width: '100%', color: 'bg-sky/20' },
            { stage: 'Applied', count: 0, width: '75%', color: 'bg-teal/20' },
            { stage: 'Interview', count: 0, width: '50%', color: 'bg-gold/20' },
            { stage: 'Enrolled', count: 0, width: '30%', color: 'bg-teal/30' },
          ].map((s) => (
            <div key={s.stage}>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="font-bold text-foreground">{s.stage}</span>
                <span className="text-muted-foreground">{s.count}</span>
              </div>
              <div className={`h-3 rounded-full ${s.color}`} style={{ width: s.width }} />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">Pipeline data coming soon</p>
      </div>

      {/* Today's Follow-ups */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">📞 Today's Follow-ups</p>
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-xs">No follow-ups scheduled for today</p>
        </div>
      </div>
    </>
  );

  const rightContent = (
    <>
      {/* This Month Stats */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-3">📈 This Month</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Inquiries', value: 0, color: 'text-sky' },
            { label: 'Enrolled', value: 0, color: 'text-teal' },
            { label: 'Conv. %', value: '0%', color: 'text-gold' },
          ].map((s) => (
            <div key={s.label} className="text-center bg-secondary/50 rounded-xl py-2.5">
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground font-bold">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <QuickActionsGrid actions={quickActions} />
    </>
  );

  return (
    <DashboardShell tabs={ADMISSIONS_TABS} leftContent={leftContent} rightContent={rightContent} brandLabel="AQA" />
  );
}
