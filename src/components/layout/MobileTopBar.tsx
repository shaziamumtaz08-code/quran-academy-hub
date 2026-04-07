import React from 'react';
import { Bell, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface MobileTopBarProps {
  title?: string;
  onMenuClick?: () => void;
  onLogout?: () => void;
}

export function MobileTopBar({ title = 'Al-Quran Time', onMenuClick, onLogout }: MobileTopBarProps) {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-11 bg-lms-navy flex items-center justify-between px-3 safe-area-inset">
      <div className="flex-1 flex items-center">
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
      <div className="flex-1 flex items-center justify-end gap-2">
        <button type="button" className="relative text-white/70 hover:text-white">
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-6 h-6 rounded-full bg-lms-navy-hover flex items-center justify-center text-white/70 hover:text-white transition-colors"
          aria-label={firstName ? `Sign out ${firstName}` : 'Sign out'}
          title="Sign out"
        >
          <LogOut className="h-3 w-3" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
