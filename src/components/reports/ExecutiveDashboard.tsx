import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarCheck, BookOpen, DollarSign, TrendingUp, TrendingDown, UserPlus, UserMinus } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from "date-fns";
import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function ExecutiveDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  // Active students count
  const { data: studentStats } = useQuery({
    queryKey: ["exec-students"],
    queryFn: async () => {
      const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      const studentIds = (studentRoles || []).map(r => r.user_id);
      const total = studentIds.length;
      if (!total) return { active: 0, total: 0, inactive: 0 };
      const { data: activeProfiles } = await supabase.from("profiles").select("id").eq("status", "active").in("id", studentIds);
      const active = activeProfiles?.length || 0;
      return { active, total, inactive: total - active };
    },
  });

  // Today's attendance
  const { data: todayAttendance } = useQuery({
    queryKey: ["exec-today-attendance"],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("status").eq("class_date", today);
      const records = data || [];
      const present = records.filter(r => r.status === "present" || r.status === "late").length;
      return { total: records.length, present, rate: records.length > 0 ? Math.round((present / records.length) * 100) : 0 };
    },
  });

  // Fees collected
  const { data: feeStats } = useQuery({
    queryKey: ["exec-fees", monthStart],
    queryFn: async () => {
      const { data: monthInvoices } = await supabase.from("fee_invoices").select("amount, amount_paid, status, currency").gte("created_at", monthStart).lte("created_at", monthEnd);
      const invoices = monthInvoices || [];
      const collected = invoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
      const pending = invoices.filter(i => i.status === "pending").reduce((s, i) => s + (i.amount - (i.amount_paid || 0)), 0);
      return { collected, pending, total: invoices.length };
    },
  });

  // New enrollments this month
  const { data: enrollmentStats } = useQuery({
    queryKey: ["exec-enrollments", monthStart],
    queryFn: async () => {
      const { count: newEnrollments } = await supabase.from("student_teacher_assignments").select("*", { count: "exact", head: true }).gte("created_at", monthStart);
      return { new: newEnrollments || 0 };
    },
  });

  // Attendance trend (last 7 days)
  const { data: attendanceTrend } = useQuery({
    queryKey: ["exec-attendance-trend"],
    queryFn: async () => {
      const days: { date: string; present: number; absent: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = format(d, "yyyy-MM-dd");
        const { data } = await supabase.from("attendance").select("status").eq("class_date", dateStr);
        const records = data || [];
        days.push({
          date: format(d, "EEE"),
          present: records.filter(r => r.status === "present" || r.status === "late").length,
          absent: records.filter(r => r.status !== "present" && r.status !== "late").length,
        });
      }
      return days;
    },
  });

  // Fee collection trend (last 6 months)
  const { data: feeTrend } = useQuery({
    queryKey: ["exec-fee-trend"],
    queryFn: async () => {
      const months: { month: string; collected: number; pending: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const ms = format(startOfMonth(d), "yyyy-MM-dd");
        const me = format(endOfMonth(d), "yyyy-MM-dd");
        const { data } = await supabase.from("fee_invoices").select("amount, amount_paid, status").gte("created_at", ms).lte("created_at", me);
        const inv = data || [];
        months.push({
          month: format(d, "MMM"),
          collected: inv.reduce((s, i) => s + (i.amount_paid || 0), 0),
          pending: inv.filter(i => i.status === "pending").reduce((s, i) => s + (i.amount - (i.amount_paid || 0)), 0),
        });
      }
      return months;
    },
  });

  const kpis = [
    { label: "Total Students", value: studentStats?.total || 0, sub: `${studentStats?.active || 0} active`, icon: Users, color: "text-primary" },
    { label: "Today's Attendance", value: `${todayAttendance?.rate || 0}%`, sub: `${todayAttendance?.present || 0}/${todayAttendance?.total || 0} classes`, icon: CalendarCheck, color: "text-green-600" },
    { label: "Classes Today", value: todayAttendance?.total || 0, sub: "sessions conducted", icon: BookOpen, color: "text-blue-600" },
    { label: "Fees Collected", value: `$${(feeStats?.collected || 0).toLocaleString()}`, sub: "this month", icon: DollarSign, color: "text-emerald-600" },
    { label: "Pending Dues", value: `$${(feeStats?.pending || 0).toLocaleString()}`, sub: `${feeStats?.total || 0} invoices`, icon: TrendingDown, color: "text-destructive" },
    { label: "New Enrollments", value: enrollmentStats?.new || 0, sub: "this month", icon: UserPlus, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Attendance (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={attendanceTrend || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" fill="hsl(var(--primary))" name="Present" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill="hsl(var(--destructive))" name="Absent" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Fee Collection Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={feeTrend || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="collected" stroke="hsl(var(--primary))" name="Collected" strokeWidth={2} />
                <Line type="monotone" dataKey="pending" stroke="hsl(var(--destructive))" name="Pending" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
