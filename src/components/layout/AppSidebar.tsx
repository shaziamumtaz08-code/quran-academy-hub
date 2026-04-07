import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Plus, Search, ArrowLeft } from 'lucide-react';

/* ─── Section configurations ─── */

interface SidebarNavItem {
  label: string;
  href?: string;
  param?: string; // query param value for section=
  badge?: number;
  badgeType?: 'alert' | 'info';
  group?: string;
}

function getHomeSidebar(): { title: string; subtitle: string; items: SidebarNavItem[] } {
  return {
    title: 'Academy',
    subtitle: 'Dashboard',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Divisions', group: 'DIVISIONS' },
      { label: 'Group Academy', href: '/teaching?section=courses' },
      { label: '1-to-1', href: '/teaching?section=assignments' },
      { label: 'Recorded', href: '/teaching?section=recorded' },
    ],
  };
}

function getTeachingSidebar(courseCount: number): { title: string; subtitle: string; items: SidebarNavItem[]; showNewCourse?: boolean } {
  return {
    title: 'Course Management',
    subtitle: `${courseCount} active courses`,
    items: [
      { label: 'All Courses', href: '/teaching?section=courses' },
      { label: 'Group Academy', href: '/courses?type=group' },
      { label: '1-to-1', href: '/teaching?section=assignments' },
      { label: 'Recorded', href: '/teaching?section=recorded' },
      { label: 'Archived', href: '/courses?type=archived' },
    ],
    showNewCourse: true,
  };
}

function getPeopleSidebar(): { title: string; subtitle: string; items: SidebarNavItem[]; showSearch?: boolean } {
  return {
    title: 'People',
    subtitle: '',
    items: [
      { label: 'Students', href: '/students' },
      { label: 'Teachers', href: '/teachers' },
      { label: 'Staff', href: '/user-management' },
      { label: 'Applicants', href: '/leads', badge: 0, badgeType: 'alert' },
    ],
    showSearch: true,
  };
}

function getFinanceSidebar(): { title: string; subtitle: string; items: SidebarNavItem[] } {
  return {
    title: 'Finance',
    subtitle: '',
    items: [
      { label: 'Overview', href: '/finance' },
      { label: 'Fee Plans', href: '/finance?section=fee-setup' },
      { label: 'Payments', href: '/payments' },
      { label: 'Teacher Payouts', href: '/finance?section=teacher-payouts' },
      { label: 'Invoices', href: '/finance?section=invoices' },
    ],
  };
}

function getCommunicationSidebar(): { title: string; subtitle: string; items: SidebarNavItem[] } {
  return {
    title: 'Communication',
    subtitle: '',
    items: [
      { label: 'Group Chat', href: '/chat' },
      { label: 'WhatsApp Inbox', href: '/whatsapp' },
      { label: 'Notifications', href: '/notifications' },
      { label: 'Zoom', href: '/zoom-management' },
      { label: 'Work Hub', href: '/hub' },
    ],
  };
}

function getSettingsSidebar(): { title: string; subtitle: string; items: SidebarNavItem[] } {
  return {
    title: 'Settings',
    subtitle: '',
    items: [
      { label: 'Organization', href: '/organization-settings' },
      { label: 'Finance Setup', href: '/finance-setup' },
      { label: 'Identity', href: '/identity' },
      { label: 'Integrity Audit', href: '/integrity-audit' },
    ],
  };
}

function getReportsSidebar(): { title: string; subtitle: string; items: SidebarNavItem[] } {
  return {
    title: 'Reports',
    subtitle: '',
    items: [
      { label: 'Overview', href: '/reports-hub' },
      { label: 'Student Reports', href: '/student-reports' },
      { label: 'KPI', href: '/kpi' },
      { label: 'Report Cards', href: '/report-card-templates' },
    ],
  };
}

/* ─── Route to section mapping ─── */
function getSidebarForRoute(pathname: string) {
  if (pathname.startsWith('/teaching') || pathname.startsWith('/courses') || pathname.startsWith('/assignments') || pathname.startsWith('/subjects') || pathname.startsWith('/attendance') || pathname.startsWith('/schedules') || pathname.startsWith('/monthly-planning')) {
    return getTeachingSidebar(0);
  }
  if (pathname.startsWith('/people') || pathname.startsWith('/students') || pathname.startsWith('/teachers') || pathname.startsWith('/user-management') || pathname.startsWith('/leads')) {
    return getPeopleSidebar();
  }
  if (pathname.startsWith('/finance') || pathname.startsWith('/payments') || pathname.startsWith('/salary') || pathname.startsWith('/expenses') || pathname.startsWith('/cash-advances') || pathname.startsWith('/staff-salaries')) {
    return getFinanceSidebar();
  }
  if (pathname.startsWith('/communication') || pathname.startsWith('/chat') || pathname.startsWith('/whatsapp') || pathname.startsWith('/notifications') || pathname.startsWith('/zoom') || pathname.startsWith('/hub')) {
    return getCommunicationSidebar();
  }
  if (pathname.startsWith('/settings') || pathname.startsWith('/organization') || pathname.startsWith('/finance-setup') || pathname.startsWith('/identity') || pathname.startsWith('/integrity')) {
    return getSettingsSidebar();
  }
  if (pathname.startsWith('/reports') || pathname.startsWith('/student-reports') || pathname.startsWith('/kpi') || pathname.startsWith('/report-card')) {
    return getReportsSidebar();
  }
  return getHomeSidebar();
}

/* ─── Course Detail sidebar ─── */
function isCourseDetailRoute(pathname: string) {
  return /^\/courses\/[^/]+$/.test(pathname) || /^\/academics\/courses\/[^/]+$/.test(pathname);
}

function getCourseDetailSidebar(pathname: string): { title: string; subtitle: string; items: SidebarNavItem[]; isCourseDetail: true } {
  const base = pathname;
  return {
    title: 'Course',
    subtitle: '',
    isCourseDetail: true,
    items: [
      { label: 'Overview', href: `${base}?tab=builder` },
      { label: 'Website', href: `${base}?tab=website`, group: 'SETUP' },
      { label: 'Settings', href: `${base}?tab=settings` },
      { label: 'Marketing', href: `${base}?tab=marketing`, group: 'OUTREACH' },
      { label: 'Reg Form', href: `${base}?tab=reg-form` },
      { label: 'Applicants', href: `${base}?tab=applicants`, group: 'PEOPLE' },
      { label: 'Roster', href: `${base}?tab=roster` },
      { label: 'Classes', href: `${base}?tab=classes`, group: 'OPERATIONS' },
      { label: 'Finance', href: `${base}?tab=finance` },
      { label: 'Attendance', href: `${base}?tab=attendance`, group: 'ACADEMICS' },
      { label: 'Exams & Quizzes', href: `${base}?tab=exams` },
      { label: 'Certificates', href: `${base}?tab=certificates` },
      { label: 'Announcements', href: `${base}?tab=notifications`, group: 'HUB' },
      { label: 'Group Chat', href: `${base}?tab=community` },
      { label: 'Assignments', href: `${base}?tab=assignments` },
      { label: 'Resources', href: `${base}?tab=resources` },
    ],
  };
}

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const location = useLocation();
  const { activeRole } = useAuth();
  const { activeDivision } = useDivision();

  const isCourseDetail = isCourseDetailRoute(location.pathname);
  const sidebar = isCourseDetail
    ? getCourseDetailSidebar(location.pathname)
    : getSidebarForRoute(location.pathname);

  const isItemActive = (item: SidebarNavItem) => {
    if (!item.href) return false;
    const [path, query] = item.href.split('?');
    if (query) {
      return location.pathname === path && location.search.includes(query);
    }
    // For course detail, if no query on current URL and item is the overview tab, mark active
    if (isCourseDetail && !location.search && item.href.includes('tab=builder')) {
      return location.pathname === path;
    }
    return location.pathname === path && !location.search;
  };

  let currentGroup: string | undefined;

  return (
    <div className={cn('w-[200px] bg-white border-r border-lms-border flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-3 pt-4 pb-2">
        {isCourseDetail && (
          <Link to="/teaching?section=courses" className="flex items-center gap-1.5 text-lms-text-3 hover:text-lms-text-1 text-[11px] mb-2">
            <ArrowLeft className="h-3 w-3" />
            Back to courses
          </Link>
        )}
        <h2 className="text-[12.5px] font-medium text-lms-navy truncate">{sidebar.title}</h2>
        {sidebar.subtitle && (
          <p className="text-[10px] text-lms-text-3 mt-0.5">{sidebar.subtitle}</p>
        )}
      </div>

      {/* Search (People only) */}
      {'showSearch' in sidebar && sidebar.showSearch && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-lms-surface border border-lms-border text-lms-text-3">
            <Search className="h-3 w-3" />
            <span className="text-[10px]">Search...</span>
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {sidebar.items.map((item, i) => {
          // Group label
          const showGroup = item.group && item.group !== currentGroup;
          if (showGroup) {
            currentGroup = item.group;
          }
          const groupLabel = showGroup ? (
              <p key={`group-${item.group}`} className="text-[9px] uppercase tracking-[.07em] text-lms-text-4 px-2 pt-3 pb-1">
                {item.group}
              </p>
          ) : null;

          const active = isItemActive(item);
          return (
            <React.Fragment key={item.label + (item.href || '')}>
              {groupLabel}
            <Link
              to={item.href || '#'}
              className={cn(
                'flex items-center justify-between px-2 py-[7px] rounded-md text-[11.5px] transition-colors',
                active
                  ? 'bg-[#eef2fa] text-lms-navy font-medium'
                  : 'text-lms-text-2 hover:bg-lms-surface'
              )}
            >
              <span className="truncate">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={cn(
                  'text-[9px] font-medium px-1.5 py-0.5 rounded-full',
                  item.badgeType === 'alert' ? 'bg-[#fde8e8] text-lms-danger' : 'bg-[#e8f0fe] text-lms-accent'
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
            </React.Fragment>
          );
        })}
      </nav>

      {/* New Course button */}
      {'showNewCourse' in sidebar && sidebar.showNewCourse && (
        <div className="px-3 pb-3 pt-1 border-t border-lms-border">
          <Link
            to="/courses"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium text-lms-accent hover:bg-lms-surface transition-colors"
          >
            <Plus className="h-3 w-3" />
            New Course
          </Link>
        </div>
      )}
    </div>
  );
}
