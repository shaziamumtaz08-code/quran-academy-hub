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
    if (activeRole === 'admin' || activeRole?.startsWith('admin_')) return '/admin';
    if (activeRole === 'teacher' || activeRole === 'examiner') return '/dashboard';
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
    if (activeRole === 'admin' || activeRole?.startsWith('admin_')) {
      return '/admin';
    }
    if (activeRole === 'teacher' || activeRole === 'examiner') {
      return '/dashboard';
    }
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
      <Route path="/teacher" element={<ProtectedRoute><TeacherOnlyRoute><DivisionModelGuard allowedModels={['one_to_one']}><TeacherNazraDashboard /></DivisionModelGuard></TeacherOnlyRoute></ProtectedRoute>} />

      <Route path="/teaching" element={<ProtectedRoute><NonStudentRoute><DashboardLayout><TeachingLanding /></DashboardLayout></NonStudentRoute></ProtectedRoute>} />
      <Route path="/teaching-os" element={<ProtectedRoute><NonStudentRoute><LanguageProvider><TeachingOS /></LanguageProvider></NonStudentRoute></ProtectedRoute>} />
      <Route path="/teaching-os/outline" element={<ProtectedRoute><NonStudentRoute><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSOutline /></LanguageProvider></DivisionModelGuard></NonStudentRoute></ProtectedRoute>} />
      <Route path="/teaching-os/planner" element={<ProtectedRoute><NonStudentRoute><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSPlanner /></LanguageProvider></DivisionModelGuard></NonStudentRoute></ProtectedRoute>} />
      <Route path="/teaching-os/dayboard" element={<ProtectedRoute><NonStudentRoute><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSDayBoard /></LanguageProvider></DivisionModelGuard></NonStudentRoute></ProtectedRoute>} />
      <Route path="/teaching-os/dayboard/live" element={<ProtectedRoute><NonStudentRoute><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSDayBoard /></LanguageProvider></DivisionModelGuard></NonStudentRoute></ProtectedRoute>} />
      <Route path="/teaching-os/student-view" element={<LanguageProvider><TeachingOSStudentView /></LanguageProvider>} />
      <Route path="/teaching-os/content-kit" element={<ProtectedRoute><NonStudentRoute><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSContentKit /></LanguageProvider></DivisionModelGuard></NonStudentRoute></ProtectedRoute>} />
      <Route path="/teaching-os/assessment" element={<ProtectedRoute><NonStudentRoute><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSAssessment /></LanguageProvider></DivisionModelGuard></NonStudentRoute></ProtectedRoute>} />
      <Route path="/teaching-os/video" element={<ProtectedRoute><NonStudentRoute><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSVideo /></LanguageProvider></DivisionModelGuard></NonStudentRoute></ProtectedRoute>} />
      <Route path="/teaching-os/speaking-tutor" element={<ProtectedRoute><NonStudentRoute><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSSpeakingTutor /></LanguageProvider></DivisionModelGuard></NonStudentRoute></ProtectedRoute>} />
      <Route path="/teaching-os/analytics" element={<ProtectedRoute><NonStudentRoute><DivisionModelGuard allowedModels={['group','recorded']}><LanguageProvider><TeachingOSAnalytics /></LanguageProvider></DivisionModelGuard></NonStudentRoute></ProtectedRoute>} />
      <Route path="/parent" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
      <Route path="/parent/child/:studentId" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
      <Route path="/people" element={<ProtectedRoute><AdminRoute><DashboardLayout><PeopleLanding /></DashboardLayout></AdminRoute></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute><AdminRoute><DashboardLayout><FinanceLanding /></DashboardLayout></AdminRoute></ProtectedRoute>} />
      <Route path="/reports-hub" element={<Navigate to="/reports?view=executive" replace />} />
      <Route path="/my-dashboard" element={<Navigate to="/dashboard" replace />} />
      <Route path="/communication" element={<ProtectedRoute><DashboardLayout><CommunicationLanding /></DashboardLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AdminRoute><DashboardLayout><SettingsLanding /></DashboardLayout></AdminRoute></ProtectedRoute>} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardWrapper /></ProtectedRoute>} />
      <Route path="/my-courses" element={<ProtectedRoute><DashboardLayout><MyCourses /></DashboardLayout></ProtectedRoute>} />
      <Route path="/my-courses/:courseId" element={<ProtectedRoute><DashboardLayout><StudentCourseView /></DashboardLayout></ProtectedRoute>} />
      <Route path="/my-teaching/:courseId" element={<ProtectedRoute><TeacherOnlyRoute><DashboardLayout><TeacherCourseView /></DashboardLayout></TeacherOnlyRoute></ProtectedRoute>} />
      <Route path="/user-management" element={<ProtectedRoute><AdminRoute><UserManagement /></AdminRoute></ProtectedRoute>} />
      <Route path="/assignments" element={<ProtectedRoute><NonStudentRoute><Assignments /></NonStudentRoute></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute><AdminRoute><Subjects /></AdminRoute></ProtectedRoute>} />
      <Route path="/teachers" element={<ProtectedRoute><NonStudentRoute><Teachers /></NonStudentRoute></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><NonStudentRoute><Students /></NonStudentRoute></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute><NonStudentRoute><Attendance /></NonStudentRoute></ProtectedRoute>} />
      <Route path="/lessons" element={<ProtectedRoute><NonStudentRoute><Lessons /></NonStudentRoute></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><AdminRoute><DashboardLayout><Reports /></DashboardLayout></AdminRoute></ProtectedRoute>} />
      <Route path="/payments" element={<Navigate to="/finance?view=payments" replace />} />
      <Route path="/kpi" element={<ProtectedRoute><AdminRoute><KPI /></AdminRoute></ProtectedRoute>} />
      <Route path="/schedules" element={<ProtectedRoute><AdminRoute><Schedules /></AdminRoute></ProtectedRoute>} />
      <Route path="/my-schedule" element={<ProtectedRoute><TeacherOnlyRoute><DashboardLayout><MySchedule /></DashboardLayout></TeacherOnlyRoute></ProtectedRoute>} />
      <Route path="/zoom-management" element={<ProtectedRoute><AdminRoute><ZoomManagement /></AdminRoute></ProtectedRoute>} />
      <Route path="/integrity-audit" element={<ProtectedRoute><AdminRoute><IntegrityAudit /></AdminRoute></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute><AdminRoute><Courses /></AdminRoute></ProtectedRoute>} />
      <Route path="/courses/:id" element={<ProtectedRoute><AdminRoute><DashboardLayout><CourseBuilder /></DashboardLayout></AdminRoute></ProtectedRoute>} />
      <Route path="/academics/courses/:id" element={<ProtectedRoute><AdminRoute><DashboardLayout><CourseBuilder /></DashboardLayout></AdminRoute></ProtectedRoute>} />
      <Route path="/organization-settings" element={<ProtectedRoute><AdminRoute><OrganizationSettings /></AdminRoute></ProtectedRoute>} />
      <Route path="/finance-setup" element={<ProtectedRoute><AdminRoute><FinanceSetup /></AdminRoute></ProtectedRoute>} />
      <Route path="/salary" element={<ProtectedRoute><AdminOrTeacherRoute><SalaryEngine /></AdminOrTeacherRoute></ProtectedRoute>} />
      <Route path="/staff-salaries" element={<ProtectedRoute><AdminRoute><StaffSalarySetup /></AdminRoute></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><AdminRoute><Expenses /></AdminRoute></ProtectedRoute>} />
      <Route path="/cash-advances" element={<ProtectedRoute><AdminRoute><CashAdvances /></AdminRoute></ProtectedRoute>} />
      <Route path="/monthly-planning" element={<ProtectedRoute><AdminOrTeacherRoute><MonthlyPlanning /></AdminOrTeacherRoute></ProtectedRoute>} />
      <Route path="/report-card-templates" element={<ProtectedRoute><AdminOrExaminerRoute><ReportCardTemplates /></AdminOrExaminerRoute></ProtectedRoute>} />
      <Route path="/generate-report-card" element={<ProtectedRoute><AdminOrExaminerRoute><GenerateReportCard /></AdminOrExaminerRoute></ProtectedRoute>} />
      <Route path="/student-reports" element={<ProtectedRoute><StudentReports /></ProtectedRoute>} />
      <Route path="/exam-templates" element={<Navigate to="/report-card-templates" replace />} />
      <Route path="/exam-submission" element={<Navigate to="/generate-report-card" replace />} />
      <Route path="/exam-results" element={<Navigate to="/student-reports" replace />} />
      <Route path="/resources" element={<ProtectedRoute><DashboardLayout><Resources /></DashboardLayout></ProtectedRoute>} />
      <Route path="/leads" element={<ProtectedRoute><AdminRoute><LeadsPipeline /></AdminRoute></ProtectedRoute>} />
      <Route path="/identity" element={<ProtectedRoute><AdminRoute><IdentityResolution /></AdminRoute></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationCenter /></ProtectedRoute>} />
      <Route path="/hub" element={<Navigate to="/work-hub" replace />} />
      <Route path="/workhub" element={<Navigate to="/work-hub" replace />} />
      <Route path="/work-hub" element={<ProtectedRoute><WorkHub /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
      <Route path="/whatsapp" element={<ProtectedRoute><AdminRoute><WhatsAppInbox /></AdminRoute></ProtectedRoute>} />
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
      <Route path="/quiz-engine" element={<ProtectedRoute><AdminOrTeacherRoute><QuizEngine /></AdminOrTeacherRoute></ProtectedRoute>} />
      <Route path="/my-quizzes" element={<ProtectedRoute><StudentQuizView /></ProtectedRoute>} />
      <Route path="/quiz/:token" element={<PublicQuiz />} />
      <Route path="/classroom/:sessionId" element={<ProtectedRoute><VirtualClassroom /></ProtectedRoute>} />
      <Route path="/admin/schema-explorer" element={
        <ProtectedRoute>
          {(() => {
            const Guard = () => {
              const { activeRole, isLoading } = useAuth();
              if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
              if (activeRole !== 'super_admin') return <Navigate to="/dashboard" replace />;
              return <SchemaExplorer />;
            };
            return <Guard />;
          })()}
        </ProtectedRoute>
      } />
      <Route path="/connections/:userType/:userId" element={<ProtectedRoute><UserConnections /></ProtectedRoute>} />
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
