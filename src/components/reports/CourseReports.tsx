import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function CourseReports() {
  const { data: courses } = useQuery({
    queryKey: ["course-reports"],
    queryFn: async () => {
      const { data: allCourses } = await supabase
        .from("courses")
        .select("id, name, status, max_students, teacher_id, start_date, teacher:profiles!courses_teacher_id_fkey(full_name)")
        .order("created_at", { ascending: false });

      if (!allCourses?.length) return [];

      // Get enrollment counts
      const courseIds = allCourses.map(c => c.id);
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

  const exportCsv = () => {
    const rows = [["Course", "Teacher", "Status", "Active Students", "Total Enrolled", "Drop-off %"]];
    (courses || []).forEach((c: any) => rows.push([c.name, c.teacher?.full_name, c.status, c.enrollments.active, c.enrollments.total, c.dropoffRate + "%"]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "course_reports.csv"; a.click();
  };

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
