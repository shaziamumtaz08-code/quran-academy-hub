import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, Search } from "lucide-react";
import { format, subDays } from "date-fns";
import { useState } from "react";
import { useDivision } from "@/contexts/DivisionContext";

export default function AttendanceReports() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchName, setSearchName] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("all");

  // Teachers for filter
  const { data: teachers } = useQuery({
    queryKey: ["report-teachers"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      if (!data?.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", data.map(d => d.user_id));
      return profiles || [];
    },
  });

  // Holidays in range — to exclude from analysis
  const { data: holidays } = useQuery({
    queryKey: ["report-holidays", dateFrom, dateTo, divisionId],
    queryFn: async () => {
      let query = supabase.from("holidays").select("holiday_date").gte("holiday_date", dateFrom).lte("holiday_date", dateTo);
      if (divisionId) query = query.eq("division_id", divisionId);
      const { data } = await query;
      return new Set((data || []).map((h: any) => h.holiday_date));
    },
  });

  // Attendance data
  const { data: attendance } = useQuery({
    queryKey: ["att-report", dateFrom, dateTo, filterTeacher, divisionId],
    queryFn: async () => {
      let query = supabase
        .from("attendance")
        .select("id, status, class_date, student_id, teacher_id, student:profiles!attendance_student_id_fkey(full_name), teacher:profiles!attendance_teacher_id_fkey(full_name)")
        .gte("class_date", dateFrom)
        .lte("class_date", dateTo)
        .order("class_date", { ascending: false });

      if (divisionId) query = query.eq("division_id", divisionId);
      if (filterTeacher !== "all") query = query.eq("teacher_id", filterTeacher);
      const { data } = await query;
      return data || [];
    },
  });

  // Filter out holiday records
  const filteredAttendance = (attendance || []).filter((r: any) => !holidays?.has(r.class_date));

  // Group by student
  const studentSummary = filteredAttendance.reduce((acc: Record<string, any>, r: any) => {
    const sid = r.student_id;
    if (!acc[sid]) {
      acc[sid] = { name: r.student?.full_name || "Unknown", teacher: r.teacher?.full_name || "Unknown", total: 0, present: 0, absent: 0, dates: [] as string[] };
    }
    acc[sid].total++;
    if (r.status === "present" || r.status === "late") acc[sid].present++;
    else acc[sid].absent++;
    if (r.status !== "present" && r.status !== "late" && r.status !== "holiday") acc[sid].dates.push(r.class_date);
    return acc;
  }, {});

  // Absence streak detection
  const getConsecutiveAbsences = (dates: string[]) => {
    if (!dates.length) return 0;
    const sorted = [...dates].sort();
    let max = 1, current = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86400000;
      if (diff <= 2) { current++; max = Math.max(max, current); }
      else current = 1;
    }
    return max;
  };

  const filtered = Object.entries(studentSummary)
    .map(([id, s]: [string, any]) => ({ id, ...s, rate: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0, streak: getConsecutiveAbsences(s.dates) }))
    .filter(s => !searchName || s.name.toLowerCase().includes(searchName.toLowerCase()))
    .sort((a, b) => a.rate - b.rate);

  const exportCsv = () => {
    const rows = [["Student", "Teacher", "Total Classes", "Present", "Absent", "Rate %", "Max Absence Streak"]];
    filtered.forEach(s => rows.push([s.name, s.teacher, s.total, s.present, s.absent, s.rate + "%", s.streak]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_report_${dateFrom}_${dateTo}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            <Select value={filterTeacher} onValueChange={setFilterTeacher}>
              <SelectTrigger><SelectValue placeholder="All Teachers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teachers</SelectItem>
                {(teachers || []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search student..." value={searchName} onChange={e => setSearchName(e.target.value)} />
            </div>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{filtered.length}</p><p className="text-xs text-muted-foreground">Students</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{filteredAttendance.length}</p><p className="text-xs text-muted-foreground">Records (excl. holidays)</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-teal">{filtered.length > 0 ? Math.round(filtered.reduce((s, f) => s + f.rate, 0) / filtered.length) : 0}%</p><p className="text-xs text-muted-foreground">Avg Attendance</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{filtered.filter(f => f.streak >= 3).length}</p><p className="text-xs text-muted-foreground">3+ Day Streaks ⚠️</p></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Student</th>
                  <th className="text-left p-3 font-medium">Teacher</th>
                  <th className="text-center p-3 font-medium">Classes</th>
                  <th className="text-center p-3 font-medium">Present</th>
                  <th className="text-center p-3 font-medium">Rate</th>
                  <th className="text-center p-3 font-medium">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 text-muted-foreground">{s.teacher}</td>
                    <td className="p-3 text-center">{s.total}</td>
                    <td className="p-3 text-center">{s.present}/{s.total}</td>
                    <td className="p-3 text-center">
                      <Badge variant={s.rate >= 80 ? "default" : s.rate >= 50 ? "secondary" : "destructive"}>{s.rate}%</Badge>
                    </td>
                    <td className="p-3 text-center">
                      {s.streak >= 3 ? (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{s.streak} days</Badge>
                      ) : s.streak > 0 ? <span className="text-muted-foreground">{s.streak}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No attendance data found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
