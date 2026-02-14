import React, { useState, useMemo, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  DollarSign, CheckCircle, XCircle, Clock, User, Loader2, Zap, GraduationCap,
  Plus, Receipt, Upload, ArrowRightLeft, AlertTriangle, ImageIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/contexts/AuthContext';

// ─── Constants ───────────────────────────────────────────────────────
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

// ─── Types ───────────────────────────────────────────────────────────
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
  forgiven_amount: number;
  profiles: { full_name: string } | null;
  student_teacher_assignments: { fee_packages: { name: string } | null } | null;
  student_billing_plans: { fee_packages: { name: string } | null; session_duration: number } | null;
}
interface StudentOption { id: string; full_name: string }
interface PackageOption { id: string; name: string; amount: number; currency: string }

// ─── Helpers ─────────────────────────────────────────────────────────
const formatBillingMonth = (bm: string) => {
  const [y, m] = bm.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]?.label || m} ${y}`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'paid':
      return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><CheckCircle className="h-3 w-3" /> Paid</Badge>;
    case 'partially_paid':
      return <Badge className="bg-accent/20 text-accent-foreground border-accent/30 gap-1"><Clock className="h-3 w-3" /> Partial</Badge>;
    case 'overdue':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Overdue</Badge>;
    default:
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
  }
};

const getPackageName = (inv: InvoiceRow) =>
  inv.student_billing_plans?.fee_packages?.name
  || inv.student_teacher_assignments?.fee_packages?.name
  || '—';

// ─── Main Component ──────────────────────────────────────────────────
export default function Payments() {
  const { activeBranch, activeDivision } = useDivision();
  const { user } = useAuth();
  const branchId = activeBranch?.id || null;
  const divisionId = activeDivision?.id || null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter state
  const [monthFilter, setMonthFilter] = useState(currentBillingMonth);
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [setupOpen, setSetupOpen] = useState(false);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);

  // Setup fee form
  const [feeForm, setFeeForm] = useState({ student_id: '', base_package_id: '', session_duration: '30', flat_discount: '0' });

  // Bulk payment form
  const [payForm, setPayForm] = useState({
    amount_foreign: '',
    amount_local: '',
    resolution: 'full' as 'full' | 'partial' | 'writeoff' | 'arrears',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // ─── Data Queries ────────────────────────────────────────────────
  const { data: students = [] } = useQuery({
    queryKey: ['students-for-fees', branchId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
      return (data || []) as StudentOption[];
    },
    enabled: setupOpen,
  });

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

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['fee-invoices', branchId, divisionId, monthFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('fee_invoices')
        .select(`
          id, assignment_id, plan_id, student_id, amount, currency, billing_month,
          due_date, status, paid_at, amount_paid, forgiven_amount,
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

  // ─── Computed Values ─────────────────────────────────────────────
  // Setup fee calculator
  const selectedPkg = useMemo(() => packages.find(p => p.id === feeForm.base_package_id), [packages, feeForm.base_package_id]);
  const baseAmount = selectedPkg?.amount || 0;
  const duration = parseInt(feeForm.session_duration) || 30;
  const durationSurcharge = baseAmount * (duration / 30 - 1);
  const subtotal = baseAmount + durationSurcharge;
  const flatDiscount = parseFloat(feeForm.flat_discount) || 0;
  const netRecurringFee = Math.max(0, subtotal - flatDiscount);
  const feeCurrency = selectedPkg?.currency || 'USD';

  // Bulk payment calculator
  const selectedInvoices = useMemo(() => invoices.filter(i => selectedIds.has(i.id)), [invoices, selectedIds]);
  const unpaidSelected = useMemo(() => selectedInvoices.filter(i => i.status !== 'paid'), [selectedInvoices]);
  const totalExpected = unpaidSelected.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid || 0)), 0);
  const bulkCurrency = unpaidSelected[0]?.currency || 'USD';
  const amountForeign = parseFloat(payForm.amount_foreign) || 0;
  const amountLocal = parseFloat(payForm.amount_local) || 0;
  const effectiveRate = amountForeign > 0 ? amountLocal / amountForeign : 0;
  const shortfall = totalExpected - amountForeign;
  const hasShortfall = amountForeign > 0 && amountForeign < totalExpected;

  // Summary
  const totalFees = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const collected = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const pending = totalFees - collected;

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return { value: `${now.getFullYear()}-${m}`, label: `${MONTHS[i].label} ${now.getFullYear()}` };
  });

  // Selectable (non-paid) invoices
  const selectableInvoices = useMemo(() => invoices.filter(i => i.status !== 'paid'), [invoices]);
  const allSelectableChecked = selectableInvoices.length > 0 && selectableInvoices.every(i => selectedIds.has(i.id));

  // ─── Mutations ───────────────────────────────────────────────────
  // Save billing plan
  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (!feeForm.student_id || !feeForm.base_package_id) throw new Error('Select student and package');
      const { error } = await supabase.from('student_billing_plans').insert({
        student_id: feeForm.student_id,
        base_package_id: feeForm.base_package_id,
        session_duration: duration,
        duration_surcharge: durationSurcharge,
        flat_discount: flatDiscount,
        net_recurring_fee: netRecurringFee,
        currency: feeCurrency,
        is_active: true,
        branch_id: branchId,
        division_id: divisionId,
      });
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

  // Generate invoices
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.from('fee_invoices').select('plan_id, assignment_id').eq('billing_month', currentBillingMonth);
      const existingPlanIds = new Set((existing || []).filter(e => e.plan_id).map(e => e.plan_id));
      const existingAssignmentIds = new Set((existing || []).filter(e => e.assignment_id).map(e => e.assignment_id));
      const newInvoices: any[] = [];

      // From billing plans
      let pq = supabase.from('student_billing_plans').select('id, student_id, net_recurring_fee, currency, branch_id, division_id').eq('is_active', true);
      if (branchId) pq = pq.eq('branch_id', branchId);
      if (divisionId) pq = pq.eq('division_id', divisionId);
      const { data: plans } = await pq;
      (plans || []).forEach((p: any) => {
        if (!existingPlanIds.has(p.id) && p.net_recurring_fee > 0) {
          newInvoices.push({ plan_id: p.id, student_id: p.student_id, amount: p.net_recurring_fee, currency: p.currency, billing_month: currentBillingMonth, due_date: `${currentBillingMonth}-10`, branch_id: p.branch_id, division_id: p.division_id });
        }
      });

      // From assignments (fallback)
      let aq = supabase.from('student_teacher_assignments').select('id, student_id, calculated_monthly_fee, first_month_prorated_fee, start_date, fee_packages!student_teacher_assignments_fee_package_id_fkey(currency), branch_id, division_id').eq('status', 'active');
      if (branchId) aq = aq.eq('branch_id', branchId);
      if (divisionId) aq = aq.eq('division_id', divisionId);
      const { data: assignments } = await aq;
      const planStudentIds = new Set(newInvoices.map(i => i.student_id));
      (assignments || []).forEach((a: any) => {
        if (!existingAssignmentIds.has(a.id) && a.calculated_monthly_fee && !planStudentIds.has(a.student_id)) {
          const isFirstMonth = a.start_date && a.start_date.startsWith(currentBillingMonth);
          const amount = isFirstMonth && a.first_month_prorated_fee ? a.first_month_prorated_fee : a.calculated_monthly_fee;
          newInvoices.push({ assignment_id: a.id, student_id: a.student_id, amount, currency: a.fee_packages?.currency || 'USD', billing_month: currentBillingMonth, due_date: `${currentBillingMonth}-10`, branch_id: a.branch_id, division_id: a.division_id });
        }
      });

      if (newInvoices.length === 0) throw new Error('All invoices for this month already exist');
      const { error } = await supabase.from('fee_invoices').insert(newInvoices);
      if (error) throw error;
      return newInvoices.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      toast({ title: `Successfully generated ${count} invoices for ${currentMonthLabel}.` });
    },
    onError: (e: any) => toast({ title: 'Generation failed', description: e.message, variant: 'destructive' }),
  });

  // Bulk payment mutation
  const bulkPayMutation = useMutation({
    mutationFn: async () => {
      if (unpaidSelected.length === 0) throw new Error('No unpaid invoices selected');
      if (!amountForeign) throw new Error('Enter the amount received');

      // Upload receipt if provided
      let receiptUrl: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop();
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('payment-receipts').upload(path, receiptFile);
        if (upErr) throw new Error('Receipt upload failed: ' + upErr.message);
        const { data: urlData } = supabase.storage.from('payment-receipts').getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }

      // Process each selected invoice
      const transactions: any[] = [];
      let remainingAmount = amountForeign;

      for (const inv of unpaidSelected) {
        const outstanding = Number(inv.amount) - Number(inv.amount_paid || 0);
        const allocated = Math.min(remainingAmount, outstanding);
        remainingAmount -= allocated;

        const isShort = allocated < outstanding;
        let newStatus: string = 'paid';
        let forgivenAmount = 0;

        if (isShort) {
          switch (payForm.resolution) {
            case 'partial':
              newStatus = 'partially_paid';
              break;
            case 'writeoff':
              newStatus = 'paid';
              forgivenAmount = outstanding - allocated;
              break;
            case 'arrears':
              newStatus = 'paid';
              // Arrears handling: create a line item for next month below
              break;
            default:
              newStatus = 'partially_paid';
          }
        }

        // Update invoice
        await supabase.from('fee_invoices').update({
          amount_paid: Number(inv.amount_paid || 0) + allocated,
          status: newStatus as any,
          paid_at: newStatus === 'paid' || newStatus === 'partially_paid' ? new Date().toISOString() : inv.paid_at,
          forgiven_amount: forgivenAmount,
        }).eq('id', inv.id);

        // Create transaction record
        transactions.push({
          invoice_id: inv.id,
          student_id: inv.student_id,
          amount_foreign: allocated,
          currency_foreign: inv.currency,
          amount_local: amountLocal > 0 ? (allocated / amountForeign) * amountLocal : 0,
          currency_local: 'PKR',
          effective_rate: effectiveRate || null,
          resolution_type: isShort ? payForm.resolution : 'full',
          shortfall_amount: isShort ? outstanding - allocated : 0,
          receipt_url: receiptUrl,
          notes: payForm.notes || null,
          recorded_by: user?.id || null,
          branch_id: branchId,
          division_id: divisionId,
        });

        // Handle arrears: create next month arrears invoice
        if (isShort && payForm.resolution === 'arrears') {
          const arrearsAmount = outstanding - allocated;
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          const nextBillingMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
          await supabase.from('fee_invoices').insert({
            student_id: inv.student_id,
            assignment_id: inv.assignment_id,
            plan_id: inv.plan_id,
            amount: arrearsAmount,
            currency: inv.currency,
            billing_month: nextBillingMonth,
            due_date: `${nextBillingMonth}-10`,
            remark: `Previous arrears from ${formatBillingMonth(inv.billing_month)}`,
            branch_id: branchId,
            division_id: divisionId,
          });
        }
      }

      // Batch insert transactions
      if (transactions.length > 0) {
        const { error: txErr } = await supabase.from('payment_transactions').insert(transactions);
        if (txErr) throw txErr;
      }

      return transactions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      toast({ title: `${count} payment(s) recorded successfully` });
      setBulkPayOpen(false);
      setSelectedIds(new Set());
      setPayForm({ amount_foreign: '', amount_local: '', resolution: 'full', notes: '' });
      setReceiptFile(null);
    },
    onError: (e: any) => toast({ title: 'Payment failed', description: e.message, variant: 'destructive' }),
  });

  // ─── Selection Handlers ──────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableInvoices.map(i => i.id)));
    }
  };

  const openBulkPay = () => {
    if (unpaidSelected.length === 0) {
      toast({ title: 'Select pending invoices first', variant: 'destructive' });
      return;
    }
    setPayForm({ amount_foreign: totalExpected.toString(), amount_local: '', resolution: 'full', notes: '' });
    setReceiptFile(null);
    setBulkPayOpen(true);
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Fee Invoices</h1>
            <p className="text-muted-foreground mt-1">Composite billing ledger with forex & arrears</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSetupOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Set Up Student Fee
            </Button>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="gap-2">
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Generate Monthly Invoices
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-6 w-6 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Fees</p>
                <p className="text-2xl font-serif font-bold text-foreground">{totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><CheckCircle className="h-6 w-6 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-2xl font-serif font-bold text-foreground">{collected.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center"><XCircle className="h-6 w-6 text-destructive" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-serif font-bold text-destructive">{pending.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters + Bulk Action */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Billing Month" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
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
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <Button onClick={openBulkPay} className="gap-2 animate-fade-in">
              <Receipt className="h-4 w-4" /> Record Payment ({unpaidSelected.length})
            </Button>
          )}
        </div>

        {/* Invoice Table */}
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
                  <TableHead className="w-10">
                    <Checkbox checked={allSelectableChecked} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Billing Month</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => {
                  const isPaid = inv.status === 'paid';
                  return (
                    <TableRow key={inv.id} className={selectedIds.has(inv.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(inv.id)}
                          onCheckedChange={() => toggleSelect(inv.id)}
                          disabled={isPaid}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <User className="h-4 w-4 text-secondary-foreground" />
                          </div>
                          <span className="font-medium">{inv.profiles?.full_name || 'Unknown'}</span>
                        </span>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{getPackageName(inv)}</Badge></TableCell>
                      <TableCell>{formatBillingMonth(inv.billing_month)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {inv.currency} {Number(inv.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {Number(inv.amount_paid || 0) > 0 ? `${inv.currency} ${Number(inv.amount_paid).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                      </TableCell>
                      <TableCell>{inv.due_date || '—'}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(inv.status)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* ─── Set Up Student Fee Modal ─────────────────────────────── */}
        <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Set Up Student Fee</DialogTitle>
              <DialogDescription>Configure a composite billing plan with duration-based surcharges.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div className="space-y-4">
                <div>
                  <Label>Student</Label>
                  <Select value={feeForm.student_id} onValueChange={v => setFeeForm(f => ({ ...f, student_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                    <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Base Package (30-min rate)</Label>
                  <Select value={feeForm.base_package_id} onValueChange={v => setFeeForm(f => ({ ...f, base_package_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select package..." /></SelectTrigger>
                    <SelectContent>{packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.currency} {p.amount}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Session Duration</Label>
                  <Select value={feeForm.session_duration} onValueChange={v => setFeeForm(f => ({ ...f, session_duration: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DURATION_OPTIONS.map(d => <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Flat Discount</Label>
                  <Input type="number" placeholder="0" value={feeForm.flat_discount} onChange={e => setFeeForm(f => ({ ...f, flat_discount: e.target.value }))} />
                </div>
              </div>
              <div className="bg-muted/50 rounded-xl border border-border p-5 space-y-3">
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Invoice Preview</h3>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Base (30-min)</span><span className="font-mono font-medium">{feeCurrency} {baseAmount.toLocaleString()}</span></div>
                  {durationSurcharge > 0 && <div className="flex justify-between text-primary"><span>Duration Premium ({duration} min)</span><span className="font-mono font-medium">+ {feeCurrency} {durationSurcharge.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                  {flatDiscount > 0 && <div className="flex justify-between text-destructive"><span>Flat Discount</span><span className="font-mono font-medium">- {feeCurrency} {flatDiscount.toLocaleString()}</span></div>}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold"><span>Net Recurring Fee</span><span className="font-mono">{feeCurrency} {netRecurringFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">Billed monthly when invoices are generated.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSetupOpen(false)}>Cancel</Button>
              <Button onClick={() => savePlanMutation.mutate()} disabled={!feeForm.student_id || !feeForm.base_package_id || savePlanMutation.isPending}>
                {savePlanMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Billing Plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Bulk Payment Modal ───────────────────────────────────── */}
        <Dialog open={bulkPayOpen} onOpenChange={setBulkPayOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Record Payment</DialogTitle>
              <DialogDescription>{unpaidSelected.length} invoice(s) selected • Expected: {bulkCurrency} {totalExpected.toLocaleString(undefined, { maximumFractionDigits: 2 })}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Selected invoices summary */}
              <div className="bg-muted/50 rounded-lg border border-border p-3 max-h-32 overflow-y-auto space-y-1">
                {unpaidSelected.map(inv => (
                  <div key={inv.id} className="flex justify-between text-sm">
                    <span>{inv.profiles?.full_name} — {formatBillingMonth(inv.billing_month)}</span>
                    <span className="font-mono font-medium">{inv.currency} {(Number(inv.amount) - Number(inv.amount_paid || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>

              {/* Forex inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount Received ({bulkCurrency})</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={payForm.amount_foreign}
                    onChange={e => setPayForm(f => ({ ...f, amount_foreign: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Realized Amount (PKR)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={payForm.amount_local}
                    onChange={e => setPayForm(f => ({ ...f, amount_local: e.target.value }))}
                  />
                </div>
              </div>

              {/* Effective rate display */}
              {amountLocal > 0 && amountForeign > 0 && (
                <div className="flex items-center gap-2 text-sm bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <ArrowRightLeft className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Effective Rate:</span>
                  <span className="font-mono font-bold text-foreground">1 {bulkCurrency} = {effectiveRate.toFixed(2)} PKR</span>
                </div>
              )}

              {/* Shortfall resolution */}
              {hasShortfall && (
                <div className="space-y-3 bg-destructive/5 rounded-lg border border-destructive/20 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Shortfall: {bulkCurrency} {shortfall.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div>
                    <Label>Shortfall Resolution</Label>
                    <Select value={payForm.resolution} onValueChange={v => setPayForm(f => ({ ...f, resolution: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="partial">Leave Open (Partially Paid)</SelectItem>
                        <SelectItem value="writeoff">Write-Off / Forgive</SelectItem>
                        <SelectItem value="arrears">Carry Forward (Arrears)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {payForm.resolution === 'partial' && 'Invoice will remain open with partial payment recorded.'}
                    {payForm.resolution === 'writeoff' && 'Deficit will be forgiven and invoice marked as paid.'}
                    {payForm.resolution === 'arrears' && 'Deficit will be carried forward as an arrears line-item for next month.'}
                  </p>
                </div>
              )}

              {/* Receipt upload */}
              <div>
                <Label>Proof of Payment (optional)</Label>
                <input ref={receiptInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
                <div
                  onClick={() => receiptInputRef.current?.click()}
                  className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {receiptFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-foreground">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      <span>{receiptFile.name}</span>
                      <Badge variant="secondary" className="text-xs">{(receiptFile.size / 1024).toFixed(0)} KB</Badge>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Upload className="h-5 w-5" />
                      <span className="text-xs">Click to upload receipt screenshot</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Any remarks about this payment..."
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  className="h-16"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkPayOpen(false)}>Cancel</Button>
              <Button onClick={() => bulkPayMutation.mutate()} disabled={bulkPayMutation.isPending || !amountForeign}>
                {bulkPayMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
