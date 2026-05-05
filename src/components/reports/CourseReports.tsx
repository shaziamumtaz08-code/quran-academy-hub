import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useDivision } from "@/contexts/DivisionContext";

export default function CourseReports() {
  const { activeDivision, activeModelType } = useDivision();
  const divisionId = activeDivision?.id;
  const isOneToOne = activeModelType === "one_to_one";

  // ===== GROUP MODE: Course / Batch view =====
  const { data: courses } = useQuery({
    enabled: !isOneToOne,
    queryKey: ["course-reports", divisionId],
    queryFn: async () => {
      let query = supabase
        .from("courses")
        .select("id, name, status, max_students, teacher_id, start_date, teacher:profiles!courses_teacher_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (divisionId) query = query.eq("division_id", divisionId);
      const { data: allCourses } = await query;

      if (!allCourses?.length) return [];

      const { data: enrollments } = await supabase
        .from("course_enrollments")
        .select("course_id, status");

      const enrollMap: Record<string, { active: number; total: number }> = {};
      (enrollments || []).forEach((e: any) => {
        if (!enrollMap[e.course_id]) enrollMap[e.course_id] = { active: 0, total: 0 };
        enrollMap[e.course_id].total++;
        if (e.status === "active") enrollMap[e.course_id].active++;
      });

      return allCourses.map((c: any) => ({
        ...c,
        enrollments: enrollMap[c.id] || { active: 0, total: 0 },
        dropoffRate: (enrollMap[c.id]?.total || 0) > 0
          ? Math.round(((enrollMap[c.id]?.total || 0) - (enrollMap[c.id]?.active || 0)) / (enrollMap[c.id]?.total || 0) * 100)
          : 0,
      }));
    },
  });

  // ===== 1:1 MODE: Teacher / Subject load view =====
  const { data: teacherLoad } = useQuery({
    enabled: isOneToOne,
    queryKey: ["teacher-load-report", divisionId],
    queryFn: async () => {
      let q = supabase
        .from("student_teacher_assignments")
        .select("teacher_id, subject_id, status, teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name), subject:subjects(name)");
      if (divisionId) q = q.eq("division_id", divisionId);
      const { data } = await q;
      if (!data?.length) return [];

      const map: Record<string, { teacher_id: string; teacher_name: string; subjects: Set<string>; active: number; paused: number; left: number; completed: number; total: number }> = {};
      (data as any[]).forEach((a) => {
        const key = a.teacher_id || "unassigned";
        if (!map[key]) map[key] = { teacher_id: key, teacher_name: a.teacher?.full_name || "Unassigned", subjects: new Set(), active: 0, paused: 0, left: 0, completed: 0, total: 0 };
        if (a.subject?.name) map[key].subjects.add(a.subject.name);
        map[key].total++;
        const s = String(a.status || "").toLowerCase();
        if (s === "active") map[key].active++;
        else if (s === "paused") map[key].paused++;
        else if (s === "left") map[key].left++;
        else if (s === "completed") map[key].completed++;
      });

      return Object.values(map)
        .map((r) => ({
          ...r,
          subjectsList: Array.from(r.subjects).join(", "),
          dropoffRate: r.total > 0 ? Math.round(((r.left + r.completed) / r.total) * 100) : 0,
        }))
        .sort((a, b) => b.active - a.active);
    },
  });

  const exportCsv = () => {
    if (isOneToOne) {
      const rows = [["Teacher", "Subjects", "Active", "Paused", "Left", "Completed", "Total", "Drop-off %"]];
      (teacherLoad || []).forEach((r: any) => rows.push([r.teacher_name, r.subjectsList, r.active, r.paused, r.left, r.completed, r.total, r.dropoffRate + "%"]));
      const csv = rows.map(r => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "teacher_load_report.csv"; a.click();
      return;
    }
    const rows = [["Course", "Teacher", "Status", "Active Students", "Total Enrolled", "Drop-off %"]];
    (courses || []).forEach((c: any) => rows.push([c.name, c.teacher?.full_name, c.status, c.enrollments.active, c.enrollments.total, c.dropoffRate + "%"]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "course_reports.csv"; a.click();
  };

  if (isOneToOne) {
    const rows = teacherLoad || [];
    const totalAssignments = rows.reduce((s: number, r: any) => s + r.total, 0);
    const totalActive = rows.reduce((s: number, r: any) => s + r.active, 0);
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{rows.length}</p><p className="text-xs text-muted-foreground">Teachers</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{totalAssignments}</p><p className="text-xs text-muted-foreground">Total Assignments</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{totalActive}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{totalAssignments > 0 ? Math.round(((totalAssignments - totalActive) / totalAssignments) * 100) : 0}%</p><p className="text-xs text-muted-foreground">Avg Drop-off</p></CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Teacher</th>
                    <th className="text-left p-3 font-medium">Subjects</th>
                    <th className="text-center p-3 font-medium">Active</th>
                    <th className="text-center p-3 font-medium">Paused</th>
                    <th className="text-center p-3 font-medium">Left</th>
                    <th className="text-center p-3 font-medium">Completed</th>
                    <th className="text-center p-3 font-medium">Total</th>
                    <th className="text-center p-3 font-medium">Drop-off</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r: any) => (
                    <tr key={r.teacher_id} className="hover:bg-muted/30">
                      <td className="p-3 font-medium">{r.teacher_name}</td>
                      <td className="p-3 text-muted-foreground">{r.subjectsList || "—"}</td>
                      <td className="p-3 text-center">{r.active}</td>
                      <td className="p-3 text-center">{r.paused}</td>
                      <td className="p-3 text-center">{r.left}</td>
                      <td className="p-3 text-center">{r.completed}</td>
                      <td className="p-3 text-center font-medium">{r.total}</td>
                      <td className="p-3 text-center">{r.dropoffRate > 20 ? <Badge variant="destructive">{r.dropoffRate}%</Badge> : <span>{r.dropoffRate}%</span>}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No assignments found</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{(courses || []).length}</p><p className="text-xs text-muted-foreground">Total Courses</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{(courses || []).filter((c: any) => c.status === "active").length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{(courses || []).reduce((s: number, c: any) => s + c.enrollments.active, 0)}</p><p className="text-xs text-muted-foreground">Total Enrolled</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Course</th>
                  <th className="text-left p-3 font-medium">Teacher</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-center p-3 font-medium">Active</th>
                  <th className="text-center p-3 font-medium">Total</th>
                  <th className="text-center p-3 font-medium">Drop-off</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(courses || []).map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-muted-foreground">{c.teacher?.full_name}</td>
                    <td className="p-3 text-center"><Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge></td>
                    <td className="p-3 text-center">{c.enrollments.active}</td>
                    <td className="p-3 text-center">{c.enrollments.total}</td>
                    <td className="p-3 text-center">{c.dropoffRate > 20 ? <Badge variant="destructive">{c.dropoffRate}%</Badge> : <span>{c.dropoffRate}%</span>}</td>
                  </tr>
                ))}
                {(courses || []).length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No courses found</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
