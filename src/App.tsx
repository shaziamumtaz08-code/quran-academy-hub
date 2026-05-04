import { lazy, Suspense } from "react";
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
import { isStudentRouteAllowed } from "@/lib/studentRoutes";
import { RouteGuard } from "@/components/auth/RouteGuard";

const queryClient = new QueryClient();

function AppShellLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

const Login = lazy(() => import("./pages/Login"));
const TenantLoginPage = lazy(() => import("./pages/TenantLogin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Teachers = lazy(() => import("./pages/Teachers"));
const Students = lazy(() => import("./pages/Students"));
const Schedules = lazy(() => import("./pages/Schedules"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Lessons = lazy(() => import("./pages/Lessons"));
const Reports = lazy(() => import("./pages/Reports"));
const Payments = lazy(() => import("./pages/Payments"));
const KPI = lazy(() => import("./pages/KPI"));
const ReportCardTemplates = lazy(() => import("./pages/ReportCardTemplates"));
const GenerateReportCard = lazy(() => import("./pages/GenerateReportCard"));
const StudentReports = lazy(() => import("./pages/StudentReports"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const Resources = lazy(() => import("./pages/Resources"));
const Assignments = lazy(() => import("./pages/Assignments"));
const MonthlyPlanning = lazy(() => import("./pages/MonthlyPlanning"));
const AdminCommandCenter = lazy(() => import("./pages/AdminCommandCenter"));
const TeacherNazraDashboard = lazy(() => import("./pages/TeacherNazraDashboard"));
const TeacherPerformance = lazy(() => import("./pages/TeacherPerformance"));
const Subjects = lazy(() => import("./pages/Subjects"));
const ZoomManagement = lazy(() => import("./pages/ZoomManagement"));
const IntegrityAudit = lazy(() => import("./pages/IntegrityAudit"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseBuilder = lazy(() => import("./pages/CourseBuilder"));
const PublicCoursePage = lazy(() => import("./pages/PublicCoursePage"));
const OrganizationSettings = lazy(() => import("./pages/OrganizationSettings"));
const FinanceSetup = lazy(() => import("./pages/FinanceSetup"));
const SalaryEngine = lazy(() => import("./pages/SalaryEngine"));
const StaffSalarySetup = lazy(() => import("./pages/StaffSalarySetup"));
const Expenses = lazy(() => import("./pages/Expenses"));
const CashAdvances = lazy(() => import("./pages/CashAdvances"));
const SelectDivision = lazy(() => import("./pages/SelectDivision"));
const PrintReport = lazy(() => import("./pages/PrintReport"));
const PrintInvoice = lazy(() => import("./pages/PrintInvoice"));
const PrintSalary = lazy(() => import("./pages/PrintSalary"));
const WorkHub = lazy(() => import("./pages/WorkHub"));
const LeadsPipeline = lazy(() => import("./pages/LeadsPipeline"));
const EnrollmentForm = lazy(() => import("./pages/EnrollmentForm"));
const PublicInquiryForm = lazy(() => import("./pages/PublicInquiryForm"));
const StudentCourseView = lazy(() => import("./pages/StudentCourseView"));
const MyCourses = lazy(() => import("./pages/MyCourses"));
const TeacherCourseView = lazy(() => import("./pages/TeacherCourseView"));
const NotFound = lazy(() => import("./pages/NotFound"));
const IdentityResolution = lazy(() => import("./pages/IdentityResolution"));
const CourseCatalog = lazy(() => import("./pages/CourseCatalog"));
const CourseAssetLibrary = lazy(() => import("./pages/CourseAssetLibrary"));
const RecordedCourses = lazy(() => import("./pages/RecordedCourses"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));
const GroupChat = lazy(() => import("./pages/GroupChat"));
const WhatsAppInbox = lazy(() => import("./pages/WhatsAppInbox"));
const PublicApplyForm = lazy(() => import("./pages/PublicApplyForm"));
const TeachingOS = lazy(() => import("./pages/TeachingOS"));
const TeachingOSOutline = lazy(() => import("./pages/TeachingOSOutline"));
const TeachingOSPlanner = lazy(() => import("./pages/TeachingOSPlanner"));
const TeachingOSDayBoard = lazy(() => import("./pages/TeachingOSDayBoard"));
const TeachingOSStudentView = lazy(() => import("./pages/TeachingOSStudentView"));
const TeachingOSContentKit = lazy(() => import("./pages/TeachingOSContentKit"));
const TeachingOSAssessment = lazy(() => import("./pages/TeachingOSAssessment"));
const TeachingOSVideo = lazy(() => import("./pages/TeachingOSVideo"));
const TeachingOSSpeakingTutor = lazy(() => import("./pages/TeachingOSSpeakingTutor"));
const TeachingOSAnalytics = lazy(() => import("./pages/TeachingOSAnalytics"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const QuizEngine = lazy(() => import("./pages/QuizEngine"));
const PublicQuiz = lazy(() => import("./pages/PublicQuiz"));
const StudentQuizView = lazy(() => import("./pages/StudentQuizView"));
const VirtualClassroom = lazy(() => import("./pages/VirtualClassroom"));
const SchemaExplorer = lazy(() => import("./pages/SchemaExplorer"));
const UserConnections = lazy(() => import("./pages/UserConnections"));
const TeachingLanding = lazy(() => import("./pages/TeachingLanding"));
const PeopleLanding = lazy(() => import("./pages/PeopleLanding"));
const FinanceLanding = lazy(() => import("./pages/FinanceLanding"));
const MySchedule = lazy(() => import("./pages/MySchedule"));
const CommunicationLanding = lazy(() => import("./pages/CommunicationLanding"));
const SettingsLanding = lazy(() => import("./pages/SettingsLanding"));

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
    if (activeRole === 'admin_division') return '/dashboard';
    if (activeRole === 'admin' || activeRole?.startsWith('admin_')) return '/admin';
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
    if (activeRole === 'admin_division') return '/dashboard';
    if (activeRole === 'admin' || activeRole?.startsWith('admin_')) return '/admin';
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

      <Route path="/admin" element={<ProtectedRoute>{(() => {
        const SuperAdminOnly = () => {
          const { activeRole } = useAuth();
          if (activeRole && activeRole !== 'super_admin') return <Navigate to="/dashboard" replace />;
          return <AdminCommandCenter />;
        };
        return <SuperAdminOnly />;
      })()}</ProtectedRoute>} />
      <Route path="/teacher" element={<ProtectedRoute><RouteGuard moduleId="teacher_nazra"><DivisionModelGuard allowedModels={['one_to_one']}><TeacherNazraDashboard /></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/performance" element={<ProtectedRoute><TeacherPerformance /></ProtectedRoute>} />

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
      <Route path="/course-asset-library" element={<ProtectedRoute><RouteGuard moduleId="courses_admin"><CourseAssetLibrary /></RouteGuard></ProtectedRoute>} />
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
            <Suspense fallback={<AppShellLoader />}>
              <AppRoutes />
            </Suspense>
          </DivisionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
