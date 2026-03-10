import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

import { TeacherTopBar } from "./teacher/TeacherTopBar";
import { MissedAttendanceBanner } from "./teacher/MissedAttendanceBanner";
import { NextClassCountdown } from "./teacher/NextClassCountdown";
import { TeacherStudentCard, getAvatarColor } from "./teacher/TeacherStudentCard";
import type { StudentData } from "./teacher/TeacherStudentCard";
import { TeacherAttendanceModal } from "./teacher/TeacherAttendanceModal";
import { TeacherQuickActions } from "./teacher/TeacherQuickActions";
import { TeacherStatsRow } from "./teacher/TeacherStatsRow";
import { TeacherBottomNav } from "./teacher/TeacherBottomNav";

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<StudentData | null>(null);

  // Fetch students with attendance data
  const { data: students, isLoading } = useQuery({
    queryKey: ["teacher-students", user?.id],
    queryFn: async (): Promise<StudentData[]> => {
      if (!user?.id) return [];

      // Get active assignments
      const { data: assignments } = await supabase
        .from("student_teacher_assignments")
        .select(`
          id,
          student_id,
          student:profiles!student_teacher_assignments_student_id_fkey(id, full_name, age, gender),
          subject:subjects(name),
          schedules(day_of_week, is_active)
        `)
        .eq("teacher_id", user.id)
        .eq("status", "active");

      if (!assignments?.length) return [];

      // Fetch attendance for all students in one query
      const studentIds = assignments.map(a => (a.student as any)?.id).filter(Boolean);
      const twoWeeksAgo = format(subDays(new Date(), 14), 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data: allAttendance } = await supabase
        .from("attendance")
        .select("student_id, status, class_date, lesson_covered, surah_name, ayah_from, ayah_to")
        .eq("teacher_id", user.id)
        .in("student_id", studentIds);

      const attendanceByStudent = new Map<string, any[]>();
      (allAttendance || []).forEach(a => {
        if (!attendanceByStudent.has(a.student_id)) attendanceByStudent.set(a.student_id, []);
        attendanceByStudent.get(a.student_id)!.push(a);
      });

      // Get latest monthly plans
      const { data: plans } = await supabase
        .from("student_monthly_plans")
        .select("student_id, daily_target, primary_marker")
        .eq("teacher_id", user.id)
        .in("student_id", studentIds)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      const planByStudent = new Map<string, any>();
      (plans || []).forEach(p => {
        if (!planByStudent.has(p.student_id)) planByStudent.set(p.student_id, p);
      });

      return assignments.map(a => {
        const student = a.student as any;
        const subject = a.subject as any;
        const sid = student?.id;
        const records = attendanceByStudent.get(sid) || [];
        const present = records.filter((r: any) => r.status === 'present').length;
        const total = records.length;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        // Latest lesson
        const sorted = [...records].filter((r: any) => r.status === 'present').sort((x: any, y: any) => y.class_date.localeCompare(x.class_date));
        const latest = sorted[0];
        const lastLesson = latest
          ? `${latest.surah_name || latest.lesson_covered || 'N/A'}${latest.ayah_from ? ` Ayah ${latest.ayah_from}` : ''}`
          : null;

        // Current position from latest attendance
        const currentPosition = latest
          ? `${latest.surah_name || 'N/A'}${latest.ayah_from ? ` Ayah ${latest.ayah_from}` : ''}`
          : subject?.name || 'Quran';

        // Missed sessions: scheduled days in last 14 days with no attendance
        const schedules = (a.schedules as any[]) || [];
        const activeDays = schedules.filter((s: any) => s.is_active).map((s: any) => s.day_of_week);
        const attendedDates = new Set(records.map((r: any) => r.class_date));
        let missedCount = 0;
        for (let i = 1; i <= 14; i++) {
          const d = subDays(new Date(), i);
          if (activeDays.includes(DAY_NAMES[d.getDay()])) {
            if (!attendedDates.has(format(d, 'yyyy-MM-dd'))) missedCount++;
          }
        }

        // Pace from plan
        const plan = planByStudent.get(sid);
        const pace = plan ? `${plan.daily_target} ${plan.primary_marker}/day` : null;

        const name = student?.full_name || 'Student';
        const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

        return {
          id: sid,
          name,
          age: student?.age,
          gender: student?.gender,
          course: subject?.name || 'Quran',
          currentPosition,
          lastLesson,
          pace,
          attendanceRate: rate,
          missedSessions: missedCount,
          initials,
          avatarColor: getAvatarColor(name),
        };
      });
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background max-w-[480px] mx-auto">
        <Skeleton className="h-28 rounded-b-2xl" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-[480px] mx-auto relative font-sans">
      {/* Top Bar */}
      <TeacherTopBar />

      {/* Scrollable Content */}
      <div className="p-4 pb-24 space-y-4">
        {/* Missed Attendance Alert */}
        <MissedAttendanceBanner />

        {/* Next Class Countdown */}
        <NextClassCountdown />

        {/* My Students — Smart Cards */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[15px] font-extrabold text-foreground">👩‍🎓 My Students</p>
            <button
              onClick={() => navigate('/students')}
              className="text-xs text-teal font-bold bg-transparent border-none cursor-pointer hover:underline"
            >
              All Students →
            </button>
          </div>
          <div className="space-y-3">
            {(students || []).length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-8 text-center text-muted-foreground">
                <p className="text-sm">No students assigned yet</p>
              </div>
            ) : (
              (students || []).map((s) => (
                <TeacherStudentCard
                  key={s.id}
                  student={s}
                  onMarkAttendance={setActiveModal}
                />
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <TeacherQuickActions />

        {/* Stats Row */}
        <TeacherStatsRow />
      </div>

      {/* Bottom Nav (mobile only) */}
      <TeacherBottomNav />

      {/* Attendance Modal */}
      {activeModal && (
        <TeacherAttendanceModal
          student={activeModal}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
