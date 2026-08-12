import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Printer, Users, Search } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, eachDayOfInterval, parseISO } from "date-fns";
import { useDivision } from "@/contexts/DivisionContext";
import { useAuth } from "@/contexts/AuthContext";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

type Row = {
  id: string;
  name: string;
  coverage: number;
  timeliness: number;
  planRate: number;
  planPunctuality: number;
  detail: number;
  score: number;
  tier: "full" | "partial" | "non";
};

const tierMeta = {
  full: { label: "Full Compliance", variant: "default" as const },
  partial: { label: "Partial Compliance", variant: "secondary" as const },
  non: { label: "Non-Compliance", variant: "destructive" as const },
};

export default function ComplianceReport() {
  const { user } = useAuth();
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;

  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState("");

  const applyPreset = (preset: string) => {
    const now = new Date();
    if (preset === "this-month") {
      setDateFrom(format(startOfMonth(now), "yyyy-MM-dd"));
      setDateTo(format(now, "yyyy-MM-dd"));
    } else if (preset === "last-month") {
      const m = subMonths(now, 1);
      setDateFrom(format(startOfMonth(m), "yyyy-MM-dd"));
      setDateTo(format(endOfMonth(m), "yyyy-MM-dd"));
    } else if (preset === "last-30") {
      setDateFrom(format(subDays(now, 30), "yyyy-MM-dd"));
      setDateTo(format(now, "yyyy-MM-dd"));
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["compliance-report", dateFrom, dateTo, divisionId],
    enabled: !!user?.id,
    queryFn: async () => {
      let aq = supabase
        .from("student_teacher_assignments")
        .select(
          "id, teacher_id, status, start_date, effective_to_date, status_effective_date, requires_planning, requires_attendance, teacher:profiles!student_teacher_assignments_teacher_id_fkey(full_name, archived_at)",
        );
      if (divisionId) aq = aq.eq("division_id", divisionId);
      const { data: assignments, error: aErr } = await aq;
      if (aErr) throw aErr;

      const assignmentIds = (assignments || []).map((a: any) => a.id);
      const { data: schedules, error: sErr } = await supabase
        .from("schedules")
        .select("assignment_id, day_of_week, is_active")
        .in("assignment_id", assignmentIds.length ? assignmentIds : ["00000000-0000-0000-0000-000000000000"]);
      if (sErr) throw sErr;

      let atq = supabase
        .from("attendance")
        .select("teacher_id, class_date, created_at, lesson_covered, status")
        .gte("class_date", dateFrom)
        .lte("class_date", dateTo);
      if (divisionId) atq = atq.or(`division_id.eq.${divisionId},division_id.is.null`);
      const { data: attendance, error: atErr } = await atq;
      if (atErr) throw atErr;

      const from = parseISO(dateFrom);
      const to = parseISO(dateTo);
      let pq = supabase
        .from("student_monthly_plans")
        .select("teacher_id, assignment_id, month, year, created_at, status")
        .gte("year", from.getFullYear())
        .lte("year", to.getFullYear());
      if (divisionId) pq = pq.eq("division_id", divisionId);
      const { data: plans, error: pErr } = await pq;
      if (pErr) throw pErr;

      const { data: holidayRows } = await supabase
        .from("holidays")
        .select("holiday_date")
        .gte("holiday_date", dateFrom)
        .lte("holiday_date", dateTo);
      const holidays = new Set((holidayRows || []).map((h: any) => h.holiday_date));

      return { assignments: assignments || [], schedules: schedules || [], attendance: attendance || [], plans: plans || [], holidays };
    },
  });

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const { assignments, schedules, attendance, plans, holidays } = data as any;

    const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) }).filter(
      (d) => !holidays.has(format(d, "yyyy-MM-dd")),
    );
    const monthsInRange = Array.from(
      new Set(days.map((d) => `${d.getFullYear()}-${d.getMonth() + 1}`)),
    );

    const schedByAssignment = new Map<string, string[]>();
    (schedules as any[]).forEach((s) => {
      if (s.is_active === false) return;
      const list = schedByAssignment.get(s.assignment_id) || [];
      list.push(String(s.day_of_week || "").toLowerCase());
      schedByAssignment.set(s.assignment_id, list);
    });

    const agg = new Map<string, any>();
    const ensure = (id: string, name: string) => {
      if (!agg.has(id))
        agg.set(id, { id, name, expected: 0, marked: 0, onTime: 0, withDetail: 0, plansDue: 0, plansDone: 0, plansOnTime: 0 });
      return agg.get(id);
    };

    (assignments as any[]).forEach((a) => {
      if (!a.teacher_id || a.teacher?.archived_at) return;
      const t = ensure(a.teacher_id, a.teacher?.full_name || "Unknown");
      const startBound = a.start_date ? parseISO(a.start_date) : null;
      const endBound = a.effective_to_date
        ? parseISO(a.effective_to_date)
        : a.status !== "active" && a.status_effective_date
          ? parseISO(a.status_effective_date)
          : null;
      const activeDays = days.filter(
        (d) => (!startBound || d >= startBound) && (!endBound || d <= endBound),
      );
      if (a.requires_attendance !== false) {
        const sched = schedByAssignment.get(a.id) || [];
        t.expected += activeDays.filter((d) => sched.includes(DAY_NAMES[d.getDay()])).length;
      }
      if (a.requires_planning) {
        monthsInRange.forEach((key) => {
          const [y, m] = key.split("-").map(Number);
          const monthStart = new Date(y, m - 1, 1);
          const monthEnd = endOfMonth(monthStart);
          if ((startBound && startBound > monthEnd) || (endBound && endBound < monthStart)) return;
          t.plansDue += 1;
          const plan = (plans as any[]).find(
            (p) => p.assignment_id === a.id && p.month === m && p.year === y,
          );
          if (plan) {
            t.plansDone += 1;
            const created = plan.created_at ? new Date(plan.created_at) : null;
            if (created && created <= new Date(y, m - 1, 3, 23, 59, 59)) t.plansOnTime += 1;
          }
        });
      }
    });

    (attendance as any[]).forEach((r) => {
      if (!r.teacher_id || holidays.has(r.class_date)) return;
      const t = agg.get(r.teacher_id);
      if (!t) return;
      t.marked += 1;
      if (r.created_at) {
        const diffH = (new Date(r.created_at).getTime() - parseISO(r.class_date).getTime()) / 3600000;
        if (diffH <= 48) t.onTime += 1;
      }
      if (r.lesson_covered && String(r.lesson_covered).trim().length > 3) t.withDetail += 1;
    });

    const pct = (n: number, d: number) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0);

    return Array.from(agg.values())
      .filter((t) => t.expected > 0 || t.plansDue > 0 || t.marked > 0)
      .map((t) => {
        const coverage = pct(t.marked, t.expected || t.marked);
        const timeliness = pct(t.onTime, t.marked);
        const planRate = t.plansDue ? pct(t.plansDone, t.plansDue) : 100;
        const planPunctuality = t.plansDone ? pct(t.plansOnTime, t.plansDone) : 100;
        const detail = pct(t.withDetail, t.marked);
        const score = Math.round(
          coverage * 0.4 + timeliness * 0.2 + planRate * 0.25 + planPunctuality * 0.1 + detail * 0.05,
        );
        const tier: Row["tier"] = score >= 90 ? "full" : score >= 60 ? "partial" : "non";
        return { id: t.id, name: t.name, coverage, timeliness, planRate, planPunctuality, detail, score, tier };
      })
      .sort((a, b) => b.score - a.score);
  }, [data, dateFrom, dateTo]);

  const visible = rows.filter((r) => !excluded.includes(r.id));

  const exportCsv = () => {
    const head = ["Teacher", "Score", "Tier", "Attendance Coverage %", "Marking Timeliness %", "Plan Submission %", "Plan Punctuality %", "Lesson Detail %"];
    const body = visible.map((r) => [r.name, r.score, tierMeta[r.tier].label, r.coverage, r.timeliness, r.planRate, r.planPunctuality, r.detail]);
    const csv = [head, ...body].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `compliance_report_${dateFrom}_${dateTo}.csv`;
    a.click();
  };

  const grouped: Array<[Row["tier"], Row[]]> = [
    ["full", visible.filter((r) => r.tier === "full")],
    ["partial", visible.filter((r) => r.tier === "partial")],
    ["non", visible.filter((r) => r.tier === "non")],
  ];

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  {excluded.length ? `${excluded.length} excluded` : "All teachers"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <div className="border-b p-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Search teacher..." value={teacherSearch} onChange={(e) => setTeacherSearch(e.target.value)} />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {rows
                    .filter((r) => r.name.toLowerCase().includes(teacherSearch.toLowerCase()))
                    .map((r) => (
                      <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                        <Checkbox
                          checked={!excluded.includes(r.id)}
                          onCheckedChange={(c) =>
                            setExcluded((prev) => (c ? prev.filter((id) => id !== r.id) : [...prev, r.id]))
                          }
                        />
                        {r.name}
                      </label>
                    ))}
                  {rows.length === 0 && <p className="p-2 text-sm text-muted-foreground">No teachers in range</p>}
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" />CSV
              </Button>
              <Button className="flex-1" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />Print / PDF
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "This month", value: "this-month" },
              { label: "Last month", value: "last-month" },
              { label: "Last 30 days", value: "last-30" },
            ].map((p) => (
              <Button key={p.value} size="sm" variant="secondary" onClick={() => applyPreset(p.value)}>
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Building compliance report…</CardContent></Card>}
      {error && <Card><CardContent className="p-6 text-sm text-destructive">{(error as Error).message}</CardContent></Card>}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {grouped.map(([tier, list]) => (
              <Card key={tier}>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold">{list.length}</p>
                  <p className="text-xs text-muted-foreground">{tierMeta[tier].label}</p>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-teal">
                  {visible.length ? Math.round(visible.reduce((s, r) => s + r.score, 0) / visible.length) : 0}
                </p>
                <p className="text-xs text-muted-foreground">Average score</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">Teacher</th>
                      <th className="p-3 text-center font-medium">Score</th>
                      <th className="p-3 text-center font-medium">Attendance coverage</th>
                      <th className="p-3 text-center font-medium">Marking on time</th>
                      <th className="p-3 text-center font-medium">Plans submitted</th>
                      <th className="p-3 text-center font-medium">Plans on time</th>
                      <th className="p-3 text-center font-medium">Lesson detail</th>
                      <th className="p-3 text-center font-medium">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visible.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">{r.name}</td>
                        <td className="p-3 text-center font-bold">{r.score}</td>
                        <td className="p-3 text-center">{r.coverage}%</td>
                        <td className="p-3 text-center">{r.timeliness}%</td>
                        <td className="p-3 text-center">{r.planRate}%</td>
                        <td className="p-3 text-center">{r.planPunctuality}%</td>
                        <td className="p-3 text-center">{r.detail}%</td>
                        <td className="p-3 text-center">
                          <Badge variant={tierMeta[r.tier].variant}>{tierMeta[r.tier].label}</Badge>
                        </td>
                      </tr>
                    ))}
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">No data for this period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">How the score works (100 points)</p>
              <p>Attendance coverage 40 · Marking on time (within 48h) 20 · Monthly plans submitted 25 · Plans submitted by the 3rd 10 · Lesson detail recorded 5.</p>
              <p>Tiers: Full Compliance 90+, Partial Compliance 60–89, Non-Compliance below 60. All measures are rates, so teachers with different caseloads are compared fairly.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
