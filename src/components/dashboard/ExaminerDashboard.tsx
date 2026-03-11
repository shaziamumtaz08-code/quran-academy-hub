import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth } from 'date-fns';

import { DashboardShell } from './shared/DashboardShell';
import { QuickActionsGrid } from './shared/QuickActionsGrid';
import { StatsRowCompact } from './shared/StatsRowCompact';

const EXAMINER_TABS = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/dashboard' },
  { id: 'exams', icon: '📝', label: 'Exams', path: '/generate-report-card' },
  { id: 'results', icon: '📊', label: 'Results', path: '/student-reports' },
  { id: 'students', icon: '👩‍🎓', label: 'Students', path: '/students' },
];

export function ExaminerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['examiner-dashboard', user?.id],
    queryFn: async () => {
      if (!user?.id) return { conducted: 0, passed: 0, failed: 0, avgScore: 0 };

      const now = new Date();
      const startDate = format(startOfMonth(now), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(now), 'yyyy-MM-dd');

      const { data: exams } = await supabase
        .from('exams')
        .select('id, exam_date, total_marks, max_total_marks, percentage')
        .eq('examiner_id', user.id)
        .gte('exam_date', startDate)
        .lte('exam_date', endDate)
        .is('deleted_at', null);

      const examList = exams || [];
      const conducted = examList.length;
      const passed = examList.filter(e => e.percentage >= 50).length;
      const failed = conducted - passed;
      const avgScore = conducted > 0 ? Math.round(examList.reduce((s, e) => s + e.percentage, 0) / conducted) : 0;

      return { conducted, passed, failed, avgScore };
    },
    enabled: !!user?.id,
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
    { icon: '📝', label: 'Schedule Exam', bg: 'bg-primary', textColor: 'text-primary-foreground', border: 'border-transparent', onClick: () => navigate('/generate-report-card') },
    { icon: '✏️', label: 'Enter Results', bg: 'bg-teal/10', textColor: 'text-teal', border: 'border-teal/15', onClick: () => navigate('/generate-report-card') },
    { icon: '📊', label: 'View Reports', bg: 'bg-sky/10', textColor: 'text-sky', border: 'border-sky/15', onClick: () => navigate('/student-reports') },
    { icon: '👩‍🎓', label: 'Students', bg: 'bg-gold/10', textColor: 'text-gold', border: 'border-gold/15', onClick: () => navigate('/students') },
  ];

  const leftContent = (
    <>
      {/* Upcoming Exams */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">📝 Upcoming Exams</p>
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-xs">No upcoming exams scheduled</p>
          <button
            onClick={() => navigate('/generate-report-card')}
            className="mt-2 bg-primary/10 text-primary border border-primary/15 rounded-xl px-3 py-1.5 font-bold text-xs"
          >
            Schedule Exam
          </button>
        </div>
      </div>

      {/* Pending Results */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
        <p className="text-[13px] font-extrabold text-foreground mb-2">⏳ Pending Results</p>
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-xs">All results up to date</p>
        </div>
      </div>
    </>
  );

  const rightContent = (
    <>
      {/* This Month Stats */}
      <StatsRowCompact
        title={`📈 Exams — ${format(new Date(), 'MMMM')}`}
        stats={[
          { value: stats?.conducted || 0, label: 'Conducted', sub: 'Total', color: 'text-teal' },
          { value: stats?.passed || 0, label: 'Passed', sub: 'Students', color: 'text-sky' },
          { value: `${stats?.avgScore || 0}%`, label: 'Avg Score', sub: 'Overall', color: 'text-gold' },
        ]}
      />

      <QuickActionsGrid actions={quickActions} />
    </>
  );

  return (
    <DashboardShell tabs={EXAMINER_TABS} leftContent={leftContent} rightContent={rightContent} brandLabel="AQA" />
  );
}
