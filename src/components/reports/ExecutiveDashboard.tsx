import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, CalendarCheck, BookOpen, DollarSign, TrendingDown, UserPlus } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useDivision } from "@/contexts/DivisionContext";

export default function ExecutiveDashboard() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const today = format(new Date(), "yyyy-MM-dd");
  const currentBillingMonth = format(new Date(), "yyyy-MM");

  // Active students count — via assignments in this division
  const { data: studentStats } = useQuery({
    queryKey: ["exec-students", divisionId],
    queryFn: async () => {
      let query = supabase.from("student_teacher_assignments").select("student_id, status");
      if (divisionId) query = query.eq("division_id", divisionId);
      const { data } = await query;
      const all = data || [];
      const uniqueStudents = [...new Set(all.map(a => a.student_id))];
      const activeStudents = [...new Set(all.filter(a => a.status === "active").map(a => a.student_id))];
      return { active: activeStudents.length, total: uniqueStudents.length, inactive: uniqueStudents.length - activeStudents.length };
    },
  });

  // Today's attendance
  const { data: todayAttendance } = useQuery({
    queryKey: ["exec-today-attendance", divisionId],
    queryFn: async () => {
      let query = supabase.from("attendance").select("status").eq("class_date", today);
      if (divisionId) query = query.eq("division_id", divisionId);
      const { data } = await query;
      const records = data || [];
      const present = records.filter(r => r.status === "present" || r.status === "late").length;
      return { total: records.length, present, rate: records.length > 0 ? Math.round((present / records.length) * 100) : 0 };
    },
  });

  // Fees — use billing_month + payment_transactions ledger (source of truth)
  const { data: feeStats } = useQuery({
    queryKey: ["exec-fees", currentBillingMonth, divisionId],
    queryFn: async () => {
      // Get invoices for current billing month
      let invQuery = supabase.from("fee_invoices").select("id, amount, amount_paid, status, currency, forgiven_amount");
      invQuery = invQuery.eq("billing_month", currentBillingMonth);
      if (divisionId) invQuery = invQuery.eq("division_id", divisionId);
      const { data: invoices } = await invQuery;
      const inv = invoices || [];

      // Collected from payment_transactions ledger (PKR source of truth)
      const invoiceIds = inv.map(i => i.id);
      let collectedPKR = 0;
      if (invoiceIds.length > 0) {
        const { data: txns } = await supabase
          .from("payment_transactions")
          .select("amount_local")
          .in("invoice_id", invoiceIds);
        collectedPKR = (txns || []).reduce((s: number, t: any) => s + Number(t.amount_local || 0), 0);
      }

      // Expected = sum of invoice amounts (simplified, PKR-first)
      const expectedPKR = inv.reduce((s, i) => s + Number(i.amount || 0), 0);
      const pendingPKR = inv.filter(i => i.status === "pending" || i.status === "partially_paid")
        .reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid || 0) - Number(i.forgiven_amount || 0)), 0);

      return { collected: Math.round(collectedPKR), pending: Math.round(pendingPKR), expected: Math.round(expectedPKR), total: inv.length };
    },
  });

  // New enrollments this month
  const { data: enrollmentStats } = useQuery({
    queryKey: ["exec-enrollments", currentBillingMonth, divisionId],
    queryFn: async () => {
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
      let query = supabase.from("student_teacher_assignments").select("*", { count: "exact", head: true }).gte("created_at", monthStart);
      if (divisionId) query = query.eq("division_id", divisionId);
      const { count } = await query;
      return { new: count || 0 };
    },
  });

  // Attendance trend (last 7 days) — single batch query
  const { data: attendanceTrend } = useQuery({
    queryKey: ["exec-attendance-trend", divisionId],
    queryFn: async () => {
      const weekAgo = format(new Date(Date.now() - 6 * 86400000), "yyyy-MM-dd");
      let query = supabase.from("attendance").select("status, class_date").gte("class_date", weekAgo).lte("class_date", today);
      if (divisionId) query = query.eq("division_id", divisionId);
      const { data } = await query;

      // Also fetch holidays to exclude
      let holQuery = supabase.from("holidays").select("holiday_date").gte("holiday_date", weekAgo).lte("holiday_date", today);
      if (divisionId) holQuery = holQuery.eq("division_id", divisionId);
      const { data: holidays } = await holQuery;
      const holidayDates = new Set((holidays || []).map((h: any) => h.holiday_date));

      const dayMap: Record<string, { present: number; absent: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dateStr = format(d, "yyyy-MM-dd");
        if (!holidayDates.has(dateStr)) {
          dayMap[dateStr] = { present: 0, absent: 0 };
        }
      }

      (data || []).forEach((r: any) => {
        if (!dayMap[r.class_date]) return;
        if (r.status === "present" || r.status === "late") dayMap[r.class_date].present++;
        else dayMap[r.class_date].absent++;
      });

      return Object.entries(dayMap).map(([date, counts]) => ({
        date: format(new Date(date), "EEE"),
        ...counts,
      }));
    },
  });

  // Fee collection trend (last 6 months) — use billing_month + ledger
  const { data: feeTrend } = useQuery({
    queryKey: ["exec-fee-trend", divisionId],
    queryFn: async () => {
      const months: { month: string; collected: number; expected: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const bm = format(d, "yyyy-MM");
        let query = supabase.from("fee_invoices").select("id, amount, amount_paid").eq("billing_month", bm);
        if (divisionId) query = query.eq("division_id", divisionId);
        const { data: inv } = await query;
        const invoices = inv || [];

        // Get collected from ledger
        const ids = invoices.map(i => i.id);
        let collected = 0;
        if (ids.length > 0) {
          const { data: txns } = await supabase.from("payment_transactions").select("amount_local").in("invoice_id", ids);
          collected = (txns || []).reduce((s: number, t: any) => s + Number(t.amount_local || 0), 0);
        }

        months.push({
          month: format(d, "MMM"),
          collected: Math.round(collected),
          expected: invoices.reduce((s, i) => s + Number(i.amount || 0), 0),
        });
      }
      return months;
    },
  });

  const kpis = [
    { label: "Total Students", value: studentStats?.total || 0, sub: `${studentStats?.active || 0} active`, icon: Users, color: "text-primary" },
    { label: "Today's Attendance", value: `${todayAttendance?.rate || 0}%`, sub: `${todayAttendance?.present || 0}/${todayAttendance?.total || 0} classes`, icon: CalendarCheck, color: "text-teal" },
    { label: "Classes Today", value: todayAttendance?.total || 0, sub: "sessions conducted", icon: BookOpen, color: "text-sky" },
    { label: "Fees Collected", value: `PKR ${(feeStats?.collected || 0).toLocaleString()}`, sub: "this month (ledger)", icon: DollarSign, color: "text-teal" },
    { label: "Pending Dues", value: `PKR ${(feeStats?.pending || 0).toLocaleString()}`, sub: `${feeStats?.total || 0} invoices`, icon: TrendingDown, color: "text-destructive" },
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
            <h3 className="font-semibold mb-4">Attendance (Last 7 Days, excl. holidays)</h3>
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
            <h3 className="font-semibold mb-4">Fee Collection Trend (Ledger)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={feeTrend || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value: number) => `PKR ${value.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="collected" stroke="hsl(var(--primary))" name="Collected (PKR)" strokeWidth={2} />
                <Line type="monotone" dataKey="expected" stroke="hsl(var(--muted-foreground))" name="Expected" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
