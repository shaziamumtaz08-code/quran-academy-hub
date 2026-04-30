import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, BookOpen, Users, DollarSign, BarChart3,
  MessageSquare, Cog, ClipboardCheck, Target,
  Award, FileText, FolderOpen, LogOut,
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.jpg';

export interface RailItem {
  label: string;
  href: string;
  icon: React.ElementType;
  divider?: boolean;
}

export function buildRailNav(role: AppRole | null): RailItem[] {
  const adminRoles = ['super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic'];
  if (role && (adminRoles.includes(role) || role?.startsWith('admin_'))) {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Teaching', href: '/teaching', icon: BookOpen },
      { label: 'People', href: '/people', icon: Users },
      { label: 'Finance', href: '/finance', icon: DollarSign },
      { label: 'Reports', href: '/reports', icon: BarChart3 },
      { label: 'Communication', href: '/communication', icon: MessageSquare, divider: true },
      { label: 'Settings', href: '/settings', icon: Cog },
    ];
  }
  if (role === 'teacher') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'My Classes', href: '/teaching', icon: BookOpen },
      { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
      { label: 'Planning', href: '/monthly-planning', icon: Target },
      { label: 'Reports', href: '/student-reports', icon: BarChart3 },
      { label: 'Salary', href: '/salary', icon: DollarSign },
      { label: 'Communication', href: '/communication', icon: MessageSquare },
    ];
  }
  if (role === 'student') {
    return [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'My Courses', href: '/my-courses', icon: BookOpen },
      { label: 'Resources', href: '/resources', icon: FolderOpen },
      { label: 'Communication', href: '/communication', icon: MessageSquare },
    ];
  }
  if (role === 'parent') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Reports', href: '/student-reports', icon: BarChart3 },
      { label: 'Communication', href: '/communication', icon: MessageSquare },
    ];
  }
  if (role === 'examiner') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Exam Center', href: '/report-card-templates', icon: Award },
      { label: 'Student Reports', href: '/student-reports', icon: FileText },
    ];
  }
  return [{ label: 'Home', href: '/dashboard', icon: LayoutDashboard }];
}

interface NavRailProps {
  items: RailItem[];
  orgInitials?: string;
}

export function NavRail({ items, orgInitials = 'AQ' }: NavRailProps) {
  const location = useLocation();
  const { logout } = useAuth();

  const ROUTE_GROUPS: Record<string, string[]> = {
    '/people': ['/people', '/students', '/teachers', '/user-management', '/leads', '/identity', '/applicants'],
    '/teaching': ['/teaching', '/teaching-os', '/quiz-engine', '/courses', '/course-builder', '/my-courses', '/lessons', '/assignments', '/subjects', '/schedules', '/attendance', '/monthly-planning'],
    '/finance': ['/finance', '/payments', '/expenses', '/cash-advances', '/salary', '/staff-salary', '/teacher-payouts'],
    '/reports': ['/reports-hub', '/reports', '/student-reports', '/kpi'],
    '/communication': ['/communication', '/group-chat', '/whatsapp-inbox', '/notifications', '/work-hub'],
    '/settings': ['/settings', '/organization-settings', '/zoom-management', '/report-card-templates'],
    '/resources': ['/resources', '/my-resources'],
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
    const prefixes = ROUTE_GROUPS[href] || [href];
    return prefixes.some((prefix) => location.pathname === prefix || location.pathname.startsWith(prefix + '/') || location.pathname.startsWith(prefix + '?') || location.pathname === prefix);
  };

  return (
    <div className="fixed top-0 left-0 z-40 flex h-full w-14 flex-col items-center gap-1 bg-lms-navy py-3">
      <div className="mb-3 flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-lms-navy-hover">
        <img src={logoDark} alt="Academy" className="h-7 w-7 rounded object-cover" />
      </div>

      <nav className="flex w-full flex-1 flex-col items-center gap-0.5 px-[9px]">
        {items.map((item) => (
          <React.Fragment key={item.href + item.label}>
            {item.divider && <div className="my-1.5 h-px w-6 bg-white/10" />}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to={item.href}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                    isActive(item.href)
                      ? 'bg-lms-navy-hover text-white'
                      : 'text-white/40 hover:bg-lms-navy-hover hover:text-white'
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          </React.Fragment>
        ))}
      </nav>

      <div className="w-full px-[9px] pb-1">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => logout()}
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-red-600/20 hover:text-red-400"
              aria-label="Sign out"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs">
            Sign Out
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
