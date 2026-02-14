import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CheckCircle, XCircle, Clock, User, Loader2, Zap, GraduationCap } from 'lucide-react';
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

interface InvoiceRow {
  id: string;
  assignment_id: string | null;
  student_id: string;
  amount: number;
  currency: string;
  billing_month: string;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
  remark: string | null;
  profiles: { full_name: string } | null;
  student_teacher_assignments: {
    fee_packages: { name: string } | null;
  } | null;
}

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

  // Fetch invoices with relational joins
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['fee-invoices', branchId, divisionId, monthFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('fee_invoices')
        .select(`
          id, assignment_id, student_id, amount, currency, billing_month,
          due_date, status, paid_at, payment_method, remark,
          profiles!fee_invoices_student_id_fkey(full_name),
          student_teacher_assignments!fee_invoices_assignment_id_fkey(
            fee_packages!student_teacher_assignments_fee_package_id_fkey(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (branchId) q = q.eq('branch_id', branchId);
      if (divisionId) q = q.eq('division_id', divisionId);
      if (monthFilter !== 'all') q = q.eq('billing_month', monthFilter);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter as 'pending' | 'paid' | 'overdue');

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as InvoiceRow[];
    },
    enabled: !!branchId,
  });

  // Generate invoices mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      // 1. Fetch all active assignments with billing data
      let q = supabase
        .from('student_teacher_assignments')
        .select('id, student_id, calculated_monthly_fee, first_month_prorated_fee, start_date, fee_packages!student_teacher_assignments_fee_package_id_fkey(currency), branch_id, division_id')
        .eq('status', 'active');
      if (branchId) q = q.eq('branch_id', branchId);
      if (divisionId) q = q.eq('division_id', divisionId);

      const { data: assignments, error: aErr } = await q;
      if (aErr) throw aErr;
      if (!assignments || assignments.length === 0) throw new Error('No active assignments found');

      // 2. Fetch existing invoices for this month to avoid duplicates
      const { data: existing } = await supabase
        .from('fee_invoices')
        .select('assignment_id')
        .eq('billing_month', currentBillingMonth);

      const existingSet = new Set((existing || []).map((e: any) => e.assignment_id));

      // 3. Build new invoice rows
      const newInvoices = (assignments as any[])
        .filter((a) => a.calculated_monthly_fee && !existingSet.has(a.id))
        .map((a) => {
          // Determine if this is the first month
          const isFirstMonth = a.start_date && a.start_date.startsWith(currentBillingMonth);
          const amount = isFirstMonth && a.first_month_prorated_fee
            ? a.first_month_prorated_fee
            : a.calculated_monthly_fee;

          const currency = a.fee_packages?.currency || 'USD';

          return {
            assignment_id: a.id,
            student_id: a.student_id,
            amount,
            currency,
            billing_month: currentBillingMonth,
            due_date: `${currentBillingMonth}-10`,
            branch_id: a.branch_id,
            division_id: a.division_id,
          };
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
      const { error } = await supabase
        .from('fee_invoices')
        .update({ status: 'paid' as any, paid_at: new Date().toISOString() })
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

  // Build month options from billing_month format
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return { value: `${now.getFullYear()}-${m}`, label: `${MONTHS[i].label} ${now.getFullYear()}` };
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><CheckCircle className="h-3 w-3" /> Paid</Badge>;
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

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Fee Invoices</h1>
            <p className="text-muted-foreground mt-1">Automated billing ledger from active assignments</p>
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2"
          >
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Generate Monthly Invoices
          </Button>
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
              <p className="text-sm">Click "Generate Monthly Invoices" to create invoices from active assignments</p>
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
                      <Badge variant="outline" className="text-xs">
                        {inv.student_teacher_assignments?.fee_packages?.name || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatBillingMonth(inv.billing_month)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {inv.currency} {Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{inv.due_date || '—'}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right">
                      {inv.status === 'pending' || inv.status === 'overdue' ? (
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
