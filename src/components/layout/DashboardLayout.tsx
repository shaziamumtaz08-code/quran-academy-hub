import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, ChevronRight, ChevronDown, LayoutDashboard, BookOpen, Users, DollarSign, BarChart3, MessageSquare, Cog, Briefcase, FolderOpen, FileText, GraduationCap, Wallet, Landmark, Award } from "lucide-react";
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

const storageKeyForUser = (userId: string | undefined) => `aqt:drawer-expanded:${userId ?? "guest"}`;

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
              { label: "Academy Chat", href: "/communication?view=chat" },
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
              { label: "Academy Chat", href: "/communication?view=chat" },
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

function getRouteSignature(pathname: string, search: string) {
  return `${pathname}${search}`;
}

function matchesHref(pathname: string, search: string, href: string) {
  return getRouteSignature(pathname, search) === href;
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
  const [open, setOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const sections = useMemo(() => filterSectionsForRole(buildDrawerSections(activeRole), activeRole), [activeRole]);
  const storageKey = storageKeyForUser(profile?.id);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    if (stored) {
      setExpandedKey(stored);
      return;
    }

    const activeParent = sections
      .flatMap((section) => section.items)
      .find((item) => item.children?.some((child) => matchesHref(location.pathname, location.search, child.href)));
    setExpandedKey(activeParent ? getParentKey(activeParent) : null);
  }, [location.pathname, location.search, sections, storageKey]);

  const handleExpandedChange = (key: string | null) => {
    setExpandedKey(key);
    if (typeof window !== "undefined") {
      if (key) window.localStorage.setItem(storageKey, key);
      else window.localStorage.removeItem(storageKey);
    }
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login");
  };

  if (isLoading) return <div className="min-h-screen bg-background" />;

  const initials = profile?.full_name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AQ";

  const profileName = profile?.full_name || "Al-Quran Time User";
  const profileEmail = profile?.email || "";
  const orgName = "Al-Quran Time Academy";
  const orgEmail = profileEmail || "info@alqurantimeacademy.com";

  const renderNavItem = (item: DrawerItem) => {
    const key = getParentKey(item);
    const hasChildren = !!item.children?.length;
    const activeChild = item.children?.find((child) => matchesHref(location.pathname, location.search, child.href));
    const parentActive = !!activeChild || (!!item.href && matchesHref(location.pathname, location.search, item.href));
    const expanded = expandedKey === key;

    if (!hasChildren && item.href) {
      return (
        <button
          key={key}
          type="button"
          onClick={() => {
            navigate(item.href!);
            setOpen(false);
          }}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            parentActive && "bg-primary/10 font-semibold text-primary",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      );
    }

    return (
      <div key={key} className="space-y-1">
        <button
          type="button"
          onClick={() => handleExpandedChange(expanded ? null : key)}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            parentActive && "font-semibold text-foreground",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", expanded && "rotate-90")} />
        </button>
        {expanded ? (
          <div className="space-y-1 pl-10">
            {item.children?.map((child) => {
              const childActive = matchesHref(location.pathname, location.search, child.href);
              return (
                <button
                  key={child.href}
                  type="button"
                  onClick={() => {
                    navigate(child.href);
                    if (typeof window !== "undefined" && window.innerWidth <= 1024) {
                      setOpen(false);
                    }
                  }}
                  className={cn(
                    "flex h-10 w-full items-center rounded-lg border-l-2 border-transparent px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    childActive && "border-primary bg-primary/10 text-primary",
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

  return (
    <DashboardLayoutContext.Provider value={true}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
          <div className="mx-auto flex h-full w-full max-w-[1600px] items-center gap-3 px-4 md:px-6 lg:px-8">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu" className="shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[calc(100vw-60px)] max-w-sm p-0 sm:w-[280px] sm:max-w-[280px] [&>button]:top-4 [&>button]:right-4"
              >
                <div className="flex h-full flex-col bg-background text-foreground">
                  <div className="border-b border-border px-4 pb-4 pt-6">
                    <div className="flex items-center gap-3">
                      <img src={logoDark} alt={orgName} className="h-10 w-10 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{orgName}</p>
                        <p className="truncate text-xs text-muted-foreground">{orgEmail}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {sections.map((section) => (
                      <div key={section.label} className="mt-4 first:mt-0">
                        <p className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">{section.label}</p>
                        <div className="space-y-1">{section.items.map(renderNavItem)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="sticky bottom-0 border-t border-border bg-background px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{profileName}</p>
                            <p className="truncate text-xs text-muted-foreground">{profileEmail}</p>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="top" className="w-64">
                        <DropdownMenuLabel>{profileName}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { navigate("/dashboard"); setOpen(false); }}>Profile</DropdownMenuItem>
                        {profile?.roles && profile.roles.length > 1
                          ? profile.roles.map((role) => (
                              <DropdownMenuItem
                                key={role}
                                onClick={() => {
                                  if (role !== activeRole) {
                                    setActiveRole(role);
                                    const home = role === "parent" ? "/parent" : "/dashboard";
                                    navigate(home, { replace: true });
                                  }
                                  setOpen(false);
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
              </SheetContent>
            </Sheet>

            <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
              <img src={logoDark} alt="Al-Quran Time" className="h-8 w-8 rounded-md object-cover" />
              <span className="font-serif text-base font-bold max-[399px]:hidden">Al-Quran Time</span>
            </Link>

            <div className="ml-auto flex items-center gap-2 md:gap-3">
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
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">{initials}</AvatarFallback>
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
                              const home = role === "parent" ? "/parent" : "/dashboard";
                              navigate(home, { replace: true });
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
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] bg-background px-4 py-4 md:px-6 md:py-6 lg:px-8">{children}</main>
      </div>
    </DashboardLayoutContext.Provider>
  );
}