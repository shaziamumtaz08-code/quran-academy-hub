import React from 'react';
import { useNavigate } from 'react-router-dom';

import { DashboardShell } from './shared/DashboardShell';
import { QuickActionsGrid } from './shared/QuickActionsGrid';

const ACADEMIC_TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'courses', icon: '📖', label: 'Courses', path: '/courses' },
  { id: 'teachers', icon: '👨‍🏫', label: 'Teachers', path: '/teachers' },
  { id: 'reports', icon: '📊', label: 'Reports', path: '/reports' },
];

export function AcademicAdminDashboard() {
  const navigate = useNavigate();

  const quickActions = [
    { icon: '👨‍🏫', label: 'Assign Teacher', bg: 'bg-teal/10', textColor: 'text-teal', border: 'border-teal/15', onClick: () => navigate('/assignments') },
    { icon: '📖', label: 'Create Course', bg: 'bg-sky/10', textColor: 'text-sky', border: 'border-sky/15', onClick: () => navigate('/courses') },
    { icon: '📅', label: 'Upload Plan', bg: 'bg-gold/10', textColor: 'text-gold', border: 'border-gold/15', onClick: () => navigate('/monthly-planning') },
    { icon: '📊', label: 'View Reports', bg: 'bg-primary/10', textColor: 'text-primary', border: 'border-primary/15', onClick: () => navigate('/reports') },
  ];

  const leftContent = (
    <>
      {/* Stalled Students */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">⚠️ Stalled Students</p>
        <p className="text-[11px] text-muted-foreground">Students with no progress in 7+ days</p>
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-xs">No stalled students detected</p>
        </div>
      </div>

      {/* Course Health */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">📖 Course Health</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-teal/10 rounded-xl py-2.5">
            <p className="text-xl font-black text-teal">0</p>
            <p className="text-[10px] text-muted-foreground">Active Courses</p>
          </div>
          <div className="text-center bg-secondary/50 rounded-xl py-2.5">
            <p className="text-xl font-black text-foreground">0%</p>
            <p className="text-[10px] text-muted-foreground">Avg. Completion</p>
          </div>
        </div>
      </div>
    </>
  );

  const rightContent = (
    <>
      {/* Teacher Performance */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-3">👨‍🏫 Teacher Performance</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-secondary/50 rounded-xl py-2.5">
            <p className="text-xl font-black text-sky">0%</p>
            <p className="text-[10px] text-muted-foreground">Lesson Log Rate</p>
          </div>
          <div className="text-center bg-secondary/50 rounded-xl py-2.5">
            <p className="text-xl font-black text-gold">0%</p>
            <p className="text-[10px] text-muted-foreground">Attendance Rate</p>
          </div>
        </div>
      </div>

      <QuickActionsGrid actions={quickActions} />
    </>
  );

  return (
    <DashboardShell tabs={ACADEMIC_TABS} leftContent={leftContent} rightContent={rightContent} brandLabel="AQA" />
  );
}
