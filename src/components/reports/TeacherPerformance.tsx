import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format, subDays } from "date-fns";
import { useDivision } from "@/contexts/DivisionContext";

export default function TeacherPerformance() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  const { data: perfData } = useQuery({
    queryKey: ["teacher-perf", dateFrom, dateTo, divisionId],
    queryFn: async () => {
      // Get teachers
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      if (!roles?.length) return [];
      const teacherIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);

      // Get attendance records with division filter
      let attQuery = supabase
        .from("attendance")
        .select("teacher_id, status, class_date, student_id")
        .in("teacher_id", teacherIds)
        .gte("class_date", dateFrom)
        .lte("class_date", dateTo);
      if (divisionId) attQuery = attQuery.eq("division_id", divisionId);
      const { data: attendance } = await attQuery;

      // Get scheduled classes
      let schedQuery = supabase
        .from("schedules")
        .select("assignment_id, day_of_week, student_teacher_assignments!inner(teacher_id)")
        .in("student_teacher_assignments.teacher_id", teacherIds)
        .eq("is_active", true);
      if (divisionId) schedQuery = schedQuery.eq("division_id", divisionId);
      const { data: schedules } = await schedQuery;

      // Get assignments for student count
      let assignQuery = supabase
        .from("student_teacher_assignments")
        .select("teacher_id, student_id, status")
        .in("teacher_id", teacherIds);
      if (divisionId) assignQuery = assignQuery.eq("division_id", divisionId);
      const { data: assignments } = await assignQuery;

      const teachers: Record<string, any> = {};
      (profiles || []).forEach((p: any) => {
        teachers[p.id] = {
          id: p.id,
          name: p.full_name,
          classesTaken: 0,
          totalStudents: 0,
          activeStudents: 0,
          studentPresent: 0,
          totalRecords: 0,
          scheduledPerWeek: 0,
          teacherAbsent: 0,
        };
      });

      (schedules || []).forEach((s: any) => {
        const tid = (s.student_teacher_assignments as any)?.teacher_id;
        if (tid && teachers[tid]) teachers[tid].scheduledPerWeek++;
      });

      (assignments || []).forEach((a: any) => {
        if (teachers[a.teacher_id]) {
          teachers[a.teacher_id].totalStudents++;
          if (a.status === "active") teachers[a.teacher_id].activeStudents++;
        }
      });

      (attendance || []).forEach((r: any) => {
        const t = teachers[r.teacher_id];
        if (!t) return;
        t.totalRecords++;
        if (r.status === "present" || r.status === "late") {
          t.classesTaken++;
          t.studentPresent++;
        }
        if (r.status === "teacher_absent" || r.status === "teacher_leave") t.teacherAbsent++;
      });

      return Object.values(teachers).map((t: any) => ({
        ...t,
        studentAttRate: t.totalRecords > 0 ? Math.round((t.studentPresent / t.totalRecords) * 100) : 0,
        retentionRate: t.totalStudents > 0 ? Math.round((t.activeStudents / t.totalStudents) * 100) : 0,
      }));
    },
  });

  const sorted = [...(perfData || [])].sort((a: any, b: any) => b.classesTaken - a.classesTaken);

  const exportCsv = () => {
    const rows = [["Teacher", "Classes Taken", "Active Students", "Student Att %", "Teacher Absences", "Retention %"]];
    sorted.forEach((t: any) => rows.push([t.name, t.classesTaken, t.activeStudents, t.studentAttRate + "%", t.teacherAbsent, t.retentionRate + "%"]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "teacher_performance.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{sorted.length}</p><p className="text-xs text-muted-foreground">Teachers</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{sorted.reduce((s: number, t: any) => s + t.classesTaken, 0)}</p><p className="text-xs text-muted-foreground">Classes Taken</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{sorted.reduce((s: number, t: any) => s + t.activeStudents, 0)}</p><p className="text-xs text-muted-foreground">Active Students</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{sorted.reduce((s: number, t: any) => s + t.teacherAbsent, 0)}</p><p className="text-xs text-muted-foreground">Teacher Absences</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Teacher</th>
                  <th className="text-center p-3 font-medium">Classes</th>
                  <th className="text-center p-3 font-medium">Students</th>
                  <th className="text-center p-3 font-medium">Student Att %</th>
                  <th className="text-center p-3 font-medium">Absences</th>
                  <th className="text-center p-3 font-medium">Retention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((t: any) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3 text-center">{t.classesTaken}</td>
                    <td className="p-3 text-center">{t.activeStudents}</td>
                    <td className="p-3 text-center"><Badge variant={t.studentAttRate >= 80 ? "default" : "secondary"}>{t.studentAttRate}%</Badge></td>
                    <td className="p-3 text-center">{t.teacherAbsent > 0 ? <Badge variant="destructive">{t.teacherAbsent}</Badge> : "0"}</td>
                    <td className="p-3 text-center"><Badge variant={t.retentionRate >= 80 ? "default" : "secondary"}>{t.retentionRate}%</Badge></td>
                  </tr>
                ))}
                {sorted.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No data found</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
