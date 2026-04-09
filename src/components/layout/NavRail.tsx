import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AuthContext';
import {
  LayoutDashboard, BookOpen, Users, DollarSign, BarChart3,
  MessageSquare, Cog, GraduationCap, ClipboardCheck, Target,
  FolderOpen, Award, FileText, CalendarDays,
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
      { label: 'Reports', href: '/reports-hub', icon: BarChart3 },
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
      { label: 'Salary', href: '/salary', icon: DollarSign },
      { label: 'Communication', href: '/communication', icon: MessageSquare },
    ];
  }
  if (role === 'student') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Classes', href: '/teaching', icon: BookOpen },
      { label: 'Calendar', href: '/schedules', icon: CalendarDays },
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

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="fixed top-0 left-0 z-40 h-full w-14 bg-lms-navy flex flex-col items-center py-3 gap-1">
      {/* Org initials */}
      <div className="w-[30px] h-[30px] rounded-lg bg-lms-navy-hover flex items-center justify-center mb-3">
        <img src={logoDark} alt="Academy" className="w-7 h-7 rounded object-cover" />
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col items-center gap-0.5 w-full px-[9px]">
        {items.map((item) => (
          <React.Fragment key={item.href + item.label}>
            {item.divider && <div className="w-6 h-px bg-white/10 my-1.5" />}
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to={item.href}
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
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
    </div>
  );
}
