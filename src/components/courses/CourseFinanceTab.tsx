import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Plus, Trash2, DollarSign, Loader2, Users, CheckCircle2, Edit, GraduationCap,
  Receipt, Filter, CreditCard, Gift, AlertCircle, Eye
} from 'lucide-react';

interface CourseFinanceTabProps {
  courseId: string;
  isVolunteerClass?: boolean;
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export function CourseFinanceTab({ courseId, isVolunteerClass }: CourseFinanceTabProps) {
  const qc = useQueryClient();
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [applyPlanId, setApplyPlanId] = useState<string | null>(null);
  const [selectedStudentFee, setSelectedStudentFee] = useState<any>(null);
  const [payOpen, setPayOpen] = useState<any>(null);
  const [feeFilter, setFeeFilter] = useState('all');

  // ─── Queries ───
  const { data: plans = [] } = useQuery({
    queryKey: ['course-fee-plans', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_fee_plans')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: studentFees = [], isLoading: feesLoading } = useQuery({
    queryKey: ['course-student-fees', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_student_fees')
        .select('*, profile:student_id(id, full_name, email), plan:plan_id(plan_name, total_amount, currency)')
        .eq('course_id', courseId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: enrolledStudents = [] } = useQuery({
    queryKey: ['course-enrolled-finance', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_enrollments')
        .select('student_id, profile:student_id(id, full_name, email)')
        .eq('course_id', courseId)
        .eq('status', 'active');
      return data || [];
    },
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_fee_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-fee-plans', courseId] });
      toast({ title: 'Plan deleted' });
    },
  });

  // Filter student fees
  const filteredFees = studentFees.filter((sf: any) => {
    if (feeFilter === 'all') return true;
    if (feeFilter === 'scholarship') return sf.is_scholarship;
    if (feeFilter === 'paid') return sf.status === 'paid';
    if (feeFilter === 'pending') return sf.status === 'pending' && !sf.is_scholarship;
    if (feeFilter === 'overdue') return sf.status === 'overdue';
    return true;
  });

  if (isVolunteerClass) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
        <Gift className="h-10 w-10 mx-auto mb-2 opacity-40" />
        This is a Volunteer class — no fees or invoices are generated.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ FEE PLANS SECTION ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Receipt className="h-4 w-4" /> Fee Plans
          </h3>
          <Button size="sm" className="gap-1.5" onClick={() => setCreatePlanOpen(true)}>
            <Plus className="h-4 w-4" /> Create Plan
          </Button>
        </div>

        {plans.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
            No fee plans created yet. Create a plan to start billing students.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan: any) => (
              <Card key={plan.id} className="shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{plan.plan_name}</p>
                      <p className="text-lg font-bold mt-0.5">{plan.currency} {Number(plan.total_amount).toLocaleString()}</p>
                    </div>
                    <button onClick={() => deletePlan.mutate(plan.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {plan.installments === 1 ? 'Single Payment' : `${plan.installments} Installments`}
                    </Badge>
                    {plan.tax_percent > 0 && <span>+{plan.tax_percent}% tax</span>}
                  </div>
                  {plan.installments > 1 && (
                    <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t">
                      {(plan.installment_schedule || []).map((inst: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span>Installment {i + 1}: {plan.currency} {inst.amount}</span>
                          <span>{inst.due_date}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {plan.notes && <p className="text-[11px] text-muted-foreground italic">{plan.notes}</p>}
                  <Button size="sm" variant="outline" className="w-full gap-1.5 mt-2 text-xs"
                    onClick={() => setApplyPlanId(plan.id)}>
                    <Users className="h-3.5 w-3.5" /> Apply to Students
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* ═══ STUDENT FEES SECTION ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" /> Student Fees ({studentFees.length})
          </h3>
          <div className="flex gap-1.5">
            {['all', 'pending', 'paid', 'overdue', 'scholarship'].map(f => (
              <button key={f} onClick={() => setFeeFilter(f)}
                className={cn("px-2.5 py-1 rounded-md text-xs border transition-colors",
                  feeFilter === f ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30")}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {feesLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filteredFees.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
            {studentFees.length === 0
              ? 'No fee plans applied to students yet. Create a plan and apply it.'
              : 'No students match this filter.'}
          </CardContent></Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFees.map((sf: any) => {
                    const balance = Math.max(0, Number(sf.total_due) - Number(sf.total_paid));
                    const statusColor = sf.is_scholarship
                      ? 'bg-purple-500/10 text-purple-600 border-purple-200'
                      : sf.status === 'paid'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                      : sf.status === 'overdue'
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : 'bg-amber-500/10 text-amber-600 border-amber-200';
                    const statusLabel = sf.is_scholarship ? 'Scholarship' : sf.status;

                    return (
                      <TableRow key={sf.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{sf.profile?.full_name || '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{sf.profile?.email}</p>
                        </TableCell>
                        <TableCell className="text-xs">{sf.plan?.plan_name || '—'}</TableCell>
                        <TableCell className="text-right text-sm">
                          {sf.is_scholarship ? '—' : `${sf.plan?.currency || 'PKR'} ${Number(sf.total_due).toLocaleString()}`}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {sf.is_scholarship ? '—' : `${sf.plan?.currency || 'PKR'} ${Number(sf.total_paid).toLocaleString()}`}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {sf.is_scholarship ? '—' : `${sf.plan?.currency || 'PKR'} ${balance.toLocaleString()}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] capitalize", statusColor)}>
                            {statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!sf.is_scholarship && balance > 0 && (
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                                onClick={() => setPayOpen(sf)}>
                                <CreditCard className="h-3 w-3" /> Pay
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                              onClick={() => setSelectedStudentFee(sf)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <CreatePlanDialog open={createPlanOpen} onOpenChange={setCreatePlanOpen} courseId={courseId} />
      {applyPlanId && (
        <ApplyPlanDialog
          open={!!applyPlanId}
          onOpenChange={() => setApplyPlanId(null)}
          courseId={courseId}
          planId={applyPlanId}
          plans={plans}
          enrolledStudents={enrolledStudents}
          existingFeeStudentIds={studentFees.map((sf: any) => sf.student_id)}
        />
      )}
      {selectedStudentFee && (
        <StudentFeeDrawer
          open={!!selectedStudentFee}
          onOpenChange={() => setSelectedStudentFee(null)}
          studentFee={selectedStudentFee}
          plans={plans}
          courseId={courseId}
        />
      )}
      {payOpen && (
        <MarkPaidDialog
          open={!!payOpen}
          onOpenChange={() => setPayOpen(null)}
          studentFee={payOpen}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// CREATE PLAN DIALOG
// ═══════════════════════════════════════════════════
function CreatePlanDialog({ open, onOpenChange, courseId }: { open: boolean; onOpenChange: (v: boolean) => void; courseId: string }) {
  const qc = useQueryClient();
  const [planName, setPlanName] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [currency, setCurrency] = useState('PKR');
  const [installments, setInstallments] = useState(1);
  const [schedule, setSchedule] = useState<{ amount: number; due_date: string }[]>([]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('');

  // Auto-generate installment schedule when count or amount changes
  React.useEffect(() => {
    if (installments <= 1) { setSchedule([]); return; }
    const perInstallment = Math.floor(totalAmount / installments);
    const remainder = totalAmount - perInstallment * installments;
    const today = new Date();
    const newSchedule = Array.from({ length: installments }, (_, i) => ({
      amount: i === 0 ? perInstallment + remainder : perInstallment,
      due_date: format(new Date(today.getFullYear(), today.getMonth() + i, today.getDate()), 'yyyy-MM-dd'),
    }));
    setSchedule(newSchedule);
  }, [installments, totalAmount]);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('course_fee_plans').insert({
        course_id: courseId,
        plan_name: planName.trim(),
        total_amount: totalAmount,
        currency,
        installments,
        installment_schedule: installments > 1 ? schedule : [],
        tax_percent: taxPercent,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-fee-plans', courseId] });
      onOpenChange(false);
      setPlanName(''); setTotalAmount(0); setInstallments(1); setNotes('');
      toast({ title: 'Fee plan created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Fee Plan</DialogTitle>
          <DialogDescription>Define a billing plan for this course</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Plan Name *</Label>
            <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="e.g. Full Course Fee" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Total Amount *</Label>
              <Input type="number" min={0} value={totalAmount} onChange={e => setTotalAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PKR">PKR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Installments</Label>
              <Input type="number" min={1} max={24} value={installments}
                onChange={e => setInstallments(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tax %</Label>
              <Input type="number" min={0} max={100} value={taxPercent}
                onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {installments > 1 && schedule.length > 0 && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
              <p className="text-xs font-medium">Installment Schedule</p>
              {schedule.map((inst, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">#{i + 1}</span>
                  <Input type="number" className="h-8 text-xs" value={inst.amount}
                    onChange={e => {
                      const ns = [...schedule];
                      ns[i] = { ...ns[i], amount: parseFloat(e.target.value) || 0 };
                      setSchedule(ns);
                    }} />
                  <Input type="date" className="h-8 text-xs" value={inst.due_date}
                    onChange={e => {
                      const ns = [...schedule];
                      ns[i] = { ...ns[i], due_date: e.target.value };
                      setSchedule(ns);
                    }} />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!planName.trim() || totalAmount <= 0 || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════
// APPLY PLAN TO STUDENTS DIALOG
// ═══════════════════════════════════════════════════
function ApplyPlanDialog({ open, onOpenChange, courseId, planId, plans, enrolledStudents, existingFeeStudentIds }: {
  open: boolean; onOpenChange: () => void; courseId: string; planId: string;
  plans: any[]; enrolledStudents: any[]; existingFeeStudentIds: string[];
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [feeType, setFeeType] = useState<'standard' | 'full_scholarship' | 'partial' | 'waiver'>('standard');
  const [discountPct, setDiscountPct] = useState(0);
  const [applyNotes, setApplyNotes] = useState('');
  const plan = plans.find((p: any) => p.id === planId);

  const available = enrolledStudents.filter((e: any) => !existingFeeStudentIds.includes(e.student_id));

  const apply = useMutation({
    mutationFn: async () => {
      if (!plan) return;
      const taxMultiplier = 1 + (Number(plan.tax_percent) || 0) / 100;
      const baseTotalWithTax = Number(plan.total_amount) * taxMultiplier;

      const isScholarship = feeType === 'full_scholarship' || feeType === 'waiver';
      const totalDue = feeType === 'full_scholarship' || feeType === 'waiver'
        ? 0
        : feeType === 'partial'
        ? baseTotalWithTax * (1 - discountPct / 100)
        : baseTotalWithTax;

      const rows = Array.from(selected).map(studentId => ({
        course_id: courseId,
        student_id: studentId,
        plan_id: planId,
        total_due: totalDue,
        total_paid: 0,
        status: isScholarship ? 'waived' : 'pending',
        is_scholarship: isScholarship || feeType === 'partial',
        discount_type: feeType === 'partial' ? 'percentage' : feeType !== 'standard' ? 'full' : 'none',
        discount_value: feeType === 'partial' ? discountPct : feeType !== 'standard' ? 100 : 0,
        notes: applyNotes || null,
      }));
      const { error } = await supabase.from('course_student_fees').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-student-fees', courseId] });
      onOpenChange();
      toast({ title: `Plan applied to ${selected.size} student(s)` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleAll = () => {
    if (selected.size === available.length) setSelected(new Set());
    else setSelected(new Set(available.map((e: any) => e.student_id)));
  };

  return (
    <Dialog open={open} onOpenChange={() => onOpenChange()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply "{plan?.plan_name}" to Students</DialogTitle>
          <DialogDescription>Select students and fee type</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* Fee type selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Fee Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'standard', label: 'Standard fee' },
                { value: 'full_scholarship', label: 'Full scholarship' },
                { value: 'partial', label: 'Partial scholarship' },
                { value: 'waiver', label: 'Fee waiver' },
              ].map(opt => (
                <button key={opt.value}
                  onClick={() => setFeeType(opt.value as any)}
                  className={cn("px-3 py-2 rounded-md border text-xs text-left transition-colors",
                    feeType === opt.value ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/30"
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {feeType === 'partial' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Discount %</Label>
              <Input type="number" min={0} max={100} value={discountPct}
                onChange={e => setDiscountPct(parseInt(e.target.value) || 0)}
                placeholder="e.g. 50" />
              {plan && (
                <p className="text-xs text-muted-foreground">
                  Student will pay: {plan.currency} {(Number(plan.total_amount) * (1 - discountPct / 100)).toLocaleString()}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Input value={applyNotes} onChange={e => setApplyNotes(e.target.value)} placeholder="Scholarship reason..." />
          </div>

          <Separator />

          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">All enrolled students already have a fee plan assigned</p>
          ) : (
            <>
              <label className="flex items-center gap-2 px-2 py-1 cursor-pointer">
                <Checkbox checked={selected.size === available.length} onCheckedChange={toggleAll} />
                <span className="text-sm font-medium">Select All ({available.length})</span>
              </label>
              <div className="max-h-60 overflow-y-auto border rounded-md">
                {available.map((e: any) => (
                  <label key={e.student_id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selected.has(e.student_id)}
                      onCheckedChange={() => setSelected(prev => {
                        const next = new Set(prev);
                        if (next.has(e.student_id)) next.delete(e.student_id); else next.add(e.student_id);
                        return next;
                      })} />
                    <span className="text-sm">{e.profile?.full_name || e.profile?.email}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange()}>Cancel</Button>
          <Button onClick={() => apply.mutate()} disabled={selected.size === 0 || apply.isPending}>
            {apply.isPending ? 'Applying…' : `Apply to ${selected.size} Student(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════
// STUDENT FEE DRAWER (per-student override)
// ═══════════════════════════════════════════════════
function StudentFeeDrawer({ open, onOpenChange, studentFee, plans, courseId }: {
  open: boolean; onOpenChange: (v: boolean) => void; studentFee: any; plans: any[]; courseId: string;
}) {
  const qc = useQueryClient();
  const [discountType, setDiscountType] = useState(studentFee.discount_type || 'none');
  const [discountValue, setDiscountValue] = useState(Number(studentFee.discount_value) || 0);
  const [isScholarship, setIsScholarship] = useState(studentFee.is_scholarship || false);
  const [selectedPlanId, setSelectedPlanId] = useState(studentFee.plan_id || '');
  const [notes, setNotes] = useState(studentFee.notes || '');

  // Payment history
  const { data: payments = [] } = useQuery({
    queryKey: ['student-fee-payments', studentFee.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_fee_payments')
        .select('*')
        .eq('student_fee_id', studentFee.id)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const plan = plans.find((p: any) => p.id === selectedPlanId);
      const baseDue = plan ? Number(plan.total_amount) * (1 + Number(plan.tax_percent || 0) / 100) : Number(studentFee.total_due);

      let finalDue = baseDue;
      if (!isScholarship) {
        if (discountType === 'fixed') finalDue = Math.max(0, baseDue - discountValue);
        else if (discountType === 'percentage') finalDue = Math.max(0, baseDue * (1 - discountValue / 100));
      } else {
        finalDue = 0;
      }

      const totalPaid = Number(studentFee.total_paid) || 0;
      const newStatus = isScholarship ? 'scholarship' : totalPaid >= finalDue ? 'paid' : 'pending';

      const { error } = await supabase.from('course_student_fees').update({
        plan_id: selectedPlanId || null,
        discount_type: discountType,
        discount_value: discountValue,
        is_scholarship: isScholarship,
        total_due: finalDue,
        status: newStatus,
        notes: notes.trim() || null,
      }).eq('id', studentFee.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-student-fees', courseId] });
      onOpenChange(false);
      toast({ title: 'Student fee updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{studentFee.profile?.full_name || 'Student'} — Fee Details</SheetTitle>
          <SheetDescription>{studentFee.profile?.email}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          {/* Current Status */}
          <Card>
            <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">Due</p>
                <p className="text-sm font-bold">{studentFee.is_scholarship ? '—' : Number(studentFee.total_due).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Paid</p>
                <p className="text-sm font-bold text-emerald-600">{Number(studentFee.total_paid).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Balance</p>
                <p className="text-sm font-bold text-destructive">
                  {studentFee.is_scholarship ? '—' : Math.max(0, Number(studentFee.total_due) - Number(studentFee.total_paid)).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Plan Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs">Fee Plan</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.plan_name} ({p.currency} {Number(p.total_amount).toLocaleString()})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scholarship */}
          <div className="flex items-center gap-3">
            <Switch checked={isScholarship} onCheckedChange={setIsScholarship} />
            <Label className="text-xs">Scholarship (zero balance, no invoices)</Label>
          </div>

          {/* Discount */}
          {!isScholarship && (
            <div className="space-y-2">
              <Label className="text-xs">Discount</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Discount</SelectItem>
                    <SelectItem value="fixed">Fixed (PKR)</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
                {discountType !== 'none' && (
                  <Input type="number" min={0} value={discountValue}
                    onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                    placeholder={discountType === 'percentage' ? '% off' : 'Amount'} />
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </Button>

          {/* Payment History */}
          {payments.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment History</p>
              {payments.map((pay: any) => (
                <div key={pay.id} className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded-md">
                  <div>
                    <p className="text-sm font-medium">{Number(pay.amount).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(pay.payment_date), 'MMM d, yyyy')}
                      {pay.reference && ` • Ref: ${pay.reference}`}
                    </p>
                  </div>
                  {pay.payment_method && <Badge variant="outline" className="text-[10px]">{pay.payment_method}</Badge>}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════
// MARK PAID DIALOG
// ═══════════════════════════════════════════════════
function MarkPaidDialog({ open, onOpenChange, studentFee }: {
  open: boolean; onOpenChange: (v: boolean) => void; studentFee: any;
}) {
  const qc = useQueryClient();
  const balance = Math.max(0, Number(studentFee.total_due) - Number(studentFee.total_paid));
  const [amount, setAmount] = useState(balance);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('cash');
  const [paymentLink, setPaymentLink] = useState('');

  const pay = useMutation({
    mutationFn: async () => {
      // Record payment
      const { error: payErr } = await supabase.from('course_fee_payments').insert({
        student_fee_id: studentFee.id,
        amount,
        payment_date: paymentDate,
        reference: reference.trim() || null,
        payment_method: method,
        payment_link: paymentLink.trim() || null,
      });
      if (payErr) throw payErr;

      // Update totals
      const newPaid = Number(studentFee.total_paid) + amount;
      const newStatus = newPaid >= Number(studentFee.total_due) ? 'paid' : 'pending';
      const { error: updErr } = await supabase.from('course_student_fees').update({
        total_paid: newPaid,
        status: newStatus,
      }).eq('id', studentFee.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-student-fees', studentFee.course_id] });
      qc.invalidateQueries({ queryKey: ['student-fee-payments', studentFee.id] });
      onOpenChange(false);
      toast({ title: 'Payment recorded' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={() => onOpenChange(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>{studentFee.profile?.full_name} — Balance: {balance.toLocaleString()}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Amount *</Label>
            <Input type="number" min={0} max={balance} value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Date</Label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reference</Label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Transaction ID, receipt #..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Link (optional)</Label>
            <Input value={paymentLink} onChange={e => setPaymentLink(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => pay.mutate()} disabled={amount <= 0 || pay.isPending}>
            {pay.isPending ? 'Recording…' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
