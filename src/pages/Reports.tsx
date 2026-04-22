import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/contexts/AuthContext";
import { ViewPillBar } from "@/components/layout/ViewPillBar";
import ExecutiveDashboard from "@/components/reports/ExecutiveDashboard";
import AttendanceReports from "@/components/reports/AttendanceReports";
import FeeReports from "@/components/reports/FeeReports";
import StudentEngagement from "@/components/reports/StudentEngagement";
import TeacherPerformance from "@/components/reports/TeacherPerformance";
import CourseReports from "@/components/reports/CourseReports";
import ActivityLogs from "@/components/reports/ActivityLogs";
import AlertsAutomation from "@/components/reports/AlertsAutomation";
import CustomReportBuilder from "@/components/reports/CustomReportBuilder";
import AccountabilityReport from "@/components/reports/AccountabilityReport";

const allViews = [
  { label: 'Executive', value: 'executive' },
  { label: 'Attendance', value: 'attendance' },
  { label: 'Fees', value: 'fees' },
  { label: 'Engagement', value: 'engagement' },
  { label: 'Teachers', value: 'teacher' },
  { label: 'Accountability', value: 'accountability' },
  { label: 'Course/Batch', value: 'courses' },
  { label: 'Activity Logs', value: 'logs' },
  { label: 'Alerts', value: 'alerts' },
  { label: 'Custom', value: 'custom' },
] as const;

const descriptions: Record<string, string> = {
  executive: 'High-level overview of academy performance.',
  attendance: 'Daily attendance summaries, absence detection, and streak tracking.',
  fees: 'Revenue tracking, pending dues, and payment analysis.',
  engagement: 'Student progress tracking, consistency, and engagement patterns.',
  teacher: 'Classes taken, punctuality, and teacher performance analysis.',
  accountability: 'Zoom session accountability, no-shows, and punctuality.',
  courses: 'Enrollment counts, completion rates, and drop-off analysis.',
  logs: 'Complete audit trail of all system actions.',
  alerts: 'Auto-generated alerts for low attendance, overdue fees, and absences.',
  custom: 'Build custom reports with export-friendly filters.',
};

export default function Reports() {
  const { activeRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');
  const availableViews = useMemo(
    () => allViews.filter((view) => isAdmin || !['logs', 'alerts', 'custom', 'teacher', 'accountability'].includes(view.value)),
    [isAdmin],
  );

  const requested = searchParams.get('view') || searchParams.get('section');
  const activeView = availableViews.some((item) => item.value === requested) ? requested! : 'executive';

  const setView = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', value);
    next.delete('section');
    setSearchParams(next, { replace: true });
  };

  const renderSection = () => {
    switch (activeView) {
      case 'executive': return <ExecutiveDashboard />;
      case 'attendance': return <AttendanceReports />;
      case 'fees': return <FeeReports />;
      case 'engagement': return <StudentEngagement />;
      case 'teacher': return <TeacherPerformance />;
      case 'accountability': return <AccountabilityReport />;
      case 'courses': return <CourseReports />;
      case 'logs': return <ActivityLogs />;
      case 'alerts': return <AlertsAutomation />;
      case 'custom': return <CustomReportBuilder />;
      default: return <ExecutiveDashboard />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        <header>
          <h1 className="text-2xl font-serif font-bold text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">{descriptions[activeView]}</p>
        </header>

        <ViewPillBar items={availableViews.map((item) => ({ ...item }))} activeValue={activeView} onChange={setView} />

        <ErrorBoundary>{renderSection()}</ErrorBoundary>
      </div>
    </DashboardLayout>
  );
}
