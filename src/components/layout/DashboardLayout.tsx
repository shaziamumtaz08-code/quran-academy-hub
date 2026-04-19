import React, { ReactNode, useState, useEffect, useMemo, createContext, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useDivision } from '@/contexts/DivisionContext';
import { Button } from '@/components/ui/button';
import { PageBreadcrumb } from '@/components/layout/PageBreadcrumb';
import { useIsMobile } from '@/hooks/use-mobile';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { DivisionSwitcher } from '@/components/layout/DivisionSwitcher';
import { LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import logoLight from '@/assets/logo-light.png';
import logoDark from '@/assets/logo-dark.jpg';

import { NavRail, buildRailNav } from '@/components/layout/NavRail';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { MobileTopBar } from '@/components/layout/MobileTopBar';

const DashboardLayoutContext = createContext(false);
export const useIsInsideDashboard = () => useContext(DashboardLayoutContext);

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

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, logout, isLoading, activeRole } = useAuth();
  const { activeDivision, activeBranch } = useDivision();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);

  // Close tablet drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
    setTabletDrawerOpen(false);
  }, [location.pathname]);

  const railItems = useMemo(() => buildRailNav(activeRole), [activeRole]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-lms-surface flex items-center justify-center">
        <div className="text-center">
          <img src={logoLight} alt="Al-Quran Time Academy" className="h-24 w-24 object-contain mx-auto mb-4 animate-pulse" />
          <p className="text-lms-text-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-lms-surface">
        <header className="fixed top-0 left-0 right-0 z-50 h-11 bg-lms-navy flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src={logoDark} alt="Al-Quran Time Academy" className="h-7 w-7 object-contain rounded" />
            <span className="text-[13px] font-medium text-white">Al-Quran Time Academy</span>
          </div>
          <Link to="/login">
            <Button size="sm" className="h-7 text-[11px] bg-lms-accent hover:bg-lms-accent/90 text-white border-0 rounded-md">Sign In</Button>
          </Link>
        </header>
        <main className="min-h-screen pt-11 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <img src={logoLight} alt="Al-Quran Time Academy" className="w-28 h-28 object-contain mx-auto mb-6" />
            <h2 className="text-[16px] font-medium text-lms-navy mb-2">Welcome to Al-Quran Time Academy</h2>
            <p className="text-lms-text-3 text-[13px] mb-6">Please sign in to access the Learning Management System.</p>
            <Link to="/login">
              <Button className="bg-lms-navy hover:bg-lms-navy-hover text-white rounded-md px-5 py-2 text-[13px]">Sign In to Continue</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isDashboard = location.pathname === '/dashboard';

  /* ─── MOBILE (<768px) ─── */
  if (isMobile) {
    return (
      <DashboardLayoutContext.Provider value={true}>
        <div className="min-h-screen bg-lms-surface">
          {mobileDrawerOpen && (
            <>
              <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setMobileDrawerOpen(false)} />
              <div className="fixed top-0 left-0 z-[61] h-full w-[88vw] max-w-[360px] bg-white flex animate-in slide-in-from-left duration-200 shadow-xl">
                {/* Rail column (icons) */}
                <div className="w-14 shrink-0 bg-lms-navy flex flex-col">
                  <div className="h-12 flex items-center justify-center border-b border-white/10">
                    <img src={logoDark} alt="Al-Quran Time" className="h-7 w-7 object-contain rounded" />
                  </div>
                  <nav className="flex-1 overflow-y-auto py-2 space-y-1">
                    {railItems.map((item) => {
                      const active = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.href + item.label}
                          to={item.href}
                          onClick={() => setMobileDrawerOpen(false)}
                          className={cn(
                            'flex flex-col items-center gap-0.5 mx-1 px-1 py-2 rounded-md transition-colors',
                            active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                          <span className="text-[8.5px] leading-tight text-center">{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                  <button
                    onClick={() => { setMobileDrawerOpen(false); handleLogout(); }}
                    className="h-12 flex items-center justify-center text-red-300 hover:text-red-200 border-t border-white/10"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </button>
                </div>

                {/* White sub-menu (AppSidebar) */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                  <div className="px-3 py-2 border-b border-lms-border">
                    <DivisionSwitcher />
                  </div>
                  <div
                    className="flex-1 overflow-y-auto"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('a')) setMobileDrawerOpen(false);
                    }}
                  >
                    <AppSidebar />
                  </div>
                </div>
              </div>
            </>
          )}
          <MobileTopBar
            title={isDashboard ? 'Al-Quran Time' : undefined}
            onMenuClick={() => setMobileDrawerOpen(true)}
            onLogout={handleLogout}
          />
          <main className={cn('pb-16', isDashboard ? 'pt-11' : 'pt-11')}>
            <div className={isDashboard ? '' : 'p-3'}>
              {!isDashboard && <PageBreadcrumb />}
              {children}
            </div>
          </main>
          <MobileBottomNav role={activeRole} />
        </div>
      </DashboardLayoutContext.Provider>
    );
  }

  /* ─── TABLET (768–1023px) ─── */
  const isTablet = typeof window !== 'undefined' && window.innerWidth < 1024;
  if (isTablet) {
    return (
      <DashboardLayoutContext.Provider value={true}>
        <div className="min-h-screen bg-lms-surface flex">
          {/* Rail */}
          <NavRail items={railItems} />

          {/* Tablet drawer overlay */}
          {tabletDrawerOpen && (
            <>
              <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setTabletDrawerOpen(false)} />
              <div className="fixed top-0 left-14 z-30 h-full">
                <AppSidebar />
              </div>
            </>
          )}

          {/* Content */}
          <main className="flex-1 ml-14 min-h-screen">
            <header className="sticky top-0 z-20 h-11 bg-white border-b border-lms-border flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                {activeBranch && activeDivision && (
                  <span className="text-[10px] text-lms-text-4">
                    {activeBranch.name} <span className="text-lms-text-2 font-medium">› {activeDivision.name}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <DivisionSwitcher />
                <RoleSwitcher />
                <button
                  onClick={handleLogout}
                  className="text-lms-text-3 hover:text-lms-text-1 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </header>
            <div className={isDashboard ? '' : 'p-4'}>
              {!isDashboard && <PageBreadcrumb />}
              {children}
            </div>
          </main>
        </div>
      </DashboardLayoutContext.Provider>
    );
  }

  /* ─── DESKTOP (1024px+) ─── */
  return (
    <DashboardLayoutContext.Provider value={true}>
      <div className="h-screen bg-lms-surface flex overflow-hidden">
        {/* Rail (56px → using w-14) */}
        <NavRail items={railItems} />

        {/* Sidebar (200px) */}
        <div className="ml-14 h-full">
          <AppSidebar />
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Sticky top bar */}
          <header className="shrink-0 h-11 bg-white border-b border-lms-border flex items-center justify-between px-5">
            <div className="flex items-center gap-2">
              <PageBreadcrumb />
            </div>
            <div className="flex items-center gap-2">
              <DivisionSwitcher />
              <RoleSwitcher />
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-lms-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-lms-surface flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-lms-text-2" />
                  </div>
                  <div className="hidden xl:block">
                    <p className="text-[11px] font-medium text-lms-navy leading-tight truncate max-w-[120px]">{profile.full_name}</p>
                    <p className="text-[9px] text-lms-text-3">{activeRole ? ROLE_LABELS[activeRole] : 'User'}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-lms-text-3 hover:text-lms-text-1 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </header>

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto">
            <div className={isDashboard ? 'p-4' : 'p-5'}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardLayoutContext.Provider>
  );
}
