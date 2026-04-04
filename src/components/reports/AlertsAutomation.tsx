import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, UserMinus, DollarSign } from "lucide-react";
import { format, subDays } from "date-fns";
import { useDivision } from "@/contexts/DivisionContext";

export default function AlertsAutomation() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const today = format(new Date(), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  // Low attendance students (< 50% in last 30 days)
  const { data: lowAttendance } = useQuery({
    queryKey: ["alert-low-attendance", divisionId],
    queryFn: async () => {
      const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
      let query = supabase
        .from("attendance")
        .select("student_id, status, student:profiles!attendance_student_id_fkey(full_name)")
        .gte("class_date", from)
        .lte("class_date", today);
      if (divisionId) query = query.eq("division_id", divisionId);
      const { data } = await query;

      const students: Record<string, { name: string; total: number; present: number }> = {};
      (data || []).forEach((r: any) => {
        if (!students[r.student_id]) students[r.student_id] = { name: r.student?.full_name || "Unknown", total: 0, present: 0 };
        students[r.student_id].total++;
        if (r.status === "present" || r.status === "late") students[r.student_id].present++;
      });

      return Object.entries(students)
        .map(([id, s]) => ({ id, ...s, rate: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0 }))
        .filter(s => s.rate < 50 && s.total >= 3)
        .sort((a, b) => a.rate - b.rate);
    },
  });

  // Overdue fees — use real status + due_date
  const { data: overdueFees } = useQuery({
    queryKey: ["alert-overdue-fees", divisionId],
    queryFn: async () => {
      let query = supabase
        .from("fee_invoices")
        .select("id, amount, amount_paid, forgiven_amount, billing_month, currency, student:profiles!fee_invoices_student_id_fkey(full_name)")
        .in("status", ["pending", "overdue"])
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(20);
      if (divisionId) query = query.eq("division_id", divisionId);
      const { data } = await query;
      return data || [];
    },
  });

  // Teacher missed classes (teacher_absent in last 7 days)
  const { data: teacherMissed } = useQuery({
    queryKey: ["alert-teacher-missed", divisionId],
    queryFn: async () => {
      let query = supabase
        .from("attendance")
        .select("teacher_id, class_date, teacher:profiles!attendance_teacher_id_fkey(full_name)")
        .in("status", ["teacher_absent", "teacher_leave"])
        .gte("class_date", weekAgo)
        .lte("class_date", today);
      if (divisionId) query = query.eq("division_id", divisionId);
      const { data } = await query;

      const teachers: Record<string, { name: string; count: number; dates: string[] }> = {};
      (data || []).forEach((r: any) => {
        if (!teachers[r.teacher_id]) teachers[r.teacher_id] = { name: r.teacher?.full_name || "Unknown", count: 0, dates: [] };
        teachers[r.teacher_id].count++;
        teachers[r.teacher_id].dates.push(r.class_date);
      });

      return Object.entries(teachers).map(([id, t]) => ({ id, ...t })).sort((a, b) => b.count - a.count);
    },
  });

  const alerts = [
    ...(lowAttendance || []).map((s: any) => ({
      type: "attendance" as const,
      icon: UserMinus,
      title: `${s.name} — ${s.rate}% attendance`,
      description: `Only ${s.present} of ${s.total} classes attended in 30 days`,
      severity: s.rate < 30 ? "critical" : "warning",
    })),
    ...(overdueFees || []).map((f: any) => ({
      type: "fee" as const,
      icon: DollarSign,
      title: `${f.student?.full_name} — overdue fee`,
      description: `${f.billing_month}: ${f.currency} ${Number(f.amount) - Number(f.amount_paid || 0) - Number(f.forgiven_amount || 0)} pending`,
      severity: "warning",
    })),
    ...(teacherMissed || []).map((t: any) => ({
      type: "teacher" as const,
      icon: Clock,
      title: `${t.name} — ${t.count} missed classes`,
      description: `Absent on: ${t.dates.map((d: string) => format(new Date(d), "MMM d")).join(", ")}`,
      severity: t.count >= 3 ? "critical" : "warning",
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{lowAttendance?.length || 0}</p><p className="text-xs text-muted-foreground">Low Attendance</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-gold">{overdueFees?.length || 0}</p><p className="text-xs text-muted-foreground">Overdue Fees</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-destructive">{teacherMissed?.length || 0}</p><p className="text-xs text-muted-foreground">Teacher Absences</p></CardContent></Card>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">✨ No active alerts — everything looks good!</p>
          </Card>
        )}
        {alerts.map((alert, i) => (
          <Card key={i} className={`border-l-4 ${alert.severity === "critical" ? "border-l-destructive" : "border-l-gold"}`}>
            <CardContent className="p-4 flex items-start gap-3">
              <alert.icon className={`h-5 w-5 mt-0.5 ${alert.severity === "critical" ? "text-destructive" : "text-gold"}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{alert.title}</p>
                  <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"} className="text-xs capitalize">{alert.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
