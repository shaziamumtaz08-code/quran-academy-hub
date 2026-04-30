import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DivisionProvider, useDivision } from "@/contexts/DivisionContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Login from "./pages/Login";
import TenantLoginPage from "./pages/TenantLogin";
import Dashboard from "./pages/Dashboard";
import Teachers from "./pages/Teachers";
import Students from "./pages/Students";
import Schedules from "./pages/Schedules";
import Attendance from "./pages/Attendance";
import Lessons from "./pages/Lessons";
import Reports from "./pages/Reports";
import Payments from "./pages/Payments";
import KPI from "./pages/KPI";
import ReportCardTemplates from "./pages/ReportCardTemplates";
import GenerateReportCard from "./pages/GenerateReportCard";
import StudentReports from "./pages/StudentReports";
import UserManagement from "./pages/UserManagement";
import Resources from "./pages/Resources";
import Assignments from "./pages/Assignments";
import MonthlyPlanning from "./pages/MonthlyPlanning";
import AdminCommandCenter from "./pages/AdminCommandCenter";
import TeacherNazraDashboard from "./pages/TeacherNazraDashboard";
import Subjects from "./pages/Subjects";
import ZoomManagement from "./pages/ZoomManagement";
import IntegrityAudit from "./pages/IntegrityAudit";
import Courses from "./pages/Courses";
import CourseBuilder from "./pages/CourseBuilder";
import PublicCoursePage from "./pages/PublicCoursePage";
import OrganizationSettings from "./pages/OrganizationSettings";
import FinanceSetup from "./pages/FinanceSetup";
import SalaryEngine from "./pages/SalaryEngine";
import StaffSalarySetup from "./pages/StaffSalarySetup";
import Expenses from "./pages/Expenses";
import CashAdvances from "./pages/CashAdvances";
import SelectDivision from "./pages/SelectDivision";
import PrintReport from "./pages/PrintReport";
import PrintInvoice from "./pages/PrintInvoice";
import PrintSalary from "./pages/PrintSalary";
import WorkHub from "./pages/WorkHub";
import LeadsPipeline from "./pages/LeadsPipeline";
import EnrollmentForm from "./pages/EnrollmentForm";
import PublicInquiryForm from "./pages/PublicInquiryForm";
import StudentCourseView from "./pages/StudentCourseView";
import MyCourses from "./pages/MyCourses";
import TeacherCourseView from "./pages/TeacherCourseView";
import NotFound from "./pages/NotFound";
import IdentityResolution from "./pages/IdentityResolution";
import CourseCatalog from "./pages/CourseCatalog";
import RecordedCourses from "./pages/RecordedCourses";
import NotificationCenter from "./pages/NotificationCenter";
import GroupChat from "./pages/GroupChat";
import WhatsAppInbox from "./pages/WhatsAppInbox";
import PublicApplyForm from "./pages/PublicApplyForm";
import TeachingOS from "./pages/TeachingOS";
import TeachingOSOutline from "./pages/TeachingOSOutline";
import TeachingOSPlanner from "./pages/TeachingOSPlanner";
import TeachingOSDayBoard from "./pages/TeachingOSDayBoard";
import TeachingOSStudentView from "./pages/TeachingOSStudentView";
import TeachingOSContentKit from "./pages/TeachingOSContentKit";
import TeachingOSAssessment from "./pages/TeachingOSAssessment";
import TeachingOSVideo from "./pages/TeachingOSVideo";
import TeachingOSSpeakingTutor from "./pages/TeachingOSSpeakingTutor";
import TeachingOSAnalytics from "./pages/TeachingOSAnalytics";
import ParentDashboard from "./pages/ParentDashboard";
import QuizEngine from "./pages/QuizEngine";
import PublicQuiz from "./pages/PublicQuiz";
import StudentQuizView from "./pages/StudentQuizView";
import VirtualClassroom from "./pages/VirtualClassroom";
import SchemaExplorer from "./pages/SchemaExplorer";
import UserConnections from "./pages/UserConnections";
import TeachingLanding from "./pages/TeachingLanding";
import PeopleLanding from "./pages/PeopleLanding";
import FinanceLanding from "./pages/FinanceLanding";
import MySchedule from "./pages/MySchedule";
import CommunicationLanding from "./pages/CommunicationLanding";
import SettingsLanding from "./pages/SettingsLanding";
import { isStudentRouteAllowed } from "@/lib/studentRoutes";
import { RouteGuard } from "@/components/auth/RouteGuard";

const queryClient = new QueryClient();

/**
 * Blocks the `student` role from admin/teacher routes that previously had no
 * guard. Other roles pass through unchanged.
 */
function NonStudentRoute({ children }: { children: React.ReactNode }) {
  const { activeRole, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading || (profile && !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (activeRole === 'student' && !isStudentRouteAllowed(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

/** @deprecated Use <RouteGuard moduleId="..."/>. Kept for one sprint during transition. */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { activeRole, isLoading, profile } = useAuth();

  if (isLoading || (profile && !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  const isAdmin = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_');

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/** @deprecated Use <RouteGuard moduleId="..."/>. Kept for one sprint during transition. */
function AdminOrExaminerRoute({ children }: { children: React.ReactNode }) {
  const { activeRole, isLoading, profile } = useAuth();

  if (isLoading || (profile && !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  const allowed = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_') || activeRole === 'examiner';

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/** @deprecated Use <RouteGuard moduleId="..."/>. Kept for one sprint during transition. */
function AdminOrExaminerOrTeacherRoute({ children }: { children: React.ReactNode }) {
  const { activeRole, isLoading, profile } = useAuth();

  if (isLoading || (profile && !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  const allowed = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_') || activeRole === 'examiner' || activeRole === 'teacher';

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/** @deprecated Use <RouteGuard moduleId="..."/>. Kept for one sprint during transition. */
function AdminOrTeacherRoute({ children }: { children: React.ReactNode }) {
  const { activeRole, isLoading, profile } = useAuth();

  if (isLoading || (profile && !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  const allowed =
    activeRole === 'super_admin' ||
    activeRole === 'admin' ||
    activeRole?.startsWith('admin_') ||
    activeRole === 'teacher';

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/** @deprecated Use <RouteGuard moduleId="..."/>. Kept for one sprint during transition. */
function TeacherOnlyRoute({ children }: { children: React.ReactNode }) {
  const { activeRole, isLoading, profile } = useAuth();

  if (isLoading || (profile && !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  if (activeRole !== 'teacher' && activeRole !== 'examiner') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

type DivisionModel = 'one_to_one' | 'group' | 'recorded';
function DivisionModelGuard({ allowedModels, children }: { allowedModels: DivisionModel[]; children: React.ReactNode }) {
  const { activeDivision, isLoading } = useDivision();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }
  if (!activeDivision || !allowedModels.includes(activeDivision.model_type as DivisionModel)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/** @deprecated Use <RouteGuard moduleId="..."/>. Kept for one sprint during transition. */
function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { activeRole, isLoading, profile } = useAuth();

  if (isLoading || (profile && !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  const isTeacher = activeRole === 'teacher' || activeRole === 'examiner';

  if (!isTeacher) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function LoginRedirect() {
  const { isAuthenticated, activeRole } = useAuth();
  const location = useLocation();
  const from = (location.state as any)?.from;

  const getDefaultRoute = () => {
    if (!activeRole) return '/dashboard';
    if (activeRole === 'super_admin') return '/select-division';
    if (activeRole === 'admin_division' || activeRole === 'admin' || activeRole?.startsWith('admin_')) return '/admin';
    if (activeRole === 'teacher' || activeRole === 'examiner') return '/dashboard';
    if (activeRole === 'parent') return '/parent';
    return '/dashboard';
  };

  if (isAuthenticated) {
    return <Navigate to={from || getDefaultRoute()} replace />;
  }
  return <Login />;
}

function DashboardWrapper() {
  return (
    <DashboardLayout>
      <ErrorBoundary><Dashboard /></ErrorBoundary>
    </DashboardLayout>
  );
}

function AppRoutes() {
  const { activeRole } = useAuth();

  const getDefaultRoute = () => {
    if (!activeRole) return '/dashboard';
    if (activeRole === 'super_admin') return '/select-division';
    if (activeRole === 'admin_division' || activeRole === 'admin' || activeRole?.startsWith('admin_')) return '/admin';
    if (activeRole === 'teacher' || activeRole === 'examiner') return '/dashboard';
    if (activeRole === 'parent') return '/parent';
    return '/dashboard';
  };

  return (
    <Routes>
      <Route path="/login" element={<LoginRedirect />} />
      <Route path="/login/:slug" element={<TenantLoginPage />} />
      <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
      <Route path="/select-division" element={
        <ProtectedRoute>
          {(() => {
            const SelectDivisionGuard = () => {
              const { activeRole, isLoading } = useAuth();
              if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
              if (activeRole !== 'super_admin') return <Navigate to="/dashboard" replace />;
              return <SelectDivision />;
            };
            return <SelectDivisionGuard />;
          })()}
        </ProtectedRoute>
      } />

      <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminCommandCenter /></AdminRoute></ProtectedRoute>} />
      <Route path="/teacher" element={<ProtectedRoute><RouteGuard moduleId="teacher_nazra"><DivisionModelGuard allowedModels={['one_to_one']}><TeacherNazraDashboard /></DivisionModelGuard></RouteGuard></ProtectedRoute>} />

      <Route path="/teaching" element={<ProtectedRoute><RouteGuard moduleId="teaching_landing"><DashboardLayout><TeachingLanding /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><LanguageProvider><TeachingOS /></LanguageProvider></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/outline" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSOutline /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/planner" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSPlanner /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/dayboard" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSDayBoard /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/dayboard/live" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSDayBoard /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/student-view" element={<LanguageProvider><TeachingOSStudentView /></LanguageProvider>} />
      <Route path="/teaching-os/content-kit" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSContentKit /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/assessment" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSAssessment /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/video" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSVideo /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/speaking-tutor" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSSpeakingTutor /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/analytics" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSAnalytics /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/parent" element={<ProtectedRoute><RouteGuard moduleId="parent_portal"><ParentDashboard /></RouteGuard></ProtectedRoute>} />
      <Route path="/parent/child/:studentId" element={<ProtectedRoute><RouteGuard moduleId="parent_portal"><ParentDashboard /></RouteGuard></ProtectedRoute>} />
      <Route path="/people" element={<ProtectedRoute><RouteGuard moduleId="people"><DashboardLayout><PeopleLanding /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute><RouteGuard moduleId="finance"><DashboardLayout><FinanceLanding /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/reports-hub" element={<Navigate to="/reports?view=executive" replace />} />
      <Route path="/my-dashboard" element={<Navigate to="/dashboard" replace />} />
      <Route path="/communication" element={<ProtectedRoute><RouteGuard moduleId="communication"><DashboardLayout><CommunicationLanding /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><RouteGuard moduleId="settings"><DashboardLayout><SettingsLanding /></DashboardLayout></RouteGuard></ProtectedRoute>} />

      <Route path="/dashboard" element={<ProtectedRoute><RouteGuard moduleId="dashboard"><DashboardWrapper /></RouteGuard></ProtectedRoute>} />
      <Route path="/my-courses" element={<ProtectedRoute><RouteGuard moduleId="my_courses"><DashboardLayout><MyCourses /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/my-courses/:courseId" element={<ProtectedRoute><RouteGuard moduleId="my_courses"><DashboardLayout><StudentCourseView /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/my-teaching/:courseId" element={<ProtectedRoute><RouteGuard moduleId="my_teaching"><DashboardLayout><TeacherCourseView /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/user-management" element={<ProtectedRoute><RouteGuard moduleId="user_management"><UserManagement /></RouteGuard></ProtectedRoute>} />
      <Route path="/assignments" element={<ProtectedRoute><RouteGuard moduleId="assignments"><Assignments /></RouteGuard></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute><RouteGuard moduleId="subjects"><Subjects /></RouteGuard></ProtectedRoute>} />
      <Route path="/teachers" element={<ProtectedRoute><RouteGuard moduleId="teachers"><Teachers /></RouteGuard></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><RouteGuard moduleId="students"><Students /></RouteGuard></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute><RouteGuard moduleId="attendance"><Attendance /></RouteGuard></ProtectedRoute>} />
      <Route path="/lessons" element={<ProtectedRoute><RouteGuard moduleId="lessons"><Lessons /></RouteGuard></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><RouteGuard moduleId="reports"><DashboardLayout><Reports /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/payments" element={<Navigate to="/finance?view=payments" replace />} />
      <Route path="/kpi" element={<ProtectedRoute><RouteGuard moduleId="kpi"><KPI /></RouteGuard></ProtectedRoute>} />
      <Route path="/schedules" element={<ProtectedRoute><RouteGuard moduleId="schedules"><Schedules /></RouteGuard></ProtectedRoute>} />
      <Route path="/my-schedule" element={<ProtectedRoute><RouteGuard moduleId="my_schedule"><DashboardLayout><MySchedule /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/zoom-management" element={<ProtectedRoute><RouteGuard moduleId="zoom_management"><ZoomManagement /></RouteGuard></ProtectedRoute>} />
      <Route path="/integrity-audit" element={<ProtectedRoute><RouteGuard moduleId="integrity_audit"><IntegrityAudit /></RouteGuard></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute><RouteGuard moduleId="courses_admin"><Courses /></RouteGuard></ProtectedRoute>} />
      <Route path="/courses/:id" element={<ProtectedRoute><RouteGuard moduleId="courses_admin"><DashboardLayout><CourseBuilder /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/academics/courses/:id" element={<ProtectedRoute><RouteGuard moduleId="courses_admin"><DashboardLayout><CourseBuilder /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/organization-settings" element={<ProtectedRoute><RouteGuard moduleId="org_settings"><OrganizationSettings /></RouteGuard></ProtectedRoute>} />
      <Route path="/finance-setup" element={<ProtectedRoute><RouteGuard moduleId="finance_setup"><FinanceSetup /></RouteGuard></ProtectedRoute>} />
      <Route path="/salary" element={<ProtectedRoute><RouteGuard moduleId="salary"><SalaryEngine /></RouteGuard></ProtectedRoute>} />
      <Route path="/staff-salaries" element={<ProtectedRoute><RouteGuard moduleId="staff_salaries"><StaffSalarySetup /></RouteGuard></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><RouteGuard moduleId="expenses"><Expenses /></RouteGuard></ProtectedRoute>} />
      <Route path="/cash-advances" element={<ProtectedRoute><RouteGuard moduleId="cash_advances"><CashAdvances /></RouteGuard></ProtectedRoute>} />
      <Route path="/monthly-planning" element={<ProtectedRoute><RouteGuard moduleId="monthly_planning"><MonthlyPlanning /></RouteGuard></ProtectedRoute>} />
      <Route path="/report-card-templates" element={<ProtectedRoute><RouteGuard moduleId="report_card_tpl"><ReportCardTemplates /></RouteGuard></ProtectedRoute>} />
      <Route path="/generate-report-card" element={<ProtectedRoute><RouteGuard moduleId="generate_report_card"><GenerateReportCard /></RouteGuard></ProtectedRoute>} />
      <Route path="/student-reports" element={<ProtectedRoute><RouteGuard moduleId="student_reports"><StudentReports /></RouteGuard></ProtectedRoute>} />
      <Route path="/exam-templates" element={<Navigate to="/report-card-templates" replace />} />
      <Route path="/exam-submission" element={<Navigate to="/generate-report-card" replace />} />
      <Route path="/exam-results" element={<Navigate to="/student-reports" replace />} />
      <Route path="/resources" element={<ProtectedRoute><RouteGuard moduleId="resources"><DashboardLayout><Resources /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/leads" element={<ProtectedRoute><RouteGuard moduleId="leads"><LeadsPipeline /></RouteGuard></ProtectedRoute>} />
      <Route path="/identity" element={<ProtectedRoute><RouteGuard moduleId="identity"><IdentityResolution /></RouteGuard></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><RouteGuard moduleId="notifications"><NotificationCenter /></RouteGuard></ProtectedRoute>} />
      <Route path="/hub" element={<Navigate to="/work-hub" replace />} />
      <Route path="/workhub" element={<Navigate to="/work-hub" replace />} />
      <Route path="/work-hub" element={<ProtectedRoute><RouteGuard moduleId="work_hub"><WorkHub /></RouteGuard></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><RouteGuard moduleId="chat"><GroupChat /></RouteGuard></ProtectedRoute>} />
      <Route path="/whatsapp" element={<ProtectedRoute><RouteGuard moduleId="whatsapp"><WhatsAppInbox /></RouteGuard></ProtectedRoute>} />
      <Route path="/my-resources" element={<Navigate to="/resources?tab=assigned" replace />} />
      <Route path="/reports/print/:reportId" element={<ProtectedRoute><PrintReport /></ProtectedRoute>} />
      <Route path="/finance/print/invoice/:invoiceId" element={<ProtectedRoute><PrintInvoice /></ProtectedRoute>} />
      <Route path="/finance/print/salary/:payoutId" element={<ProtectedRoute><PrintSalary /></ProtectedRoute>} />
      <Route path="/course/:slug" element={<PublicCoursePage />} />
      <Route path="/enroll/:token" element={<EnrollmentForm />} />
      <Route path="/inquiry" element={<PublicInquiryForm />} />
      <Route path="/courses-catalog" element={<CourseCatalog />} />
      <Route path="/recorded-courses" element={<RecordedCourses />} />
      <Route path="/apply/:slug" element={<PublicApplyForm />} />
      <Route path="/quiz-engine" element={<ProtectedRoute><RouteGuard moduleId="quiz_engine"><QuizEngine /></RouteGuard></ProtectedRoute>} />
      <Route path="/my-quizzes" element={<ProtectedRoute><RouteGuard moduleId="my_quizzes"><StudentQuizView /></RouteGuard></ProtectedRoute>} />
      <Route path="/quiz/:token" element={<PublicQuiz />} />
      <Route path="/classroom/:sessionId" element={<ProtectedRoute><RouteGuard moduleId="classroom"><VirtualClassroom /></RouteGuard></ProtectedRoute>} />
      <Route path="/admin/schema-explorer" element={<ProtectedRoute><RouteGuard moduleId="schema_explorer"><SchemaExplorer /></RouteGuard></ProtectedRoute>} />
      <Route path="/connections/:userType/:userId" element={<ProtectedRoute><RouteGuard moduleId="connections"><UserConnections /></RouteGuard></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallBanner />
      <BrowserRouter>
        <AuthProvider>
          <DivisionProvider>
            <AppRoutes />
          </DivisionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
