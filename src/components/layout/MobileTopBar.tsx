import React from 'react';
import { Bell, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface MobileTopBarProps {
  title?: string;
}

export function MobileTopBar({ title = 'Al-Quran Time' }: MobileTopBarProps) {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] || '';

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-11 bg-lms-navy flex items-center justify-between px-3 safe-area-inset">
      <div className="flex-1" />
      <span className="text-[13px] font-medium text-white truncate">{title}</span>
      <div className="flex-1 flex items-center justify-end gap-2">
        <button className="relative text-white/70 hover:text-white">
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        <div className="w-6 h-6 rounded-full bg-lms-navy-hover flex items-center justify-center">
          <User className="h-3 w-3 text-white/70" />
        </div>
      </div>
    </div>
  );
}
