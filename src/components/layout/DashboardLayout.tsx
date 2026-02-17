import React, { ReactNode, useState, useEffect, useCallback, useMemo } from 'react';
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
  ChevronDown,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.jpg';

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
  permission?: string;
  roles?: string[];
}

interface NavSubGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items?: NavItem[];
  subGroups?: NavSubGroup[];
}

// Build navigation groups dynamically based on active division model type and branch type
function buildNavGroups(modelType: string | null, branchType: string | null): NavGroup[] {
  const isOneToOne = modelType === 'one_to_one';
  const isGroup = modelType === 'group';
  const isOnsite = branchType === 'onsite';

  // Context-aware teaching items
  const teachingItems: NavItem[] = isOneToOne
    ? [
        { label: 'Assignments', href: '/assignments', icon: UserCheck, roles: ['super_admin', 'admin'] },
        { label: 'Schedules', href: '/schedules', icon: Calendar, roles: ['super_admin', 'admin'] },
      ]
    : [
        { label: 'Courses', href: '/courses', icon: BookOpen, roles: ['super_admin', 'admin', 'admin_academic'] },
        { label: 'Schedules', href: '/schedules', icon: CalendarClock, roles: ['super_admin', 'admin'] },
      ];

  return [
    {
      id: 'academics',
      label: 'Academics',
      icon: GraduationCap,
      items: [
        ...teachingItems,
        { label: 'Attendance', href: '/attendance', icon: ClipboardCheck, permission: 'attendance.view' },
        { label: 'Planning', href: '/monthly-planning', icon: Target, roles: ['super_admin', 'admin', 'teacher'] },
        { label: 'Subjects', href: '/subjects', icon: BookOpen, roles: ['super_admin', 'admin'] },
      ],
      subGroups: [
        {
          id: 'exam-center',
          label: 'Exam Center',
          icon: Award,
          items: [
            { label: 'Report Templates', href: '/report-card-templates', icon: FileText, roles: ['super_admin', 'admin', 'examiner'] },
            { label: 'Generate Reports', href: '/generate-report-card', icon: ClipboardCheck, roles: ['super_admin', 'admin', 'examiner'] },
            { label: 'Student Reports', href: '/student-reports', icon: BarChart3, roles: ['super_admin', 'admin', 'examiner', 'teacher', 'student', 'parent'] },
            { label: 'Reports', href: '/reports', icon: FileText, permission: 'reports.view' },
          ],
        },
      ],
    },
    {
      id: 'people',
      label: 'People',
      icon: Users,
      items: [
        { label: 'All Users', href: '/user-management', icon: Shield, roles: ['super_admin', 'admin'] },
        { label: 'Teachers', href: '/teachers', icon: Users, permission: 'teachers.view' },
        { label: 'Students', href: '/students', icon: GraduationCap, permission: 'students.view' },
      ],
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: DollarSign,
      items: [
        { label: 'Fees', href: '/payments', icon: CreditCard, permission: 'payments.view' },
        { label: 'Salary Engine', href: '/salary', icon: Wallet, roles: ['super_admin', 'admin', 'admin_fees'] },
        { label: 'Expenses', href: '/expenses', icon: Receipt, roles: ['super_admin', 'admin', 'admin_fees'] },
        { label: 'Cash Advances', href: '/cash-advances', icon: Wallet, roles: ['super_admin', 'admin', 'admin_fees'] },
        { label: 'Finance Setup', href: '/finance-setup', icon: Wallet, roles: ['super_admin'] },
        { label: 'KPI', href: '/kpi', icon: BarChart3, roles: ['super_admin', 'admin'] },
      ],
    },
    {
      id: 'communication',
      label: 'Communication',
      icon: MessageSquare,
      items: [
        ...(!isOnsite ? [{ label: 'Zoom Engine', href: '/zoom-management', icon: Video, roles: ['super_admin', 'admin'] as string[] }] : []),
        { label: 'Integrity Audit', href: '/integrity-audit', icon: AlertTriangle, roles: ['super_admin', 'admin'] },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      items: [
        { label: 'System Control', href: '/organization-settings', icon: Cog, roles: ['super_admin', 'admin'] },
        { label: 'Resources', href: '/resources', icon: FolderOpen, roles: ['super_admin'] },
      ],
    },
  ];
}

const SIDEBAR_STATE_KEY = 'sidebar-groups-state';
const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

function useSidebarState() {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const expandGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      if (prev[groupId]) return prev;
      return { ...prev, [groupId]: true };
    });
  }, []);

  return { expandedGroups, toggleGroup, expandGroup };
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, logout, isLoading, hasPermission, isSuperAdmin, activeRole } = useAuth();
  const { activeModelType, activeDivision, activeBranch } = useDivision();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; } catch { return false; }
  });
  const isMobile = useIsMobile();
  const { expandedGroups, toggleGroup, expandGroup } = useSidebarState();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  // Build nav groups based on active division and branch
  const navGroups = useMemo(() => buildNavGroups(activeModelType, activeBranch?.type || null), [activeModelType, activeBranch?.type]);

  // Check item visibility
  const isItemVisible = useCallback((item: NavItem) => {
    if (activeRole === 'super_admin') return true;
    if (item.href === '/dashboard') return true;
    if (item.roles && activeRole && item.roles.includes(activeRole)) return true;
    if (item.permission && hasPermission(item.permission)) return true;
    return false;
  }, [activeRole, hasPermission]);

  // Helper: get all nav items from a group (including sub-groups)
  const getAllGroupItems = useCallback((group: NavGroup): NavItem[] => {
    const direct = group.items ?? [];
    const nested = (group.subGroups ?? []).flatMap(sg => sg.items);
    return [...direct, ...nested];
  }, []);

  // Filter groups: only show groups that have at least one visible item
  const visibleGroups = useMemo(() => {
    return navGroups.map(group => ({
      ...group,
      items: (group.items ?? []).filter(isItemVisible),
      subGroups: (group.subGroups ?? []).map(sg => ({
        ...sg,
        items: sg.items.filter(isItemVisible),
      })).filter(sg => sg.items.length > 0),
    })).filter(group => (group.items?.length ?? 0) > 0 || (group.subGroups?.length ?? 0) > 0);
  }, [isItemVisible, navGroups]);

  // Auto-expand group & sub-group containing the active route
  useEffect(() => {
    for (const group of navGroups) {
      const allItems = getAllGroupItems(group);
      if (allItems.some(item => location.pathname === item.href)) {
        expandGroup(group.id);
        for (const sg of (group.subGroups ?? [])) {
          if (sg.items.some(item => location.pathname === item.href)) {
            expandGroup(sg.id);
          }
        }
        break;
      }
    }
  }, [location.pathname, expandGroup, getAllGroupItems, navGroups]);

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

  const sidebarWidthPx = collapsed ? 68 : 256;
  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-64';

  const renderNavLink = (item: NavItem, closeMobile?: boolean) => {
    const isActive = location.pathname === item.href;
    if (collapsed) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
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
      );
    }
    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={() => closeMobile && setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-accent text-accent-foreground shadow-glow"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const renderSubGroup = (sg: NavSubGroup, closeMobile?: boolean) => {
    if (collapsed) {
      return (
        <div key={sg.id} className="space-y-0.5">
          {sg.items.map(item => renderNavLink(item, closeMobile))}
        </div>
      );
    }
    const isOpen = expandedGroups[sg.id] ?? false;
    return (
      <Collapsible key={sg.id} open={isOpen} onOpenChange={() => toggleGroup(sg.id)}>
        <CollapsibleTrigger className={cn(
          "flex items-center justify-between w-full px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200",
          isOpen ? "text-accent" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
        )}>
          <span className="flex items-center gap-2">
            <sg.icon className="h-3.5 w-3.5" />
            {sg.label}
          </span>
          <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", isOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-2 mt-0.5 space-y-0.5">
          {sg.items.map(item => renderNavLink(item, closeMobile))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderSidebarContent = (closeMobile?: boolean) => (
    <>
      {/* Dashboard - always top */}
      {renderNavLink({ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.admin' }, closeMobile)}

      {/* Separator */}
      {!collapsed && <div className="h-px bg-sidebar-border my-2" />}
      {collapsed && <div className="h-px bg-sidebar-border my-1 mx-2" />}

      {/* Grouped items */}
      {visibleGroups.map(group => {
        const isOpen = expandedGroups[group.id] ?? false;

        if (collapsed) {
          // In collapsed mode, show group icon as a tooltip trigger
          return (
            <div key={group.id} className="space-y-0.5">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setCollapsed(false); expandGroup(group.id); }}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-lg mx-auto transition-all duration-200",
                      isOpen
                        ? "bg-accent/20 text-accent"
                        : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <group.icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {group.label}
                </TooltipContent>
              </Tooltip>
            </div>
          );
        }

        return (
          <Collapsible key={group.id} open={isOpen} onOpenChange={() => toggleGroup(group.id)}>
            <CollapsibleTrigger className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
              isOpen
                ? "bg-accent/15 text-accent"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}>
              <span className="flex items-center gap-3">
                <group.icon className="h-5 w-5" />
                {group.label}
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-3 mt-0.5 space-y-0.5">
              {(group.items ?? []).map(item => renderNavLink(item, closeMobile))}
              {(group.subGroups ?? []).map(sg => renderSubGroup(sg, closeMobile))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background islamic-pattern">
      {/* Mobile Header - larger touch targets */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border flex items-center justify-between px-3 safe-area-inset">
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
            {/* Logo Area */}
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

            {/* Active Context Badge */}
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

            {/* Collapse toggle at bottom for collapsed state */}
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

      {/* Mobile Sidebar - slide-over drawer */}
      <aside className={cn(
        "lg:hidden fixed top-0 left-0 z-40 h-full w-[280px] max-w-[85vw] bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Mobile sidebar header */}
          <div className="flex items-center gap-3 p-4 pt-5 border-b border-sidebar-border">
            <img src={logoDark} alt="Al-Quran Time Academy" className="h-9 w-9 object-contain rounded-lg shrink-0" />
            <div className="min-w-0">
              <h1 className="font-serif text-sm font-bold text-sidebar-foreground truncate">Al-Quran Time</h1>
              <p className="text-[10px] text-sidebar-foreground/60">Academy LMS</p>
            </div>
          </div>

          {/* Active Context Badge - mobile */}
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
          className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main
        className="min-h-screen pt-14 lg:pt-0 transition-all duration-300"
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
        <div className="p-3 sm:p-4 lg:p-6">
          <PageBreadcrumb />
          {children}
        </div>
      </main>
    </div>
  );
}
