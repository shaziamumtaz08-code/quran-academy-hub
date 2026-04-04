import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, Search, Flame } from "lucide-react";
import { format, subDays } from "date-fns";
import { useState } from "react";
import { useDivision } from "@/contexts/DivisionContext";

export default function StudentEngagement() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const [searchName, setSearchName] = useState("");
  const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  const { data: engagementData } = useQuery({
    queryKey: ["engagement-report", dateFrom, dateTo, divisionId],
    queryFn: async () => {
      // Get active assignments in division
      let assignQuery = supabase
        .from("student_teacher_assignments")
        .select("student_id, student:profiles!student_teacher_assignments_student_id_fkey(full_name)")
        .eq("status", "active");
      if (divisionId) assignQuery = assignQuery.eq("division_id", divisionId);
      const { data: assignments } = await assignQuery;

      if (!assignments?.length) return [];

      const studentIds = [...new Set(assignments.map(a => a.student_id))];

      // Get attendance with Hifz progress fields
      let attQuery = supabase
        .from("attendance")
        .select("student_id, status, class_date, progress_marker, sabaq, lines_completed, raw_input_amount, input_unit, surah_name, ayah_from, ayah_to")
        .in("student_id", studentIds)
        .gte("class_date", dateFrom)
        .lte("class_date", dateTo);
      if (divisionId) attQuery = attQuery.eq("division_id", divisionId);
      const { data: attendance } = await attQuery;

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
            lastSurah: "",
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
        // Use raw_input_amount if available, fall back to lines_completed
        const amount = r.raw_input_amount || r.lines_completed || 0;
        if (amount) s.linesCompleted += Number(amount);
        if (r.progress_marker) s.progressMarkers++;
        if (r.sabaq) s.sabaqCount++;
        if (r.surah_name) s.lastSurah = r.surah_name;
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
    const rows = [["Student", "Attendance %", "Classes", "Lines/Progress", "Sabaq Entries", "Consistency Streak", "Last Surah"]];
    filtered.forEach((s: any) => rows.push([s.name, s.attendanceRate + "%", `${s.present}/${s.totalClasses}`, s.linesCompleted, s.sabaqCount, s.consistency, s.lastSurah]));
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
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{filtered.reduce((s: number, f: any) => s + f.linesCompleted, 0)}</p><p className="text-xs text-muted-foreground">Total Progress</p></CardContent></Card>
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
                  <th className="text-center p-3 font-medium">Hifz Progress</th>
                  <th className="text-center p-3 font-medium">Sabaq</th>
                  <th className="text-center p-3 font-medium">Last Surah</th>
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
                    <td className="p-3 text-center text-muted-foreground text-xs">{s.lastSurah || "—"}</td>
                    <td className="p-3 text-center">
                      {s.consistency >= 5 ? (
                        <Badge variant="default" className="gap-1"><Flame className="h-3 w-3" />{s.consistency} days</Badge>
                      ) : <span className="text-muted-foreground">{s.consistency} days</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No data found</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
