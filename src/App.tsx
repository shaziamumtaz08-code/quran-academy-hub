import { lazyWithRetry } from "@/lib/lazyRetry";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ForcePasswordChange from "@/components/auth/ForcePasswordChange";
import { DivisionProvider, useDivision } from "@/contexts/DivisionContext";
import { KidContextProvider } from "@/contexts/KidContext";
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

const Login = lazyWithRetry(() => import("./pages/Login"));
const TenantLoginPage = lazyWithRetry(() => import("./pages/TenantLogin"));
const Trust = lazyWithRetry(() => import("./pages/Trust"));
const Policies = lazyWithRetry(() => import("./pages/Policies"));
const PublicPolicies = lazyWithRetry(() => import("./pages/PublicPolicies"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Schedules = lazyWithRetry(() => import("./pages/Schedules"));
const Attendance = lazyWithRetry(() => import("./pages/Attendance"));
const Lessons = lazyWithRetry(() => import("./pages/Lessons"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const Payments = lazyWithRetry(() => import("./pages/Payments"));
const KPI = lazyWithRetry(() => import("./pages/KPI"));
const ReportCardTemplates = lazyWithRetry(() => import("./pages/ReportCardTemplates"));
const GenerateReportCard = lazyWithRetry(() => import("./pages/GenerateReportCard"));
const StudentReports = lazyWithRetry(() => import("./pages/StudentReports"));
const ProgressTimeline = lazyWithRetry(() => import("./pages/ProgressTimeline"));

const UserManagement = lazyWithRetry(() => import("./pages/UserManagement"));
const Library = lazyWithRetry(() => import("./pages/Library"));
const LibraryShare = lazyWithRetry(() => import("./pages/LibraryShare"));
const MyResources = lazyWithRetry(() => import("./pages/MyResources"));
const WalkthroughShare = lazyWithRetry(() => import("./pages/WalkthroughShare"));
const OAuthConsent = lazyWithRetry(() => import("./pages/OAuthConsent"));

const Assignments = lazyWithRetry(() => import("./pages/Assignments"));
const MonthlyPlanning = lazyWithRetry(() => import("./pages/MonthlyPlanning"));
const AdminCommandCenter = lazyWithRetry(() => import("./pages/AdminCommandCenter"));
const TeacherNazraDashboard = lazyWithRetry(() => import("./pages/TeacherNazraDashboard"));
const TeacherPerformance = lazyWithRetry(() => import("./pages/TeacherPerformance"));
const TeacherProfile = lazyWithRetry(() => import("./pages/TeacherProfile"));
const StudentProfile = lazyWithRetry(() => import("./pages/StudentProfile"));
const MyProfile = lazyWithRetry(() => import("./pages/MyProfile"));
const Impersonate = lazyWithRetry(() => import("./pages/Impersonate"));
const QuranPageBrowser = lazyWithRetry(() => import("./pages/QuranPageBrowser"));
const ParentProfile = lazyWithRetry(() => import("./pages/ParentProfile"));
const TeacherOnboarding = lazyWithRetry(() => import("./pages/TeacherOnboarding"));
const StudentOnboarding = lazyWithRetry(() => import("./pages/StudentOnboarding"));
const StudentsRoute = lazyWithRetry(() => import('@/pages/StudentsRoute'));
const TeacherRegistration = lazyWithRetry(() => import('./pages/TeacherRegistration'));
const StudentRegistration = lazyWithRetry(() => import("./pages/StudentRegistration"));

const Subjects = lazyWithRetry(() => import("./pages/Subjects"));
const ZoomManagement = lazyWithRetry(() => import("./pages/ZoomManagement"));
const ZoomVault = lazyWithRetry(() => import("./pages/ZoomVault"));
const SharedPool = lazyWithRetry(() => import("./pages/SharedPool"));
const IntegrityAudit = lazyWithRetry(() => import("./pages/IntegrityAudit"));
const ActivityLog = lazyWithRetry(() => import("./pages/ActivityLog"));
const Courses = lazyWithRetry(() => import("./pages/Courses"));
const CourseBuilder = lazyWithRetry(() => import("./pages/CourseBuilder"));
const PublicCoursePage = lazyWithRetry(() => import("./pages/PublicCoursePage"));
const OrganizationSettings = lazyWithRetry(() => import("./pages/OrganizationSettings"));
const FinanceSetup = lazyWithRetry(() => import("./pages/FinanceSetup"));
const SalaryEngine = lazyWithRetry(() => import("./pages/SalaryEngine"));
const StaffSalarySetup = lazyWithRetry(() => import("./pages/StaffSalarySetup"));
const Expenses = lazyWithRetry(() => import("./pages/Expenses"));
const CashAdvances = lazyWithRetry(() => import("./pages/CashAdvances"));
const SelectDivision = lazyWithRetry(() => import("./pages/SelectDivision"));
const PrintReport = lazyWithRetry(() => import("./pages/PrintReport"));
const PrintInvoice = lazyWithRetry(() => import("./pages/PrintInvoice"));
const PrintSalary = lazyWithRetry(() => import("./pages/PrintSalary"));
const PrintSalaryBulk = lazyWithRetry(() => import("./pages/PrintSalaryBulk"));
const WorkHub = lazyWithRetry(() => import("./pages/WorkHub"));
const LeadsPipeline = lazyWithRetry(() => import("./pages/LeadsPipeline"));
const EnrollmentForm = lazyWithRetry(() => import("./pages/EnrollmentForm"));
const PublicInquiryForm = lazyWithRetry(() => import("./pages/PublicInquiryForm"));
const ParentRegistration = lazyWithRetry(() => import("./pages/ParentRegistration"));
const FamilyRegistrations = lazyWithRetry(() => import("./pages/FamilyRegistrations"));
const RegistrationReview = lazyWithRetry(() => import("./pages/RegistrationReview"));
const StudentCourseView = lazyWithRetry(() => import("./pages/StudentCourseView"));
const MyCourses = lazyWithRetry(() => import("./pages/MyCourses"));
const Recordings = lazyWithRetry(() => import("./pages/Recordings"));
const TeacherCourseView = lazyWithRetry(() => import("./pages/TeacherCourseView"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"));

const IdentityResolution = lazyWithRetry(() => import("./pages/IdentityResolution"));
const CourseCatalog = lazyWithRetry(() => import("./pages/CourseCatalog"));
const RecordedCourses = lazyWithRetry(() => import("./pages/RecordedCourses"));
const NotificationCenter = lazyWithRetry(() => import("./pages/NotificationCenter"));
const GroupChat = lazyWithRetry(() => import("./pages/GroupChat"));
const WhatsAppInbox = lazyWithRetry(() => import("./pages/WhatsAppInbox"));
const PublicApplyForm = lazyWithRetry(() => import("./pages/PublicApplyForm"));
const PublicDemoView = lazyWithRetry(() => import("./pages/PublicDemoView"));
const TeachingOS = lazyWithRetry(() => import("./pages/TeachingOS"));
const TeachingOSOutline = lazyWithRetry(() => import("./pages/TeachingOSOutline"));
const TeachingOSPlanner = lazyWithRetry(() => import("./pages/TeachingOSPlanner"));
const TeachingOSDayBoard = lazyWithRetry(() => import("./pages/TeachingOSDayBoard"));
const TeachingOSStudentView = lazyWithRetry(() => import("./pages/TeachingOSStudentView"));
const TeachingOSContentKit = lazyWithRetry(() => import("./pages/TeachingOSContentKit"));
const TeachingOSAssessment = lazyWithRetry(() => import("./pages/TeachingOSAssessment"));
const TeachingOSVideo = lazyWithRetry(() => import("./pages/TeachingOSVideo"));
const TeachingOSSpeakingTutor = lazyWithRetry(() => import("./pages/TeachingOSSpeakingTutor"));
const TeachingOSAnalytics = lazyWithRetry(() => import("./pages/TeachingOSAnalytics"));
const ParentDashboard = lazyWithRetry(() => import("./pages/ParentDashboard"));
const QuizEngine = lazyWithRetry(() => import("./pages/QuizEngine"));
const PublicQuiz = lazyWithRetry(() => import("./pages/PublicQuiz"));
const QuizInviteAccept = lazyWithRetry(() => import("./pages/QuizInviteAccept"));

const StudentQuizView = lazyWithRetry(() => import("./pages/StudentQuizView"));
const VirtualClassroom = lazyWithRetry(() => import("./pages/VirtualClassroom"));
const ClassRoom = lazyWithRetry(() => import("./pages/ClassRoom"));
const VcrRoom = lazyWithRetry(() => import("./pages/VcrRoom"));
const VcrRecordings = lazyWithRetry(() => import("./pages/VcrRecordings"));
const StudentSyllabus = lazyWithRetry(() => import("./pages/StudentSyllabus"));
const LiveClasses = lazyWithRetry(() => import("./pages/LiveClasses"));
const SchemaExplorer = lazyWithRetry(() => import("./pages/SchemaExplorer"));
const QATestMate = lazyWithRetry(() => import("./pages/QATestMate"));
const UserConnections = lazyWithRetry(() => import("./pages/UserConnections"));
const TeachingLanding = lazyWithRetry(() => import("./pages/TeachingLanding"));
const PeopleLanding = lazyWithRetry(() => import("./pages/PeopleLanding"));
const FinanceLanding = lazyWithRetry(() => import("./pages/FinanceLanding"));
const MySchedule = lazyWithRetry(() => import("./pages/MySchedule"));
const CommunicationLanding = lazyWithRetry(() => import("./pages/CommunicationLanding"));
const AnnouncementsPage = lazyWithRetry(() => import("./pages/Announcements"));
const TutorialsPage = lazyWithRetry(() => import("./pages/Tutorials"));
const SettingsLanding = lazyWithRetry(() => import("./pages/SettingsLanding"));

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
  const { isAuthenticated, isLoading, profile } = useAuth();
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

  // Accounts created with the academy default password must set their own
  // password before any other part of the app becomes reachable.
  // Exception: admin impersonation tabs — the admin is verifying the user's
  // view, not logging in as the account owner, so the gate must not block.
  const isImpersonationTab = (() => {
    try {
      return window.sessionStorage.getItem('lovable_impersonation_tab') === '1';
    } catch {
      return false;
    }
  })();
  if (profile?.force_password_reset && !isImpersonationTab) {
    return <ForcePasswordChange />;
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
  const { isAuthenticated, activeRole, isLoading, profile } = useAuth();
  const location = useLocation();
  const from = (location.state as any)?.from;

  // Honor `?next=` so external flows (e.g. the OAuth consent page bouncing
  // an unauthenticated user through /login) return the user to where they
  // came from instead of the role-based default route. Only accept
  // same-origin relative paths.
  const search = new URLSearchParams(location.search);
  const rawNext = search.get("next");
  const nextTarget =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  const getDefaultRoute = () => {
    if (!activeRole) return '/dashboard';
    if (activeRole === 'super_admin') return '/select-division';
    if (activeRole === 'admin_division') return '/dashboard';
    // /admin is super-admin only and immediately bounces other admins,
    // so send them straight to the dashboard instead of flashing a redirect.
    if (activeRole === 'admin' || activeRole?.startsWith('admin_')) return '/dashboard';
    if (activeRole === 'teacher' || activeRole === 'examiner') return '/dashboard';
    if (activeRole === 'parent') return '/parent';
    return '/dashboard';
  };

  // Wait for profile/activeRole to resolve before redirecting,
  // otherwise we bounce to a guarded route that kicks us back to /login.
  if (isAuthenticated && (isLoading || !profile || !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (isAuthenticated) {
    // Super admins must always pass through the division picker on a fresh
    // login — a stale `from` path (set when an expired session bounced them
    // to /login) otherwise drops them straight into whichever division was
    // last cached, skipping the global overview.
    const target = activeRole === 'super_admin'
      ? (nextTarget || '/select-division')
      : (nextTarget || from || getDefaultRoute());
    return <Navigate to={target} replace />;
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
      <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
      <Route path="/trust" element={<Trust />} />
      <Route path="/legal/policies" element={<PublicPolicies />} />
      <Route path="/policies" element={<ProtectedRoute><DashboardLayout><Policies /></DashboardLayout></ProtectedRoute>} />
      <Route path="/impersonate" element={<Impersonate />} />
      <Route path="/quran-page" element={<ProtectedRoute><DashboardLayout><QuranPageBrowser /></DashboardLayout></ProtectedRoute>} />

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
      <Route path="/teaching-os/outline" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded','one_to_one']}><LanguageProvider><TeachingOSOutline /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/planner" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded','one_to_one']}><LanguageProvider><TeachingOSPlanner /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/dayboard" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded','one_to_one']}><LanguageProvider><TeachingOSDayBoard /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/dayboard/live" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded','one_to_one']}><LanguageProvider><TeachingOSDayBoard /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/student-view" element={<LanguageProvider><TeachingOSStudentView /></LanguageProvider>} />
      <Route path="/teaching-os/content-kit" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded','one_to_one']}><LanguageProvider><TeachingOSContentKit /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/assessment" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded','one_to_one']}><LanguageProvider><TeachingOSAssessment /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/video" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded','one_to_one']}><LanguageProvider><TeachingOSVideo /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/speaking-tutor" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded','one_to_one']}><LanguageProvider><TeachingOSSpeakingTutor /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/teaching-os/analytics" element={<ProtectedRoute><RouteGuard moduleId="teaching_os"><DivisionModelGuard allowedModels={['group','recorded','one_to_one']}><LanguageProvider><TeachingOSAnalytics /></LanguageProvider></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/parent" element={<ProtectedRoute><RouteGuard moduleId="parent_portal"><ParentDashboard /></RouteGuard></ProtectedRoute>} />
      <Route path="/parent/child/:studentId" element={<ProtectedRoute><RouteGuard moduleId="parent_portal"><ParentDashboard /></RouteGuard></ProtectedRoute>} />
      <Route path="/people" element={<ProtectedRoute><RouteGuard moduleId="people"><DashboardLayout><PeopleLanding /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/people/registrations/:id" element={<ProtectedRoute><RouteGuard moduleId="people"><DashboardLayout><RegistrationReview /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/people/add/student" element={<ProtectedRoute><RouteGuard moduleId="people"><StudentRegistration /></RouteGuard></ProtectedRoute>} />
      <Route path="/people/add/teacher" element={<ProtectedRoute><RouteGuard moduleId="people"><TeacherRegistration /></RouteGuard></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute><RouteGuard moduleId="finance"><DashboardLayout><FinanceLanding /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/reports-hub" element={<Navigate to="/reports?view=executive" replace />} />
      <Route path="/my-dashboard" element={<Navigate to="/dashboard" replace />} />
      <Route path="/announcements" element={<ProtectedRoute><DashboardLayout><AnnouncementsPage /></DashboardLayout></ProtectedRoute>} />
      <Route path="/tutorials" element={<ProtectedRoute><DashboardLayout><TutorialsPage /></DashboardLayout></ProtectedRoute>} />
      <Route path="/tutorials/:tutorialId" element={<ProtectedRoute><DashboardLayout><TutorialsPage /></DashboardLayout></ProtectedRoute>} />
      <Route path="/help" element={<Navigate to="/tutorials" replace />} />
      <Route path="/communication" element={<ProtectedRoute><RouteGuard moduleId="communication"><DashboardLayout><CommunicationLanding /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><RouteGuard moduleId="settings"><DashboardLayout><SettingsLanding /></DashboardLayout></RouteGuard></ProtectedRoute>} />

      <Route path="/dashboard" element={<ProtectedRoute><RouteGuard moduleId="dashboard"><DashboardWrapper /></RouteGuard></ProtectedRoute>} />
      <Route path="/my-courses" element={<ProtectedRoute><RouteGuard moduleId="my_courses"><DashboardLayout><MyCourses /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/my-courses/:courseId" element={<ProtectedRoute><RouteGuard moduleId="my_courses"><DashboardLayout><StudentCourseView /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/recordings" element={<ProtectedRoute><Recordings /></ProtectedRoute>} />
      <Route path="/my-teaching/:courseId" element={<ProtectedRoute><RouteGuard moduleId="my_teaching"><DashboardLayout><TeacherCourseView /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/user-management" element={<ProtectedRoute><RouteGuard moduleId="user_management"><UserManagement /></RouteGuard></ProtectedRoute>} />
      <Route path="/assignments" element={<ProtectedRoute><RouteGuard moduleId="assignments"><Assignments /></RouteGuard></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute><RouteGuard moduleId="subjects"><Subjects /></RouteGuard></ProtectedRoute>} />
      <Route path="/teachers" element={<ProtectedRoute><RouteGuard moduleId="teachers"><UserManagement lockedRole="teacher" /></RouteGuard></ProtectedRoute>} />
      <Route path="/teacher-profile" element={<ProtectedRoute><DashboardLayout><TeacherProfile /></DashboardLayout></ProtectedRoute>} />
      <Route path="/teacher-profile/:teacherId" element={<ProtectedRoute><DashboardLayout><TeacherProfile /></DashboardLayout></ProtectedRoute>} />
      <Route path="/staff-profile/:staffId" element={<ProtectedRoute><DashboardLayout><TeacherProfile staffMode /></DashboardLayout></ProtectedRoute>} />
      <Route path="/register/student" element={<StudentRegistration />} />
      <Route path="/register/student/:token" element={<StudentRegistration />} />
      <Route path="/register/teacher" element={<TeacherRegistration />} />
      <Route path="/onboard/:token" element={<TeacherOnboarding />} />

      <Route path="/students" element={<ProtectedRoute><RouteGuard moduleId="students"><StudentsRoute /></RouteGuard></ProtectedRoute>} />
      <Route path="/student-profile" element={<ProtectedRoute><DashboardLayout><StudentProfile /></DashboardLayout></ProtectedRoute>} />
      <Route path="/student-profile/:studentId" element={<ProtectedRoute><DashboardLayout><StudentProfile /></DashboardLayout></ProtectedRoute>} />
      <Route path="/parent-profile" element={<ProtectedRoute><DashboardLayout><ParentProfile /></DashboardLayout></ProtectedRoute>} />
      <Route path="/parent-profile/:parentId" element={<ProtectedRoute><DashboardLayout><ParentProfile /></DashboardLayout></ProtectedRoute>} />
      <Route path="/my-profile" element={<ProtectedRoute><DashboardLayout><MyProfile /></DashboardLayout></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute><RouteGuard moduleId="attendance"><Attendance /></RouteGuard></ProtectedRoute>} />
      <Route path="/lessons" element={<ProtectedRoute><RouteGuard moduleId="lessons"><Lessons /></RouteGuard></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><RouteGuard moduleId="reports"><DashboardLayout><Reports /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/payments" element={<Navigate to="/finance?view=payments" replace />} />
      <Route path="/kpi" element={<ProtectedRoute><RouteGuard moduleId="kpi"><KPI /></RouteGuard></ProtectedRoute>} />
      <Route path="/schedules" element={<ProtectedRoute><RouteGuard moduleId="schedules"><Schedules /></RouteGuard></ProtectedRoute>} />
      <Route path="/my-schedule" element={<ProtectedRoute><RouteGuard moduleId="my_schedule"><DashboardLayout><MySchedule /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/zoom-management" element={<ProtectedRoute><RouteGuard moduleId="zoom_management"><ZoomManagement /></RouteGuard></ProtectedRoute>} />
      <Route path="/admin/zoom-vault" element={<ProtectedRoute><RouteGuard moduleId="zoom_vault"><DashboardLayout><ZoomVault /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/shared-pool" element={<ProtectedRoute><RouteGuard moduleId="shared_pool"><DashboardLayout><SharedPool /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/integrity-audit" element={<ProtectedRoute><RouteGuard moduleId="integrity_audit"><IntegrityAudit /></RouteGuard></ProtectedRoute>} />
      <Route path="/activity-log" element={<ProtectedRoute><RouteGuard moduleId="activity_log"><DashboardLayout><ActivityLog /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute><RouteGuard moduleId="courses_admin"><Courses /></RouteGuard></ProtectedRoute>} />
      <Route path="/courses/:id" element={<ProtectedRoute><RouteGuard moduleId="courses_admin"><DashboardLayout><CourseBuilder /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/academics/courses/:id" element={<ProtectedRoute><RouteGuard moduleId="courses_admin"><DashboardLayout><CourseBuilder /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/course-asset-library" element={<Navigate to="/library" replace />} />
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
      <Route path="/progress-timeline" element={<ProtectedRoute><RouteGuard moduleId="progress_timeline"><ProgressTimeline /></RouteGuard></ProtectedRoute>} />
      <Route path="/progress-timeline/:studentId" element={<ProtectedRoute><RouteGuard moduleId="progress_timeline"><ProgressTimeline /></RouteGuard></ProtectedRoute>} />

      <Route path="/exam-templates" element={<Navigate to="/report-card-templates" replace />} />
      <Route path="/exam-submission" element={<Navigate to="/generate-report-card" replace />} />
      <Route path="/exam-results" element={<Navigate to="/student-reports" replace />} />
      <Route path="/resources" element={<Navigate to="/library" replace />} />
      <Route path="/library" element={<ProtectedRoute><RouteGuard moduleId="resources"><DashboardLayout><Library /></DashboardLayout></RouteGuard></ProtectedRoute>} />
      <Route path="/library/share/:token" element={<LibraryShare />} />
      <Route path="/help/w/:token" element={<WalkthroughShare />} />
      <Route path="/leads" element={<ProtectedRoute><RouteGuard moduleId="leads"><DivisionModelGuard allowedModels={['one_to_one']}><LeadsPipeline /></DivisionModelGuard></RouteGuard></ProtectedRoute>} />
      <Route path="/identity" element={<ProtectedRoute><RouteGuard moduleId="identity"><IdentityResolution /></RouteGuard></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><RouteGuard moduleId="notifications"><NotificationCenter /></RouteGuard></ProtectedRoute>} />
      <Route path="/hub" element={<Navigate to="/work-hub" replace />} />
      <Route path="/workhub" element={<Navigate to="/work-hub" replace />} />
      <Route path="/work-hub" element={<ProtectedRoute><RouteGuard moduleId="work_hub"><WorkHub /></RouteGuard></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><RouteGuard moduleId="chat"><GroupChat /></RouteGuard></ProtectedRoute>} />
      <Route path="/whatsapp" element={<ProtectedRoute><RouteGuard moduleId="whatsapp"><WhatsAppInbox /></RouteGuard></ProtectedRoute>} />
      <Route path="/my-resources" element={<ProtectedRoute><DashboardLayout><MyResources /></DashboardLayout></ProtectedRoute>} />
      <Route path="/reports/print/:reportId" element={<ProtectedRoute><PrintReport /></ProtectedRoute>} />
      <Route path="/finance/print/invoice/:invoiceId" element={<ProtectedRoute><PrintInvoice /></ProtectedRoute>} />
      <Route path="/finance/print/salary/:payoutId" element={<ProtectedRoute><PrintSalary /></ProtectedRoute>} />
      <Route path="/finance/print/salary-bulk" element={<ProtectedRoute><PrintSalaryBulk /></ProtectedRoute>} />
      <Route path="/course/:slug" element={<PublicCoursePage />} />
      <Route path="/enroll" element={<EnrollmentForm />} />
      <Route path="/enroll/:token" element={<EnrollmentForm />} />
      <Route path="/inquiry" element={<PublicInquiryForm />} />
      <Route path="/register/family" element={<ParentRegistration />} />
      <Route path="/register/parent" element={<ParentRegistration />} />
      <Route path="/register/parent/:token" element={<ParentRegistration />} />
      <Route path="/admin/family-registrations" element={<ProtectedRoute><DashboardLayout><FamilyRegistrations /></DashboardLayout></ProtectedRoute>} />
      <Route path="/demo/:token" element={<PublicDemoView />} />
      <Route path="/courses-catalog" element={<CourseCatalog />} />
      <Route path="/recorded-courses" element={<RecordedCourses />} />
      <Route path="/apply/:slug" element={<PublicApplyForm />} />
      <Route path="/quiz-engine" element={<ProtectedRoute><RouteGuard moduleId="quiz_engine"><QuizEngine /></RouteGuard></ProtectedRoute>} />
      <Route path="/my-quizzes" element={<ProtectedRoute><RouteGuard moduleId="my_quizzes"><StudentQuizView /></RouteGuard></ProtectedRoute>} />
      <Route path="/quiz/:token" element={<PublicQuiz />} />
      <Route path="/quiz-invite/:token" element={<QuizInviteAccept />} />

      <Route path="/classroom/:sessionId" element={<ProtectedRoute><RouteGuard moduleId="classroom"><VirtualClassroom /></RouteGuard></ProtectedRoute>} />
      <Route path="/class-room" element={<ProtectedRoute><ClassRoom /></ProtectedRoute>} />
      <Route path="/vcr/:studentId" element={<ProtectedRoute><VcrRoom /></ProtectedRoute>} />
      <Route path="/class-recordings" element={<ProtectedRoute><DashboardLayout><VcrRecordings /></DashboardLayout></ProtectedRoute>} />
      <Route path="/syllabus/:studentId" element={<ProtectedRoute><StudentSyllabus /></ProtectedRoute>} />
      <Route path="/live-classes" element={<ProtectedRoute><LiveClasses /></ProtectedRoute>} />
      <Route path="/admin/schema-explorer" element={<ProtectedRoute><RouteGuard moduleId="schema_explorer"><SchemaExplorer /></RouteGuard></ProtectedRoute>} />
      <Route path="/qa-testmate" element={<ProtectedRoute><RouteGuard moduleId="qa_testmate"><QATestMate /></RouteGuard></ProtectedRoute>} />
      <Route path="/connections/:userType/:userId" element={<ProtectedRoute><RouteGuard moduleId="connections"><UserConnections /></RouteGuard></ProtectedRoute>} />
      <Route path="/auth/callback" element={<AuthCallback />} />
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
        <ScrollToTop />
        <AuthProvider>
          <DivisionProvider>
            <KidContextProvider>
              <Suspense fallback={<AppShellLoader />}>
                <AppRoutes />
              </Suspense>
            </KidContextProvider>
          </DivisionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
