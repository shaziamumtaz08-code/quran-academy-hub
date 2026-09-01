import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { DollarSign, Users, AlertCircle, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Group Academy finance view — aggregates billing across all courses in the
 * active division. Sources: course_fee_plans, course_student_fees,
 * course_fee_payments, course_classes.fee_amount. Per-course drill-down uses
 * the existing CourseFinanceTab inside each course.
 */
export default function GroupAcademyFinance() {
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id || null;

  const { data, isLoading } = useQuery({
    queryKey: ['group-academy-finance', divisionId],
    enabled: !!divisionId,
    queryFn: async () => {
      // Courses in division
      const { data: courses } = await supabase
        .from('courses')
        .select('id, name')
        .eq('division_id', divisionId!);
      const courseIds = (courses || []).map((c: any) => c.id);
      if (courseIds.length === 0) {
        return { courses: [], perCourse: [], totals: { due: 0, paid: 0, pending: 0, students: 0 } };
      }

      const [feesRes, plansRes, classesRes] = await Promise.all([
        supabase.from('course_student_fees')
          .select('id, course_id, student_id, total_due, total_paid, status, is_scholarship, plan:plan_id(currency)')
          .in('course_id', courseIds),
        supabase.from('course_fee_plans')
          .select('id, course_id, plan_name, total_amount, currency, status')
          .in('course_id', courseIds),
        supabase.from('course_classes')
          .select('id, course_id, name, fee_amount, fee_currency')
          .in('course_id', courseIds),
      ]);

      const fees = feesRes.data || [];
      const plans = plansRes.data || [];
      const classes = classesRes.data || [];

      const perCourse = (courses || []).map((c: any) => {
        const cFees = fees.filter((f: any) => f.course_id === c.id);
        const cPlans = plans.filter((p: any) => p.course_id === c.id);
        const cClasses = classes.filter((cl: any) => cl.course_id === c.id);
        const due = cFees.reduce((s: number, f: any) => s + Number(f.total_due || 0), 0);
        const paid = cFees.reduce((s: number, f: any) => s + Number(f.total_paid || 0), 0);
        const pending = Math.max(0, due - paid);
        const students = new Set(cFees.map((f: any) => f.student_id)).size;
        const scholarshipCount = cFees.filter((f: any) => f.is_scholarship).length;
        const currency = cPlans[0]?.currency || cClasses[0]?.fee_currency || c.currency || 'PKR';
        return { id: c.id, name: c.name, currency, due, paid, pending, students, plans: cPlans.length, classes: cClasses.length, scholarshipCount };
      });

      const totals = {
        due: perCourse.reduce((s, x) => s + x.due, 0),
        paid: perCourse.reduce((s, x) => s + x.paid, 0),
        pending: perCourse.reduce((s, x) => s + x.pending, 0),
        students: new Set(fees.map((f: any) => f.student_id)).size,
      };

      return { courses, perCourse, totals };
    },
  });

  const perCourse = data?.perCourse || [];
  const totals = data?.totals || { due: 0, paid: 0, pending: 0, students: 0 };

  const kpis = useMemo(() => ([
    { label: 'Total Billed', value: totals.due, icon: DollarSign, color: 'text-primary' },
    { label: 'Collected', value: totals.paid, icon: DollarSign, color: 'text-teal' },
    { label: 'Pending', value: totals.pending, icon: AlertCircle, color: 'text-destructive' },
    { label: 'Paying Students', value: totals.students, icon: Users, color: 'text-accent', raw: true },
  ]), [totals]);

  if (!divisionId) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Select a division to view finance.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <k.icon className={`h-4 w-4 ${k.color}`} />
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </div>
              <p className="text-2xl font-bold">
                {k.raw ? k.value : k.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              {!k.raw && <p className="text-xs text-muted-foreground">mixed currency</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Billing by Course</h3>
            <span className="text-xs text-muted-foreground">Per-course drill-down opens each course's Finance tab</span>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : perCourse.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No courses in this division yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Plans</TableHead>
                  <TableHead className="text-right">Classes</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {perCourse.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {c.scholarshipCount > 0 && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">{c.scholarshipCount} scholarship</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{c.students}</TableCell>
                    <TableCell className="text-right">{c.plans}</TableCell>
                    <TableCell className="text-right">{c.classes}</TableCell>
                    <TableCell className="text-right">{c.currency} {Number(c.due).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-teal">{c.currency} {Number(c.paid).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive">{c.currency} {Number(c.pending).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Link to={`/courses/${c.id}?tab=finance`} className="text-xs text-primary hover:underline">Open</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
