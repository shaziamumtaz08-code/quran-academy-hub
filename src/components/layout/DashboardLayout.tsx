import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
  BookOpen,
  User,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student', 'parent', 'examiner'] },
  { label: 'Teachers', href: '/teachers', icon: Users, roles: ['admin'] },
  { label: 'Students', href: '/students', icon: GraduationCap, roles: ['admin'] },
  { label: 'Schedules', href: '/schedules', icon: Calendar, roles: ['admin', 'teacher', 'student', 'parent'] },
  { label: 'Attendance', href: '/attendance', icon: ClipboardCheck, roles: ['admin', 'teacher'] },
  { label: 'Lessons', href: '/lessons', icon: BookOpen, roles: ['admin', 'teacher', 'student', 'parent'] },
  { label: 'Exam Templates', href: '/exam-templates', icon: FileText, roles: ['admin'] },
  { label: 'Submit Exam', href: '/exam-submission', icon: ClipboardCheck, roles: ['admin', 'examiner'] },
  { label: 'Exam Results', href: '/exam-results', icon: BarChart3, roles: ['admin', 'examiner', 'teacher', 'student', 'parent'] },
  { label: 'Reports', href: '/reports', icon: FileText, roles: ['admin', 'teacher', 'student', 'parent'] },
  { label: 'Payments', href: '/payments', icon: DollarSign, roles: ['admin'] },
  { label: 'KPI', href: '/kpi', icon: BarChart3, roles: ['admin'] },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background islamic-pattern flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show unauthenticated state with visible layout
  if (!user) {
    return (
      <div className="min-h-screen bg-background islamic-pattern">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold text-foreground">Quran Academy</h1>
              <p className="text-xs text-muted-foreground">Learning Management</p>
            </div>
          </div>
          <Link to="/login">
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </Link>
        </header>

        {/* Main Content with Sign In Message */}
        <main className="min-h-screen pt-16">
          <div className="p-6 lg:p-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <User className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
                Welcome to Quran Academy LMS
              </h2>
              <p className="text-muted-foreground mb-6">
                Please sign in to access the Quran Academy LMS.
              </p>
              <Link to="/login">
                <Button className="w-full sm:w-auto">
                  Sign In to Continue
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background islamic-pattern">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-card border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-serif text-lg font-bold text-foreground">Quran Academy</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-full w-64 bg-card border-r border-border transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="hidden lg:flex items-center gap-3 p-6 border-b border-border">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold text-foreground">Quran Academy</h1>
              <p className="text-xs text-muted-foreground">Learning Management</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 mt-16 lg:mt-0 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <User className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
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
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
