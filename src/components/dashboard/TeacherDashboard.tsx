import React from "react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "./StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, CheckCircle, BookOpen, Clock, AlertCircle, Layers } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { SmartSessionRibbon } from "./SmartSessionRibbon";
import { CourseDeckCarousel } from "./CourseDeckCarousel";
import { LaunchClassCard } from "./LaunchClassCard";
import { HybridTodayTimeline, useActiveBatchesCount } from "./HybridTodayTimeline";

export function TeacherDashboard() {
  const { profile, user } = useAuth();

  // Fetch teacher stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["teacher-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const [assignmentsRes, attendanceRes] = await Promise.all([
        supabase.from("student_teacher_assignments").select("student_id").eq("teacher_id", user.id),
        supabase.from("attendance").select("status, class_date").eq("teacher_id", user.id),
      ]);

      const today = format(new Date(), "yyyy-MM-dd");
      const attendance = attendanceRes.data || [];
      const todayClasses = attendance.filter((a) => a.class_date === today);

      return {
        assignedStudents: assignmentsRes.data?.length || 0,
        classesToday: todayClasses.length,
        classesThisMonth: attendance.length,
        attendanceRate:
          attendance.length > 0
            ? Math.round((attendance.filter((a) => a.status === "present").length / attendance.length) * 100)
            : 0,
        presentToday: todayClasses.filter((a) => a.status === "present").length,
        absentToday: todayClasses.filter((a) => a.status === "absent").length,
        lateToday: todayClasses.filter((a) => a.status === "late").length,
      };
    },
    enabled: !!user?.id,
  });

  // MUST be called before any early returns — Rules of Hooks
  const { data: activeBatches } = useActiveBatchesCount();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
          Welcome, {profile?.full_name || "Teacher"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your teaching overview</p>
      </div>

      {/* Smart Session Ribbon - Top Priority */}
      <SmartSessionRibbon />

      {/* Stats Grid - Compact on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard title="Students" value={stats?.assignedStudents || 0} icon={Users} variant="primary" />
        <StatCard title="Active Batches" value={activeBatches ?? 0} icon={Layers} />
        <StatCard title="Classes Today" value={stats?.classesToday || 0} icon={Calendar} />
        <StatCard title="This Month" value={stats?.classesThisMonth || 0} icon={BookOpen} />
        <StatCard title="Attendance" value={`${stats?.attendanceRate || 0}%`} icon={CheckCircle} variant="gold" />
      </div>

      {/* Hybrid Today Timeline */}
      <HybridTodayTimeline />

      {/* Course Deck Carousel */}
      <CourseDeckCarousel />

      {/* Launch Class Card */}
      <LaunchClassCard />

      {/* Today's Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.classesToday === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No classes recorded today</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
              <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <p className="text-2xl sm:text-3xl font-serif font-bold text-emerald-600 dark:text-emerald-400">
                  {stats?.presentToday || 0}
                </p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Present</p>
              </div>
              <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-2xl sm:text-3xl font-serif font-bold text-amber-600 dark:text-amber-400">
                  {stats?.lateToday || 0}
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">Late</p>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-2xl sm:text-3xl font-serif font-bold text-red-600 dark:text-red-400">
                  {stats?.absentToday || 0}
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">Absent</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
