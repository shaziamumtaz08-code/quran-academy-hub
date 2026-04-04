import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Search, Flame } from "lucide-react";
import { format, subDays } from "date-fns";
import { useState } from "react";

export default function StudentEngagement() {
  const [searchName, setSearchName] = useState("");
  const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  // Student attendance + assignments data
  const { data: engagementData } = useQuery({
    queryKey: ["engagement-report", dateFrom, dateTo],
    queryFn: async () => {
      // Get all student assignments
      const { data: assignments } = await supabase
        .from("student_teacher_assignments")
        .select("student_id, student:profiles!student_teacher_assignments_student_id_fkey(full_name)")
        .eq("status", "active");

      if (!assignments?.length) return [];

      // Get attendance for these students
      const studentIds = [...new Set(assignments.map(a => a.student_id))];
      const { data: attendance } = await supabase
        .from("attendance")
        .select("student_id, status, class_date, progress_marker, sabaq, lines_completed")
        .in("student_id", studentIds)
        .gte("class_date", dateFrom)
        .lte("class_date", dateTo);

      // Build engagement per student
      const students: Record<string, any> = {};
      assignments.forEach((a: any) => {
        if (!students[a.student_id]) {
          students[a.student_id] = {
            id: a.student_id,
            name: a.student?.full_name || "Unknown",
            totalClasses: 0,
            present: 0,
            linesCompleted: 0,
            progressMarkers: 0,
            sabaqCount: 0,
            dates: [] as string[],
          };
        }
      });

      (attendance || []).forEach((r: any) => {
        const s = students[r.student_id];
        if (!s) return;
        s.totalClasses++;
        if (r.status === "present" || r.status === "late") {
          s.present++;
          s.dates.push(r.class_date);
        }
        if (r.lines_completed) s.linesCompleted += r.lines_completed;
        if (r.progress_marker) s.progressMarkers++;
        if (r.sabaq) s.sabaqCount++;
      });

      return Object.values(students).map((s: any) => ({
        ...s,
        attendanceRate: s.totalClasses > 0 ? Math.round((s.present / s.totalClasses) * 100) : 0,
        consistency: getConsistencyStreak(s.dates),
      }));
    },
  });

  function getConsistencyStreak(dates: string[]): number {
    if (!dates.length) return 0;
    const sorted = [...new Set(dates)].sort().reverse();
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i - 1]).getTime() - new Date(sorted[i]).getTime()) / 86400000;
      if (diff <= 3) streak++;
      else break;
    }
    return streak;
  }

  const filtered = (engagementData || [])
    .filter((s: any) => !searchName || s.name.toLowerCase().includes(searchName.toLowerCase()))
    .sort((a: any, b: any) => b.attendanceRate - a.attendanceRate);

  const exportCsv = () => {
    const rows = [["Student", "Attendance %", "Classes", "Lines Completed", "Sabaq Entries", "Consistency Streak"]];
    filtered.forEach((s: any) => rows.push([s.name, s.attendanceRate + "%", `${s.present}/${s.totalClasses}`, s.linesCompleted, s.sabaqCount, s.consistency]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "student_engagement.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search student..." value={searchName} onChange={e => setSearchName(e.target.value)} />
            </div>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{filtered.length}</p><p className="text-xs text-muted-foreground">Students</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{filtered.length > 0 ? Math.round(filtered.reduce((s: number, f: any) => s + f.attendanceRate, 0) / filtered.length) : 0}%</p><p className="text-xs text-muted-foreground">Avg Attendance</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{filtered.reduce((s: number, f: any) => s + f.linesCompleted, 0)}</p><p className="text-xs text-muted-foreground">Total Lines</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{filtered.reduce((s: number, f: any) => s + f.sabaqCount, 0)}</p><p className="text-xs text-muted-foreground">Sabaq Entries</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Student</th>
                  <th className="text-center p-3 font-medium">Attendance</th>
                  <th className="text-center p-3 font-medium">Hifz Lines</th>
                  <th className="text-center p-3 font-medium">Sabaq</th>
                  <th className="text-center p-3 font-medium">Consistency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s: any) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 text-center">
                      <Badge variant={s.attendanceRate >= 80 ? "default" : s.attendanceRate >= 50 ? "secondary" : "destructive"}>{s.attendanceRate}%</Badge>
                    </td>
                    <td className="p-3 text-center">{s.linesCompleted}</td>
                    <td className="p-3 text-center">{s.sabaqCount}</td>
                    <td className="p-3 text-center">
                      {s.consistency >= 5 ? (
                        <Badge variant="default" className="gap-1"><Flame className="h-3 w-3" />{s.consistency} days</Badge>
                      ) : <span className="text-muted-foreground">{s.consistency} days</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No data found</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
