import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import type { IslamicDateData } from "@/lib/islamicDate";

import { IslamicDateCard } from "./teacher/IslamicDateCard";
import { PrayerBar } from "./teacher/PrayerBar";
import { NextClassCountdown } from "./teacher/NextClassCountdown";
import { TeacherQuickLinks } from "./teacher/TeacherQuickLinks";
import { TeacherStatsRow } from "./teacher/TeacherStatsRow";
import { TeacherActionCentre } from "./teacher/TeacherActionCentre";
import { TeacherNotificationsSection } from "./teacher/TeacherNotificationsSection";
import { TeacherAttendanceComments } from "./teacher/TeacherAttendanceComments";
import { RecentSessionsCard } from "./teacher/RecentSessionsCard";
import { SalaryLeaveCard } from "./teacher/SalaryLeaveCard";
import { WorkHubCard } from "./teacher/WorkHubCard";
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
      <div className="p-3 md:p-4 pb-6 space-y-2 max-w-[1100px] mx-auto">
        {/* Prayer Bar — greeting + Islamic date + prayer pills + bell */}
        <PrayerBar
          firstName={firstName}
          islamicDate={islamicDate}
          timezone={timezone}
          unreadCount={unreadCount}
        />

        {/* Hidden — keeps Islamic date + timezone data loading without UI duplication */}
        <IslamicDateCard hidden onIslamicDateLoaded={setIslamicDate} onTimezoneResolved={setTimezone} />


        {/* Next Class — full-width block (1:1 only) */}
        {isOneToOne && <NextClassCountdown />}

        {/* Group / Recorded widgets */}
        {!isOneToOne && <TeacherGroupAcademyWidgets />}

        {/* Rescheduled sessions landing today */}
        <RescheduledTodayBanner />

        {/* 3-column grid: Quick links · My stats · Action centre + Spotlight */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <TeacherQuickLinks />
          <TeacherStatsRow />
          <TeacherActionCentre />
        </div>

        {/* 2-col row: Recent sessions (2fr) + Salary/Leave & Work Hub (1fr) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2">
            <RecentSessionsCard />
          </div>
          <div className="flex flex-col gap-3">
            <SalaryLeaveCard />
            <WorkHubCard />
          </div>
        </div>

        {/* My Performance */}
        <MyPerformanceSection />

        {/* Recent Sessions with full comment threads */}
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
