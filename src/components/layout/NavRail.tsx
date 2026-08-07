import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, BookOpen, Users, DollarSign, BarChart3,
  MessageSquare, Cog, ClipboardCheck, Target,
  Award, FileText, FolderOpen, LogOut, Activity, Megaphone, Video,
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
      { label: 'Leads', href: '/leads', icon: Megaphone },
      { label: 'Teaching', href: '/teaching', icon: BookOpen },
      { label: 'People', href: '/people', icon: Users },
      { label: 'Finance', href: '/finance', icon: DollarSign },
      { label: 'Reports', href: '/reports', icon: BarChart3 },
      { label: 'Zoom', href: '/zoom-management', icon: Video, divider: true },
      { label: 'Communication', href: '/communication', icon: MessageSquare },
      { label: 'Settings', href: '/settings', icon: Cog },
    ];
  }
  if (role === 'teacher') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
      { label: 'Planning', href: '/monthly-planning', icon: Target },
      { label: 'Student Reports', href: '/student-reports', icon: BarChart3 },
      { label: 'Performance', href: '/performance', icon: Activity },
      { label: 'Salary', href: '/salary', icon: DollarSign },
      { label: 'Library', href: '/library', icon: FolderOpen },
      { label: 'Zoom', href: '/live-classes', icon: Video, divider: true },
      { label: 'Communication', href: '/communication', icon: MessageSquare },
    ];
  }

  // Student & parent share the same menu. Difference: parent sees a kid toggle (rendered
  // inside dashboards) and an extra Family link for managing children.
  if (role === 'student' || role === 'parent') {
    const items: RailItem[] = [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'My Courses', href: '/my-courses', icon: BookOpen },
      { label: 'Reports', href: '/student-reports', icon: BarChart3 },
      { label: 'Library', href: '/library', icon: FolderOpen },
      { label: 'Communication', href: '/announcements', icon: MessageSquare },
    ];
    if (role === 'parent') {
      items.push({ label: 'Family', href: '/parent', icon: Users });
    }
    return items;
  }
  if (role === 'examiner') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Exam Center', href: '/report-card-templates', icon: Award },
      { label: 'Student Reports', href: '/student-reports', icon: FileText },
      { label: 'Communication', href: '/announcements', icon: MessageSquare },
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
    '/reports': ['/reports-hub', '/reports', '/student-reports', '/progress-timeline', '/kpi'],
    '/communication': ['/communication', '/group-chat', '/whatsapp-inbox', '/notifications', '/work-hub'],
    '/zoom-management': ['/zoom-management', '/live-classes'],
    '/live-classes': ['/live-classes', '/zoom-management'],
    '/settings': ['/settings', '/organization-settings', '/report-card-templates'],

    '/library': ['/library', '/resources', '/my-resources'],
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
