import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { IslamicDateData } from "@/lib/islamicDate";

import { IslamicDateCard } from "./teacher/IslamicDateCard";
import { PrayerTimesWidget } from "./teacher/PrayerTimesWidget";
import { NextClassCountdown } from "./teacher/NextClassCountdown";
import { TeacherQuickActions } from "./teacher/TeacherQuickActions";
import { TeacherStatsRow } from "./teacher/TeacherStatsRow";
import { TeacherNotificationsSection } from "./teacher/TeacherNotificationsSection";
import { TeacherAttendanceComments } from "./teacher/TeacherAttendanceComments";
import { RescheduledTodayBanner } from "./teacher/RescheduledTodayBanner";
import { AiInsightsWidget } from "./AiInsightsWidget";
import { TeacherGroupAcademyWidgets } from "./teacher/TeacherGroupAcademyWidgets";
import { MyPerformanceSection } from "./teacher/MyPerformanceSection";
import { useDivision } from "@/contexts/DivisionContext";

export function TeacherDashboard() {
  const { user, profile } = useAuth();
  const { activeDivision } = useDivision();
  const modelType = (activeDivision?.model_type as string) || null;
  const isOneToOne = modelType !== 'group' && modelType !== 'recorded';
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
      <div className="p-4 pb-20 md:pb-6 space-y-2 max-w-[1100px] mx-auto">
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

        {/* Next Class — full-width block (1:1 only) */}
        {isOneToOne && <NextClassCountdown />}

        {/* Group / Recorded widgets */}
        {!isOneToOne && <TeacherGroupAcademyWidgets />}

        {/* Rescheduled sessions landing today */}
        <RescheduledTodayBanner />

        {/* Quick Actions */}
        <TeacherQuickActions />

        {/* My Stats */}
        <TeacherStatsRow />

        {/* My Performance */}
        <MyPerformanceSection />

        {/* Recent Sessions with Comments */}
        <TeacherAttendanceComments />

        {/* AI Insights */}
        <AiInsightsWidget />

        {/* Notifications & Alerts */}
        <div>
          <p className="text-[13px] font-extrabold text-foreground mb-2">🔔 Notifications & Alerts</p>
          <TeacherNotificationsSection />
        </div>
      </div>
    </div>
  );
}
