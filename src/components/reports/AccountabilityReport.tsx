import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDivision } from "@/contexts/DivisionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Clock, Users, Video, TrendingUp, TrendingDown } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";

type DateRange = "this_week" | "this_month" | "custom";

export default function AccountabilityReport() {
  const { activeDivisionId } = useDivision();
  const [dateRange, setDateRange] = useState<DateRange>("this_week");
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    if (dateRange === "this_week") return { fromDate: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), toDate: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    if (dateRange === "this_month") return { fromDate: format(startOfMonth(now), "yyyy-MM-dd"), toDate: format(endOfMonth(now), "yyyy-MM-dd") };
    return { fromDate: customFrom, toDate: customTo };
  }, [dateRange, customFrom, customTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["accountability-report", fromDate, toDate, activeDivisionId],
    queryFn: async () => {
      // 1) Get live_sessions in range
      let sessionQuery = supabase
        .from("live_sessions")
        .select("id, teacher_id, schedule_id, assignment_id, scheduled_start, actual_start, actual_end, status")
        .gte("scheduled_start", `${fromDate}T00:00:00`)
        .lte("scheduled_start", `${toDate}T23:59:59`);

      const { data: sessions } = await sessionQuery;

      // 2) Get schedules for the period
      let schedQuery = supabase
        .from("schedules")
        .select("id, assignment_id, day_of_week, teacher_local_time, duration_minutes, division_id")
        .eq("is_active", true);
      if (activeDivisionId) schedQuery = schedQuery.eq("division_id", activeDivisionId);
      const { data: schedules } = await schedQuery;

      // 3) Get zoom_attendance_logs for these sessions
      const sessionIds = (sessions || []).map(s => s.id);
      let logs: any[] = [];
      if (sessionIds.length > 0) {
        const { data: logData } = await supabase
          .from("zoom_attendance_logs")
          .select("id, session_id, user_id, action, join_time, leave_time, total_duration_minutes")
          .in("session_id", sessionIds);
        logs = logData || [];
      }

      // 4) Get teacher/student profiles
      const teacherIds = [...new Set((sessions || []).map(s => s.teacher_id).filter(Boolean))];
      const studentIdsFromLogs = [...new Set(logs.map(l => l.user_id))];
      const allProfileIds = [...new Set([...teacherIds, ...studentIdsFromLogs])];
      
      let profiles: Record<string, string> = {};
      if (allProfileIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", allProfileIds);
        (profileData || []).forEach(p => { profiles[p.id] = p.full_name || "Unknown"; });
      }

      // 5) Get assignments to know which students belong to which teacher
      const assignmentIds = [...new Set((schedules || []).map(s => s.assignment_id).filter(Boolean))];
      let assignments: any[] = [];
      if (assignmentIds.length > 0) {
        const { data: aData } = await supabase
          .from("student_teacher_assignments")
          .select("id, teacher_id, student_id")
          .in("id", assignmentIds)
          .eq("status", "active");
        assignments = aData || [];
      }

      // Get student profiles too
      const studentIds = [...new Set(assignments.map(a => a.student_id))];
      if (studentIds.length > 0) {
        const { data: sp } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
        (sp || []).forEach(p => { profiles[p.id] = p.full_name || "Unknown"; });
      }

      // 6) Get user_roles for the log users to distinguish teacher vs student
      let userRoles: Record<string, string> = {};
      if (allProfileIds.length > 0) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", allProfileIds);
        (roleData || []).forEach((r: any) => { userRoles[r.user_id] = r.role; });
      }

      return { sessions: sessions || [], schedules: schedules || [], logs, profiles, assignments, userRoles };
    },
  });

  // Process teacher metrics
  const teacherMetrics = useMemo(() => {
    if (!data) return [];
    const { sessions, schedules, logs, profiles } = data;

    // Count scheduled classes per teacher from schedules (number of day occurrences in range)
    const teacherMap: Record<string, {
      name: string;
      scheduled: number;
      conducted: number;
      totalDurationMin: number;
      lateStarts: number;
      noShows: number;
    }> = {};

    // From sessions (conducted)
    sessions.forEach(s => {
      if (!s.teacher_id) return;
      if (!teacherMap[s.teacher_id]) {
        teacherMap[s.teacher_id] = { name: profiles[s.teacher_id] || "Unknown", scheduled: 0, conducted: 0, totalDurationMin: 0, lateStarts: 0, noShows: 0 };
      }
      const t = teacherMap[s.teacher_id];
      if (s.status === "completed" || s.status === "live") {
        t.conducted++;
        if (s.actual_start && s.actual_end) {
          t.totalDurationMin += differenceInMinutes(new Date(s.actual_end), new Date(s.actual_start));
        }
        // Late start: >5 min after scheduled_start
        if (s.actual_start && s.scheduled_start) {
          const lateMins = differenceInMinutes(new Date(s.actual_start), new Date(s.scheduled_start));
          if (lateMins > 5) t.lateStarts++;
        }
      }
    });

    // Count scheduled from schedules (rough: each active schedule = 1 per week)
    const fromD = new Date(fromDate);
    const toD = new Date(toDate);
    const daysBetween = Math.ceil((toD.getTime() - fromD.getTime()) / 86400000) + 1;
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    // Count occurrences of each day_of_week in date range
    const dayOccurrences: Record<string, number> = {};
    for (let d = new Date(fromD); d <= toD; d.setDate(d.getDate() + 1)) {
      const dn = dayNames[d.getDay()];
      dayOccurrences[dn] = (dayOccurrences[dn] || 0) + 1;
    }

    // Map schedules to teachers via assignments
    const assignmentTeacherMap: Record<string, string> = {};
    (data.assignments || []).forEach((a: any) => { assignmentTeacherMap[a.id] = a.teacher_id; });

    schedules.forEach(sch => {
      const teacherId = assignmentTeacherMap[sch.assignment_id];
      if (!teacherId) return;
      if (!teacherMap[teacherId]) {
        teacherMap[teacherId] = { name: profiles[teacherId] || "Unknown", scheduled: 0, conducted: 0, totalDurationMin: 0, lateStarts: 0, noShows: 0 };
      }
      teacherMap[teacherId].scheduled += dayOccurrences[sch.day_of_week] || 0;
    });

    // No-shows = scheduled - conducted (approximate)
    Object.values(teacherMap).forEach(t => {
      t.noShows = Math.max(0, t.scheduled - t.conducted);
    });

    return Object.entries(teacherMap)
      .map(([id, m]) => ({ id, ...m, avgDuration: m.conducted > 0 ? Math.round(m.totalDurationMin / m.conducted) : 0 }))
      .sort((a, b) => b.scheduled - a.scheduled);
  }, [data, fromDate]);

  // Process student metrics
  const studentMetrics = useMemo(() => {
    if (!data) return [];
    const { sessions, logs, profiles, userRoles, assignments } = data;

    // Build student -> expected sessions map
    const studentExpected: Record<string, number> = {};
    const studentTeacher: Record<string, string> = {};
    (assignments || []).forEach((a: any) => {
      studentExpected[a.student_id] = (studentExpected[a.student_id] || 0) + 1; // rough count
      studentTeacher[a.student_id] = a.teacher_id;
    });

    // Map session to its teacher for expected duration
    const sessionMap: Record<string, any> = {};
    sessions.forEach(s => { sessionMap[s.id] = s; });

    // Student attendance from logs
    const studentMap: Record<string, {
      name: string;
      sessionsJoined: number;
      totalExpected: number;
      totalDurationMin: number;
      expectedDurationMin: number;
      lateJoins: number;
      earlyLeaves: number;
      teacherName: string;
    }> = {};

    // Get student-only logs
    const studentLogs = logs.filter(l => userRoles[l.user_id] === "student" || !userRoles[l.user_id]);

    studentLogs.forEach(log => {
      if (!studentMap[log.user_id]) {
        studentMap[log.user_id] = {
          name: profiles[log.user_id] || "Unknown",
          sessionsJoined: 0,
          totalExpected: 0,
          totalDurationMin: 0,
          expectedDurationMin: 0,
          lateJoins: 0,
          earlyLeaves: 0,
          teacherName: profiles[studentTeacher[log.user_id]] || "",
        };
      }
      const s = studentMap[log.user_id];
      if (log.action === "join_intent" || log.action === "leave") {
        // Count unique sessions
        s.sessionsJoined++;
        s.totalDurationMin += log.total_duration_minutes || 0;
        s.expectedDurationMin += 30; // default

        // Late join: >5 min after session start
        const session = sessionMap[log.session_id];
        if (session?.actual_start && log.join_time) {
          const lateMins = differenceInMinutes(new Date(log.join_time), new Date(session.actual_start));
          if (lateMins > 5) s.lateJoins++;
        }

        // Early leave: <80% of expected time (24 min of 30)
        if (log.total_duration_minutes && log.total_duration_minutes < 24) {
          s.earlyLeaves++;
        }
      }
    });

    // Deduplicate sessions per student
    const studentSessionSets: Record<string, Set<string>> = {};
    studentLogs.forEach(l => {
      if (!studentSessionSets[l.user_id]) studentSessionSets[l.user_id] = new Set();
      studentSessionSets[l.user_id].add(l.session_id);
    });
    Object.entries(studentSessionSets).forEach(([uid, sessions]) => {
      if (studentMap[uid]) studentMap[uid].sessionsJoined = sessions.size;
    });

    return Object.entries(studentMap)
      .map(([id, m]) => ({
        id,
        ...m,
        attendanceRate: m.totalExpected > 0 ? Math.round((m.sessionsJoined / Math.max(m.totalExpected, m.sessionsJoined)) * 100) : 0,
        avgDuration: m.sessionsJoined > 0 ? Math.round(m.totalDurationMin / m.sessionsJoined) : 0,
      }))
      .sort((a, b) => a.attendanceRate - b.attendanceRate);
  }, [data]);

  // Summary stats
  const summary = useMemo(() => {
    const totalScheduled = teacherMetrics.reduce((s, t) => s + t.scheduled, 0);
    const totalConducted = teacherMetrics.reduce((s, t) => s + t.conducted, 0);
    const totalLateTeacher = teacherMetrics.reduce((s, t) => s + t.lateStarts, 0);
    const totalNoShows = teacherMetrics.reduce((s, t) => s + t.noShows, 0);
    const totalStudentSessions = studentMetrics.reduce((s, m) => s + m.sessionsJoined, 0);
    const totalLateStudents = studentMetrics.reduce((s, m) => s + m.lateJoins, 0);
    const totalEarlyLeaves = studentMetrics.reduce((s, m) => s + m.earlyLeaves, 0);
    return { totalScheduled, totalConducted, totalLateTeacher, totalNoShows, totalStudentSessions, totalLateStudents, totalEarlyLeaves };
  }, [teacherMetrics, studentMetrics]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Date Range</label>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {dateRange === "custom" && (
          <>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">From</label>
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-[150px]" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">To</label>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-[150px]" />
            </div>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Video className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-black">{summary.totalScheduled}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Scheduled</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <p className="text-2xl font-black text-emerald-600">{summary.totalConducted}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Conducted</p>
          </CardContent>
        </Card>
        <Card className={cn("border-border", summary.totalLateTeacher > 0 && "border-destructive/30")}>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className={cn("text-2xl font-black", summary.totalLateTeacher > 0 ? "text-amber-600" : "")}>{summary.totalLateTeacher}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Teacher Late</p>
          </CardContent>
        </Card>
        <Card className={cn("border-border", summary.totalNoShows > 0 && "border-destructive/30")}>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className={cn("text-2xl font-black", summary.totalNoShows > 0 ? "text-destructive" : "")}>{summary.totalNoShows}</p>
            <p className="text-[11px] text-muted-foreground font-medium">No-Shows</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-black">{summary.totalStudentSessions}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Student Joins</p>
          </CardContent>
        </Card>
        <Card className={cn("border-border", summary.totalLateStudents > 0 && "border-amber-500/30")}>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className={cn("text-2xl font-black", summary.totalLateStudents > 0 ? "text-amber-600" : "")}>{summary.totalLateStudents}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Student Late</p>
          </CardContent>
        </Card>
        <Card className={cn("border-border", summary.totalEarlyLeaves > 0 && "border-destructive/30")}>
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className={cn("text-2xl font-black", summary.totalEarlyLeaves > 0 ? "text-destructive" : "")}>{summary.totalEarlyLeaves}</p>
            <p className="text-[11px] text-muted-foreground font-medium">Early Leaves</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="teachers">
        <TabsList>
          <TabsTrigger value="teachers">Teacher Accountability</TabsTrigger>
          <TabsTrigger value="students">Student Accountability</TabsTrigger>
        </TabsList>

        <TabsContent value="teachers" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Teacher Performance — Zoom Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
              ) : teacherMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No session data for this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead className="text-center">Scheduled</TableHead>
                        <TableHead className="text-center">Conducted</TableHead>
                        <TableHead className="text-center">Avg Duration</TableHead>
                        <TableHead className="text-center">Late Starts</TableHead>
                        <TableHead className="text-center">No-Shows</TableHead>
                        <TableHead className="text-center">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacherMetrics.map(t => {
                        const rate = t.scheduled > 0 ? Math.round((t.conducted / t.scheduled) * 100) : 0;
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">{t.name}</TableCell>
                            <TableCell className="text-center">{t.scheduled}</TableCell>
                            <TableCell className="text-center">{t.conducted}</TableCell>
                            <TableCell className="text-center">{t.avgDuration}m</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={t.lateStarts > 0 ? "destructive" : "secondary"} className="text-[10px]">
                                {t.lateStarts}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={t.noShows > 0 ? "destructive" : "secondary"} className="text-[10px]">
                                {t.noShows}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                className={cn(
                                  "text-[10px]",
                                  rate >= 90 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                  rate >= 70 ? "bg-amber-100 text-amber-700 border-amber-200" :
                                  "bg-red-100 text-red-700 border-red-200"
                                )}
                              >
                                {rate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Student Accountability — Zoom Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
              ) : studentMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No student data for this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead className="text-center">Sessions</TableHead>
                        <TableHead className="text-center">Avg Duration</TableHead>
                        <TableHead className="text-center">Late Joins</TableHead>
                        <TableHead className="text-center">Early Leaves</TableHead>
                        <TableHead className="text-center">Punctuality</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentMetrics.map(s => {
                        const punctuality = s.sessionsJoined > 0 ? Math.round(((s.sessionsJoined - s.lateJoins) / s.sessionsJoined) * 100) : 0;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{s.teacherName}</TableCell>
                            <TableCell className="text-center">{s.sessionsJoined}</TableCell>
                            <TableCell className="text-center">
                              <span className={cn(s.avgDuration < 24 ? "text-destructive font-semibold" : "")}>
                                {s.avgDuration}m
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={s.lateJoins > 0 ? "destructive" : "secondary"} className="text-[10px]">
                                {s.lateJoins}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={s.earlyLeaves > 0 ? "destructive" : "secondary"} className="text-[10px]">
                                {s.earlyLeaves}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                className={cn(
                                  "text-[10px]",
                                  punctuality >= 90 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                  punctuality >= 70 ? "bg-amber-100 text-amber-700 border-amber-200" :
                                  "bg-red-100 text-red-700 border-red-200"
                                )}
                              >
                                {punctuality}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
