import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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
import { StartClassButton } from "@/components/zoom/StartClassButton";

interface TodayFocusStudent {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  course: string;
  continueFrom: string;
  attendanceRate: number;
}

const AVATAR_COLORS = [
  'hsl(250 60% 65%)', 'hsl(340 60% 60%)', 'hsl(200 70% 55%)',
  'hsl(160 60% 45%)', 'hsl(30 70% 55%)', 'hsl(280 55% 60%)',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function TeacherDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [islamicDate, setIslamicDate] = useState<IslamicDateData | null>(null);
  const [timezone, setTimezone] = useState<string>('Asia/Karachi');
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

  const { data: focusStudents, isLoading } = useQuery({
    queryKey: ["teacher-today-focus", user?.id],
    queryFn: async (): Promise<TodayFocusStudent[]> => {
      if (!user?.id) return [];

      const { data: assignments } = await supabase
        .from("student_teacher_assignments")
        .select(`
          id,
          student_id,
          student:profiles!student_teacher_assignments_student_id_fkey(id, full_name),
          subject:subjects(name)
        `)
        .eq("teacher_id", user.id)
        .eq("status", "active");

      if (!assignments?.length) return [];

      const studentIds = assignments.map(a => (a.student as any)?.id).filter(Boolean);

      const { data: recentAttendance } = await supabase
        .from("attendance")
        .select("student_id, status, class_date, surah_name, ayah_from, lesson_covered")
        .eq("teacher_id", user.id)
        .in("student_id", studentIds)
        .order("class_date", { ascending: false });

      const attendanceByStudent = new Map<string, any[]>();
      (recentAttendance || []).forEach(a => {
        if (!attendanceByStudent.has(a.student_id)) attendanceByStudent.set(a.student_id, []);
        attendanceByStudent.get(a.student_id)!.push(a);
      });

      return assignments.map(a => {
        const student = a.student as any;
        const subject = a.subject as any;
        const sid = student?.id;
        const records = attendanceByStudent.get(sid) || [];
        const present = records.filter((r: any) => r.status === 'present').length;
        const total = records.length;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        const latestPresent = records.find((r: any) => r.status === 'present');
        const continueFrom = latestPresent
          ? `${latestPresent.surah_name || latestPresent.lesson_covered || 'N/A'}${latestPresent.ayah_from ? ` Ayah ${latestPresent.ayah_from}` : ''}`
          : subject?.name || 'Start';

        const name = student?.full_name || 'Student';
        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

        return {
          id: sid,
          name,
          initials,
          avatarColor: getAvatarColor(name),
          course: subject?.name || 'Quran',
          continueFrom,
          attendanceRate: rate,
        };
      });
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-12 bg-primary" />
        <div className="p-4 space-y-3 max-w-[680px] mx-auto pt-16">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative font-sans">
      {/* Fixed top bar — mobile only */}
      <TeacherTopBar />

      {/* Scrollable content — padded for fixed top + bottom bars */}
      <div className="p-4 pt-14 md:pt-4 pb-20 md:pb-6 space-y-2 max-w-[680px] mx-auto">
        {/* Desktop greeting + notifications */}
        <div className="hidden md:flex items-center justify-between bg-card border border-border rounded-xl px-3 py-1.5">
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

        {/* 1. Islamic date/time card (scrolls) */}
        <IslamicDateCard onIslamicDateLoaded={setIslamicDate} onTimezoneResolved={setTimezone} />

        {/* 2. Prayer widget (compact, collapsible) */}
        <PrayerTimesWidget islamicDate={islamicDate} timezone={timezone} />

        {/* 3. Next Class (compact) */}
        <NextClassCountdown />

        {/* 4. Quick Actions 2×2 */}
        <TeacherQuickActions />

        {/* 5. My Stats */}
        <TeacherStatsRow />

        {/* 6. Today's Focus — compact student list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-extrabold text-foreground">📋 Today's Focus</p>
            <button
              onClick={() => navigate('/students')}
              className="text-[11px] text-teal font-bold bg-transparent border-none cursor-pointer hover:underline"
            >
              All Students →
            </button>
          </div>

          {(!focusStudents?.length) ? (
            <div className="bg-card rounded-xl border border-border p-4 text-center text-muted-foreground">
              <p className="text-xs">No students assigned yet</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
              {focusStudents.map((s) => (
                <div
                  key={s.id}
                  className="px-3 py-2.5 flex items-center gap-2.5 hover:bg-secondary/30 cursor-pointer transition-colors"
                  onClick={() => navigate('/attendance?tab=1on1')}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-[10px] flex-shrink-0"
                    style={{ background: s.avatarColor }}
                  >
                    {s.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[13px] text-foreground truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {s.course} · {s.continueFrom}
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold flex-shrink-0 ${s.attendanceRate >= 85 ? 'text-teal' : 'text-gold'}`}>
                    {s.attendanceRate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fixed bottom nav — mobile only */}
      <TeacherBottomNav />
    </div>
  );
}
