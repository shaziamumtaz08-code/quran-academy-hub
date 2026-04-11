import React, { useState } from 'react';
import { LogOut, Menu, User, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { NotificationBell } from '@/components/layout/NotificationBell';

interface MobileTopBarProps {
  title?: string;
  onMenuClick?: () => void;
  onLogout?: () => void;
}

export function MobileTopBar({ title = 'Al-Quran Time', onMenuClick, onLogout }: MobileTopBarProps) {
  const { profile, activeRole } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] || '';
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-11 bg-lms-navy flex items-center justify-between px-3 safe-area-inset">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </div>

        <span className="text-[13px] font-medium text-white truncate px-2">{title}</span>

        <div className="flex items-center gap-1.5">
          <RoleSwitcher />
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-7 h-7 rounded-full bg-lms-navy-hover flex items-center justify-center text-white/70 hover:text-white transition-colors"
            aria-label="User menu"
          >
            <User className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* User menu dropdown */}
      {userMenuOpen && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setUserMenuOpen(false)} />
          <div className="fixed top-11 right-2 z-[101] w-48 bg-white rounded-lg shadow-lg border border-lms-border py-1">
            <div className="px-3 py-2 border-b border-lms-border">
              <p className="text-[12px] font-medium text-lms-navy truncate">{profile?.full_name}</p>
              <p className="text-[10px] text-lms-text-3 capitalize">{activeRole?.replace(/_/g, ' ')}</p>
            </div>
            <button
              onClick={() => {
                setUserMenuOpen(false);
                onLogout?.();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </>
  );
}
