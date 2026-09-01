import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Award,
  BarChart3,
  CalendarDays,

  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Cog,
  DollarSign,
  FileText,
  FolderOpen,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Menu,
  MessageCircle,
  MessageSquare,
  ScrollText,
  UserCog,
  Users,
  Target,
  Video,
  Wallet,

  MonitorPlay,
  ListChecks,
  Building2,
} from "lucide-react";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useDivision } from "@/contexts/DivisionContext";
import { logRouteHit } from "@/lib/telemetry";
import { DivisionSwitcher } from "@/components/layout/DivisionSwitcher";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { preloadRouteModule, preloadRouteModules } from "@/lib/routePreload";
import logoDark from "@/assets/logo-dark.jpg";
import { ActingAsBanner } from "@/components/shared/ActingAsBanner";
import { IncomingCallAlert } from "@/components/vcr/IncomingCallAlert";

import { PushNotificationInitializer } from "@/components/pwa/PushNotificationInitializer";
import { PushPermissionBanner } from "@/components/pwa/PushPermissionBanner";

// Stored on globalThis so that duplicate module instances (HMR / split chunks)
// still share the same context and never render a second nested shell.
const globalKey = "__aqta_dashboard_layout_ctx__";
const DashboardLayoutContext: ReturnType<typeof createContext<boolean>> =
  (globalThis as any)[globalKey] ?? ((globalThis as any)[globalKey] = createContext(false));
export const useIsInsideDashboard = () => useContext(DashboardLayoutContext);

interface DashboardLayoutProps {
  children: ReactNode;
}

interface DrawerChildItem {
  label: string;
  href: string;
  icon?: React.ElementType;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

interface DrawerItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: DrawerChildItem[];
}

interface DrawerSection {
  label: string;
  items: DrawerItem[];
}

const adminRoles = ["super_admin", "admin", "admin_admissions", "admin_fees", "admin_academic"];

const expandedKeyForUser = (userId: string | undefined) => `aqt:drawer-expanded:${userId ?? "guest"}`;
const collapsedKeyForUser = (userId: string | undefined) => `aqt:drawer-collapsed:${userId ?? "guest"}`;

function isAdminRole(role: AppRole | null) {
  return !!role && (adminRoles.includes(role) || role.startsWith("admin_"));
}

function buildDrawerSections(role: AppRole | null, modelType?: "one_to_one" | "group" | "recorded" | null, selfId?: string | null): DrawerSection[] {
  const isGroupStyleModel = modelType === "group" || modelType === "recorded";
  const isOneToOne = !isGroupStyleModel;

  if (isAdminRole(role)) {
    return [
      {
        label: "MENU",
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { label: "Leads", href: "/leads", icon: Megaphone },
          {
            label: "Teaching",
            icon: BookOpen,
            children: [
              ...(isGroupStyleModel ? [{ label: "All Courses", href: "/courses" }] : []),
              ...(isOneToOne ? [
                { label: "Assignments", href: "/teaching?view=assignments" },
                { label: "Schedules", href: "/teaching?view=schedules" },
                { label: "Attendance", href: "/teaching?view=attendance" },
                { label: "Planning", href: "/teaching?view=planning" },
                { label: "Subjects", href: "/teaching?view=subjects" },
              ] : []),
              
              { label: "AI Teaching OS", href: "/teaching-os" },
              { label: "Quiz Engine", href: "/quiz-engine" },
            ],
          },
          {
            label: "Exam & Report Cards",
            icon: Award,
            children: [
              { label: "Report Card Templates", href: "/report-card-templates" },
              { label: "Generate Report Card", href: "/generate-report-card" },
              { label: "Student Reports", href: "/student-reports" },
              { label: "Progress Timeline", href: "/progress-timeline" },
            ],
          },
          { label: "Class Room (VCR)", href: "/class-room", icon: MonitorPlay },
          {
            label: "People",
            icon: Users,
            children: [
              { label: "User Management", href: "/user-management", icon: UserCog },
              { label: "Students", href: "/people?view=students" },
              { label: "Teachers", href: "/people?view=teachers" },
              { label: "Staff", href: "/people?view=staff" },
              { label: "Parents", href: "/people?view=parents" },
              { label: "Registrations", href: "/people?view=registrations" },
            ],
          },
          {
            label: "Finance",
            icon: DollarSign,
            children: [
              { label: "Invoices", href: "/finance?view=invoices" },
              { label: "Payments", href: "/finance?view=payments" },
              { label: "Fee Plans", href: "/finance?view=fee-plans" },
              { label: "Staff Salary Setup", href: "/finance?view=staff-salary-setup" },
              { label: "Salaries", href: "/finance?view=salaries" },
              { label: "Expenses", href: "/finance?view=expenses" },
              { label: "Cash Advances", href: "/finance?view=cash-advances" },
              { label: "Payouts", href: "/finance?view=payouts" },
              { label: "Setup", href: "/finance?view=setup" },
            ],
          },
        ],
      },
      {
        label: "INSIGHTS",
        items: [
          {
            label: "Reports",
            icon: BarChart3,
            children: [
              { label: "Executive Dashboard", href: "/reports?view=executive" },
              { label: "Student Reports", href: "/student-reports" },
              { label: "Progress Timeline", href: "/progress-timeline" },
              { label: "Attendance Reports", href: "/reports?view=attendance" },
              { label: "Fee & Financial", href: "/reports?view=fees" },
              { label: "Salary & Fee Statements", href: "/reports?view=statements" },
              { label: "Salary Revisions", href: "/reports?view=salary-revisions" },
              { label: "Student Engagement", href: "/reports?view=engagement" },
              { label: "Qaida Progress", href: "/reports?view=qaida" },
              { label: "Teacher Performance", href: "/reports?view=teachers" },
              { label: "Compliance", href: "/reports?view=compliance" },
              { label: "Accountability", href: "/reports?view=accountability" },
              { label: "Course / Batch", href: "/reports?view=course-batch" },
              { label: "Activity Logs", href: "/reports?view=activity-logs" },
              { label: "Alerts & Automation", href: "/reports?view=alerts" },
              { label: "Custom Report Builder", href: "/reports?view=custom" },
            ],
          },
        ],
      },
      {
        label: "OTHERS",
        items: [
          { label: "Zoom", href: "/zoom-management", icon: Video },
          {
            label: "Communication",
            icon: MessageSquare,
            children: [
              { label: "Announcements", href: "/communication?view=announcements" },
              { label: "Academy Chat", href: "/communication?view=academy-chat" },
              { label: "WhatsApp Inbox", href: "/communication?view=whatsapp" },
              { label: "Notifications", href: "/communication?view=notifications" },
            ],
          },
          { label: "Library", href: "/library", icon: FolderOpen },
          { label: "Policies & SOPs", href: "/policies", icon: ScrollText },
          { label: "Help Centre", href: "/tutorials", icon: LifeBuoy },

          { label: "Tasks & Tickets", href: "/work-hub", icon: Briefcase },
          {
            label: "Settings",
            icon: Cog,
            children: [
              { label: "Organization", href: "/settings?view=organization" },
              { label: "Branches", href: "/settings?view=branches" },
              { label: "Divisions", href: "/settings?view=divisions" },
              { label: "Holidays", href: "/settings?view=holidays" },
              { label: "Payouts Config", href: "/settings?view=payouts-config" },
              { label: "Classroom", href: "/settings?view=classroom" },
              { label: "Finance Setup", href: "/settings?view=finance-setup" },
              { label: "Integrity Audit", href: "/settings?view=integrity" },
              { label: "Schema Explorer", href: "/settings?view=schema", superAdminOnly: true },
            ],
          },
        ],
      },
    ];
  }

  if (role === "teacher") {
    return [
      {
        label: "MENU",
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { label: "My Schedule", href: "/my-schedule", icon: CalendarDays },
          { label: "Attendance", href: "/teaching?view=attendance", icon: ClipboardCheck },
          { label: "Monthly Planning", href: "/monthly-planning", icon: Target },
          { label: "Students", href: "/students", icon: Users },
          { label: "Student Reports", href: "/student-reports", icon: FileText },
          { label: "Progress Timeline", href: "/progress-timeline", icon: BarChart3 },
          { label: "Performance", href: "/performance", icon: BarChart3 },
          {
            label: "Teaching Tools",
            icon: BookOpen,
            children: [
              { label: "Class Room (VCR)", href: "/class-room" },
              { label: "AI Teaching OS", href: "/teaching-os" },
              { label: "Quiz Engine", href: "/quiz-engine" },
            ],
          },
        ],

      },
      {
        label: "OTHERS",
        items: [
          { label: "Salary", href: "/salary", icon: Wallet },
          {
            label: "Communication",
            icon: MessageSquare,
            children: [
              { label: "Announcements", href: "/communication?view=announcements" },
              { label: "Academy Chat", href: "/communication?view=academy-chat" },
              { label: "WhatsApp", href: "/communication?view=whatsapp" },
              { label: "Notifications", href: "/communication?view=notifications" },
            ],
          },
          { label: "Library", href: "/library", icon: FolderOpen },
          { label: "Policies & SOPs", href: "/policies", icon: ScrollText },
          { label: "Help Centre", href: "/tutorials", icon: LifeBuoy },
          { label: "Tasks & Tickets", href: "/work-hub", icon: Briefcase },
        ],
      },
    ];
  }

  if (role === "student") {
    const items: DrawerItem[] = [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ];
    if (selfId) {
      items.push(
        { label: "Class Room (VCR)", href: `/vcr/${selfId}`, icon: MonitorPlay },
        { label: "My Schedule", href: "/my-schedule", icon: CalendarDays },
        { label: "My Syllabus", href: `/syllabus/${selfId}`, icon: ListChecks },
      );

    }
    items.push(
      { label: "Attendance", href: "/attendance", icon: BarChart3 },
      { label: "Reports", href: "/student-reports", icon: FileText },
      { label: "Fees", href: "/finance?view=payments", icon: Landmark },
      { label: "Library", href: "/library", icon: FolderOpen },
      { label: "Policies & SOPs", href: "/policies", icon: ScrollText },
      {
        label: "Communication",
        icon: MessageSquare,
        children: [
          { label: "Announcements", href: "/announcements" },
          { label: "Messages & Requests", href: "/hub" },
          { label: "Help Centre", href: "/tutorials" },
        ],
      },
    );
    return [{ label: "MENU", items }];

  }

  if (role === "parent") {
    // Parent menu mirrors the student menu exactly so the experience is
    // identical when a parent is acting on behalf of a child.
    const items: DrawerItem[] = [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ];
    items.push(
      { label: "Attendance", href: "/attendance", icon: BarChart3 },
      { label: "Reports", href: "/student-reports", icon: FileText },
      { label: "Fees", href: "/finance?view=payments", icon: Landmark },
      { label: "Library", href: "/library", icon: FolderOpen },
      { label: "Policies & SOPs", href: "/policies", icon: ScrollText },
      {
        label: "Communication",
        icon: MessageSquare,
        children: [
          { label: "Announcements", href: "/announcements" },
          { label: "Messages & Requests", href: "/hub" },
          { label: "Help Centre", href: "/tutorials" },
        ],
      },
    );
    return [{ label: "MENU", items }];

  }

  if (role === "examiner") {
    return [
      {
        label: "MENU",
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { label: "Exam Center", href: "/report-card-templates", icon: Award },
          { label: "Student Reports", href: "/student-reports", icon: FileText },
          { label: "Library", href: "/library", icon: FolderOpen },
          { label: "Policies & SOPs", href: "/policies", icon: ScrollText },
          { label: "Announcements", href: "/announcements", icon: MessageSquare },
          { label: "Help Centre", href: "/tutorials", icon: LifeBuoy },
          { label: "Tasks & Tickets", href: "/work-hub", icon: Briefcase },
        ],
      },
    ];
  }

  return [{ label: "MENU", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] }];
}

function matchesHref(pathname: string, search: string, href: string) {
  return `${pathname}${search}` === href;
}

function getParentKey(item: DrawerItem) {
  return item.href ?? item.label;
}

function filterSectionsForRole(sections: DrawerSection[], role: AppRole | null) {
  return sections.map((section) => ({
    ...section,
    items: section.items
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) => {
          if (child.superAdminOnly) return role === "super_admin";
          if (child.adminOnly) return isAdminRole(role);
          return true;
        }),
      }))
      .filter((item) => !item.children || item.children.length > 0 || item.href),
  }));
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, isLoading, logout, activeRole, setActiveRole } = useAuth();
  const { activeDivision } = useDivision();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Telemetry: log route hits (deduped, fire-and-forget)
  useEffect(() => {
    if (!activeRole) return;
    void logRouteHit(activeRole, location.pathname, activeDivision?.id);
  }, [activeRole, location.pathname, activeDivision?.id]);

  const sections = useMemo(
    () => filterSectionsForRole(buildDrawerSections(activeRole, activeDivision?.model_type ?? null, profile?.id ?? null), activeRole),
    [activeRole, activeDivision?.model_type, profile?.id]
  );
  const expandedStorageKey = expandedKeyForUser(profile?.id);
  const collapsedStorageKey = collapsedKeyForUser(profile?.id);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(expandedStorageKey);
    if (stored) {
      setExpandedKey(stored);
      return;
    }
    const activeParent = sections
      .flatMap((section) => section.items)
      .find((item) => item.children?.some((child) => matchesHref(location.pathname, location.search, child.href)));
    setExpandedKey(activeParent ? getParentKey(activeParent) : null);
  }, [expandedStorageKey, location.pathname, location.search, sections]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(collapsedStorageKey);
    setDesktopCollapsed(stored === "true");
  }, [collapsedStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleMeetingLayout = (event: Event) => {
      const detail = (event as CustomEvent<{ collapsed?: boolean }>).detail;
      if (typeof detail?.collapsed === "boolean") setDesktopCollapsed(detail.collapsed);
    };
    window.addEventListener("aqt:meeting-layout", handleMeetingLayout);
    return () => window.removeEventListener("aqt:meeting-layout", handleMeetingLayout);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isDesktop && mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    document.body.style.overflow = "";
    return undefined;
  }, [isDesktop, mobileOpen]);

  const handleExpandedChange = (key: string | null) => {
    setExpandedKey(key);
    if (typeof window !== "undefined") {
      if (key) window.localStorage.setItem(expandedStorageKey, key);
      else window.localStorage.removeItem(expandedStorageKey);
    }
  };

  const handleDesktopCollapsedChange = (next: boolean) => {
    setDesktopCollapsed(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(collapsedStorageKey, String(next));
    }
  };

  const closeMobileDrawer = () => {
    if (!isDesktop) setMobileOpen(false);
  };

  const handleLogout = async () => {
    closeMobileDrawer();
    await logout();
    navigate("/login");
  };

  if (isLoading) return <div className="min-h-screen bg-background" />;

  const initials =
    profile?.full_name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AQ";

  const profileName = profile?.full_name || "Al-Quran Time User";
  const profileEmail = profile?.email || "";
  const orgName = "Al-Quran Time Academy";
  const orgEmail = profileEmail || "info@alqurantimeacademy.com";
  const collapsed = isDesktop && desktopCollapsed;
  const drawerWidthClass = collapsed ? "lg:w-16" : "lg:w-[260px]";

  const navigateWithPreload = async (href: string) => {
    await preloadRouteModule(href);
    navigate(href);
    closeMobileDrawer();
  };

  const handleParentClick = async (item: DrawerItem) => {
    const key = getParentKey(item);
    const hasChildren = !!item.children?.length;
    const isExpanded = expandedKey === key;

    if (!hasChildren && item.href) {
      await navigateWithPreload(item.href);
      return;
    }

    if (collapsed && isDesktop) {
      handleDesktopCollapsedChange(false);
      handleExpandedChange(key);
      void preloadRouteModules(item.children?.map((child) => child.href) ?? [item.href]);
      return;
    }

    handleExpandedChange(isExpanded ? null : key);
    if (!isExpanded) {
      void preloadRouteModules(item.children?.map((child) => child.href) ?? [item.href]);
    }
  };

  const renderNavItem = (item: DrawerItem) => {
    const key = getParentKey(item);
    const hasChildren = !!item.children?.length;
    const activeChild = item.children?.find((child) => matchesHref(location.pathname, location.search, child.href));
    const parentActive = !!activeChild || (!!item.href && matchesHref(location.pathname, location.search, item.href));
    const expanded = expandedKey === key;

    // Parent shows blue bar only if a child is active (subtle); full treatment if the parent itself is the active route
    const parentIsExactActive = !!item.href && matchesHref(location.pathname, location.search, item.href);
    const parentHasActiveChild = !!activeChild;

    const parentButton = (
      <button
        type="button"
          onClick={() => void handleParentClick(item)}
          onMouseEnter={() => void preloadRouteModules(item.children?.map((child) => child.href) ?? [item.href])}
        className={cn(
          "relative flex h-10 w-full items-center gap-3 rounded-none border-l-[3px] border-transparent px-3 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40",
          parentIsExactActive
            ? "border-[#3B82F6] bg-[rgba(59,130,246,0.15)] font-medium text-white"
            : parentHasActiveChild
              ? "border-[#3B82F6] font-medium text-white/90"
              : "font-medium text-white/65 hover:bg-white/5 hover:text-white/90",
          collapsed && "justify-center px-0",
        )}
      >
        <item.icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            parentIsExactActive || parentHasActiveChild ? "text-[#3B82F6]" : "text-white/60",
          )}
        />
        {!collapsed ? <span className="flex-1 text-left">{item.label}</span> : null}
        {!collapsed && hasChildren ? (
          <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", expanded && "rotate-90")} />
        ) : null}
      </button>
    );

    return (
      <div key={key} className="space-y-1">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{parentButton}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          parentButton
        )}

        {!collapsed && hasChildren && expanded ? (
          <div className="space-y-1 pl-10">
            {item.children?.map((child) => {
              const childActive = matchesHref(location.pathname, location.search, child.href);
              return (
                <button
                  key={child.href}
                  type="button"
                  onClick={() => void navigateWithPreload(child.href)}
                  onMouseEnter={() => void preloadRouteModule(child.href)}
                  className={cn(
                    "relative flex h-10 w-full items-center rounded-none border-l-[3px] px-3 text-left text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40",
                    childActive
                      ? "border-[#3B82F6] bg-[rgba(59,130,246,0.15)] font-medium text-white"
                      : "border-transparent font-normal text-white/60 hover:bg-white/5 hover:text-white/90",
                  )}
                >
                  {child.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const drawerInner = (
    <div className="flex h-full flex-col bg-slate-900 text-white">
      <div className="border-b border-slate-800 bg-slate-900 px-4 pb-4 pt-6">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center") }>
          <img src={logoDark} alt={orgName} className="h-10 w-10 rounded-lg object-cover" />
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{orgName}</p>
              <p className="truncate text-xs text-slate-400">{orgEmail}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-thumb-slate-700">
        {sections.map((section) => (
          <div key={section.label} className="mt-4 first:mt-0">
            {!collapsed ? <p className="px-4 py-2 text-xs uppercase tracking-wider text-slate-500">{section.label}</p> : null}
            <div className="space-y-1">{section.items.map(renderNavItem)}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800 bg-slate-900 px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                collapsed && "justify-center px-0",
              )}
            >
              <Avatar className="h-9 w-9 border border-slate-700">
                <AvatarFallback className="bg-slate-800 text-xs font-semibold text-white">{initials}</AvatarFallback>
              </Avatar>
              {!collapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{profileName}</p>
                    <p className="truncate text-xs text-slate-400">{profileEmail}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side={collapsed ? "right" : "top"} className="w-56">
            <DropdownMenuLabel>{profileName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { navigate("/my-profile"); closeMobileDrawer(); }}>My profile</DropdownMenuItem>
            {profile?.roles && profile.roles.length > 1
              ? profile.roles.map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => {
                      if (role !== activeRole) {
                        setActiveRole(role);
                        navigate(role === "parent" ? "/parent" : "/dashboard", { replace: true });
                      }
                      closeMobileDrawer();
                    }}
                  >
                    Switch to {role.replace(/_/g, " ")}
                  </DropdownMenuItem>
                ))
              : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <DashboardLayoutContext.Provider value={true}>
      <div className="flex h-screen bg-background text-foreground">
        <aside
          className={cn(
            "hidden border-r border-slate-800 bg-slate-900 transition-[width] duration-200 lg:flex lg:h-screen lg:flex-col lg:flex-shrink-0",
            drawerWidthClass,
          )}
        >
          {drawerInner}
        </aside>

        <Sheet open={!isDesktop && mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-[260px] max-w-[80vw] border-slate-800 bg-slate-900 p-0 text-white [&>button]:right-4 [&>button]:top-4 [&>button]:text-slate-300"
          >
            {drawerInner}
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <header className="sticky top-0 z-40 flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
            <Button
              variant="ghost"
              size="icon"
              aria-label={isDesktop ? "Collapse navigation drawer" : "Open navigation drawer"}
              className="shrink-0"
              onClick={() => {
                if (isDesktop) handleDesktopCollapsedChange(!desktopCollapsed);
                else setMobileOpen(true);
              }}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/dashboard" className="hidden shrink-0 lg:block">
              <img src={logoDark} alt="Al-Quran Time" className="h-8 w-8 rounded-md object-cover" />
            </Link>
            <div className="ml-auto flex min-w-0 items-center gap-2 md:gap-3">
              {activeRole === "super_admin" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 px-2.5 text-xs"
                  onClick={() => navigate("/select-division")}
                  aria-label="Back to Command Center"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Command Center</span>
                </Button>
              )}
              <div className="max-w-[150px] min-w-0 md:max-w-[190px]">
                <DivisionSwitcher />
              </div>
              <div className="hidden sm:block">
                <RoleSwitcher />
              </div>
              <NotificationBell />
              {activeRole && activeRole !== "admin" && activeRole !== "super_admin" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  onClick={() => navigate("/communication?view=dms&recipient=admin")}
                  aria-label="Chat with admin"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Chat admin</span>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label={`Open profile menu for ${profileName}`}
                    title={profileName}
                  >
                    <span className="hidden md:inline max-w-[120px] truncate text-sm font-medium text-foreground">
                      {profileName.split(" ")[0]}
                    </span>
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{profileName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/my-profile")}>My profile</DropdownMenuItem>
                  {profile?.roles && profile.roles.length > 1
                    ? profile.roles.map((role) => (
                        <DropdownMenuItem
                          key={role}
                          onClick={() => {
                            if (role !== activeRole) {
                              setActiveRole(role);
                              navigate(role === "parent" ? "/parent" : "/dashboard", { replace: true });
                            }
                          }}
                        >
                          Switch to {role.replace(/_/g, " ")}
                        </DropdownMenuItem>
                      ))
                    : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-background">
            <PushNotificationInitializer />
            <PushPermissionBanner />
            <ActingAsBanner />
            <IncomingCallAlert />


            {children}
          </main>
        </div>
      </div>
    </DashboardLayoutContext.Provider>
  );
}