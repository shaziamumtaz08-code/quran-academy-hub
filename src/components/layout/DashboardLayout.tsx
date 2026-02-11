import React, { ReactNode, useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
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

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

// Standalone items (always top-level)
const standaloneItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.admin' },
];

// Grouped navigation
const navGroups: NavGroup[] = [
  {
    id: 'education',
    label: 'Education & Classes',
    icon: GraduationCap,
    items: [
      { label: 'Course Management', href: '/courses', icon: BookOpen, roles: ['super_admin', 'admin', 'admin_academic'] },
      { label: '1:1 Assignments', href: '/assignments', icon: Users, roles: ['super_admin', 'admin'] },
      { label: '1:1 Schedules', href: '/schedules', icon: Calendar, roles: ['super_admin', 'admin'] },
      { label: 'Attendance', href: '/attendance', icon: ClipboardCheck, permission: 'attendance.view' },
      { label: 'Monthly Planning', href: '/monthly-planning', icon: Target, roles: ['super_admin', 'admin', 'teacher'] },
      { label: 'Subjects', href: '/subjects', icon: BookOpen, roles: ['super_admin', 'admin'] },
      { label: 'Exam Report Template', href: '/report-card-templates', icon: FileText, roles: ['super_admin', 'admin', 'examiner'] },
      { label: 'Generate Exam Report', href: '/generate-report-card', icon: ClipboardCheck, roles: ['super_admin', 'admin', 'examiner'] },
      { label: 'Student Exam Reports', href: '/student-reports', icon: BarChart3, roles: ['super_admin', 'admin', 'examiner', 'teacher'] },
      { label: 'Academic Reports', href: '/reports', icon: FileText, permission: 'reports.view' },
      { label: 'Zoom Management', href: '/zoom-management', icon: Video, roles: ['super_admin', 'admin'] },
    ],
  },
  {
    id: 'users',
    label: 'Users & Roles',
    icon: Users,
    items: [
      { label: 'User Management', href: '/user-management', icon: Shield, roles: ['super_admin', 'admin'] },
      { label: 'Teachers', href: '/teachers', icon: Users, permission: 'teachers.view' },
      { label: 'Students', href: '/students', icon: GraduationCap, permission: 'students.view' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    items: [
      { label: 'Payments', href: '/payments', icon: CreditCard, permission: 'payments.view' },
      { label: 'KPI', href: '/kpi', icon: BarChart3, roles: ['super_admin', 'admin'] },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    items: [
      { label: 'Integrity Audit', href: '/integrity-audit', icon: AlertTriangle, roles: ['super_admin', 'admin'] },
      { label: 'Resources', href: '/resources', icon: FolderOpen },
    ],
  },
];

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
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { expandedGroups, toggleGroup, expandGroup } = useSidebarState();

  // Check item visibility
  const isItemVisible = useCallback((item: NavItem) => {
    if (activeRole === 'super_admin') return true;
    if (item.href === '/dashboard') return true;
    if (item.roles && activeRole && item.roles.includes(activeRole)) return true;
    if (item.permission && hasPermission(item.permission)) return true;
    // Resources visible to all authenticated users
    if (item.href === '/resources') return true;
    return false;
  }, [activeRole, hasPermission]);

  // Filter groups: only show groups that have at least one visible item
  const visibleGroups = useMemo(() => {
    return navGroups.map(group => ({
      ...group,
      items: group.items.filter(isItemVisible),
    })).filter(group => group.items.length > 0);
  }, [isItemVisible]);

  const filteredStandaloneItems = useMemo(() => {
    return standaloneItems.filter(isItemVisible);
  }, [isItemVisible]);

  // Auto-expand group containing the active route
  useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some(item => location.pathname === item.href)) {
        expandGroup(group.id);
        break;
      }
    }
  }, [location.pathname, expandGroup]);

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

  const renderSidebarContent = (closeMobile?: boolean) => (
    <>
      {/* Standalone items */}
      {filteredStandaloneItems.map(item => renderNavLink(item, closeMobile))}

      {/* Grouped items */}
      {visibleGroups.map(group => {
        const isOpen = expandedGroups[group.id] ?? false;
        const hasActiveChild = group.items.some(item => location.pathname === item.href);

        return (
          <Collapsible
            key={group.id}
            open={isOpen}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <CollapsibleTrigger className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
              hasActiveChild
                ? "text-sidebar-primary-foreground/90"
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
              {group.items.map(item => renderNavLink(item, closeMobile))}
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
          {/* Logo */}
          <div className="hidden lg:flex items-center gap-3 p-4 border-b border-sidebar-border">
            <img src={logoDark} alt="Al-Quran Time Academy" className="h-12 w-12 object-contain rounded-lg" />
            <div>
              <h1 className="font-serif text-sm font-bold text-sidebar-foreground">Al-Quran Time</h1>
              <p className="text-xs text-sidebar-foreground/70">Academy LMS</p>
            </div>
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
        <header className="hidden lg:flex h-14 border-b border-border bg-card/50 backdrop-blur-sm items-center justify-end px-6">
          <RoleSwitcher />
        </header>
        <div className="p-6 lg:p-8">
          <PageBreadcrumb />
          {children}
        </div>
      </main>
    </div>
  );
}
