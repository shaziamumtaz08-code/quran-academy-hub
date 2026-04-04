import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { IslamicDateData } from "@/lib/islamicDate";

import { TeacherTopBar } from "./teacher/TeacherTopBar";
import { IslamicDateCard } from "./teacher/IslamicDateCard";
import { PrayerTimesWidget } from "./teacher/PrayerTimesWidget";
import { NextClassCountdown } from "./teacher/NextClassCountdown";
import { TeacherQuickActions } from "./teacher/TeacherQuickActions";
import { TeacherStatsRow } from "./teacher/TeacherStatsRow";
import { TeacherBottomNav } from "./teacher/TeacherBottomNav";
import { TeacherNotificationsSection } from "./teacher/TeacherNotificationsSection";

export function TeacherDashboard() {
  const { user, profile } = useAuth();
  const [islamicDate, setIslamicDate] = useState<IslamicDateData | null>(null);
  const [timezone, setTimezone] = useState<string>("Asia/Karachi");
  const firstName = profile?.full_name?.split(" ")[0] || "Teacher";

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["teacher-unread-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from("notification_queue")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("status", "pending");
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
  });

  return (
    <div className="relative font-sans">
      <div className="p-4 pb-20 md:pb-6 space-y-2 max-w-[680px] mx-auto">
        {/* Greeting */}
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-1.5">
          <p className="text-sm font-bold text-foreground truncate">Assalamu Alaikum, {firstName} 👋</p>
          <button className="relative bg-secondary border border-border rounded-lg w-9 h-9 flex items-center justify-center text-foreground shrink-0">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Islamic date */}
        <IslamicDateCard onIslamicDateLoaded={setIslamicDate} onTimezoneResolved={setTimezone} />

        {/* Prayer widget */}
        <PrayerTimesWidget islamicDate={islamicDate} timezone={timezone} />

        {/* Next Class — single block with Start inside */}
        <NextClassCountdown />

        {/* Quick Actions */}
        <TeacherQuickActions />

        {/* My Stats */}
        <TeacherStatsRow />

        {/* Notifications & Alerts */}
        <div>
          <p className="text-[13px] font-extrabold text-foreground mb-2">🔔 Notifications & Alerts</p>
          <TeacherNotificationsSection />
        </div>
      </div>
    </div>
    </div>
  );
}
