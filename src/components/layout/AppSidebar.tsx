import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Plus, Search, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

/* ─── Section configurations ─── */

interface SidebarNavItem {
  label: string;
  href?: string;
  param?: string; // query param value for section=
  badge?: number;
  badgeType?: 'alert' | 'info';
  badgeText?: string;
  group?: string;
}

function getHomeSidebar(isOneToOne?: boolean): { title: string; subtitle: string; items: SidebarNavItem[] } {
  return {
    title: 'Academy',
    subtitle: 'Dashboard',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'My Dashboard', href: '/my-dashboard' },
      { label: 'Divisions', group: 'DIVISIONS' },
      ...(!isOneToOne ? [{ label: 'Group Academy', href: '/teaching?section=courses' }] : []),
      { label: '1-to-1', href: '/teaching?section=assignments' },
      ...(!isOneToOne ? [{ label: 'Recorded', href: '/teaching?section=recorded' }] : []),
    ],
  };
}

function getTeachingSidebar(courseCount: number, isOneToOne?: boolean): { title: string; subtitle: string; items: SidebarNavItem[]; showNewCourse?: boolean } {
  const items: SidebarNavItem[] = [
    ...(!isOneToOne ? [{ label: 'All Courses', href: '/teaching?section=courses' }] : []),
    ...(!isOneToOne ? [{ label: 'Group Academy', href: '/courses?type=group' }] : []),
    { label: '1-to-1', href: '/teaching?section=assignments' },
    ...(!isOneToOne ? [{ label: 'Recorded', href: '/teaching?section=recorded' }] : []),
    ...(!isOneToOne ? [{ label: 'Archived', href: '/courses?type=archived' }] : []),
    ...(!isOneToOne ? [{ label: 'AI Teaching OS', href: '/teaching-os', badgeText: 'AI' }] : []),
  ];
  return {
    title: isOneToOne ? '1-to-1 Teaching' : 'Course Management',
    subtitle: isOneToOne ? 'Assignments & schedules' : `${courseCount} active courses`,
    items,
    showNewCourse: !isOneToOne,
  };
}

function getPeopleSidebar(isOneToOne?: boolean): { title: string; subtitle: string; items: SidebarNavItem[]; showSearch?: boolean } {
  return {
    title: 'People',
    subtitle: '',
    items: [
      { label: 'Students', href: '/students' },
      { label: 'Teachers', href: '/teachers' },
      { label: 'Staff', href: '/user-management' },
      ...(isOneToOne ? [{ label: 'Applicants', href: '/leads', badge: 0, badgeType: 'alert' as const }] : []),
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

function getCommunicationSidebar(role?: string | null): { title: string; subtitle: string; items: SidebarNavItem[] } {
  const isAdmin = role === 'super_admin' || role === 'admin' || role?.startsWith('admin_');
  return {
    title: 'Communication',
    subtitle: '',
    items: [
      { label: 'Group Chat', href: '/chat' },
      ...(isAdmin ? [{ label: 'WhatsApp Inbox', href: '/whatsapp' }] : []),
      { label: 'Notifications', href: '/notifications' },
      ...(isAdmin ? [{ label: 'Zoom', href: '/zoom-management' }] : []),
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
function getSidebarForRoute(pathname: string, isOneToOne?: boolean, role?: string | null) {
  if (pathname.startsWith('/teaching') || pathname.startsWith('/courses') || pathname.startsWith('/assignments') || pathname.startsWith('/subjects') || pathname.startsWith('/attendance') || pathname.startsWith('/schedules') || pathname.startsWith('/monthly-planning')) {
    return getTeachingSidebar(0, isOneToOne);
  }
  if (pathname.startsWith('/people') || pathname.startsWith('/students') || pathname.startsWith('/teachers') || pathname.startsWith('/user-management') || pathname.startsWith('/leads')) {
    return getPeopleSidebar(isOneToOne);
  }
  if (pathname.startsWith('/finance') || pathname.startsWith('/payments') || pathname.startsWith('/salary') || pathname.startsWith('/expenses') || pathname.startsWith('/cash-advances') || pathname.startsWith('/staff-salaries')) {
    return getFinanceSidebar();
  }
  if (pathname.startsWith('/communication') || pathname.startsWith('/chat') || pathname.startsWith('/whatsapp') || pathname.startsWith('/notifications') || pathname.startsWith('/zoom') || pathname.startsWith('/hub')) {
    return getCommunicationSidebar(role);
  }
  if (pathname.startsWith('/settings') || pathname.startsWith('/organization') || pathname.startsWith('/finance-setup') || pathname.startsWith('/identity') || pathname.startsWith('/integrity')) {
    return getSettingsSidebar();
  }
  if (pathname.startsWith('/reports') || pathname.startsWith('/student-reports') || pathname.startsWith('/kpi') || pathname.startsWith('/report-card')) {
    return getReportsSidebar();
  }
  return getHomeSidebar(isOneToOne);
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

      { label: 'Settings', href: `${base}?tab=settings`, group: 'SETUP' },
      { label: 'Website', href: `${base}?tab=website` },

      { label: 'Syllabus', href: `${base}?tab=builder`, group: 'CONTENT' },
      { label: 'Resources', href: `${base}?tab=resources` },

      { label: 'Reg Form', href: `${base}?tab=reg-form`, group: 'OUTREACH' },
      { label: 'Marketing', href: `${base}?tab=marketing` },
      { label: 'Applicants', href: `${base}?tab=applicants` },

      { label: 'Classes', href: `${base}?tab=classes`, group: 'OPERATIONS' },
      { label: 'Roster', href: `${base}?tab=roster` },
      { label: 'Finance', href: `${base}?tab=finance` },

      { label: 'Attendance', href: `${base}?tab=attendance`, group: 'ACADEMICS' },
      { label: 'Exams & Quizzes', href: `${base}?tab=exams` },
      { label: 'Assignments', href: `${base}?tab=assignments` },
      { label: 'Certificates', href: `${base}?tab=certificates` },

      { label: 'Announcements', href: `${base}?tab=notifications`, group: 'COMMUNICATE' },
      { label: 'Group Chat', href: `${base}?tab=community` },
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

  const isOneToOne = activeDivision?.model_type === 'one_to_one';
  const isCourseDetail = isCourseDetailRoute(location.pathname);
  const sidebar = isCourseDetail
    ? getCourseDetailSidebar(location.pathname)
    : getSidebarForRoute(location.pathname, isOneToOne, activeRole);

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

  const isMobile = useIsMobile();

  // Group numbering for course detail sidebar
  const GROUP_NUMBERS: Record<string, number> = {
    SETUP: 1, CONTENT: 2, OUTREACH: 3, OPERATIONS: 4, ACADEMICS: 5, COMMUNICATE: 6,
  };

  // Collapsible group state (localStorage-backed)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('sidebar-collapsed-groups');
    if (stored) {
      try { return new Set(JSON.parse(stored)); } catch { /* ignore */ }
    }
    // On mobile, collapse all by default
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      const allGroups = new Set(sidebar.items.map(i => i.group).filter(Boolean) as string[]);
      return allGroups;
    }
    return new Set<string>();
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed-groups', JSON.stringify([...collapsedGroups]));
  }, [collapsedGroups]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  };

  // Group items for rendering
  const groupedItems = React.useMemo(() => {
    const groups: { group: string | null; items: SidebarNavItem[] }[] = [];
    let current: { group: string | null; items: SidebarNavItem[] } | null = null;

    for (const item of sidebar.items) {
      if (item.group && (!current || current.group !== item.group)) {
        current = { group: item.group, items: [item] };
        groups.push(current);
      } else if (!item.group) {
        groups.push({ group: null, items: [item] });
        current = null;
      } else {
        current?.items.push(item);
      }
    }
    return groups;
  }, [sidebar.items]);

  const renderNavItem = (item: SidebarNavItem) => {
    const active = isItemActive(item);
    return (
      <Link
        key={item.label + (item.href || '')}
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
        {item.badgeText && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
            {item.badgeText}
          </span>
        )}
      </Link>
    );
  };

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
        {isCourseDetail ? (
          // Course detail: render with collapsible numbered groups
          groupedItems.map((group, gi) => {
            if (!group.group) {
              // Standalone items (Overview)
              return group.items.map(item => (
                <div key={item.label}>{renderNavItem(item)}</div>
              ));
            }

            const isCollapsed = collapsedGroups.has(group.group);
            const num = GROUP_NUMBERS[group.group] || gi;
            const hasActiveItem = group.items.some(isItemActive);

            return (
              <div key={group.group}>
                <button
                  onClick={() => toggleGroup(group.group!)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 pt-3 pb-1 group cursor-pointer',
                    hasActiveItem && isCollapsed && 'text-lms-navy'
                  )}
                >
                  <span className="text-[9px] uppercase tracking-[.07em] text-lms-text-4 group-hover:text-lms-text-2 transition-colors">
                    {num} · {group.group}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 text-lms-text-4" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-lms-text-4" />
                  )}
                </button>
                {!isCollapsed && group.items.map(item => renderNavItem(item))}
              </div>
            );
          })
        ) : (
          // Non-course-detail: original rendering
          (() => {
            let currentGroup: string | undefined;
            return sidebar.items.map((item) => {
              const showGroup = item.group && item.group !== currentGroup;
              if (showGroup) currentGroup = item.group;
              const groupLabel = showGroup ? (
                <p key={`group-${item.group}`} className="text-[9px] uppercase tracking-[.07em] text-lms-text-4 px-2 pt-3 pb-1">
                  {item.group}
                </p>
              ) : null;
              return (
                <React.Fragment key={item.label + (item.href || '')}>
                  {groupLabel}
                  {renderNavItem(item)}
                </React.Fragment>
              );
            });
          })()
        )}
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
