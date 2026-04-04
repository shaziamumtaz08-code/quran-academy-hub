import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, Trash2, Play } from "lucide-react";
import { format, subDays } from "date-fns";
import { useDivision } from "@/contexts/DivisionContext";

type Condition = {
  field: string;
  operator: string;
  value: string;
};

const fieldOptions = [
  { value: "attendance_rate", label: "Attendance %" },
  { value: "fee_status", label: "Fee Status" },
  { value: "inactive_days", label: "Inactive Days" },
  { value: "total_classes", label: "Total Classes" },
  { value: "lines_completed", label: "Hifz Progress" },
  { value: "fee_pending", label: "Fee Balance (PKR)" },
];

const operatorOptions = [
  { value: "<", label: "Less than" },
  { value: ">", label: "Greater than" },
  { value: "=", label: "Equals" },
  { value: "<=", label: "≤" },
  { value: ">=", label: "≥" },
];

export default function CustomReportBuilder() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;
  const [conditions, setConditions] = useState<Condition[]>([{ field: "attendance_rate", operator: "<", value: "50" }]);
  const [runQuery, setRunQuery] = useState(false);

  const addCondition = () => setConditions(c => [...c, { field: "attendance_rate", operator: "<", value: "" }]);
  const removeCondition = (i: number) => setConditions(c => c.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, key: keyof Condition, val: string) =>
    setConditions(c => c.map((cond, idx) => idx === i ? { ...cond, [key]: val } : cond));

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ["custom-report", JSON.stringify(conditions), divisionId],
    queryFn: async () => {
      const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const dateTo = format(new Date(), "yyyy-MM-dd");
      const currentBM = format(new Date(), "yyyy-MM");

      // Fetch active assignments in division
      let assignQuery = supabase
        .from("student_teacher_assignments")
        .select("student_id, teacher_id, status, student:profiles!student_teacher_assignments_student_id_fkey(full_name)")
        .eq("status", "active");
      if (divisionId) assignQuery = assignQuery.eq("division_id", divisionId);
      const { data: assignments } = await assignQuery;

      if (!assignments?.length) return [];

      const studentIds = [...new Set(assignments.map(a => a.student_id))];

      // Attendance
      let attQuery = supabase
        .from("attendance")
        .select("student_id, status, class_date, lines_completed, raw_input_amount")
        .in("student_id", studentIds)
        .gte("class_date", dateFrom)
        .lte("class_date", dateTo);
      if (divisionId) attQuery = attQuery.eq("division_id", divisionId);
      const { data: attendance } = await attQuery;

      // Fees — current billing month pending invoices
      let feeQuery = supabase
        .from("fee_invoices")
        .select("student_id, status, amount, amount_paid, forgiven_amount")
        .in("student_id", studentIds)
        .in("status", ["pending", "partially_paid", "overdue"]);
      if (divisionId) feeQuery = feeQuery.eq("division_id", divisionId);
      const { data: invoices } = await feeQuery;

      // Build student records
      const students: Record<string, any> = {};
      assignments.forEach((a: any) => {
        if (!students[a.student_id]) {
          students[a.student_id] = {
            id: a.student_id,
            name: a.student?.full_name || "Unknown",
            total_classes: 0,
            present: 0,
            attendance_rate: 0,
            lines_completed: 0,
            fee_status: "paid",
            fee_pending: 0,
            last_class: "",
            inactive_days: 30,
          };
        }
      });

      (attendance || []).forEach((r: any) => {
        const s = students[r.student_id];
        if (!s) return;
        s.total_classes++;
        if (r.status === "present" || r.status === "late") {
          s.present++;
          if (!s.last_class || r.class_date > s.last_class) s.last_class = r.class_date;
        }
        const amount = r.raw_input_amount || r.lines_completed || 0;
        if (amount) s.lines_completed += Number(amount);
      });

      Object.values(students).forEach((s: any) => {
        s.attendance_rate = s.total_classes > 0 ? Math.round((s.present / s.total_classes) * 100) : 0;
        s.inactive_days = s.last_class ? Math.floor((Date.now() - new Date(s.last_class).getTime()) / 86400000) : 30;
      });

      (invoices || []).forEach((inv: any) => {
        const s = students[inv.student_id];
        if (!s) return;
        s.fee_status = "unpaid";
        s.fee_pending += (Number(inv.amount) - Number(inv.amount_paid || 0) - Number(inv.forgiven_amount || 0));
      });

      // Apply conditions
      let filtered = Object.values(students);
      conditions.forEach(cond => {
        filtered = filtered.filter((s: any) => {
          const val = s[cond.field];
          const target = cond.field === "fee_status" ? cond.value : parseFloat(cond.value);
          if (cond.field === "fee_status") return cond.operator === "=" ? val === target : val !== target;
          switch (cond.operator) {
            case "<": return val < target;
            case ">": return val > target;
            case "=": return val === target;
            case "<=": return val <= target;
            case ">=": return val >= target;
            default: return true;
          }
        });
      });

      return filtered;
    },
    enabled: runQuery,
  });

  const handleRun = () => { setRunQuery(true); refetch(); };

  const exportCsv = () => {
    if (!results?.length) return;
    const rows = [["Student", "Attendance %", "Classes", "Hifz Progress", "Fee Status", "Fee Balance", "Inactive Days"]];
    results.forEach((s: any) => rows.push([s.name, s.attendance_rate + "%", s.total_classes, s.lines_completed, s.fee_status, s.fee_pending, s.inactive_days]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "custom_report.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold">Filter Conditions</h3>
          {conditions.map((cond, i) => (
            <div key={i} className="flex gap-2 items-center flex-wrap">
              {i > 0 && <Badge variant="secondary" className="text-xs">AND</Badge>}
              <Select value={cond.field} onValueChange={v => updateCondition(i, "field", v)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>{fieldOptions.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={cond.operator} onValueChange={v => updateCondition(i, "operator", v)}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>{operatorOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              {cond.field === "fee_status" ? (
                <Select value={cond.value} onValueChange={v => updateCondition(i, "value", v)}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input type="number" value={cond.value} onChange={e => updateCondition(i, "value", e.target.value)} className="w-[100px]" placeholder="Value" />
              )}
              {conditions.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeCondition(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addCondition}><Plus className="h-4 w-4 mr-1" />Add Condition</Button>
            <Button size="sm" onClick={handleRun} disabled={isLoading}><Play className="h-4 w-4 mr-1" />{isLoading ? "Running..." : "Run Report"}</Button>
          </div>
        </CardContent>
      </Card>

      {results && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{results.length} results found</p>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Student</th>
                      <th className="text-center p-3 font-medium">Attendance</th>
                      <th className="text-center p-3 font-medium">Classes</th>
                      <th className="text-center p-3 font-medium">Progress</th>
                      <th className="text-center p-3 font-medium">Fee Status</th>
                      <th className="text-center p-3 font-medium">Balance</th>
                      <th className="text-center p-3 font-medium">Inactive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {results.map((s: any) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{s.name}</td>
                        <td className="p-3 text-center"><Badge variant={s.attendance_rate >= 50 ? "default" : "destructive"}>{s.attendance_rate}%</Badge></td>
                        <td className="p-3 text-center">{s.total_classes}</td>
                        <td className="p-3 text-center">{s.lines_completed}</td>
                        <td className="p-3 text-center"><Badge variant={s.fee_status === "paid" ? "default" : "destructive"} className="capitalize">{s.fee_status}</Badge></td>
                        <td className="p-3 text-center">{s.fee_pending > 0 ? <span className="text-destructive font-medium">PKR {Math.round(s.fee_pending).toLocaleString()}</span> : "—"}</td>
                        <td className="p-3 text-center">{s.inactive_days > 7 ? <Badge variant="destructive">{s.inactive_days}d</Badge> : <span>{s.inactive_days}d</span>}</td>
                      </tr>
                    ))}
                    {results.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No students match your criteria</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
