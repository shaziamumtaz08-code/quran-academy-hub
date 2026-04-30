import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { can, AppRole } from '@/lib/accessMatrix';
import {
  Plus, Search, ArrowLeft, ChevronDown, ChevronRight,
  Settings, BookOpen, Megaphone, Layers, GraduationCap, MessageSquare,
  LayoutDashboard
} from 'lucide-react';
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

function getHomeSidebar(isOneToOne?: boolean, role?: string | null, activeModelType?: string | null): { title: string; subtitle: string; items: SidebarNavItem[] } {
  const isStudent = role === 'student';
  if (role === 'teacher') {
    return {
      title: 'My Workspace',
      subtitle: 'Teacher dashboard',
      items: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'My Students', href: '/students' },
        { label: 'Today', href: '/teaching' },
      ],
    };
  }
  if (isStudent) {
    const isGroupStudent = activeModelType === 'group';
    return {
      title: isGroupStudent ? 'Group Academy Student' : 'Student Portal',
      subtitle: isGroupStudent ? 'Course learning workspace' : 'Learning workspace',
      items: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'My Courses', href: '/my-courses' },
        { label: 'Resources', href: '/resources' },
        { label: 'Communication', href: '/chat' },
      ],
    };
  }
  return {
    title: 'Academy',
    subtitle: 'Dashboard',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      ...(!isOneToOne && !isStudent ? [{ label: 'Group Academy', href: '/teaching?section=courses' }] : []),
      ...(!isStudent ? [{ label: '1-to-1', href: '/teaching?section=assignments' }] : []),
      ...(!isOneToOne && !isStudent ? [{ label: 'Recorded', href: '/teaching?section=recorded' }] : []),
    ],
  };
}

function getTeachingSidebar(courseCount: number, isOneToOne?: boolean, role?: string | null): { title: string; subtitle: string; items: SidebarNavItem[]; showNewCourse?: boolean } {
  if (role === 'teacher') {
    return {
      title: 'Teaching',
      subtitle: 'Your classes',
      items: [
        { label: 'My Classes', href: '/teaching' },
        { label: 'Schedules', href: '/my-schedule' },
        { label: 'Attendance', href: '/attendance' },
        { label: 'Planning', href: '/monthly-planning' },
        { label: 'Lessons', href: '/lessons' },
        { label: 'Assignments', href: '/assignments' },
      ],
    };
  }
  const items: SidebarNavItem[] = isOneToOne
    ? [
        { label: '1-to-1 Assignments', href: '/teaching?section=assignments' },
      ]
    : [
        { label: 'All Courses', href: '/teaching?section=courses' },
        { label: 'AI Teaching OS', href: '/teaching-os', badgeText: 'AI' },
        { label: 'Quiz Engine', href: '/quiz-engine', badgeText: 'AI' },
      ];
  return {
    title: isOneToOne ? '1-to-1 Teaching' : 'Course Management',
    subtitle: isOneToOne ? 'Assignments & schedules' : `${courseCount} active courses`,
    items,
    showNewCourse: !isOneToOne,
  };
}

function getPeopleSidebar(isOneToOne?: boolean, role?: string | null): { title: string; subtitle: string; items: SidebarNavItem[]; showSearch?: boolean } {
  if (role === 'teacher') {
    return {
      title: 'People',
      subtitle: '',
      items: [
        { label: 'My Students', href: '/students' },
      ],
      showSearch: false,
    };
  }
  const r = (role || 'student') as AppRole;
  const canStaff = can(r, 'user_management', 'view');
  const canLeads = can(r, 'leads', 'view');
  return {
    title: 'People',
    subtitle: '',
    items: [
      ...(can(r, 'students', 'view') ? [{ label: 'Students', href: '/students' }] : []),
      ...(can(r, 'teachers', 'view') ? [{ label: 'Teachers', href: '/teachers' }] : []),
      ...(canStaff ? [{ label: 'Staff', href: '/user-management?mode=staff' }] : []),
      ...(isOneToOne && canLeads ? [{ label: 'Leads', href: '/leads', badge: 0, badgeType: 'alert' as const }] : []),
    ],
    showSearch: true,
  };
}

function getFinanceSidebar(isOneToOne?: boolean, role?: string | null): { title: string; subtitle: string; items: SidebarNavItem[] } {
  if (role === 'teacher') {
    return {
      title: 'Finance',
      subtitle: '',
      items: [
        { label: 'My Salary', href: '/salary' },
      ],
    };
  }
  return {
    title: 'Finance',
    subtitle: '',
    items: [
      { label: 'Overview', href: '/finance' },
      { label: 'Fee Plans', href: '/finance?section=fee-setup' },
      { label: 'Payments', href: '/finance?section=payments' },
      ...(isOneToOne ? [
        { label: 'Salaries', href: '/finance?section=salaries' },
      ] : []),
      ...(!isOneToOne ? [
        { label: 'Teacher Payouts', href: '/finance?section=teacher-payouts' },
      ] : []),
      { label: 'Expenses', href: '/finance?section=expenses' },
      ...(isOneToOne ? [
        { label: 'Cash Advances', href: '/finance?section=advances' },
      ] : []),
    ],
  };
}

function getCommunicationSidebar(role?: string | null): { title: string; subtitle: string; items: SidebarNavItem[] } {
  const isAdmin = role === 'super_admin' || role === 'admin' || role?.startsWith('admin_');
  const isStudentOrTeacher = role === 'student' || role === 'teacher';
  return {
    title: 'Communication',
    subtitle: '',
    items: [
      { label: 'Group Chat', href: '/chat' },
      ...(isStudentOrTeacher ? [{ label: 'Direct Messages', href: '/chat?filter=dm' }] : []),
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

function getReportsSidebar(role?: string | null): { title: string; subtitle: string; items: SidebarNavItem[] } {
  if (role === 'teacher') {
    return {
      title: 'Reports',
      subtitle: '',
      items: [
        { label: 'Student Reports', href: '/student-reports' },
      ],
    };
  }
  return {
    title: 'Reports',
    subtitle: '',
    items: [
      { label: 'Executive Dashboard', href: '/reports?section=executive', group: 'OVERVIEW' },
      { label: 'Attendance Reports', href: '/reports?section=attendance', group: 'ANALYTICS' },
      { label: 'Fee & Financial', href: '/reports?section=fees' },
      { label: 'Student Engagement', href: '/reports?section=engagement' },
      { label: 'Teacher Performance', href: '/reports?section=teacher' },
      { label: 'Accountability', href: '/reports?section=accountability' },
      { label: 'Course / Batch', href: '/reports?section=courses' },
      { label: 'Activity Logs', href: '/reports?section=logs', group: 'TOOLS' },
      { label: 'Alerts & Automation', href: '/reports?section=alerts' },
      { label: 'Custom Report Builder', href: '/reports?section=custom' },
    ],
  };
}

/* ─── Route to section mapping ─── */
function getSidebarForRoute(pathname: string, isOneToOne?: boolean, role?: string | null, activeModelType?: string | null) {
  const isStudent = role === 'student';
  if (isStudent && pathname.startsWith('/resources')) {
    return getHomeSidebar(isOneToOne, role, activeModelType);
  }
  // Students should never see Teaching sidebar
  if (!isStudent && (pathname.startsWith('/teaching') || pathname.startsWith('/courses') || pathname.startsWith('/assignments') || pathname.startsWith('/subjects') || pathname.startsWith('/attendance') || pathname.startsWith('/schedules') || pathname.startsWith('/monthly-planning'))) {
    return getTeachingSidebar(0, isOneToOne, role);
  }
  if (pathname.startsWith('/people') || pathname.startsWith('/students') || pathname.startsWith('/teachers') || pathname.startsWith('/user-management') || pathname.startsWith('/leads')) {
    return getPeopleSidebar(isOneToOne, role);
  }
  if (pathname.startsWith('/finance') || pathname.startsWith('/payments') || pathname.startsWith('/salary') || pathname.startsWith('/expenses') || pathname.startsWith('/cash-advances') || pathname.startsWith('/staff-salaries')) {
    return getFinanceSidebar(isOneToOne, role);
  }
  if (!isStudent && (pathname.startsWith('/communication') || pathname.startsWith('/chat') || pathname.startsWith('/whatsapp') || pathname.startsWith('/notifications') || pathname.startsWith('/zoom') || pathname.startsWith('/hub'))) {
    return getCommunicationSidebar(role);
  }
  if (pathname.startsWith('/settings') || pathname.startsWith('/organization') || pathname.startsWith('/finance-setup') || pathname.startsWith('/identity') || pathname.startsWith('/integrity')) {
    return getSettingsSidebar();
  }
  if (pathname.startsWith('/reports') || pathname.startsWith('/student-reports') || pathname.startsWith('/kpi') || pathname.startsWith('/report-card')) {
    return getReportsSidebar(role);
  }
  return getHomeSidebar(isOneToOne, role, activeModelType);
}

/* ─── Course Detail sidebar ─── */
function isCourseDetailRoute(pathname: string) {
  return /^\/(courses|academics\/courses)\/[^/]+$/.test(pathname);
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
      { label: 'Classes', href: `${base}?tab=classes` },
      { label: 'Roster', href: `${base}?tab=roster` },
      { label: 'Finance', href: `${base}?tab=finance` },

      { label: 'Syllabus', href: `${base}?tab=builder`, group: 'CONTENT' },
      { label: 'Resources', href: `${base}?tab=resources` },

      { label: 'Reg Form', href: `${base}?tab=reg-form`, group: 'OUTREACH' },
      { label: 'Marketing', href: `${base}?tab=marketing` },
      { label: 'Applicants', href: `${base}?tab=applicants` },

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
  const isStudentCourseDetail = /^\/my-courses\/[^/]+$/.test(location.pathname);
  const courseIdMatch = location.pathname.match(/\/(?:courses|my-courses)\/([^/]+)$/);
  const courseId = courseIdMatch?.[1];

  const { data: courseInfo } = useQuery({
    queryKey: ['sidebar-course-name', courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data } = await supabase.from('courses').select('name').eq('id', courseId).maybeSingle();
      return data;
    },
    enabled: !!courseId && isCourseDetail,
    staleTime: 60_000,
  });

  const baseSidebar = isCourseDetail
    ? getCourseDetailSidebar(location.pathname)
    : getSidebarForRoute(location.pathname, isOneToOne, activeRole, activeDivision?.model_type ?? null);

  const sidebar = isCourseDetail && courseInfo
    ? { ...baseSidebar, title: courseInfo.name || 'Course', subtitle: isStudentCourseDetail ? 'Student course workspace' : 'Course workspace' }
    : baseSidebar;
  const isStudentDashboardHome = activeRole === 'student' && location.pathname === '/dashboard';
  const reportsOnlySecondarySidebar =
    location.pathname.startsWith('/reports') ||
    location.pathname.startsWith('/student-reports') ||
    location.pathname.startsWith('/kpi') ||
    location.pathname.startsWith('/report-card');
  const visibleSidebar = isStudentDashboardHome
    ? {
        ...sidebar,
        items: sidebar.items.filter((item) => item.label === 'Dashboard'),
      }
    : sidebar;

  const isItemActive = (item: SidebarNavItem) => {
    if (!item.href) return false;
    const [path, query] = item.href.split('?');
    if (item.href === '/my-courses') {
      return location.pathname === '/my-courses' || location.pathname.startsWith('/my-courses/');
    }
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
  const SECTION_ICONS: Record<string, { icon: typeof Settings; colorClass: string; bgClass: string }> = {
    SETUP:       { icon: Settings, colorClass: 'text-blue-600', bgClass: 'bg-blue-50' },
    CONTENT:     { icon: BookOpen, colorClass: 'text-violet-600', bgClass: 'bg-violet-50' },
    OUTREACH:    { icon: Megaphone, colorClass: 'text-amber-600', bgClass: 'bg-amber-50' },
    ACADEMICS:   { icon: GraduationCap, colorClass: 'text-rose-600', bgClass: 'bg-rose-50' },
    COMMUNICATE: { icon: MessageSquare, colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50' },
  };

  const GROUP_NUMBERS: Record<string, number> = {
    SETUP: 1, CONTENT: 2, OUTREACH: 3, ACADEMICS: 4, COMMUNICATE: 5,
  };

  // Collapsible group state (localStorage-backed)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('sidebar-collapsed-groups');
    if (stored) {
      try { return new Set(JSON.parse(stored)); } catch { /* ignore */ }
    }
    // On mobile, collapse all by default
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      const allGroups = new Set(visibleSidebar.items.map(i => i.group).filter(Boolean) as string[]);
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

    for (const item of visibleSidebar.items) {
      if (item.group && (!current || current.group !== item.group)) {
        // New named group starts
        current = { group: item.group, items: [item] };
        groups.push(current);
      } else if (item.group && current && current.group === item.group) {
        // Same group continues
        current.items.push(item);
      } else if (!item.group && current && current.group) {
        // Item without group following a named group → stays in that group
        current.items.push(item);
      } else {
        // Standalone item (no current group context)
        groups.push({ group: null, items: [item] });
        current = null;
      }
    }
    return groups;
  }, [visibleSidebar.items]);

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

  if (!isCourseDetail && !reportsOnlySecondarySidebar) {
    return null;
  }

  if (!isCourseDetail && visibleSidebar.items.length === 0) {
    return null;
  }

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
        <h2 className="text-[12.5px] font-medium text-lms-navy truncate">{visibleSidebar.title}</h2>
        {visibleSidebar.subtitle && (
          <p className="text-[10px] text-lms-text-3 mt-0.5">{visibleSidebar.subtitle}</p>
        )}
      </div>

      {/* Search (People only) */}
      {'showSearch' in visibleSidebar && visibleSidebar.showSearch && (
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
                <div key={item.label} className="mb-1">
                  <Link
                    to={item.href || '#'}
                    className={cn(
                      'flex items-center gap-2 px-2 py-[7px] rounded-md text-[11.5px] transition-colors',
                      isItemActive(item)
                        ? 'bg-[#eef2fa] text-lms-navy font-medium'
                        : 'text-lms-text-2 hover:bg-lms-surface'
                    )}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                </div>
              ));
            }

            const isCollapsed = collapsedGroups.has(group.group);
            const num = GROUP_NUMBERS[group.group] || gi;
            const hasActiveItem = group.items.some(isItemActive);
            const sectionConfig = SECTION_ICONS[group.group];
            const SectionIcon = sectionConfig?.icon || Settings;

            return (
              <div key={group.group} className="mt-1">
                <button
                  onClick={() => toggleGroup(group.group!)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-2 rounded-md group cursor-pointer transition-colors min-h-[36px]',
                    hasActiveItem && isCollapsed
                      ? sectionConfig?.bgClass || 'bg-muted'
                      : 'hover:bg-lms-surface'
                  )}
                >
                  <SectionIcon className={cn('h-3.5 w-3.5 shrink-0', sectionConfig?.colorClass || 'text-muted-foreground')} />
                  <span className={cn(
                    'text-[10px] uppercase tracking-[.07em] flex-1 text-left font-medium',
                    hasActiveItem ? 'text-lms-navy' : 'text-lms-text-4 group-hover:text-lms-text-2'
                  )}>
                    {num} · {group.group}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 text-lms-text-4 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-lms-text-4 shrink-0" />
                  )}
                </button>
                {!isCollapsed && (
                  <div className="ml-2 pl-3 border-l-2 border-lms-border/50 mt-0.5 space-y-0.5">
                    {group.items.map(item => {
                      const active = isItemActive(item);
                      return (
                        <Link
                          key={item.label + (item.href || '')}
                          to={item.href || '#'}
                          className={cn(
                            'flex items-center gap-2 px-2 py-[6px] rounded-md text-[11px] transition-colors',
                            active
                              ? 'bg-[#eef2fa] text-lms-navy font-medium'
                              : 'text-lms-text-2 hover:bg-lms-surface'
                          )}
                        >
                          <div className={cn(
                            'h-1.5 w-1.5 rounded-full shrink-0',
                            active ? (sectionConfig?.colorClass || 'bg-primary') : 'bg-lms-text-4/40'
                          )} style={active && sectionConfig ? { backgroundColor: 'currentColor' } : undefined} />
                          <span className="truncate">{item.label}</span>
                          {item.badgeText && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                              {item.badgeText}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // Non-course-detail: original rendering
          (() => {
            let currentGroup: string | undefined;
            return visibleSidebar.items.map((item) => {
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
      {'showNewCourse' in visibleSidebar && visibleSidebar.showNewCourse && (
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
