import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/contexts/AuthContext";
import { useDivision } from "@/contexts/DivisionContext";
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
  { label: 'Teachers', value: 'teachers' },
  { label: 'Accountability', value: 'accountability' },
  { label: 'Course/Batch', value: 'course-batch' },
  { label: 'Activity Logs', value: 'activity-logs' },
  { label: 'Alerts', value: 'alerts' },
  { label: 'Custom', value: 'custom' },
] as const;

const baseDescriptions: Record<string, string> = {
  executive: 'High-level overview of academy performance.',
  attendance: 'Daily attendance summaries, absence detection, and streak tracking.',
  fees: 'Revenue tracking, pending dues, and payment analysis.',
  engagement: 'Student progress tracking, consistency, and engagement patterns.',
  teachers: 'Classes taken, punctuality, and teacher performance analysis.',
  accountability: 'Zoom session accountability, no-shows, and punctuality.',
  'course-batch': 'Enrollment counts, completion rates, and drop-off analysis.',
  'activity-logs': 'Complete audit trail of all system actions.',
  alerts: 'Auto-generated alerts for low attendance, overdue fees, and absences.',
  custom: 'Build custom reports with export-friendly filters.',
};

export default function Reports() {
  const { activeRole } = useAuth();
  const { activeModelType } = useDivision();
  const [searchParams] = useSearchParams();
  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');
  const isOneToOne = activeModelType === 'one_to_one';
  const availableViews = useMemo(
    () => allViews.filter((view) => isAdmin || !['activity-logs', 'alerts', 'custom', 'teachers', 'accountability'].includes(view.value)),
    [isAdmin],
  );

  const requested = searchParams.get('view') || searchParams.get('section');
  const activeView = availableViews.some((item) => item.value === requested) ? requested! : null;
  if (!activeView) return <Navigate to="/reports?view=executive" replace />;

  const renderSection = () => {
    switch (activeView) {
      case 'executive': return <ExecutiveDashboard />;
      case 'attendance': return <AttendanceReports />;
      case 'fees': return <FeeReports />;
      case 'engagement': return <StudentEngagement />;
      case 'teachers': return <TeacherPerformance />;
      case 'accountability': return <AccountabilityReport />;
      case 'course-batch': return <CourseReports />;
      case 'activity-logs': return <ActivityLogs />;
      case 'alerts': return <AlertsAutomation />;
      case 'custom': return <CustomReportBuilder />;
      default: return <ExecutiveDashboard />;
    }
  };

  const description =
    activeView === 'course-batch' && isOneToOne
      ? 'Teacher and subject load: active assignments, paused, left, and drop-off analysis.'
      : baseDescriptions[activeView];

  return (
    <PageShell title="Reports" description={description}>
      <div className="animate-fade-in">
        <ErrorBoundary>{renderSection()}</ErrorBoundary>
      </div>
    </PageShell>
  );
}
