import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shows attendance records that were previously rescheduled to today's date.
 * Teacher can quickly spot pending rescheduled sessions.
 * Multi-reschedule sessions get a "Rescheduled Nx" amber badge.
 */
export function RescheduledTodayBanner() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: items = [] } = useQuery({
    queryKey: ["rescheduled-today", user?.id, today],
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return [];

      // Sessions originally rescheduled to today
      const { data: att } = await supabase
        .from("attendance")
        .select("id, student_id, reschedule_date, reschedule_time, class_date, class_time, status")
        .eq("teacher_id", user.id)
        .eq("reschedule_date", today)
        .in("status", ["rescheduled", "student_rescheduled"]);

      const rows = att || [];
      if (rows.length === 0) return [];

      const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", studentIds);

      const nameMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

      // Count reschedules per student in last 30 days for the warning badge
      const monthAgo = format(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        "yyyy-MM-dd",
      );
      const { data: history } = await supabase
        .from("session_reschedules" as any)
        .select("student_id, rescheduled_at")
        .eq("teacher_id", user.id)
        .gte("rescheduled_at", monthAgo);

      const counts = new Map<string, number>();
      ((history as any[]) || []).forEach((h) => {
        counts.set(h.student_id, (counts.get(h.student_id) || 0) + 1);
      });

      return rows
        .map((r) => ({
          id: r.id,
          student_id: r.student_id,
          student_name: nameMap.get(r.student_id) || "Student",
          time: r.reschedule_time || r.class_time,
          original_date: r.class_date,
          reschedule_count: counts.get(r.student_id) || 1,
        }))
        .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    },
  });

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-amber-600" />
        <p className="text-[13px] font-extrabold text-foreground">
          Rescheduled Sessions Today
        </p>
        <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
          {items.length}
        </span>
      </div>

      <ul className="space-y-1.5">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-2 text-xs bg-card border border-border rounded-lg px-2.5 py-1.5"
          >
            <span className="font-semibold text-foreground truncate flex-1">
              {it.student_name}
            </span>
            {it.time && (
              <span className="text-muted-foreground tabular-nums">
                {it.time.toString().substring(0, 5)}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 font-bold text-[10px]">
              Rescheduled Session
            </span>
            {it.reschedule_count >= 3 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-bold text-[10px]">
                <AlertTriangle className="h-3 w-3" />
                {it.reschedule_count}x / 30d
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
