import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Users, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const DAY_MAP: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

interface TimelineItem {
  id: string;
  type: "group" | "one_on_one";
  name: string;
  time: string;
  duration: number;
  courseId?: string;
}

export function HybridTodayTimeline() {
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();
  const todayDay = DAY_MAP[new Date().getDay()];

  const { data: timelineItems, isLoading } = useQuery({
    queryKey: ["hybrid-today-timeline", user?.id, activeRole, todayDay],
    queryFn: async () => {
      if (!user?.id) return [];

      const isAdminRole = ["super_admin", "admin", "admin_academic"].includes(activeRole || "");

      // Fetch 1:1 schedules
      let oneOnOneQuery = supabase
        .from("schedules")
        .select(
          `
          id,
          teacher_local_time,
          duration_minutes,
          student_teacher_assignments!inner (
            id,
            student_id,
            profiles!student_teacher_assignments_student_id_fkey ( full_name )
          )
        `,
        )
        .eq("day_of_week", todayDay)
        .eq("is_active", true)
        .not("assignment_id", "is", null)
        .eq("student_teacher_assignments.status", "active");

      if (!isAdminRole && activeRole === "teacher") {
        // For teachers, filter by their assignments
        oneOnOneQuery = supabase
          .from("schedules")
          .select(
            `
            id,
            teacher_local_time,
            duration_minutes,
            student_teacher_assignments!inner (
              id,
              student_id,
              teacher_id,
              profiles!student_teacher_assignments_student_id_fkey ( full_name )
            )
          `,
          )
          .eq("day_of_week", todayDay)
          .eq("is_active", true)
          .not("assignment_id", "is", null)
          .eq("student_teacher_assignments.teacher_id", user.id)
          .eq("student_teacher_assignments.status", "active");
      }

      // Fetch group class schedules
      let groupQuery = supabase
        .from("schedules")
        .select(
          `
          id,
          teacher_local_time,
          duration_minutes,
          course_id,
          courses!inner ( id, name, status )
        `,
        )
        .eq("day_of_week", todayDay)
        .eq("is_active", true)
        .not("course_id", "is", null)
        .eq("courses.status", "active");

      if (!isAdminRole && activeRole === "teacher") {
        groupQuery = supabase
          .from("schedules")
          .select(
            `
            id,
            teacher_local_time,
            duration_minutes,
            course_id,
            courses!inner ( id, name, status, teacher_id )
          `,
          )
          .eq("day_of_week", todayDay)
          .eq("is_active", true)
          .not("course_id", "is", null)
          .eq("courses.status", "active")
          .eq("courses.teacher_id", user.id);
      }

      const [oneOnOneRes, groupRes] = await Promise.all([oneOnOneQuery, groupQuery]);

      const items: TimelineItem[] = [];

      // Map 1:1 sessions
      if (oneOnOneRes.data) {
        for (const s of oneOnOneRes.data) {
          const assignment = s.student_teacher_assignments as any;
          const studentName = assignment?.profiles?.full_name || "Unknown Student";
          items.push({
            id: s.id,
            type: "one_on_one",
            name: studentName,
            time: s.teacher_local_time?.slice(0, 5) || "00:00",
            duration: s.duration_minutes,
          });
        }
      }

      // Map group classes
      if (groupRes.data) {
        for (const s of groupRes.data) {
          const course = s.courses as any;
          items.push({
            id: s.id,
            type: "group",
            name: course?.name || "Unknown Course",
            time: s.teacher_local_time?.slice(0, 5) || "00:00",
            duration: s.duration_minutes,
            courseId: s.course_id || undefined,
          });
        }
      }

      // Sort by time
      items.sort((a, b) => a.time.localeCompare(b.time));
      return items;
    },
    enabled: !!user?.id,
  });

  const handleMarkAttendance = (item: TimelineItem) => {
    if (item.type === "group") {
      navigate("/attendance?tab=group");
    } else {
      navigate("/attendance?tab=1on1");
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4">
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const items = timelineItems || [];

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="font-serif text-xl font-bold text-foreground">Today's Timeline</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          {" · "}
          {items.length} session{items.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No classes scheduled for today</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "p-4 hover:bg-secondary/50 transition-colors border-l-4",
                item.type === "group" ? "border-l-purple-500" : "border-l-cyan",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      item.type === "group" ? "bg-purple-100 dark:bg-purple-900/30" : "bg-cyan-light/20",
                    )}
                  >
                    {item.type === "group" ? (
                      <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    ) : (
                      <User className="h-5 w-5 text-cyan" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {item.type === "group" ? "👥 " : "👤 "}
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{item.time}</span>
                      <span>•</span>
                      <span>{item.duration} min</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs ml-1",
                          item.type === "group"
                            ? "border-purple-300 text-purple-600 dark:text-purple-400"
                            : "border-cyan text-cyan",
                        )}
                      >
                        {item.type === "group" ? "Batch Class" : "Private Tuition"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 gap-1.5"
                  onClick={() => handleMarkAttendance(item)}
                >
                  Mark Attendance
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Hook to get active batches count for stat cards
export function useActiveBatchesCount(divisionId?: string | null) {
  return useQuery({
    queryKey: ["active-batches-count", divisionId ?? "all"],
    queryFn: async () => {
      let query = supabase.from("courses").select("*", { count: "exact", head: true }).eq("status", "active");
      if (divisionId) {
        query = query.eq("division_id", divisionId);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });
}
