import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CalendarCheck, DollarSign, Users, GraduationCap,
  BookOpen, Activity, AlertTriangle, Wrench, ChevronLeft, Menu, ShieldCheck,
} from "lucide-react";
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

type GroupKey = 'OVERVIEW' | 'ANALYTICS' | 'TOOLS';
type Section = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: GroupKey;
};

const sections: Section[] = [
  { id: "executive", label: "Executive Dashboard", icon: LayoutDashboard, group: 'OVERVIEW' },
  { id: "attendance", label: "Attendance Reports", icon: CalendarCheck, group: 'ANALYTICS' },
  { id: "fees", label: "Fee & Financial", icon: DollarSign, group: 'ANALYTICS' },
  { id: "engagement", label: "Student Engagement", icon: Users, group: 'ANALYTICS' },
  { id: "teacher", label: "Teacher Performance", icon: GraduationCap, group: 'ANALYTICS' },
  { id: "accountability", label: "Accountability", icon: ShieldCheck, group: 'ANALYTICS' },
  { id: "courses", label: "Course / Batch", icon: BookOpen, group: 'ANALYTICS' },
  { id: "logs", label: "Activity Logs", icon: Activity, group: 'TOOLS' },
  { id: "alerts", label: "Alerts & Automation", icon: AlertTriangle, group: 'TOOLS' },
  { id: "custom", label: "Custom Report Builder", icon: Wrench, group: 'TOOLS' },
];

const GROUP_ORDER: GroupKey[] = ['OVERVIEW', 'ANALYTICS', 'TOOLS'];

export default function Reports() {
  const { activeRole } = useAuth();
  const [searchParams] = useSearchParams();
  const initial = searchParams.get('section') || 'executive';
  const [activeSection, setActiveSection] = useState(initial);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Sync when query param changes (e.g., navigating from Reports Hub cards)
  useEffect(() => {
    const next = searchParams.get('section');
    if (next && next !== activeSection) {
      setActiveSection(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const isAdmin = activeRole === "super_admin" || activeRole === "admin" || activeRole?.startsWith("admin_");

  const renderSection = () => {
    switch (activeSection) {
      case "executive": return <ExecutiveDashboard />;
      case "attendance": return <AttendanceReports />;
      case "fees": return <FeeReports />;
      case "engagement": return <StudentEngagement />;
      case "teacher": return <TeacherPerformance />;
      case "accountability": return <AccountabilityReport />;
      case "courses": return <CourseReports />;
      case "logs": return <ActivityLogs />;
      case "alerts": return <AlertsAutomation />;
      case "custom": return <CustomReportBuilder />;
      default: return <ExecutiveDashboard />;
    }
  };

  const currentSection = sections.find(s => s.id === activeSection);

  const isVisible = (section: Section) => {
    if (!isAdmin && ["logs", "alerts", "custom", "teacher", "accountability"].includes(section.id)) return false;
    return true;
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] -m-4 sm:-m-6">
        {/* Sidebar */}
        <div className={cn(
          "border-r bg-card transition-all duration-200 flex flex-col shrink-0",
          sidebarOpen ? "w-56" : "w-12"
        )}>
          <div className="p-2 border-b flex items-center justify-between">
            {sidebarOpen && <span className="text-sm font-semibold px-2">Reports</span>}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <nav className="p-1 space-y-0.5">
              {GROUP_ORDER.map(groupKey => {
                const groupItems = sections.filter(s => s.group === groupKey && isVisible(s));
                if (groupItems.length === 0) return null;
                return (
                  <div key={groupKey} className="pt-2 first:pt-0">
                    {sidebarOpen && (
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 pt-1 pb-1">
                        {groupKey}
                      </p>
                    )}
                    {groupItems.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors",
                          activeSection === section.id
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title={section.label}
                      >
                        <section.icon className="h-4 w-4 shrink-0" />
                        {sidebarOpen && <span className="truncate">{section.label}</span>}
                      </button>
                    ))}
                  </div>
                );
              })}
            </nav>
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">{currentSection?.label || "Reports"}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {activeSection === "executive" && "High-level overview of academy performance"}
                {activeSection === "attendance" && "Daily attendance summaries, absence detection & streak tracking"}
                {activeSection === "fees" && "Revenue tracking, pending dues, and payment analysis"}
                {activeSection === "engagement" && "Student progress tracking — Hifz, Tajweed, consistency"}
                {activeSection === "teacher" && "Classes taken, punctuality, student retention analysis"}
                {activeSection === "accountability" && "Zoom session accountability — late starts, no-shows, student punctuality & duration"}
                {activeSection === "courses" && "Enrollment counts, completion rates, drop-off analysis"}
                {activeSection === "logs" && "Complete audit trail of all system actions"}
                {activeSection === "alerts" && "Auto-generated alerts for low attendance, overdue fees, teacher absences"}
                {activeSection === "custom" && "Build custom queries with combinable conditions and export"}
              </p>
            </div>
            <ErrorBoundary>
              {renderSection()}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
