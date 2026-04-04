import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Search } from "lucide-react";
import { format, subMonths } from "date-fns";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useDivision } from "@/contexts/DivisionContext";

export default function FeeReports() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [searchName, setSearchName] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  // Fee invoices by billing_month (not created_at)
  const { data: invoices } = useQuery({
    queryKey: ["fee-report", selectedMonth, divisionId],
    queryFn: async () => {
      let query = supabase
        .from("fee_invoices")
        .select("*, student:profiles!fee_invoices_student_id_fkey(full_name)")
        .eq("billing_month", selectedMonth)
        .order("created_at", { ascending: false });
      if (divisionId) query = query.eq("division_id", divisionId);
      const { data } = await query;
      return data || [];
    },
  });

  // Revenue trend (last 6 months) — ledger-based collected
  const { data: revTrend } = useQuery({
    queryKey: ["fee-trend-report", divisionId],
    queryFn: async () => {
      const result: { month: string; collected: number; expected: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const bm = format(d, "yyyy-MM");
        let query = supabase.from("fee_invoices").select("id, amount, amount_paid, forgiven_amount").eq("billing_month", bm);
        if (divisionId) query = query.eq("division_id", divisionId);
        const { data } = await query;
        const inv = data || [];

        // Collected from payment_transactions ledger
        const ids = inv.map(i => i.id);
        let collected = 0;
        if (ids.length > 0) {
          const { data: txns } = await supabase.from("payment_transactions").select("amount_local").in("invoice_id", ids);
          collected = (txns || []).reduce((s: number, t: any) => s + Number(t.amount_local || 0), 0);
        }

        result.push({
          month: format(d, "MMM"),
          collected: Math.round(collected),
          expected: inv.reduce((s, i) => s + Number(i.amount || 0), 0),
        });
      }
      return result;
    },
  });

  const filtered = (invoices || []).filter((inv: any) => {
    if (searchName && !inv.student?.full_name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    return true;
  });

  // Collected from ledger for this month's filtered invoices
  const { data: monthLedger } = useQuery({
    queryKey: ["fee-report-ledger", selectedMonth, divisionId],
    queryFn: async () => {
      const ids = (invoices || []).map((i: any) => i.id);
      if (!ids.length) return { collected: 0 };
      const { data: txns } = await supabase.from("payment_transactions").select("amount_local, invoice_id").in("invoice_id", ids);
      return { collected: (txns || []).reduce((s: number, t: any) => s + Number(t.amount_local || 0), 0) };
    },
    enabled: !!invoices,
  });

  const totalCollected = Math.round(monthLedger?.collected || 0);
  const totalPending = filtered.filter((i: any) => i.status === "pending" || i.status === "partially_paid")
    .reduce((s: number, i: any) => s + (Number(i.amount) - Number(i.amount_paid || 0) - Number(i.forgiven_amount || 0)), 0);
  const totalForgiven = filtered.reduce((s: number, i: any) => s + Number(i.forgiven_amount || 0), 0);

  const exportCsv = () => {
    const rows = [["Student", "Amount", "Paid", "Forgiven", "Balance", "Status", "Currency"]];
    filtered.forEach((i: any) => rows.push([
      i.student?.full_name, i.amount, i.amount_paid, i.forgiven_amount || 0,
      i.amount - (i.amount_paid || 0) - (i.forgiven_amount || 0), i.status, i.currency
    ]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `fee_report_${selectedMonth}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partially_paid">Partial</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{filtered.length}</p><p className="text-xs text-muted-foreground">Invoices</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-teal">PKR {totalCollected.toLocaleString()}</p><p className="text-xs text-muted-foreground">Collected (Ledger)</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-destructive">PKR {Math.round(totalPending).toLocaleString()}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-gold">PKR {Math.round(totalForgiven).toLocaleString()}</p><p className="text-xs text-muted-foreground">Forgiven</p></CardContent></Card>
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4">Expected vs Collected Revenue (Ledger)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revTrend || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => `PKR ${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="expected" fill="hsl(var(--muted-foreground))" name="Expected" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" fill="hsl(var(--primary))" name="Collected (PKR)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Student</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-right p-3 font-medium">Paid</th>
                  <th className="text-right p-3 font-medium">Forgiven</th>
                  <th className="text-right p-3 font-medium">Balance</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">{inv.student?.full_name}</td>
                    <td className="p-3 text-right">{inv.currency} {inv.amount}</td>
                    <td className="p-3 text-right">{inv.amount_paid || 0}</td>
                    <td className="p-3 text-right">{inv.forgiven_amount || 0}</td>
                    <td className="p-3 text-right font-medium">{inv.amount - (inv.amount_paid || 0) - (inv.forgiven_amount || 0)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={inv.status === "paid" ? "default" : inv.status === "partially_paid" ? "secondary" : "destructive"} className="capitalize">
                        {inv.status?.replace("_", " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No invoices found</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
