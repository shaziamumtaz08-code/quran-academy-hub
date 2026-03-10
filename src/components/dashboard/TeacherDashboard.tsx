import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { IslamicDateData } from "@/lib/islamicDate";

import { TeacherTopBar } from "./teacher/TeacherTopBar";
import { NextClassCountdown } from "./teacher/NextClassCountdown";
import { PrayerTimesWidget } from "./teacher/PrayerTimesWidget";
import { TeacherQuickActions } from "./teacher/TeacherQuickActions";
import { TeacherStatsRow } from "./teacher/TeacherStatsRow";
import { TeacherBottomNav } from "./teacher/TeacherBottomNav";

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [islamicDate, setIslamicDate] = useState<IslamicDateData | null>(null);

  // Fetch students for Today's Focus
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

      // Fetch recent attendance for last lesson info
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
        <Skeleton className="h-28 rounded-b-2xl" />
        <div className="p-4 space-y-4 max-w-[680px] mx-auto">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative font-sans">
      {/* Islamic Header - scrolls with content */}
      <TeacherTopBar onIslamicDateLoaded={setIslamicDate} />

      {/* Scrollable Content - padded for fixed bottom nav on mobile */}
      <div className="p-4 pb-24 md:pb-8 space-y-4 max-w-[680px] mx-auto">
        {/* Next Class Countdown */}
        <NextClassCountdown />

        {/* Prayer Times Widget */}
        <PrayerTimesWidget islamicDate={islamicDate} />

        {/* Stats Row — above Quick Actions */}
        <TeacherStatsRow />

        {/* Quick Actions */}
        <TeacherQuickActions />

        {/* Today's Focus — compact student list */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[15px] font-extrabold text-foreground">📋 Today's Focus</p>
            <button
              onClick={() => navigate('/students')}
              className="text-xs text-teal font-bold bg-transparent border-none cursor-pointer hover:underline"
            >
              All Students →
            </button>
          </div>

          {(!focusStudents?.length) ? (
            <div className="bg-card rounded-2xl border border-border p-6 text-center text-muted-foreground">
              <p className="text-sm">No students assigned yet</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {focusStudents.map((s) => (
                <div
                  key={s.id}
                  className="px-3.5 py-3 flex items-center gap-3 hover:bg-secondary/30 cursor-pointer transition-colors"
                  onClick={() => navigate('/attendance?tab=1on1')}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0"
                    style={{ background: s.avatarColor }}
                  >
                    {s.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.course} · Continue: {s.continueFrom}
                    </p>
                  </div>
                  <span className={`text-xs font-bold flex-shrink-0 ${s.attendanceRate >= 85 ? 'text-teal' : 'text-gold'}`}>
                    {s.attendanceRate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Nav — mobile only, hidden on md+ */}
      <TeacherBottomNav />
    </div>
  );
}
