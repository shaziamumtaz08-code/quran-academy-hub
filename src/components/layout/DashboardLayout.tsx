import React, { ReactNode, useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Button } from '@/components/ui/button';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { useIsMobile } from '@/hooks/use-mobile';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { DivisionSwitcher } from '@/components/layout/DivisionSwitcher';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  ClipboardCheck,
  FileText,
  DollarSign,
  BarChart3,
  LogOut,
  User,
  Menu,
  X,
  Shield,
  FolderOpen,
  Target,
  BookOpen,
  Video,
  AlertTriangle,
  Settings,
  MessageSquare,
  CreditCard,
  UserCheck,
  Wallet,
  CalendarClock,
  Award,
  Cog,
  Receipt,
  PanelLeftClose,
  PanelLeft,
  Bell,
  Megaphone,
  Library,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.jpg';

const DashboardLayoutContext = createContext(false);
export const useIsInsideDashboard = () => useContext(DashboardLayoutContext);

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  admin_admissions: 'Admissions',
  admin_fees: 'Fees Admin',
  admin_academic: 'Academic',
  teacher: 'Teacher',
  examiner: 'Examiner',
  student: 'Student',
  parent: 'Parent',
};

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  divider?: boolean; // thin separator before this item
}

// ── Flat navigation per role ──────────────────────────────────────
// 7 items max for admin, role-specific for others. No accordions.
function buildFlatNav(role: AppRole | null, modelType: string | null, branchType: string | null): NavItem[] {
  const adminRoles = ['super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic'];
  const adminOnly = ['super_admin', 'admin'];

  // Admin: 7 items
  if (role && (adminOnly.includes(role) || role.startsWith('admin_'))) {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Teaching', href: '/teaching', icon: BookOpen },
      { label: 'People', href: '/people', icon: Users },
      { label: 'Finance', href: '/finance', icon: DollarSign },
      { label: 'Reports', href: '/reports-hub', icon: BarChart3 },
      { label: 'Communication', href: '/communication', icon: MessageSquare },
      { label: 'Settings', href: '/settings', icon: Cog },
    ];
  }

  // Teacher: 7 items
  if (role === 'teacher') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'My Classes', href: '/teaching', icon: BookOpen },
      { label: 'My Students', href: '/students', icon: GraduationCap },
      { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
      { label: 'Planning', href: '/monthly-planning', icon: Target },
      { label: 'Resources', href: '/resources', icon: FolderOpen },
      { label: 'Chat', href: '/chat', icon: MessageSquare },
    ];
  }

  // Student: 5 items
  if (role === 'student') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'My Class', href: '/student-reports', icon: BookOpen },
      { label: 'Progress', href: '/student-reports', icon: BarChart3 },
      { label: 'Resources', href: '/resources', icon: FolderOpen },
      { label: 'Chat', href: '/chat', icon: MessageSquare },
    ];
  }

  // Parent: 3 items
  if (role === 'parent') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Reports', href: '/student-reports', icon: BarChart3 },
      { label: 'Chat', href: '/chat', icon: MessageSquare },
    ];
  }

  // Examiner
  if (role === 'examiner') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Exam Center', href: '/report-card-templates', icon: Award },
      { label: 'Student Reports', href: '/student-reports', icon: FileText },
    ];
  }

  // Default
  return [
    { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  ];
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, logout, isLoading, hasPermission, isSuperAdmin, activeRole } = useAuth();
  const { activeModelType, activeDivision, activeBranch } = useDivision();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSidebarOpen(prev => !prev);
    window.addEventListener('teacher-menu-toggle', handler);
    return () => window.removeEventListener('teacher-menu-toggle', handler);
  }, []);

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; } catch { return false; }
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  // Build flat nav
  const allItems = useMemo(
    () => buildFlatNav(activeRole, activeModelType, activeBranch?.type || null),
    [activeRole, activeModelType, activeBranch?.type],
  );

  // All items are already role-filtered by buildFlatNav
  const visibleItems = allItems;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background islamic-pattern flex items-center justify-center">
        <div className="text-center">
          <img src={logoLight} alt="Al-Quran Time Academy" className="h-24 w-24 object-contain mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background islamic-pattern">
        <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img src={logoLight} alt="Al-Quran Time Academy" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="font-serif text-lg font-bold text-foreground">Al-Quran Time Academy</h1>
              <p className="text-xs text-muted-foreground">Learning Management</p>
            </div>
          </div>
          <Link to="/login">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
        </header>
        <main className="min-h-screen pt-16">
          <div className="p-6 lg:p-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
            <div className="text-center max-w-md">
              <img src={logoLight} alt="Al-Quran Time Academy" className="w-32 h-32 object-contain mx-auto mb-6" />
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Welcome to Al-Quran Time Academy</h2>
              <p className="text-muted-foreground mb-6">Please sign in to access the Learning Management System.</p>
              <Link to="/login">
                <Button className="w-full sm:w-auto btn-primary-glow">Sign In to Continue</Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const sidebarWidthPx = collapsed ? 68 : 220;
  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-[220px]';

  const renderNavLink = (item: NavItem, closeMobile?: boolean) => {
    const isActive = location.pathname === item.href;
    if (collapsed) {
      return (
        <React.Fragment key={item.href}>
          {item.divider && <div className="h-px bg-sidebar-border my-1 mx-2" />}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                to={item.href}
                onClick={() => closeMobile && setSidebarOpen(false)}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg mx-auto transition-all duration-200",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-glow"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {item.label}
            </TooltipContent>
          </Tooltip>
        </React.Fragment>
      );
    }
    return (
      <React.Fragment key={item.href}>
        {item.divider && <div className="h-px bg-sidebar-border my-2" />}
        <Link
          to={item.href}
          onClick={() => closeMobile && setSidebarOpen(false)}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
            isActive
              ? "bg-accent text-accent-foreground shadow-glow"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      </React.Fragment>
    );
  };

  const renderSidebarContent = (closeMobile?: boolean) => (
    <>
      {visibleItems.map(item => renderNavLink(item, closeMobile))}
    </>
  );

  return (
    <div className="min-h-screen bg-background islamic-pattern">
      {/* Mobile Header */}
      <header className={`lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border flex items-center justify-between px-3 safe-area-inset ${location.pathname === '/dashboard' && activeRole !== 'teacher' && activeRole !== 'examiner' ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <img src={logoLight} alt="Al-Quran Time Academy" className="h-7 w-7 object-contain shrink-0" />
          <span className="font-serif text-base font-bold text-foreground truncate">Al-Quran Time</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <DivisionSwitcher />
          <RoleSwitcher />
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside
        className={cn("hidden lg:block fixed top-0 left-0 z-40 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300", sidebarWidth)}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
            <div className={cn("flex items-center gap-3 overflow-hidden", collapsed && "justify-center w-full")}>
              <img src={logoDark} alt="Al-Quran Time Academy" className={cn("object-contain rounded-lg shrink-0", collapsed ? "h-9 w-9" : "h-10 w-10")} />
              {!collapsed && (
                <div className="min-w-0">
                  <h1 className="font-serif text-sm font-bold text-sidebar-foreground truncate">Al-Quran Time</h1>
                  <p className="text-[10px] text-sidebar-foreground/60">Academy LMS</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0",
                collapsed && "hidden"
              )}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* Context Badge */}
          {activeBranch && activeDivision && !collapsed && (
            <div className="px-3 pt-2">
              <div className="px-2.5 py-1.5 rounded-md bg-accent/10 border border-accent/20">
                <p className="text-[10px] font-semibold text-accent truncate">
                  {activeBranch.name} · {activeDivision.name}
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className={cn("flex-1 overflow-y-auto scrollbar-thin", collapsed ? "p-2 space-y-0.5" : "p-3 space-y-0.5")}>
            {renderSidebarContent(false)}
          </nav>

          {/* Collapse toggle */}
          {collapsed && (
            <div className="p-2 border-t border-sidebar-border">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setCollapsed(false)}
                    className="flex items-center justify-center w-10 h-10 rounded-lg mx-auto text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* User Section */}
          <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center w-10 h-10 rounded-lg mx-auto text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{profile.full_name} · Sign Out</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2 px-2">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.full_name}</p>
                    <p className="text-[10px] text-sidebar-foreground/50 capitalize">
                      {activeRole ? ROLE_LABELS[activeRole] : 'User'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 text-xs"
                  onClick={handleLogout}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside className={cn(
        "lg:hidden fixed top-0 left-0 z-[210] h-full w-[280px] max-w-[85vw] bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 p-4 pt-5 border-b border-sidebar-border">
            <img src={logoDark} alt="Al-Quran Time Academy" className="h-9 w-9 object-contain rounded-lg shrink-0" />
            <div className="min-w-0">
              <h1 className="font-serif text-sm font-bold text-sidebar-foreground truncate">Al-Quran Time</h1>
              <p className="text-[10px] text-sidebar-foreground/60">Academy LMS</p>
            </div>
          </div>

          {activeBranch && activeDivision && (
            <div className="px-3 pt-3">
              <div className="px-2.5 py-1.5 rounded-md bg-accent/10 border border-accent/20">
                <p className="text-[10px] font-semibold text-accent truncate">
                  {activeBranch.name} · {activeDivision.name}
                </p>
              </div>
            </div>
          )}

          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch">
            {renderSidebarContent(true)}
          </nav>

          <div className="p-3 border-t border-sidebar-border safe-area-bottom">
            <div className="flex items-center gap-3 mb-2 px-2">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.full_name}</p>
                <p className="text-[10px] text-sidebar-foreground/50 capitalize">
                  {activeRole ? ROLE_LABELS[activeRole] : 'User'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent h-10 text-sm"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[205] bg-foreground/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main
        className={`min-h-screen lg:pt-0 transition-all duration-300 ${location.pathname === '/dashboard' ? 'pt-0' : 'pt-14'}`}
        style={{ marginLeft: !isMobile ? sidebarWidthPx : 0 }}
      >
        <header className="hidden lg:flex h-12 border-b border-border bg-card/80 backdrop-blur-sm items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {activeBranch && activeDivision && (
              <span className="font-medium text-foreground text-xs">
                {activeBranch.name} <span className="text-muted-foreground mx-1">›</span> {activeDivision.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DivisionSwitcher />
            <RoleSwitcher />
          </div>
        </header>
        <div className={location.pathname === '/dashboard' ? 'p-0' : 'p-3 sm:p-4 lg:p-6'}>
          <PageBreadcrumb />
          {children}
        </div>
      </main>
    </div>
  );
}
