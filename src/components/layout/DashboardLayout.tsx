import React, { ReactNode, useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Button } from '@/components/ui/button';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
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
  Layers,
  UserCheck,
  Bell,
  Wallet,
  Archive,
  CalendarClock,
  Megaphone,
  ClipboardList,
  Award,
  Cog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

// Standalone items (always top-level)
const standaloneItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.admin' },
];

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

  // Context-aware academic items
  const academicItems: NavItem[] = [
    { label: 'Attendance', href: '/attendance', icon: ClipboardCheck, permission: 'attendance.view' },
    { label: 'Planning', href: '/monthly-planning', icon: Target, roles: ['super_admin', 'admin', 'teacher'] },
    { label: 'Subjects', href: '/subjects', icon: BookOpen, roles: ['super_admin', 'admin'] },
  ];

  // System items - hide Zoom for onsite
  const systemItems: NavItem[] = [
    { label: 'System Control', href: '/organization-settings', icon: Cog, roles: ['super_admin', 'admin'] },
    ...(!isOnsite ? [{ label: 'Zoom Engine', href: '/zoom-management', icon: Video, roles: ['super_admin', 'admin'] as string[] }] : []),
    { label: 'Integrity Audit', href: '/integrity-audit', icon: AlertTriangle, roles: ['super_admin', 'admin'] },
    { label: 'Resources', href: '/resources', icon: FolderOpen, roles: ['super_admin'] },
  ];

  return [
    {
      id: 'teaching',
      label: isOneToOne ? 'Mentorship' : isGroup ? 'Batch Academy' : 'Teaching',
      icon: isOneToOne ? UserCheck : GraduationCap,
      items: teachingItems,
    },
    {
      id: 'academics',
      label: 'Academics',
      icon: BookOpen,
      items: academicItems,
      subGroups: [
        {
          id: 'exam-center',
          label: 'Exam Center',
          icon: Award,
          items: [
            { label: 'Report Templates', href: '/report-card-templates', icon: FileText, roles: ['super_admin', 'admin', 'examiner'] },
            { label: 'Generate Reports', href: '/generate-report-card', icon: ClipboardCheck, roles: ['super_admin', 'admin', 'examiner'] },
            { label: 'Student Reports', href: '/student-reports', icon: BarChart3, roles: ['super_admin', 'admin', 'examiner', 'teacher'] },
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
        { label: 'KPI', href: '/kpi', icon: BarChart3, roles: ['super_admin', 'admin'] },
      ],
    },
    {
      id: 'system',
      label: 'System',
      icon: Settings,
      items: systemItems,
    },
  ];
}

const SIDEBAR_STATE_KEY = 'sidebar-groups-state';

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
  const { expandedGroups, toggleGroup, expandGroup } = useSidebarState();

  // Build nav groups based on active division and branch
  const navGroups = useMemo(() => buildNavGroups(activeModelType, activeBranch?.type || null), [activeModelType, activeBranch?.type]);

  // Check item visibility
  const isItemVisible = useCallback((item: NavItem) => {
    if (activeRole === 'super_admin') return true;
    if (item.href === '/dashboard') return true;
    if (item.roles && activeRole && item.roles.includes(activeRole)) return true;
    if (item.permission && hasPermission(item.permission)) return true;
    // Resources no longer has open access - it uses roles like other items
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

  const filteredStandaloneItems = useMemo(() => {
    return standaloneItems.filter(isItemVisible);
  }, [isItemVisible]);

  // Auto-expand group & sub-group containing the active route
  useEffect(() => {
    for (const group of navGroups) {
      const allItems = getAllGroupItems(group);
      if (allItems.some(item => location.pathname === item.href)) {
        expandGroup(group.id);
        // Also expand any matching sub-group
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

  const renderNavLink = (item: NavItem, closeMobile?: boolean) => {
    const isActive = location.pathname === item.href;
    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={() => closeMobile && setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  };

  const renderSubGroup = (sg: NavSubGroup, closeMobile?: boolean) => {
    const isOpen = expandedGroups[sg.id] ?? false;
    return (
      <Collapsible
        key={sg.id}
        open={isOpen}
        onOpenChange={() => toggleGroup(sg.id)}
      >
        <CollapsibleTrigger className={cn(
          "flex items-center justify-between w-full px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-200",
          isOpen
            ? "text-sidebar-primary"
            : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
        )}>
          <span className="flex items-center gap-2">
            <sg.icon className="h-3.5 w-3.5" />
            {sg.label}
          </span>
          <ChevronDown className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-2 mt-0.5 space-y-0.5">
          {sg.items.map(item => renderNavLink(item, closeMobile))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderSidebarContent = (closeMobile?: boolean) => (
    <>
      {/* Standalone items */}
      {filteredStandaloneItems.map(item => renderNavLink(item, closeMobile))}

      {/* Grouped items */}
      {visibleGroups.map(group => {
        const isOpen = expandedGroups[group.id] ?? false;

        return (
          <Collapsible
            key={group.id}
            open={isOpen}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <CollapsibleTrigger className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
              isOpen
                ? "bg-cyan text-white"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}>
              <span className="flex items-center gap-3">
                <group.icon className="h-5 w-5" />
                {group.label}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform duration-200",
                isOpen && "rotate-180"
              )} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-3 mt-0.5 space-y-0.5">
              {/* Direct items */}
              {(group.items ?? []).map(item => renderNavLink(item, closeMobile))}
              {/* Sub-groups */}
              {(group.subGroups ?? []).map(sg => renderSubGroup(sg, closeMobile))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background islamic-pattern">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-card border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <img src={logoLight} alt="Al-Quran Time Academy" className="h-8 w-8 object-contain" />
          <span className="font-serif text-lg font-bold text-foreground">Al-Quran Time</span>
        </div>
        <div className="flex items-center gap-2">
          <DivisionSwitcher />
          <RoleSwitcher />
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-full w-64 bg-sidebar transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo + Active Context */}
          <div className="hidden lg:flex flex-col p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <img src={logoDark} alt="Al-Quran Time Academy" className="h-12 w-12 object-contain rounded-lg" />
              <div>
                <h1 className="font-serif text-sm font-bold text-sidebar-foreground">Al-Quran Time</h1>
                <p className="text-xs text-sidebar-foreground/70">Academy LMS</p>
              </div>
            </div>
            {activeBranch && activeDivision && (
              <div className="mt-3 px-2 py-1.5 rounded-md bg-sidebar-accent/50 border border-sidebar-border">
                <p className="text-[11px] font-semibold text-accent truncate">
                  {activeBranch.name} — {activeDivision.name}
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 mt-16 lg:mt-0 overflow-y-auto scrollbar-thin">
            {renderSidebarContent(true)}
          </nav>

          {/* User Section */}
          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                <User className="h-4 w-4 text-sidebar-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{profile.full_name}</p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">
                  {activeRole ? ROLE_LABELS[activeRole] : 'User'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
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
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <header className="hidden lg:flex h-14 border-b border-border bg-card/50 backdrop-blur-sm items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {activeBranch && activeDivision && (
              <span className="font-medium text-foreground">
                {activeBranch.name} <span className="text-muted-foreground mx-1">›</span> {activeDivision.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DivisionSwitcher />
            <RoleSwitcher />
          </div>
        </header>
        <div className="p-6 lg:p-8">
          <PageBreadcrumb />
          {children}
        </div>
      </main>
    </div>
  );
}
