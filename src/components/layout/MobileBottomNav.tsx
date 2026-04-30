import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/contexts/AuthContext';
import { LayoutDashboard, BookOpen, Users, MessageSquare, MoreHorizontal, DollarSign, BarChart3, Cog, Video, Briefcase, GraduationCap, ClipboardCheck, CalendarDays, FolderOpen } from 'lucide-react';
import { useState } from 'react';

interface MobileTabItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

function getMobileTabs(role: AppRole | null): MobileTabItem[] {
  const adminRoles = ['super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic'];
  if (role && (adminRoles.includes(role) || role?.startsWith('admin_'))) {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Teaching', href: '/teaching', icon: BookOpen },
      { label: 'People', href: '/people', icon: Users },
      { label: 'Comms', href: '/communication', icon: MessageSquare },
    ];
  }
  if (role === 'teacher') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Classes', href: '/teaching', icon: BookOpen },
      { label: 'Attendance', href: '/attendance', icon: ClipboardCheck },
      { label: 'Plan', href: '/monthly-planning', icon: CalendarDays },
      { label: 'Comms', href: '/communication', icon: MessageSquare },
    ];
  }
  if (role === 'student') {
    return [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'My Courses', href: '/my-courses', icon: BookOpen },
      { label: 'Resources', href: '/resources', icon: FolderOpen },
      { label: 'Comms', href: '/communication', icon: MessageSquare },
    ];
  }
  if (role === 'parent') {
    return [
      { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Reports', href: '/student-reports', icon: BarChart3 },
      { label: 'Comms', href: '/communication', icon: MessageSquare },
    ];
  }
  return [
    { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Comms', href: '/communication', icon: MessageSquare },
  ];
}

function getMoreItems(role: AppRole | null): MobileTabItem[] {
  const adminRoles = ['super_admin', 'admin', 'admin_admissions', 'admin_fees', 'admin_academic'];
  if (role && (adminRoles.includes(role) || role?.startsWith('admin_'))) {
    return [
      { label: 'Finance', href: '/finance', icon: DollarSign },
      { label: 'Reports', href: '/reports', icon: BarChart3 },
      { label: 'Zoom', href: '/zoom-management', icon: Video },
      { label: 'Work Hub', href: '/hub', icon: Briefcase },
      { label: 'Settings', href: '/settings', icon: Cog },
    ];
  }
  return [];
}

interface MobileBottomNavProps {
  role: AppRole | null;
}

export function MobileBottomNav({ role }: MobileBottomNavProps) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = getMobileTabs(role);
  const moreItems = getMoreItems(role);
  const hasMore = moreItems.length > 0;

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(href);
  };

  return (
    <>
      {/* More bottom sheet */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[300]" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[301] bg-white rounded-t-2xl border-t border-lms-border p-4 pb-8 safe-area-bottom animate-slide-up">
            <div className="w-10 h-1 bg-lms-border rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {moreItems.map(item => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-lms-surface transition-colors"
                >
                  <item.icon className="h-5 w-5 text-lms-navy" strokeWidth={1.8} />
                  <span className="text-[10px] text-lms-text-2 font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[200] h-[52px] bg-white border-t border-lms-border flex items-center safe-area-bottom">
        {tabs.map(tab => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5"
            >
              <tab.icon
                className={cn('h-[18px] w-[18px]', active ? 'text-lms-navy' : 'text-lms-navy/30')}
                strokeWidth={active ? 2 : 1.8}
              />
              <span className={cn('text-[8px]', active ? 'text-lms-navy font-medium' : 'text-lms-navy/30')}>
                {tab.label}
              </span>
            </Link>
          );
        })}
        {hasMore && (
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5"
          >
            <MoreHorizontal className="h-[18px] w-[18px] text-lms-navy/30" strokeWidth={1.8} />
            <span className="text-[8px] text-lms-navy/30">More</span>
          </button>
        )}
      </div>
    </>
  );
}
