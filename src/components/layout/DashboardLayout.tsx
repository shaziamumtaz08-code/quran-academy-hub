import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Cog,
  DollarSign,
  FileText,
  FolderOpen,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { DivisionSwitcher } from "@/components/layout/DivisionSwitcher";
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
import logoDark from "@/assets/logo-dark.jpg";

const DashboardLayoutContext = createContext(false);
export const useIsInsideDashboard = () => useContext(DashboardLayoutContext);

interface DashboardLayoutProps {
  children: ReactNode;
}

interface DrawerChildItem {
  label: string;
  href: string;
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

function buildDrawerSections(role: AppRole | null): DrawerSection[] {
  if (isAdminRole(role)) {
    return [
      {
        label: "MENU",
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          {
            label: "Teaching",
            icon: BookOpen,
            children: [
              { label: "Live Classes", href: "/teaching?view=live-classes" },
              { label: "Assignments", href: "/teaching?view=assignments" },
              { label: "Schedules", href: "/teaching?view=schedules" },
              { label: "Attendance", href: "/teaching?view=attendance" },
              { label: "Planning", href: "/teaching?view=planning" },
              { label: "Subjects", href: "/teaching?view=subjects" },
              { label: "1-to-1 Assignments", href: "/teaching?view=one-to-one" },
            ],
          },
          {
            label: "People",
            icon: Users,
            children: [
              { label: "Students", href: "/people?view=students" },
              { label: "Teachers", href: "/people?view=teachers" },
              { label: "Staff", href: "/people?view=staff" },
              { label: "Parents", href: "/people?view=parents" },
              { label: "Leads", href: "/people?view=leads" },
            ],
          },
          {
            label: "Finance",
            icon: DollarSign,
            children: [
              { label: "Invoices", href: "/finance?view=invoices" },
              { label: "Payments", href: "/finance?view=payments" },
              { label: "Fee Plans", href: "/finance?view=fee-plans" },
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
              { label: "Attendance Reports", href: "/reports?view=attendance" },
              { label: "Fee & Financial", href: "/reports?view=fees" },
              { label: "Student Engagement", href: "/reports?view=engagement" },
              { label: "Teacher Performance", href: "/reports?view=teachers" },
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
          {
            label: "Communication",
            icon: MessageSquare,
            children: [
              { label: "Academy Chat", href: "/communication?view=academy-chat" },
              { label: "WhatsApp Inbox", href: "/communication?view=whatsapp" },
              { label: "Notifications", href: "/communication?view=notifications" },
              { label: "Zoom", href: "/communication?view=zoom" },
            ],
          },
          { label: "Work Hub", href: "/work-hub", icon: Briefcase },
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
              { label: "Teaching Config", href: "/settings?view=teaching-config" },
              { label: "Resources Manager", href: "/settings?view=resources" },
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
          {
            label: "My Classes",
            icon: BookOpen,
            children: [
              { label: "Live Classes", href: "/teaching?view=live-classes" },
              { label: "Attendance", href: "/teaching?view=attendance" },
              { label: "Planning", href: "/teaching?view=planning" },
            ],
          },
          { label: "Students", href: "/students", icon: Users },
          { label: "Student Reports", href: "/student-reports", icon: FileText },
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
              { label: "Academy Chat", href: "/communication?view=academy-chat" },
              { label: "WhatsApp", href: "/communication?view=whatsapp" },
              { label: "Notifications", href: "/communication?view=notifications" },
            ],
          },
        ],
      },
    ];
  }

  if (role === "student") {
    return [
      {
        label: "MENU",
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { label: "My Courses", href: "/my-courses", icon: GraduationCap },
          { label: "Resources", href: "/resources", icon: FolderOpen },
          { label: "Communication", href: "/communication", icon: MessageSquare },
        ],
      },
    ];
  }

  if (role === "parent") {
    return [
      {
        label: "MENU",
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { label: "My Children's Reports", href: "/student-reports", icon: FileText },
          { label: "Fees", href: "/finance?view=payments", icon: Landmark },
          { label: "Communication", href: "/communication", icon: MessageSquare },
        ],
      },
    ];
  }

  if (role === "examiner") {
    return [
      {
        label: "MENU",
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { label: "Exam Center", href: "/report-card-templates", icon: Award },
          { label: "Student Reports", href: "/student-reports", icon: FileText },
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
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const sections = useMemo(() => filterSectionsForRole(buildDrawerSections(activeRole), activeRole), [activeRole]);
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

  const handleParentClick = (item: DrawerItem) => {
    const key = getParentKey(item);
    const hasChildren = !!item.children?.length;

    if (!hasChildren && item.href) {
      navigate(item.href);
      closeMobileDrawer();
      return;
    }

    if (collapsed && isDesktop) {
      handleDesktopCollapsedChange(false);
      handleExpandedChange(key);
      return;
    }

    handleExpandedChange(expandedKey === key ? null : key);
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
        onClick={() => handleParentClick(item)}
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
            parentIsExactActive ? "text-[#3B82F6]" : parentHasActiveChild ? "text-white/80" : "text-white/60",
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
                  onClick={() => {
                    navigate(child.href);
                    closeMobileDrawer();
                  }}
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
            <DropdownMenuItem onClick={() => { navigate("/dashboard"); closeMobileDrawer(); }}>Profile</DropdownMenuItem>
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
              <div className="max-w-[190px] min-w-0">
                <DivisionSwitcher />
              </div>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Open profile menu"
                  >
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{profileName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>Profile</DropdownMenuItem>
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

          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">{children}</main>
        </div>
      </div>
    </DashboardLayoutContext.Provider>
  );
}