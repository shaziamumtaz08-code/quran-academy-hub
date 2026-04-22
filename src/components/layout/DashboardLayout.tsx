import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, ChevronRight, LayoutDashboard, BookOpen, Users, DollarSign, BarChart3, MessageSquare, Cog, LogOut, ClipboardCheck, Target, Award, FileText, FolderOpen, Briefcase } from "lucide-react";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { DivisionSwitcher } from "@/components/layout/DivisionSwitcher";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import logoDark from "@/assets/logo-dark.jpg";

const DashboardLayoutContext = createContext(false);
export const useIsInsideDashboard = () => useContext(DashboardLayoutContext);

interface DashboardLayoutProps {
  children: ReactNode;
}

interface DrawerItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  action?: "logout";
}

interface DrawerSection {
  label: string;
  items: DrawerItem[];
}

const adminRoles = ["super_admin", "admin", "admin_admissions", "admin_fees", "admin_academic"];

function buildDrawerSections(role: AppRole | null): DrawerSection[] {
  if (role && (adminRoles.includes(role) || role.startsWith("admin_"))) {
    return [
      { label: "Main", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
      { label: "Manage", items: [
        { label: "Teaching", href: "/teaching", icon: BookOpen },
        { label: "People", href: "/people", icon: Users },
        { label: "Finance", href: "/finance", icon: DollarSign },
      ]},
      { label: "Insights", items: [{ label: "Reports", href: "/reports?view=executive", icon: BarChart3 }] },
      { label: "Workspace", items: [
        { label: "Communication", href: "/communication", icon: MessageSquare },
        { label: "Work Hub", href: "/work-hub", icon: Briefcase },
      ]},
      { label: "System", items: [
        { label: "Settings", href: "/settings", icon: Cog },
        { label: "Sign Out", action: "logout", icon: LogOut },
      ]},
    ];
  }

  if (role === "teacher") {
    return [{
      label: "Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "My Classes", href: "/teaching", icon: BookOpen },
        { label: "Attendance", href: "/attendance", icon: ClipboardCheck },
        { label: "Planning", href: "/monthly-planning", icon: Target },
        { label: "Student Reports", href: "/student-reports", icon: FileText },
        { label: "Salary", href: "/salary", icon: DollarSign },
        { label: "Communication", href: "/communication", icon: MessageSquare },
        { label: "Sign Out", action: "logout", icon: LogOut },
      ],
    }];
  }

  if (role === "student") {
    return [{
      label: "Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "My Courses", href: "/my-courses", icon: BookOpen },
        { label: "Resources", href: "/resources", icon: FolderOpen },
        { label: "Communication", href: "/communication", icon: MessageSquare },
        { label: "Sign Out", action: "logout", icon: LogOut },
      ],
    }];
  }

  if (role === "parent") {
    return [{
      label: "Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Reports", href: "/student-reports", icon: BarChart3 },
        { label: "Communication", href: "/communication", icon: MessageSquare },
        { label: "Sign Out", action: "logout", icon: LogOut },
      ],
    }];
  }

  if (role === "examiner") {
    return [{
      label: "Menu",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Exam Center", href: "/report-card-templates", icon: Award },
        { label: "Student Reports", href: "/student-reports", icon: FileText },
        { label: "Sign Out", action: "logout", icon: LogOut },
      ],
    }];
  }

  return [{ label: "Menu", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] }];
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, isLoading, logout, activeRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const sections = useMemo(() => buildDrawerSections(activeRole), [activeRole]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate("/login");
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!profile) {
    return (
      <DashboardLayoutContext.Provider value={true}>
        <div className="min-h-screen bg-background">
          <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between px-4 md:px-6 lg:px-8">
              <Link to="/login" className="flex items-center gap-2">
                <img src={logoDark} alt="Al-Quran Time" className="h-8 w-8 rounded-md object-cover" />
                <span className="font-serif text-base font-bold max-[399px]:hidden">Al-Quran Time</span>
              </Link>
              <Button asChild size="sm">
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8">{children}</main>
        </div>
      </DashboardLayoutContext.Provider>
    );
  }

  const initials = profile.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AQ";

  return (
    <DashboardLayoutContext.Provider value={true}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur dark:bg-[hsl(var(--navy))]">
          <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 md:flex-1">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0" aria-label="Open navigation menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-screen max-w-sm border-r-0 bg-[hsl(var(--navy))] p-0 text-white sm:w-[280px] sm:max-w-[280px]"
                >
                  <SheetHeader className="border-b border-white/10 px-5 py-4 text-left">
                    <SheetTitle className="flex items-center gap-3 text-white">
                      <img src={logoDark} alt="Al-Quran Time" className="h-9 w-9 rounded-md object-cover" />
                      <span className="font-serif text-lg font-bold">Al-Quran Time</span>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="h-[calc(100vh-73px)] overflow-y-auto px-4 py-4">
                    {sections.map((section) => (
                      <div key={section.label} className="mb-6 last:mb-0">
                        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          {section.label}
                        </p>
                        <div className="space-y-1">
                          {section.items.map((item) => {
                            const active = item.href
                              ? location.pathname === item.href || `${location.pathname}${location.search}` === item.href || (item.href.startsWith("/reports") && location.pathname === "/reports")
                              : false;

                            if (item.action === "logout") {
                              return (
                                <button
                                  key={item.label}
                                  type="button"
                                  onClick={handleLogout}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                                >
                                  <item.icon className="h-4 w-4 shrink-0" />
                                  <span className="flex-1">{item.label}</span>
                                  <ChevronRight className="h-4 w-4 text-white/40" />
                                </button>
                              );
                            }

                            return (
                              <SheetClose asChild key={item.label}>
                                <Link
                                  to={item.href!}
                                  className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
                                    active ? "bg-white/12 text-white" : "text-white/85 hover:bg-white/10 hover:text-white",
                                  )}
                                >
                                  <item.icon className="h-4 w-4 shrink-0" />
                                  <span className="flex-1">{item.label}</span>
                                  <ChevronRight className="h-4 w-4 text-white/40" />
                                </Link>
                              </SheetClose>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>

              <Link to="/dashboard" className="relative flex items-center gap-2 max-[399px]:w-8 md:gap-3">
                <img src={logoDark} alt="Al-Quran Time" className="h-8 w-8 rounded-md object-cover" />
                <span className="font-serif text-base font-bold max-[399px]:hidden">Al-Quran Time</span>
              </Link>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <div className="max-w-[180px] min-w-0">
                <DivisionSwitcher />
              </div>
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-4 md:px-6 md:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </DashboardLayoutContext.Provider>
  );
}
