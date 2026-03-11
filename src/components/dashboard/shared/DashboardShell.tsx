import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { IslamicDateData } from '@/lib/islamicDate';

import { RoleTopBar } from './RoleTopBar';
import { RoleBottomNav, type BottomNavTab } from './RoleBottomNav';
import { IslamicDateCard } from '../teacher/IslamicDateCard';
import { PrayerTimesWidget } from '../teacher/PrayerTimesWidget';

interface DashboardShellProps {
  /** Bottom nav tabs for mobile */
  tabs: BottomNavTab[];
  /** Primary content — left col on desktop */
  leftContent: React.ReactNode;
  /** Secondary content — right col on desktop */
  rightContent: React.ReactNode;
  /** Brand label in top bar */
  brandLabel?: string;
}

export function DashboardShell({ tabs, leftContent, rightContent, brandLabel }: DashboardShellProps) {
  const { profile, user } = useAuth();
  const [islamicDate, setIslamicDate] = useState<IslamicDateData | null>(null);
  const firstName = profile?.full_name?.split(' ')[0] || 'User';

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['role-unread-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from('notification_queue')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('status', 'pending');
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  return (
    <div className="min-h-screen bg-background relative font-sans">
      {/* Fixed top bar — mobile only */}
      <RoleTopBar brandLabel={brandLabel} />

      {/* Scrollable content */}
      <div className="p-4 pt-14 md:pt-4 pb-20 md:pb-6 space-y-2 max-w-[680px] md:max-w-[1100px] mx-auto">
        {/* Desktop greeting + notifications — hidden on mobile (top bar handles it) */}
        <div className="hidden md:flex items-center justify-between bg-card border border-border rounded-xl px-3 py-1.5">
          <p className="text-sm font-bold text-foreground truncate">Assalamu Alaikum, {firstName} 👋</p>
          <button className="relative bg-secondary border border-border rounded-lg w-9 h-9 flex items-center justify-center text-foreground shrink-0">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Islamic header — full width on both mobile & desktop */}
        <IslamicDateCard onIslamicDateLoaded={setIslamicDate} />

        {/* Prayer widget */}
        <PrayerTimesWidget islamicDate={islamicDate} />

        {/* Mobile: single column stacked (left then right) */}
        {/* Desktop: 2-col grid 55/45 */}
        <div className="md:grid md:grid-cols-[55%_45%] md:gap-6">
          <div className="space-y-2 md:space-y-4">
            {leftContent}
          </div>
          <div className="space-y-2 md:space-y-4 mt-2 md:mt-0 md:sticky md:top-[80px] md:self-start">
            {rightContent}
          </div>
        </div>
      </div>

      {/* Fixed bottom nav — mobile only */}
      <RoleBottomNav tabs={tabs} />
    </div>
  );
}
