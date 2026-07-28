import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Video, Clock, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { ensureFreshSession } from '@/lib/ensureSession';
import { useAcademyTimezone, zonedDayName, zonedTimeToEpoch, zonedDateKey } from '@/hooks/useAcademyTimezone';
import { playPingChime } from '@/lib/pingChime';
import { Bell, X } from 'lucide-react';

type Row = {
  key: string;
  kind: "live_session" | "schedule";
  scheduledStartMs: number;
  durationMin: number;
  teacherId: string;
  teacherName?: string;
  studentId?: string | null;
  studentName?: string | null;
  assignmentId?: string | null;
  scheduleId?: string | null;
  liveSessionId?: string | null;
  meetingLink?: string | null;
  status?: string;
};

function fmtCountdown(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 0) {
    const abs = -s;
    if (abs < 60) return `${abs}s ago`;
    if (abs < 3600) return `${Math.floor(abs / 60)}m ago`;
    return `${Math.floor(abs / 3600)}h ago`;
  }
  if (s < 60) return `in ${s}s`;
  if (s < 3600) return `in ${Math.floor(s / 60)}m`;
  return `in ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Join window: 5 min before scheduled start → duration + 15 min buffer after
const JOIN_LEAD_MS = 5 * 60 * 1000;
const JOIN_TAIL_MS = 15 * 60 * 1000;

export default function LiveClasses() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"teacher" | "student" | "other">("other");
  const [now, setNow] = useState(Date.now());
  const [joiningKey, setJoiningKey] = useState<string | null>(null);
  const tz = useAcademyTimezone();
  const occurrenceDate = zonedDateKey(tz);
  const [pingState, setPingState] = useState<Record<string, { cooldown: number; sending: boolean }>>({});
  const [incomingPings, setIncomingPings] = useState<Record<string, "teacher" | "student">>({});

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);

    // Determine primary role
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    const primary: "teacher" | "student" | "other" = roles.includes("teacher")
      ? "teacher"
      : roles.includes("student")
      ? "student"
      : "other";
    setRole(primary);

    // Academy-timezone day boundaries (not the browser's local midnight)
    const dayStart = new Date(zonedTimeToEpoch(tz, "00:00"));
    const dayEnd = new Date(zonedTimeToEpoch(tz, "00:00") + 24 * 60 * 60 * 1000 - 1);

    // 1. Existing live_sessions for today
    const lsBase = supabase
      .from("live_sessions")
      .select("id, teacher_id, student_id, assignment_id, schedule_id, license_id, scheduled_start, status, zoom_licenses(meeting_link)")
      .gte("scheduled_start", dayStart.toISOString())
      .lte("scheduled_start", dayEnd.toISOString())
      .in("status", ["scheduled", "live", "completed"]);

    const { data: liveSessions } = primary === "teacher"
      ? await lsBase.eq("teacher_id", user.id)
      : primary === "student"
      ? await lsBase
      : await lsBase.limit(0);

    // 2. Today's recurring schedules
    const today = zonedDayName(tz);
    const schedBase = supabase
      .from("schedules")
      .select("id, assignment_id, student_local_time, teacher_local_time, duration_minutes, student_teacher_assignments!inner(id, teacher_id, student_id, status, duration_minutes)")
      .eq("day_of_week", today)
      .eq("is_active", true);

    const { data: schedules } = primary === "teacher"
      ? await schedBase.eq("student_teacher_assignments.teacher_id", user.id).eq("student_teacher_assignments.status", "active")
      : primary === "student"
      ? await schedBase.eq("student_teacher_assignments.student_id", user.id).eq("student_teacher_assignments.status", "active")
      : await schedBase.limit(0);

    // Gather profile names for teachers/students
    const teacherIds = new Set<string>();
    const studentIds = new Set<string>();
    (liveSessions || []).forEach((s: any) => {
      if (s.teacher_id) teacherIds.add(s.teacher_id);
      if (s.student_id) studentIds.add(s.student_id);
    });
    (schedules || []).forEach((s: any) => {
      const a = s.student_teacher_assignments;
      if (a?.teacher_id) teacherIds.add(a.teacher_id);
      if (a?.student_id) studentIds.add(a.student_id);
    });
    const allIds = Array.from(new Set([...teacherIds, ...studentIds]));
    const nameMap = new Map<string, string>();
    if (allIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", allIds);
      (profs || []).forEach((p: any) => nameMap.set(p.id, p.full_name || "—"));
    }

    // Build unified rows; schedule rows only when a live_session doesn't already exist
    const takenAssignmentIds = new Set(
      (liveSessions || []).map((s: any) => s.assignment_id).filter(Boolean)
    );

    const lsRows: Row[] = (liveSessions || []).map((s: any) => ({
      key: `ls:${s.id}`,
      kind: "live_session",
      scheduledStartMs: new Date(s.scheduled_start).getTime(),
      durationMin: 30,
      teacherId: s.teacher_id,
      teacherName: nameMap.get(s.teacher_id),
      studentId: s.student_id,
      studentName: s.student_id ? nameMap.get(s.student_id) : null,
      assignmentId: s.assignment_id,
      scheduleId: s.schedule_id,
      liveSessionId: s.id,
      meetingLink: s.zoom_licenses?.meeting_link || null,
      status: s.status,
    }));

    const schedRows: Row[] = (schedules || [])
      .filter((s: any) => !takenAssignmentIds.has(s.assignment_id))
      .map((s: any) => {
        const a = s.student_teacher_assignments;
        // For teacher: use teacher_local_time; for student: student_local_time.
        // Both are stored as the local wall clock time of that user; we treat as browser local.
        const timeStr = primary === "teacher" ? s.teacher_local_time : s.student_local_time;
        return {
          key: `sc:${s.id}`,
          kind: "schedule",
          scheduledStartMs: zonedTimeToEpoch(tz, timeStr),
          durationMin: s.duration_minutes || a?.duration_minutes || 30,
          teacherId: a.teacher_id,
          teacherName: nameMap.get(a.teacher_id),
          studentId: a.student_id,
          studentName: nameMap.get(a.student_id),
          assignmentId: a.id,
          scheduleId: s.id,
          liveSessionId: null,
          meetingLink: null,
          status: "scheduled",
        };
      });

    const all = [...lsRows, ...schedRows].sort((a, b) => a.scheduledStartMs - b.scheduledStartMs);
    setRows(all);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`live-classes-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_sessions" },
        () => { load(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "zoom_licenses" },
        () => { load(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleJoin = async (row: Row) => {
    if (!user?.id) return;
    setJoiningKey(row.key);
    try {
      await ensureFreshSession();
      const { data, error } = await supabase.functions.invoke("zoom-join-class", {
        body: {
          teacherId: row.teacherId,
          studentId: row.studentId || null,
          assignmentId: row.assignmentId || null,
          scheduleId: row.scheduleId || null,
          scheduledStart: new Date(row.scheduledStartMs).toISOString(),
          liveSessionId: row.liveSessionId || null,
        },
      });
      if (error) throw error;
      const payload = data as any;
      if (!payload?.joinUrl) {
        toast.info(payload?.message || "This class isn't ready yet. Please wait for your teacher to open the room.");
        await load();
        return;
      }
      window.open(payload.joinUrl, "_blank", "noopener,noreferrer");
      // Refresh so the row now shows the meeting link
      setTimeout(load, 500);
    } catch (e: any) {
      toast.error(e?.message || "Could not open the class link.");
    } finally {
      setJoiningKey(null);
    }
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading today's classes…
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No classes scheduled today.
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-3">
        {rows.map((r) => {
          const startedAt = r.scheduledStartMs;
          const endsAt = startedAt + r.durationMin * 60_000 + JOIN_TAIL_MS;
          const opensAt = startedAt - JOIN_LEAD_MS;
          const withinWindow = now >= opensAt && now <= endsAt;
          const isCompleted = r.status === "completed";
          const canJoin = withinWindow && !isCompleted;

          const other = role === "teacher"
            ? (r.studentName || "Group class")
            : (r.teacherName || "Teacher");

          return (
            <Card key={r.key} className={r.status === "live" ? "border-primary" : ""}>
              <CardContent className="p-4 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{other}</span>
                    {r.status === "live" && <Badge className="bg-green-600">Live</Badge>}
                    {isCompleted && <Badge variant="secondary">Ended</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmtTime(startedAt)} · {r.durationMin} min</span>
                    {!isCompleted && (
                      <span>
                        {now < opensAt
                          ? `Opens ${fmtCountdown(opensAt - now)}`
                          : now <= endsAt
                          ? `Started ${fmtCountdown(now - startedAt)}`
                          : "Window closed"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <Badge variant="outline">Completed</Badge>
                  ) : canJoin ? (
                    <Button
                      onClick={() => handleJoin(r)}
                      disabled={joiningKey === r.key}
                      className="gap-2"
                    >
                      {joiningKey === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                      Join Class
                    </Button>
                  ) : now > endsAt ? (
                    <Badge variant="secondary">Ended</Badge>
                  ) : !withinWindow ? (
                    <Button disabled variant="outline" className="gap-2">
                      <Clock className="h-4 w-4" /> Opens {fmtCountdown(opensAt - now)}
                    </Button>
                  ) : (
                    <Button disabled variant="outline" className="gap-2">
                      <AlertCircle className="h-4 w-4" /> Not ready yet
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }, [rows, now, loading, joiningKey, role]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Live Classes</h1>
            <p className="text-sm text-muted-foreground">Your Zoom classes for today. Join opens 5 minutes before class starts.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
        {content}
      </div>
    </DashboardLayout>
  );
}
