import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, Printer, Search, Wallet, Receipt } from "lucide-react";
import { format, startOfMonth, startOfYear, subMonths } from "date-fns";
import { useDivision } from "@/contexts/DivisionContext";
import { useAuth } from "@/contexts/AuthContext";

type Mode = "teacher" | "student";

type MonthRow = {
  month: string;
  earned: number;
  paid: number;
  balance: number;
  status: string;
  href: string;
};

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return m;
  return format(new Date(y, mo - 1, 1), "MMM yyyy");
};

function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export default function FinancialStatements() {
  const { user } = useAuth();
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;

  const [mode, setMode] = useState<Mode>("teacher");
  const [personId, setPersonId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [monthFrom, setMonthFrom] = useState(format(startOfYear(new Date()), "yyyy-MM"));
  const [monthTo, setMonthTo] = useState(format(startOfMonth(new Date()), "yyyy-MM"));

  const applyPreset = (preset: string) => {
    const now = new Date();
    if (preset === "ytd") {
      setMonthFrom(format(startOfYear(now), "yyyy-MM"));
      setMonthTo(format(now, "yyyy-MM"));
    } else if (preset === "last-12") {
      setMonthFrom(format(subMonths(now, 11), "yyyy-MM"));
      setMonthTo(format(now, "yyyy-MM"));
    } else if (preset === "last-6") {
      setMonthFrom(format(subMonths(now, 5), "yyyy-MM"));
      setMonthTo(format(now, "yyyy-MM"));
    } else if (preset === "this-month") {
      setMonthFrom(format(now, "yyyy-MM"));
      setMonthTo(format(now, "yyyy-MM"));
    }
  };

  // ── People list ────────────────────────────────────────────────
  const { data: people = [] } = useQuery({
    queryKey: ["fin-statement-people", mode],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", mode === "teacher" ? ["teacher", "admin", "admin_academic", "admin_fees", "admin_admissions"] : ["student"]);
      if (rErr) throw rErr;
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (!ids.length) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, archived_at")
        .in("id", ids)
        .order("full_name");
      if (pErr) throw pErr;
      return (profiles || []).filter((p: any) => !p.archived_at);
    },
  });

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people.slice(0, 60);
    return people
      .filter((p: any) => (p.full_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q))
      .slice(0, 60);
  }, [people, search]);

  const selectedPerson = people.find((p: any) => p.id === personId);

  // ── Ledger ─────────────────────────────────────────────────────
  const { data: ledger, isLoading } = useQuery({
    queryKey: ["fin-statement-ledger", mode, personId, monthFrom, monthTo, divisionId],
    enabled: !!personId,
    queryFn: async (): Promise<MonthRow[]> => {
      const months = monthsBetween(monthFrom, monthTo);
      const byMonth = new Map<string, MonthRow>();
      months.forEach((m) =>
        byMonth.set(m, { month: m, earned: 0, paid: 0, balance: 0, status: "—", href: "" }),
      );

      if (mode === "teacher") {
        const { data, error } = await supabase
          .from("salary_payouts")
          .select("id, salary_month, net_salary, amount_paid, status, is_archived")
          .eq("teacher_id", personId as string)
          .gte("salary_month", monthFrom)
          .lte("salary_month", monthTo);
        if (error) throw error;
        (data || [])
          .filter((p: any) => !p.is_archived)
          .forEach((p: any) => {
            const row = byMonth.get(p.salary_month);
            if (!row) return;
            const earned = Number(p.net_salary || 0);
            const paid =
              p.amount_paid != null
                ? Number(p.amount_paid)
                : ["paid", "locked"].includes(p.status)
                  ? earned
                  : 0;
            row.earned += earned;
            row.paid += paid;
            row.status = p.status || "—";
            row.href = `/salary-engine?month=${p.salary_month}&teacher=${personId}`;
          });
      } else {
        let q = supabase
          .from("fee_invoices")
          .select("id, billing_month, amount, amount_paid, forgiven_amount, status, is_archived, voided_at")
          .eq("student_id", personId as string)
          .gte("billing_month", monthFrom)
          .lte("billing_month", monthTo);
        if (divisionId) q = q.or(`division_id.eq.${divisionId},division_id.is.null`);
        const { data, error } = await q;
        if (error) throw error;
        (data || [])
          .filter((i: any) => !i.is_archived && !i.voided_at && i.status !== "voided")
          .forEach((i: any) => {
            const row = byMonth.get(i.billing_month);
            if (!row) return;
            row.earned += Number(i.amount || 0) - Number(i.forgiven_amount || 0);
            row.paid += Number(i.amount_paid || 0);
            row.status = i.status || "—";
            row.href = `/payments?month=${i.billing_month}&student=${personId}`;
          });
      }

      const rows = Array.from(byMonth.values());
      rows.forEach((r) => {
        r.balance = r.earned - r.paid;
      });
      return rows;
    },
  });

  const rows = ledger || [];
  const totals = rows.reduce(
    (acc, r) => ({ earned: acc.earned + r.earned, paid: acc.paid + r.paid, balance: acc.balance + r.balance }),
    { earned: 0, paid: 0, balance: 0 },
  );

  const exportCsv = () => {
    const head = mode === "teacher" ? ["Month", "Earned", "Paid", "Outstanding", "Status"] : ["Month", "Fee Billed", "Received", "Outstanding", "Status"];
    const lines = [
      [`${mode === "teacher" ? "Salary" : "Fee"} Statement`, selectedPerson?.full_name || "", `${monthLabel(monthFrom)} - ${monthLabel(monthTo)}`],
      [],
      head,
      ...rows.map((r) => [monthLabel(r.month), r.earned, r.paid, r.balance, r.status]),
      ["Total", totals.earned, totals.paid, totals.balance, ""],
    ];
    const csv = lines.map((l) => l.map((c) => `"${String(c ?? "")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mode}-statement-${selectedPerson?.full_name || personId}-${monthFrom}_${monthTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setPersonId(null); setSearch(""); }}>
        <TabsList>
          <TabsTrigger value="teacher"><Wallet className="mr-2 h-4 w-4" />Staff Salary Statement</TabsTrigger>
          <TabsTrigger value="student"><Receipt className="mr-2 h-4 w-4" />Student Fee Statement</TabsTrigger>
        </TabsList>
        <TabsContent value={mode} className="mt-4 space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={mode === "teacher" ? "Search staff by name or email" : "Search student by name or email"}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input type="month" value={monthFrom} onChange={(e) => setMonthFrom(e.target.value)} className="w-[150px]" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="month" value={monthTo} onChange={(e) => setMonthTo(e.target.value)} className="w-[150px]" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => applyPreset("this-month")}>This month</Button>
                  <Button variant="outline" size="sm" onClick={() => applyPreset("last-6")}>6 months</Button>
                  <Button variant="outline" size="sm" onClick={() => applyPreset("last-12")}>12 months</Button>
                  <Button variant="outline" size="sm" onClick={() => applyPreset("ytd")}>Year to date</Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {filteredPeople.map((p: any) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={p.id === personId ? "default" : "outline"}
                    onClick={() => setPersonId(p.id)}
                  >
                    {p.full_name || p.email}
                  </Button>
                ))}
                {!filteredPeople.length && (
                  <p className="text-sm text-muted-foreground">No matching people.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {!personId ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Select a {mode === "teacher" ? "staff member" : "student"} above to build their period statement.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{selectedPerson?.full_name || "—"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {mode === "teacher" ? "Salary" : "Fee"} statement · {monthLabel(monthFrom)} – {monthLabel(monthTo)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportCsv}>
                      <Download className="mr-2 h-4 w-4" />CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="mr-2 h-4 w-4" />Print
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryTile label={mode === "teacher" ? "Total earned" : "Total billed"} value={totals.earned} />
                  <SummaryTile label={mode === "teacher" ? "Total paid" : "Total received"} value={totals.paid} />
                  <SummaryTile label="Outstanding" value={totals.balance} highlight={totals.balance !== 0} />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2">Month</th>
                        <th className="py-2 text-right">{mode === "teacher" ? "Earned" : "Fee billed"}</th>
                        <th className="py-2 text-right">{mode === "teacher" ? "Paid" : "Received"}</th>
                        <th className="py-2 text-right">Outstanding</th>
                        <th className="py-2">Status</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading && (
                        <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
                      )}
                      {!isLoading && rows.map((r) => (
                        <tr key={r.month} className="border-b last:border-0">
                          <td className="py-2 font-medium">{monthLabel(r.month)}</td>
                          <td className="py-2 text-right tabular-nums">{money(r.earned)}</td>
                          <td className="py-2 text-right tabular-nums">{money(r.paid)}</td>
                          <td className={`py-2 text-right tabular-nums ${r.balance > 0 ? "text-destructive font-semibold" : r.balance < 0 ? "text-amber-600 font-semibold" : ""}`}>
                            {money(r.balance)}
                          </td>
                          <td className="py-2">
                            <Badge variant={r.status === "paid" ? "default" : r.status === "—" ? "outline" : "secondary"}>
                              {r.status}
                            </Badge>
                          </td>
                          <td className="py-2 text-right">
                            {r.href && (
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={r.href}>Open</Link>
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td className="py-2">Total</td>
                        <td className="py-2 text-right tabular-nums">{money(totals.earned)}</td>
                        <td className="py-2 text-right tabular-nums">{money(totals.paid)}</td>
                        <td className="py-2 text-right tabular-nums">{money(totals.balance)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <p className="text-xs text-muted-foreground">
                  Figures come from saved historical records ({mode === "teacher" ? "salary sheets" : "invoices and payments"}), not from
                  today's rate configuration — changing a rate now does not alter past months.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${highlight ? "text-destructive" : ""}`}>PKR {money(value)}</p>
    </div>
  );
}
