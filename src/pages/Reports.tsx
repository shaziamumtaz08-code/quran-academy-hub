import { useMemo } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDivision } from "@/contexts/DivisionContext";
import { FileText, TrendingUp } from "lucide-react";
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
import QaidaProgressReport from "@/components/reports/QaidaProgressReport";
import ComplianceReport from "@/components/reports/ComplianceReport";
import FinancialStatements from "@/components/reports/FinancialStatements";
import SalaryRevisionsReport from "@/components/reports/SalaryRevisionsReport";

const allViews = [
  { label: 'Executive', value: 'executive' },
  { label: 'Attendance', value: 'attendance' },
  { label: 'Fees', value: 'fees' },
  { label: 'Statements', value: 'statements' },
  { label: 'Salary Revisions', value: 'salary-revisions' },
  { label: 'Engagement', value: 'engagement' },
  { label: 'Qaida Progress', value: 'qaida' },
  { label: 'Teachers', value: 'teachers' },
  { label: 'Compliance', value: 'compliance' },
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
  statements: 'Individual staff salary and student fee statements for any period — earned, paid, and outstanding.',
  'salary-revisions': 'Salary sheets that are revision-due or out of sync with active assignments — filter by month, staff and issue type.',
  engagement: 'Student progress tracking, consistency, and engagement patterns.',
  qaida: 'Noorani Qaida baab-by-baab progress for every Qaida student.',
  teachers: 'Classes taken, punctuality, and teacher performance analysis.',
  compliance: 'Attendance and planning compliance scorecard for any period, with teacher filtering.',
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
    () => allViews.filter((view) => isAdmin || !['activity-logs', 'alerts', 'custom', 'teachers', 'accountability', 'compliance', 'statements', 'salary-revisions'].includes(view.value)),
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
      case 'statements': return <FinancialStatements />;
      case 'salary-revisions': return <SalaryRevisionsReport />;
      case 'engagement': return <StudentEngagement />;
      case 'qaida': return <QaidaProgressReport />;
      case 'teachers': return <TeacherPerformance />;
      case 'compliance': return <ComplianceReport />;
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
    <PageShell
      title="Reports"
      description={description}
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" size="sm" asChild>
            <Link to="/student-reports">
              <FileText className="mr-2 h-4 w-4" />
              Student Reports
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/progress-timeline">
              <TrendingUp className="mr-2 h-4 w-4" />
              Progress Timeline
            </Link>
          </Button>
        </div>
      }
    >
      <div className="animate-fade-in">
        <ErrorBoundary>{renderSection()}</ErrorBoundary>
      </div>
    </PageShell>
  );
}
