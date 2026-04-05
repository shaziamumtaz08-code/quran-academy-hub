import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CalendarCheck, DollarSign, Users, GraduationCap,
  BookOpen, Activity, AlertTriangle, Wrench, ChevronLeft, ChevronRight, Menu, ShieldCheck,
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

const sections = [
  { id: "executive", label: "Executive Dashboard", icon: LayoutDashboard },
  { id: "attendance", label: "Attendance Reports", icon: CalendarCheck },
  { id: "fees", label: "Fee & Financial", icon: DollarSign },
  { id: "engagement", label: "Student Engagement", icon: Users },
  { id: "teacher", label: "Teacher Performance", icon: GraduationCap },
  { id: "accountability", label: "Accountability", icon: ShieldCheck },
  { id: "courses", label: "Course / Batch", icon: BookOpen },
  { id: "logs", label: "Activity Logs", icon: Activity },
  { id: "alerts", label: "Alerts & Automation", icon: AlertTriangle },
  { id: "custom", label: "Custom Report Builder", icon: Wrench },
];

export default function Reports() {
  const { activeRole } = useAuth();
  const [activeSection, setActiveSection] = useState("executive");
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
              {sections.map((section) => {
                // Non-admin only sees limited sections
                if (!isAdmin && ["logs", "alerts", "custom", "teacher", "accountability"].includes(section.id)) return null;
                return (
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
