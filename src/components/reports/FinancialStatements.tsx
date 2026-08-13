import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, Printer, Search, Wallet, Receipt, ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";
import { format, startOfMonth, startOfYear, subMonths, endOfMonth, parseISO, differenceInCalendarDays, getDaysInMonth } from "date-fns";
import { useDivision } from "@/contexts/DivisionContext";
import { useAuth } from "@/contexts/AuthContext";
import { assignmentMonthWindow, SALARY_ASSIGNMENT_STATUSES } from "@/lib/salaryWindow";

type Mode = "teacher" | "student";

type ExpectedLine = {
  id: string;
  studentName: string;
  status: string;
  payoutAmount: number;
  prorated: number;
  activeDays: number;
  monthDays: number;
};

type MonthRow = {
  month: string;
  earned: number;
  paid: number;
  balance: number;
  status: string;
  href: string;
  hasSheet: boolean;
  expected: number;
  lines: ExpectedLine[];
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
        byMonth.set(m, {
          month: m,
          earned: 0,
          paid: 0,
          balance: 0,
          status: "not_generated",
          href: "",
          hasSheet: false,
          expected: 0,
          lines: [],
        }),
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
            row.hasSheet = true;
            row.status = p.status || "—";
            row.href = `/salary?month=${p.salary_month}&teacher=${personId}`;
          });

        // Expected: assignments active in each month (what SHOULD have been billed)
        const { data: assigns, error: aErr } = await supabase
          .from("student_teacher_assignments")
          .select(
            "id, student_id, payout_amount, status, effective_from_date, effective_to_date, status_effective_date, salary_linked, profiles!student_teacher_assignments_student_id_fkey(full_name)",
          )
          .eq("teacher_id", personId as string)
          .in("status", [...SALARY_ASSIGNMENT_STATUSES]);
        if (aErr) throw aErr;

        months.forEach((m) => {
          const row = byMonth.get(m)!;
          const monthStart = `${m}-01`;
          const monthEndDate = endOfMonth(parseISO(monthStart));
          const monthEnd = format(monthEndDate, "yyyy-MM-dd");
          const monthDays = getDaysInMonth(monthEndDate);
          (assigns || []).forEach((a: any) => {
            if (a.salary_linked === false) return;
            const win = assignmentMonthWindow(a, monthStart, monthEnd);
            if (!win) return;
            const activeDays =
              differenceInCalendarDays(parseISO(win.dateTo), parseISO(win.dateFrom)) + 1;
            const base = Number(a.payout_amount || 0);
            const prorated = (base / monthDays) * activeDays;
            row.lines.push({
              id: a.id,
              studentName: a.profiles?.full_name || "Unnamed student",
              status: a.status || "—",
              payoutAmount: base,
              prorated,
              activeDays,
              monthDays,
            });
            row.expected += prorated;
          });
          if (!row.href) row.href = `/salary?month=${m}&teacher=${personId}`;
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
            row.hasSheet = true;
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

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // ── Missing sheets banner (all teachers in range) ───────────────
  const { data: missingCount = 0 } = useQuery({
    queryKey: ["fin-statement-missing-sheets", monthFrom, monthTo],
    enabled: mode === "teacher",
    queryFn: async () => {
      const months = monthsBetween(monthFrom, monthTo);
      const [{ data: assigns }, { data: payouts }] = await Promise.all([
        supabase
          .from("student_teacher_assignments")
          .select("teacher_id, effective_from_date, effective_to_date, status_effective_date, status, salary_linked")
          .in("status", [...SALARY_ASSIGNMENT_STATUSES]),
        supabase
          .from("salary_payouts")
          .select("teacher_id, salary_month, is_archived")
          .gte("salary_month", monthFrom)
          .lte("salary_month", monthTo),
      ]);
      const have = new Set(
        (payouts || [])
          .filter((p: any) => !p.is_archived)
          .map((p: any) => `${p.teacher_id}|${p.salary_month}`),
      );
      let missing = 0;
      months.forEach((m) => {
        const monthStart = `${m}-01`;
        const monthEnd = format(endOfMonth(parseISO(monthStart)), "yyyy-MM-dd");
        const teachers = new Set<string>();
        (assigns || []).forEach((a: any) => {
          if (a.salary_linked === false) return;
          if (assignmentMonthWindow(a, monthStart, monthEnd)) teachers.add(a.teacher_id);
        });
        teachers.forEach((t) => {
          if (!have.has(`${t}|${m}`)) missing += 1;
        });
      });
      return missing;
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
      {mode === "teacher" && missingCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            {missingCount} teacher-month{missingCount === 1 ? "" : "s"} missing salary sheets in this date range.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/salary?audit=1">Open Salary Sheet Audit</Link>
          </Button>
        </div>
      )}
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
                        {mode === "teacher" && <th className="py-2 text-right">Expected</th>}
                        <th className="py-2 text-right">{mode === "teacher" ? "Paid" : "Received"}</th>
                        <th className="py-2 text-right">Outstanding</th>
                        <th className="py-2">Status</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading && (
                        <tr><td colSpan={mode === "teacher" ? 7 : 6} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
                      )}
                      {!isLoading && rows.map((r) => {
                        const isOpen = expandedMonth === r.month;
                        const showExpected = mode === "teacher" && (!r.hasSheet || r.status === "draft");
                        return (
                        <Fragment key={r.month}>
                        <tr className="border-b last:border-0">
                          <td className="py-2 font-medium">
                            {mode === "teacher" ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 hover:underline"
                                onClick={() => setExpandedMonth(isOpen ? null : r.month)}
                              >
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                {monthLabel(r.month)}
                              </button>
                            ) : (
                              monthLabel(r.month)
                            )}
                          </td>
                          <td className={`py-2 text-right tabular-nums ${!r.hasSheet ? "text-muted-foreground" : ""}`}>
                            {r.hasSheet ? money(r.earned) : "—"}
                          </td>
                          {mode === "teacher" && (
                            <td className={`py-2 text-right tabular-nums ${showExpected && r.expected > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
                              {r.expected > 0 ? money(r.expected) : "—"}
                            </td>
                          )}
                          <td className="py-2 text-right tabular-nums">{money(r.paid)}</td>
                          <td className={`py-2 text-right tabular-nums ${r.balance > 0 ? "text-destructive font-semibold" : r.balance < 0 ? "text-amber-600 font-semibold" : ""}`}>
                            {money(r.balance)}
                          </td>
                          <td className="py-2">
                            {!r.hasSheet ? (
                              <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/10">
                                {mode === "teacher" ? "Not generated" : "No invoice"}
                              </Badge>
                            ) : (
                              <Badge variant={r.status === "paid" ? "default" : "secondary"}>{r.status}</Badge>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            {r.href && (
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={r.href}>Open</Link>
                              </Button>
                            )}
                          </td>
                        </tr>
                        {mode === "teacher" && isOpen && (
                          <tr key={`${r.month}-detail`} className="border-b bg-muted/30">
                            <td colSpan={7} className="p-3">
                              {r.lines.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No active assignments in this month.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-muted-foreground">
                                      <th className="py-1">Student</th>
                                      <th className="py-1">Assignment status</th>
                                      <th className="py-1 text-right">Payout rate</th>
                                      <th className="py-1 text-right">Active days</th>
                                      <th className="py-1 text-right">Expected (prorated)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.lines.map((l) => (
                                      <tr key={l.id} className="border-t">
                                        <td className="py-1">{l.studentName}</td>
                                        <td className="py-1 capitalize">{l.status}</td>
                                        <td className="py-1 text-right tabular-nums">{money(l.payoutAmount)}</td>
                                        <td className="py-1 text-right tabular-nums">{l.activeDays}/{l.monthDays}</td>
                                        <td className="py-1 text-right tabular-nums">{money(l.prorated)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                        </Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-semibold">
                        <td className="py-2">Total</td>
                        <td className="py-2 text-right tabular-nums">{money(totals.earned)}</td>
                        {mode === "teacher" && (
                          <td className="py-2 text-right tabular-nums">{money(rows.reduce((s, r) => s + r.expected, 0))}</td>
                        )}
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
