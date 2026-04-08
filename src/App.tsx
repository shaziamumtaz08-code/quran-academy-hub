import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DivisionProvider } from "@/contexts/DivisionContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Login from "./pages/Login";
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
// CourseAssetLibrary moved inside per-course Marketing tab
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
import NotFound from "./pages/NotFound";
import IdentityResolution from "./pages/IdentityResolution";
import CourseCatalog from "./pages/CourseCatalog";
import RecordedCourses from "./pages/RecordedCourses";
import NotificationCenter from "./pages/NotificationCenter";
import GroupChat from "./pages/GroupChat";
import WhatsAppInbox from "./pages/WhatsAppInbox";
import PublicApplyForm from "./pages/PublicApplyForm";
import TeachingOS from "./pages/TeachingOS";
import TeachingOSPlanner from "./pages/TeachingOSPlanner";
import TeachingOSDayBoard from "./pages/TeachingOSDayBoard";
import TeachingOSStudentView from "./pages/TeachingOSStudentView";
import TeachingOSContentKit from "./pages/TeachingOSContentKit";
import TeachingOSAssessment from "./pages/TeachingOSAssessment";
import TeachingOSVideo from "./pages/TeachingOSVideo";
import TeachingOSSpeakingTutor from "./pages/TeachingOSSpeakingTutor";

// Landing pages
import TeachingLanding from "./pages/TeachingLanding";
import PeopleLanding from "./pages/PeopleLanding";
import FinanceLanding from "./pages/FinanceLanding";
import ReportsLanding from "./pages/ReportsLanding";
import CommunicationLanding from "./pages/CommunicationLanding";
import SettingsLanding from "./pages/SettingsLanding";

const queryClient = new QueryClient();

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

// Admin only route - uses activeRole for proper role switching
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { activeRole, isLoading, profile } = useAuth();
  
  // Wait until both auth loading is done AND activeRole has been resolved
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

// Admin or Examiner route (for exam templates and submission)
function AdminOrExaminerRoute({ children }: { children: React.ReactNode }) {
  const { activeRole, isLoading, profile } = useAuth();
  
  if (isLoading || (profile && !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }
  
  const allowed = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_') || 
    activeRole === 'examiner';
  
  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Admin, Examiner, or Teacher route (for exam results - teachers can view their students' exams)
function AdminOrExaminerOrTeacherRoute({ children }: { children: React.ReactNode }) {
  const { activeRole, isLoading, profile } = useAuth();
  
  if (isLoading || (profile && !activeRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }
  
  const allowed = activeRole === 'super_admin' || activeRole === 'admin' || activeRole?.startsWith('admin_') || 
    activeRole === 'examiner' || activeRole === 'teacher';
  
  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Admin or Teacher route (for monthly planning)
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

// Teacher only route - uses activeRole
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

/** Wraps Dashboard in DashboardLayout for all roles so sidebar is accessible on desktop */
function DashboardWrapper() {
  return (
    <DashboardLayout>
      <ErrorBoundary><Dashboard /></ErrorBoundary>
    </DashboardLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated, activeRole } = useAuth();
  
  // Role-based redirect on login - uses activeRole
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
      
      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminCommandCenter /></AdminRoute></ProtectedRoute>} />
      
      {/* Teacher Routes */}
      <Route path="/teacher" element={<ProtectedRoute><TeacherRoute><TeacherNazraDashboard /></TeacherRoute></ProtectedRoute>} />
      
      {/* Landing Pages */}
      <Route path="/teaching" element={<ProtectedRoute><DashboardLayout><TeachingLanding /></DashboardLayout></ProtectedRoute>} />
      <Route path="/teaching-os" element={<ProtectedRoute><TeachingOS /></ProtectedRoute>} />
      <Route path="/teaching-os/planner" element={<ProtectedRoute><TeachingOSPlanner /></ProtectedRoute>} />
      <Route path="/teaching-os/dayboard" element={<ProtectedRoute><TeachingOSDayBoard /></ProtectedRoute>} />
      <Route path="/teaching-os/dayboard/live" element={<ProtectedRoute><TeachingOSDayBoard /></ProtectedRoute>} />
      <Route path="/teaching-os/student-view" element={<TeachingOSStudentView />} />
      <Route path="/teaching-os/content-kit" element={<ProtectedRoute><TeachingOSContentKit /></ProtectedRoute>} />
      <Route path="/teaching-os/assessment" element={<ProtectedRoute><TeachingOSAssessment /></ProtectedRoute>} />
      <Route path="/teaching-os/video" element={<ProtectedRoute><TeachingOSVideo /></ProtectedRoute>} />
      <Route path="/teaching-os/speaking-tutor" element={<ProtectedRoute><TeachingOSSpeakingTutor /></ProtectedRoute>} />
      <Route path="/people" element={<ProtectedRoute><AdminRoute><DashboardLayout><PeopleLanding /></DashboardLayout></AdminRoute></ProtectedRoute>} />
      <Route path="/finance" element={<ProtectedRoute><DashboardLayout><FinanceLanding /></DashboardLayout></ProtectedRoute>} />
      <Route path="/reports-hub" element={<ProtectedRoute><DashboardLayout><ReportsLanding /></DashboardLayout></ProtectedRoute>} />
      <Route path="/communication" element={<ProtectedRoute><DashboardLayout><CommunicationLanding /></DashboardLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AdminRoute><DashboardLayout><SettingsLanding /></DashboardLayout></AdminRoute></ProtectedRoute>} />

      {/* General Protected Routes — old direct URLs still work */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardWrapper /></ProtectedRoute>} />
      <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/assignments" element={<ProtectedRoute><Assignments /></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute><Subjects /></ProtectedRoute>} />
      <Route path="/teachers" element={<ProtectedRoute><Teachers /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
      <Route path="/lessons" element={<ProtectedRoute><Lessons /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/kpi" element={<ProtectedRoute><KPI /></ProtectedRoute>} />
      {/* Admin-only routes */}
      <Route path="/schedules" element={<ProtectedRoute><AdminRoute><Schedules /></AdminRoute></ProtectedRoute>} />
      <Route path="/zoom-management" element={<ProtectedRoute><AdminRoute><ZoomManagement /></AdminRoute></ProtectedRoute>} />
      <Route path="/integrity-audit" element={<ProtectedRoute><AdminRoute><IntegrityAudit /></AdminRoute></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute><AdminRoute><Courses /></AdminRoute></ProtectedRoute>} />
      {/* Asset Library now lives inside each course's Marketing tab */}
      <Route path="/courses/:id" element={<ProtectedRoute><AdminRoute><DashboardLayout><CourseBuilder /></DashboardLayout></AdminRoute></ProtectedRoute>} />
      <Route path="/academics/courses/:id" element={<ProtectedRoute><AdminRoute><DashboardLayout><CourseBuilder /></DashboardLayout></AdminRoute></ProtectedRoute>} />
      <Route path="/organization-settings" element={<ProtectedRoute><AdminRoute><OrganizationSettings /></AdminRoute></ProtectedRoute>} />
      <Route path="/finance-setup" element={<ProtectedRoute><AdminRoute><FinanceSetup /></AdminRoute></ProtectedRoute>} />
      <Route path="/salary" element={<ProtectedRoute><AdminOrTeacherRoute><SalaryEngine /></AdminOrTeacherRoute></ProtectedRoute>} />
      <Route path="/staff-salaries" element={<ProtectedRoute><AdminRoute><StaffSalarySetup /></AdminRoute></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><AdminRoute><Expenses /></AdminRoute></ProtectedRoute>} />
      <Route path="/cash-advances" element={<ProtectedRoute><AdminRoute><CashAdvances /></AdminRoute></ProtectedRoute>} />
      <Route path="/monthly-planning" element={<ProtectedRoute><AdminOrTeacherRoute><MonthlyPlanning /></AdminOrTeacherRoute></ProtectedRoute>} />
      {/* Report Card pages (renamed from Exam) */}
      <Route path="/report-card-templates" element={<ProtectedRoute><AdminOrExaminerRoute><ReportCardTemplates /></AdminOrExaminerRoute></ProtectedRoute>} />
      <Route path="/generate-report-card" element={<ProtectedRoute><AdminOrExaminerRoute><GenerateReportCard /></AdminOrExaminerRoute></ProtectedRoute>} />
      <Route path="/student-reports" element={<ProtectedRoute><StudentReports /></ProtectedRoute>} />
      {/* Legacy routes redirect */}
      <Route path="/exam-templates" element={<Navigate to="/report-card-templates" replace />} />
      <Route path="/exam-submission" element={<Navigate to="/generate-report-card" replace />} />
      <Route path="/exam-results" element={<Navigate to="/student-reports" replace />} />
      <Route path="/resources" element={
        <ProtectedRoute>
          {(() => {
            const ResourcesGuard = () => {
              const { activeRole, isLoading } = useAuth();
              if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
              if (activeRole !== 'super_admin') return <Navigate to="/dashboard" replace />;
              return <DashboardLayout><Resources /></DashboardLayout>;
            };
            return <ResourcesGuard />;
          })()}
        </ProtectedRoute>
      } />
      {/* Leads Pipeline - admin only */}
      <Route path="/leads" element={<ProtectedRoute><AdminRoute><LeadsPipeline /></AdminRoute></ProtectedRoute>} />
      {/* Identity Resolution - admin only */}
      <Route path="/identity" element={<ProtectedRoute><AdminRoute><IdentityResolution /></AdminRoute></ProtectedRoute>} />
      {/* Notification Center - admin only */}
      <Route path="/notifications" element={<ProtectedRoute><AdminRoute><NotificationCenter /></AdminRoute></ProtectedRoute>} />
      {/* Work Hub - accessible by all authenticated users */}
      <Route path="/hub" element={<ProtectedRoute><WorkHub /></ProtectedRoute>} />
      <Route path="/workhub" element={<Navigate to="/hub" replace />} />
      <Route path="/work-hub" element={<Navigate to="/hub" replace />} />
      {/* Group Chat - all authenticated users */}
      <Route path="/chat" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
      {/* WhatsApp Inbox - admin only */}
      <Route path="/whatsapp" element={<ProtectedRoute><AdminRoute><WhatsAppInbox /></AdminRoute></ProtectedRoute>} />
      {/* My Resources - redirect to unified Resources page */}
      <Route path="/my-resources" element={<Navigate to="/resources?tab=assigned" replace />} />
      {/* Printable Routes - standalone, no layout */}
      <Route path="/reports/print/:reportId" element={<ProtectedRoute><PrintReport /></ProtectedRoute>} />
      <Route path="/finance/print/invoice/:invoiceId" element={<ProtectedRoute><PrintInvoice /></ProtectedRoute>} />
      <Route path="/finance/print/salary/:payoutId" element={<ProtectedRoute><PrintSalary /></ProtectedRoute>} />
      {/* Public Course Page - no auth required */}
      <Route path="/course/:slug" element={<PublicCoursePage />} />
      {/* Public Enrollment Form - token-based, no auth */}
      <Route path="/enroll/:token" element={<EnrollmentForm />} />
      {/* Public Inquiry Form - no auth */}
      <Route path="/inquiry" element={<PublicInquiryForm />} />
      {/* Public Course Catalog - no auth */}
      <Route path="/courses-catalog" element={<CourseCatalog />} />
      {/* Recorded Courses Storefront - no auth */}
      <Route path="/recorded-courses" element={<RecordedCourses />} />
      {/* Public Registration Form - no auth */}
      <Route path="/apply/:slug" element={<PublicApplyForm />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
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
