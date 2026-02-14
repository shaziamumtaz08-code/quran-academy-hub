import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DollarSign, CheckCircle, XCircle, Clock, User, Loader2, Zap, GraduationCap, Plus, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';

const MONTHS = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' },
  { value: '03', label: 'March' }, { value: '04', label: 'April' },
  { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' },
  { value: '09', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const now = new Date();
const currentBillingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const currentMonthLabel = MONTHS[now.getMonth()]?.label ?? '';

const DURATION_OPTIONS = [30, 45, 60, 90];

interface InvoiceRow {
  id: string;
  assignment_id: string | null;
  plan_id: string | null;
  student_id: string;
  amount: number;
  currency: string;
  billing_month: string;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  amount_paid: number;
  profiles: { full_name: string } | null;
  student_teacher_assignments: {
    fee_packages: { name: string } | null;
  } | null;
  student_billing_plans: {
    fee_packages: { name: string } | null;
    session_duration: number;
  } | null;
}

interface StudentOption { id: string; full_name: string; }
interface PackageOption { id: string; name: string; amount: number; currency: string; }

export default function Payments() {
  const { activeBranch, activeDivision } = useDivision();
  const branchId = activeBranch?.id || null;
  const divisionId = activeDivision?.id || null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [monthFilter, setMonthFilter] = useState(currentBillingMonth);
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  // Setup fee form state
  const [feeForm, setFeeForm] = useState({
    student_id: '',
    base_package_id: '',
    session_duration: '30',
    flat_discount: '0',
  });

  // Fetch students for the setup modal
  const { data: students = [] } = useQuery({
    queryKey: ['students-for-fees', branchId, divisionId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_teacher_student_ids', { _teacher_id: '00000000-0000-0000-0000-000000000000' });
      // Fallback: fetch all students with role 'student'
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      return (profiles || []) as StudentOption[];
    },
    enabled: setupOpen,
  });

  // Fetch packages for the setup modal
  const { data: packages = [] } = useQuery({
    queryKey: ['fee-packages-for-setup', branchId, divisionId],
    queryFn: async () => {
      let q = supabase.from('fee_packages').select('id, name, amount, currency').eq('is_active', true);
      if (branchId) q = q.eq('branch_id', branchId);
      if (divisionId) q = q.eq('division_id', divisionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as PackageOption[];
    },
    enabled: setupOpen,
  });

  // Live fee calculation
  const selectedPkg = useMemo(() => packages.find(p => p.id === feeForm.base_package_id), [packages, feeForm.base_package_id]);
  const baseAmount = selectedPkg?.amount || 0;
  const duration = parseInt(feeForm.session_duration) || 30;
  const durationMultiplier = duration / 30;
  const durationSurcharge = baseAmount * (durationMultiplier - 1);
  const subtotal = baseAmount + durationSurcharge;
  const flatDiscount = parseFloat(feeForm.flat_discount) || 0;
  const netRecurringFee = Math.max(0, subtotal - flatDiscount);
  const currency = selectedPkg?.currency || 'USD';

  // Save billing plan mutation
  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (!feeForm.student_id || !feeForm.base_package_id) throw new Error('Select a student and package');
      const payload = {
        student_id: feeForm.student_id,
        base_package_id: feeForm.base_package_id,
        session_duration: duration,
        duration_surcharge: durationSurcharge,
        flat_discount: flatDiscount,
        net_recurring_fee: netRecurringFee,
        currency,
        is_active: true,
        branch_id: branchId,
        division_id: divisionId,
      };
      const { error } = await supabase.from('student_billing_plans').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
      toast({ title: 'Student fee plan saved' });
      setSetupOpen(false);
      setFeeForm({ student_id: '', base_package_id: '', session_duration: '30', flat_discount: '0' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Fetch invoices with relational joins
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['fee-invoices', branchId, divisionId, monthFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('fee_invoices')
        .select(`
          id, assignment_id, plan_id, student_id, amount, currency, billing_month,
          due_date, status, paid_at, amount_paid,
          profiles!fee_invoices_student_id_fkey(full_name),
          student_teacher_assignments!fee_invoices_assignment_id_fkey(
            fee_packages!student_teacher_assignments_fee_package_id_fkey(name)
          ),
          student_billing_plans!fee_invoices_plan_id_fkey(
            fee_packages!student_billing_plans_base_package_id_fkey(name),
            session_duration
          )
        `)
        .order('created_at', { ascending: false });

      if (branchId) q = q.eq('branch_id', branchId);
      if (divisionId) q = q.eq('division_id', divisionId);
      if (monthFilter !== 'all') q = q.eq('billing_month', monthFilter);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter as any);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as InvoiceRow[];
    },
    enabled: !!branchId,
  });

  // Generate invoices mutation — now pulls from both billing plans AND assignments
  const generateMutation = useMutation({
    mutationFn: async () => {
      // Fetch existing invoices for this month to avoid duplicates
      const { data: existing } = await supabase
        .from('fee_invoices')
        .select('plan_id, assignment_id')
        .eq('billing_month', currentBillingMonth);

      const existingPlanIds = new Set((existing || []).filter(e => e.plan_id).map(e => e.plan_id));
      const existingAssignmentIds = new Set((existing || []).filter(e => e.assignment_id).map(e => e.assignment_id));

      const newInvoices: any[] = [];

      // 1. From billing plans
      let pq = supabase.from('student_billing_plans').select('id, student_id, net_recurring_fee, currency, branch_id, division_id').eq('is_active', true);
      if (branchId) pq = pq.eq('branch_id', branchId);
      if (divisionId) pq = pq.eq('division_id', divisionId);
      const { data: plans } = await pq;

      (plans || []).forEach((p: any) => {
        if (!existingPlanIds.has(p.id) && p.net_recurring_fee > 0) {
          newInvoices.push({
            plan_id: p.id,
            student_id: p.student_id,
            amount: p.net_recurring_fee,
            currency: p.currency,
            billing_month: currentBillingMonth,
            due_date: `${currentBillingMonth}-10`,
            branch_id: p.branch_id,
            division_id: p.division_id,
          });
        }
      });

      // 2. From assignments (legacy / those without billing plans)
      let aq = supabase
        .from('student_teacher_assignments')
        .select('id, student_id, calculated_monthly_fee, first_month_prorated_fee, start_date, fee_packages!student_teacher_assignments_fee_package_id_fkey(currency), branch_id, division_id')
        .eq('status', 'active');
      if (branchId) aq = aq.eq('branch_id', branchId);
      if (divisionId) aq = aq.eq('division_id', divisionId);

      const { data: assignments } = await aq;

      // Exclude students who already have a billing plan invoice this month
      const planStudentIds = new Set(newInvoices.map(i => i.student_id));

      (assignments || []).forEach((a: any) => {
        if (!existingAssignmentIds.has(a.id) && a.calculated_monthly_fee && !planStudentIds.has(a.student_id)) {
          const isFirstMonth = a.start_date && a.start_date.startsWith(currentBillingMonth);
          const amount = isFirstMonth && a.first_month_prorated_fee ? a.first_month_prorated_fee : a.calculated_monthly_fee;
          newInvoices.push({
            assignment_id: a.id,
            student_id: a.student_id,
            amount,
            currency: a.fee_packages?.currency || 'USD',
            billing_month: currentBillingMonth,
            due_date: `${currentBillingMonth}-10`,
            branch_id: a.branch_id,
            division_id: a.division_id,
          });
        }
      });

      if (newInvoices.length === 0) throw new Error('All invoices for this month already exist');

      const { error: iErr } = await supabase.from('fee_invoices').insert(newInvoices);
      if (iErr) throw iErr;

      return newInvoices.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      toast({ title: `Successfully generated ${count} invoices for ${currentMonthLabel}.` });
    },
    onError: (e: any) => toast({ title: 'Generation failed', description: e.message, variant: 'destructive' }),
  });

  // Record payment mutation
  const payMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const inv = invoices.find(i => i.id === invoiceId);
      const { error } = await supabase
        .from('fee_invoices')
        .update({ status: 'paid' as any, paid_at: new Date().toISOString(), amount_paid: inv?.amount || 0 })
        .eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      toast({ title: 'Payment recorded' });
      setConfirmOpen(false);
      setSelectedInvoice(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Summary calculations
  const totalFees = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const collected = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const pending = totalFees - collected;

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return { value: `${now.getFullYear()}-${m}`, label: `${MONTHS[i].label} ${now.getFullYear()}` };
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><CheckCircle className="h-3 w-3" /> Paid</Badge>;
      case 'partially_paid':
        return <Badge className="bg-accent/20 text-accent-foreground gap-1"><Clock className="h-3 w-3" /> Partial</Badge>;
      case 'overdue':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Overdue</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
  };

  const formatBillingMonth = (bm: string) => {
    const [y, m] = bm.split('-');
    return `${MONTHS[parseInt(m, 10) - 1]?.label || m} ${y}`;
  };

  const getPackageName = (inv: InvoiceRow) => {
    return inv.student_billing_plans?.fee_packages?.name
      || inv.student_teacher_assignments?.fee_packages?.name
      || '—';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Fee Invoices</h1>
            <p className="text-muted-foreground mt-1">Composite billing ledger with smart surcharges</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSetupOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Set Up Student Fee
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="gap-2"
            >
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Generate Monthly Invoices
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Fees</p>
                <p className="text-2xl font-serif font-bold text-foreground">{totalFees.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-2xl font-serif font-bold text-foreground">{collected.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-serif font-bold text-destructive">{pending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Billing Month" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partially_paid">Partially Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4" />
            <span>{invoices.length} invoice(s)</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <DollarSign className="h-12 w-12 mb-4 opacity-40" />
              <p className="font-medium">No invoices yet</p>
              <p className="text-sm">Set up student fees then generate monthly invoices</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Billing Month</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <User className="h-4 w-4 text-secondary-foreground" />
                        </div>
                        <span className="font-medium">{inv.profiles?.full_name || 'Unknown'}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{getPackageName(inv)}</Badge>
                    </TableCell>
                    <TableCell>{formatBillingMonth(inv.billing_month)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {inv.currency} {Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{inv.due_date || '—'}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right">
                      {inv.status === 'pending' || inv.status === 'overdue' || inv.status === 'partially_paid' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => { setSelectedInvoice(inv); setConfirmOpen(true); }}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Record Payment
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : 'Paid'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Set Up Student Fee Modal */}
        <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Set Up Student Fee</DialogTitle>
              <DialogDescription>Configure a composite billing plan with duration-based surcharges.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              {/* Left Column: Inputs */}
              <div className="space-y-4">
                <div>
                  <Label>Student</Label>
                  <Select value={feeForm.student_id} onValueChange={v => setFeeForm(f => ({ ...f, student_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                    <SelectContent>
                      {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Base Package (30-min rate)</Label>
                  <Select value={feeForm.base_package_id} onValueChange={v => setFeeForm(f => ({ ...f, base_package_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select package..." /></SelectTrigger>
                    <SelectContent>
                      {packages.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.currency} {p.amount}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Session Duration (minutes)</Label>
                  <Select value={feeForm.session_duration} onValueChange={v => setFeeForm(f => ({ ...f, session_duration: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(d => <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Flat Discount</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={feeForm.flat_discount}
                    onChange={e => setFeeForm(f => ({ ...f, flat_discount: e.target.value }))}
                  />
                </div>
              </div>

              {/* Right Column: Live Invoice Preview */}
              <div className="bg-muted/50 rounded-xl border border-border p-5 space-y-3">
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Invoice Preview</h3>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Package (30-min)</span>
                    <span className="font-mono font-medium">{currency} {baseAmount.toLocaleString()}</span>
                  </div>
                  {durationSurcharge > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Duration Premium ({duration} min)</span>
                      <span className="font-mono font-medium">+ {currency} {durationSurcharge.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {flatDiscount > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Flat Discount</span>
                      <span className="font-mono font-medium">- {currency} {flatDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Net Recurring Fee</span>
                    <span className="font-mono">{currency} {netRecurringFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">This amount will be billed monthly when invoices are generated.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSetupOpen(false)}>Cancel</Button>
              <Button
                onClick={() => savePlanMutation.mutate()}
                disabled={!feeForm.student_id || !feeForm.base_package_id || savePlanMutation.isPending}
              >
                {savePlanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Billing Plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Payment Dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirm Payment</DialogTitle>
              <DialogDescription>
                Mark invoice for <strong>{selectedInvoice?.profiles?.full_name}</strong> as paid?
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 text-center">
              <p className="text-2xl font-serif font-bold text-foreground">
                {selectedInvoice?.currency} {Number(selectedInvoice?.amount || 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedInvoice ? formatBillingMonth(selectedInvoice.billing_month) : ''}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button
                onClick={() => selectedInvoice && payMutation.mutate(selectedInvoice.id)}
                disabled={payMutation.isPending}
              >
                {payMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm Paid
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
