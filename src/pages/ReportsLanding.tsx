import React, { Suspense, lazy, useMemo } from 'react';
import { LandingPageShell, LandingCard } from '@/components/layout/LandingPageShell';
import { BarChart3, ClipboardCheck, FileText, Shield, Award } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const KPI = lazy(() => import('./KPI'));
const Reports = lazy(() => import('./Reports'));
const StudentReports = lazy(() => import('./StudentReports'));
const IntegrityAudit = lazy(() => import('./IntegrityAudit'));
const ReportCardTemplates = lazy(() => import('./ReportCardTemplates'));

const Loading = () => <div className="py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

export default function ReportsLanding() {
  const cards: LandingCard[] = [
    { id: 'kpi', title: 'KPI', subtitle: 'Key performance indicators', count: '📊', countLoading: false, icon: <BarChart3 className="h-5 w-5" />, color: 'bg-primary' },
    { id: 'attendance-reports', title: 'Attendance Reports', subtitle: 'Analytics & trends', count: '📈', countLoading: false, icon: <ClipboardCheck className="h-5 w-5" />, color: 'bg-emerald-500' },
    { id: 'student-reports', title: 'Student Reports', subtitle: 'Exam results & cards', count: '🎓', countLoading: false, icon: <FileText className="h-5 w-5" />, color: 'bg-blue-500' },
    { id: 'integrity', title: 'Integrity Audit', subtitle: 'Data quality checks', count: '🔍', countLoading: false, icon: <Shield className="h-5 w-5" />, color: 'bg-rose-500' },
    { id: 'exams', title: 'Exam Center', subtitle: 'Templates & grading', count: '📝', countLoading: false, icon: <Award className="h-5 w-5" />, color: 'bg-amber-500' },
  ];

  const contentMap = useMemo(() => ({
    'kpi': <Suspense fallback={<Loading />}><KPI /></Suspense>,
    'attendance-reports': <Suspense fallback={<Loading />}><Reports /></Suspense>,
    'student-reports': <Suspense fallback={<Loading />}><StudentReports /></Suspense>,
    'integrity': <Suspense fallback={<Loading />}><IntegrityAudit /></Suspense>,
    'exams': <Suspense fallback={<Loading />}><ReportCardTemplates /></Suspense>,
  }), []);

  return (
    <LandingPageShell
      title="Reports"
      subtitle="KPIs, analytics, student reports, and data integrity"
      cards={cards}
      contentMap={contentMap}
      defaultCard="kpi"
    />
  );
}
