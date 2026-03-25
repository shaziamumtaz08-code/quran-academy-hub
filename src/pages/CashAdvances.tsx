import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Banknote, Plus, Search, Loader2, Trash2, ArrowDownLeft, Receipt,
  CheckCircle, AlertCircle, Wallet, BookOpen, Upload, FileText, Image, ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayDate } from '@/lib/dateFormat';

const CURRENCIES = ['USD', 'PKR', 'GBP', 'EUR', 'CAD', 'AUD', 'AED'];
const DISBURSEMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'wallet', label: 'Wallet' },
];

const EXPENSE_CATEGORIES = [
  { value: 'allowance', label: 'Allowance' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'admin_cost', label: 'Admin Cost' },
  { value: 'gifts', label: 'Gifts' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'operational', label: 'Operational' },
  { value: 'manual', label: 'Manual' },
];

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'easypaisa', label: 'Easypaisa' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online Transfer' },
  { value: 'other', label: 'Other' },
];

export default function CashAdvances() {
  const { activeBranch, activeDivision } = useDivision();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const branchId = activeBranch?.id || null;
  const divisionId = activeDivision?.id || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [issueOpen, setIssueOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [expenseFromAdvanceOpen, setExpenseFromAdvanceOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<any>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const [form, setForm] = useState({
    issued_to: '',
    amount: '',
    currency: 'USD',
    issue_date: new Date().toISOString().split('T')[0],
    purpose: '',
    notes: '',
    disbursement_method: 'cash',
  });

  const [returnForm, setReturnForm] = useState({
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });

  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    category: 'operational',
    expense_date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    receipt_url: '',
    payment_method: 'cash',
  });
  const [expenseReceiptUploading, setExpenseReceiptUploading] = useState(false);
  const expenseReceiptRef = React.useRef<HTMLInputElement>(null);

  // Fetch staff
  const { data: staff = [] } = useQuery({
    queryKey: ['advance-staff'],
    queryFn: async () => {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['teacher', 'admin', 'admin_fees', 'admin_academic', 'admin_admissions']);
      if (!roleRows?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name')
        .in('id', roleRows.map(r => r.user_id))
        .is('archived_at', null).order('full_name');
      return data || [];
    },
  });

  // Fetch advances
  const { data: advances = [], isLoading } = useQuery({
    queryKey: ['cash-advances', branchId, divisionId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('cash_advances')
        .select('*, issued_to_profile:profiles!cash_advances_issued_to_fkey(full_name)')
        .order('issue_date', { ascending: false });
      if (branchId) q = q.eq('branch_id', branchId);
      if (divisionId) q = q.eq('division_id', divisionId);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!branchId,
  });

  // Fetch ALL transactions grouped by advance for inline summaries
  const advanceIds = useMemo(() => advances.map((a: any) => a.id), [advances]);
  const { data: allTransactions = [] } = useQuery({
    queryKey: ['all-advance-transactions', advanceIds],
    queryFn: async () => {
      if (!advanceIds.length) return [];
      const { data, error } = await supabase
        .from('cash_advance_transactions')
        .select('*')
        .in('advance_id', advanceIds)
        .order('transaction_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: advanceIds.length > 0,
  });

  // Compute per-advance summaries
  const advanceSummaries = useMemo(() => {
    const map: Record<string, { spent: number; returned: number }> = {};
    for (const tx of allTransactions) {
      if (!map[tx.advance_id]) map[tx.advance_id] = { spent: 0, returned: 0 };
      if (tx.transaction_type === 'expense') map[tx.advance_id].spent += Number(tx.amount);
      else if (tx.transaction_type === 'return') map[tx.advance_id].returned += Number(tx.amount);
    }
    return map;
  }, [allTransactions]);

  // Fetch transactions for ledger view
  const { data: ledgerTransactions = [] } = useQuery({
    queryKey: ['advance-ledger', selectedAdvance?.id],
    queryFn: async () => {
      if (!selectedAdvance?.id) return [];
      const { data, error } = await supabase
        .from('cash_advance_transactions')
        .select('*')
        .eq('advance_id', selectedAdvance.id)
        .order('transaction_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedAdvance?.id && ledgerOpen,
  });

  // Build ledger with running balance
  const ledgerWithBalance = useMemo(() => {
    if (!selectedAdvance) return [];
    let balance = Number(selectedAdvance.amount);
    const issueRow = {
      id: 'issue',
      transaction_date: selectedAdvance.issue_date,
      transaction_type: 'issue',
      description: `Advance issued — ${selectedAdvance.purpose}`,
      amount: Number(selectedAdvance.amount),
      balance_after: balance,
    };
    const rows = [issueRow];
    for (const tx of ledgerTransactions) {
      balance -= Number(tx.amount);
      rows.push({
        id: tx.id,
        transaction_date: tx.transaction_date,
        transaction_type: tx.transaction_type,
        description: tx.description,
        amount: Number(tx.amount),
        balance_after: balance,
      });
    }
    return rows;
  }, [selectedAdvance, ledgerTransactions]);

  const filtered = useMemo(() => {
    if (!searchQuery) return advances;
    const q = searchQuery.toLowerCase();
    return advances.filter((a: any) =>
      a.purpose?.toLowerCase().includes(q) ||
      a.issued_to_profile?.full_name?.toLowerCase().includes(q)
    );
  }, [advances, searchQuery]);

  // Auto-open ledger from URL query param (e.g., ?ledger=<advance_id>)
  useEffect(() => {
    const ledgerId = searchParams.get('ledger');
    if (ledgerId && advances.length > 0) {
      const adv = advances.find((a: any) => a.id === ledgerId);
      if (adv) {
        setSelectedAdvance(adv);
        setLedgerOpen(true);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, advances]);

  // Dashboard stats
  const openAdvances = advances.filter((a: any) => a.status === 'open');
  const settledAdvances = advances.filter((a: any) => a.status === 'settled');
  const cashOutside = openAdvances.reduce((s: number, a: any) => s + Number(a.remaining_balance), 0);

  // Save advance (issue or edit)
  const saveAdvance = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(form.amount) || 0;
      if (editingId) {
        // Safe edit: recalculate remaining_balance based on transactions
        const summary = advanceSummaries[editingId] || { spent: 0, returned: 0 };
        const newRemaining = amt - summary.spent - summary.returned;
        if (newRemaining < 0) throw new Error('New amount cannot be less than already spent/returned');
        const { error } = await supabase.from('cash_advances').update({
          issued_to: form.issued_to,
          amount: amt,
          remaining_balance: newRemaining,
          currency: form.currency,
          issue_date: form.issue_date,
          purpose: form.purpose,
          notes: form.notes || null,
          disbursement_method: form.disbursement_method,
          status: newRemaining <= 0 ? 'settled' : 'open',
        }).eq('id', editingId);
        if (error) throw error;
      } else {
        // Create advance
        const { data: inserted, error } = await supabase.from('cash_advances').insert({
          issued_to: form.issued_to,
          amount: amt,
          remaining_balance: amt,
          currency: form.currency,
          issue_date: form.issue_date,
          purpose: form.purpose,
          notes: form.notes || null,
          disbursement_method: form.disbursement_method,
          branch_id: branchId,
          division_id: divisionId,
          created_by: user?.id,
          status: 'open',
        }).select('id').single();
        if (error) throw error;

        // Create ISSUE transaction
        if (inserted) {
          await supabase.from('cash_advance_transactions').insert({
            advance_id: inserted.id,
            transaction_type: 'issue',
            amount: amt,
            description: `Cash advance issued: ${form.purpose}`,
            transaction_date: form.issue_date,
            created_by: user?.id,
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Advance updated' : 'Cash advance issued' });
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] });
      queryClient.invalidateQueries({ queryKey: ['all-advance-transactions'] });
      closeIssueForm();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Record cash return
  const recordReturn = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(returnForm.amount) || 0;
      if (amt <= 0) throw new Error('Amount must be positive');
      if (amt > Number(selectedAdvance.remaining_balance)) throw new Error('Return exceeds remaining balance');

      const { error: txErr } = await supabase.from('cash_advance_transactions').insert({
        advance_id: selectedAdvance.id,
        transaction_type: 'return',
        amount: amt,
        description: returnForm.description || 'Cash returned',
        transaction_date: returnForm.transaction_date,
        created_by: user?.id,
      });
      if (txErr) throw txErr;

      const newBalance = Number(selectedAdvance.remaining_balance) - amt;
      const { error: upErr } = await supabase.from('cash_advances').update({
        remaining_balance: newBalance,
        status: newBalance <= 0 ? 'settled' : 'open',
      }).eq('id', selectedAdvance.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast({ title: 'Cash return recorded' });
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] });
      queryClient.invalidateQueries({ queryKey: ['all-advance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['advance-ledger'] });
      setReturnOpen(false);
      setReturnForm({ amount: '', description: '', transaction_date: new Date().toISOString().split('T')[0] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Record expense from advance
  const recordExpenseFromAdvance = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(expenseForm.amount) || 0;
      if (amt <= 0) throw new Error('Amount must be positive');
      if (amt > Number(selectedAdvance.remaining_balance)) throw new Error('Expense exceeds remaining advance balance');

      const { data: inserted, error: expErr } = await supabase.from('expenses').insert({
        category: expenseForm.category,
        description: expenseForm.description,
        amount: amt,
        currency: selectedAdvance.currency,
        expense_date: expenseForm.expense_date,
        invoice_number: expenseForm.invoice_number || null,
        receipt_url: expenseForm.receipt_url || null,
        branch_id: branchId,
        division_id: divisionId,
        created_by: user?.id,
        status: 'approved',
        advance_id: selectedAdvance.id,
        teacher_id: selectedAdvance.issued_to,
      }).select('id').single();
      if (expErr) throw expErr;

      // Auto-create salary adjustment if issued to teacher
      const { data: roleCheck } = await supabase
        .from('user_roles').select('role')
        .eq('user_id', selectedAdvance.issued_to)
        .eq('role', 'teacher')
        .maybeSingle();

      if (roleCheck && inserted) {
        const salaryMonth = expenseForm.expense_date.substring(0, 7);
        await supabase.from('salary_adjustments').insert({
          teacher_id: selectedAdvance.issued_to,
          salary_month: salaryMonth,
          adjustment_type: 'expense',
          amount: amt,
          reason: `Expense from advance: ${expenseForm.description}`,
          expense_id: inserted.id,
          created_by: user?.id,
        });
      }

      // Create advance transaction
      await supabase.from('cash_advance_transactions').insert({
        advance_id: selectedAdvance.id,
        transaction_type: 'expense',
        amount: amt,
        description: expenseForm.description,
        transaction_date: expenseForm.expense_date,
        expense_id: inserted.id,
        created_by: user?.id,
      });

      // Update remaining balance
      const newBalance = Number(selectedAdvance.remaining_balance) - amt;
      await supabase.from('cash_advances').update({
        remaining_balance: newBalance,
        status: newBalance <= 0 ? 'settled' : 'open',
      }).eq('id', selectedAdvance.id);
    },
    onSuccess: () => {
      toast({ title: 'Expense recorded from advance' });
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] });
      queryClient.invalidateQueries({ queryKey: ['all-advance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['advance-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['salary-adjustments'] });
      setExpenseFromAdvanceOpen(false);
      setExpenseForm({ amount: '', description: '', category: 'operational', expense_date: new Date().toISOString().split('T')[0], invoice_number: '', receipt_url: '' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Delete with safety check
  const deleteAdvance = useMutation({
    mutationFn: async (id: string) => {
      // Check for existing transactions
      const { count } = await supabase
        .from('cash_advance_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('advance_id', id);
      if (count && count > 0) {
        throw new Error('Cannot delete advance with existing transactions. Settle it instead.');
      }
      const { error } = await supabase.from('cash_advances').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Advance deleted' });
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const closeIssueForm = () => {
    setIssueOpen(false);
    setEditingId(null);
    setForm({ issued_to: '', amount: '', currency: 'USD', issue_date: new Date().toISOString().split('T')[0], purpose: '', notes: '', disbursement_method: 'cash' });
  };

  const openEdit = (adv: any) => {
    setEditingId(adv.id);
    setForm({
      issued_to: adv.issued_to,
      amount: String(adv.amount),
      currency: adv.currency,
      issue_date: adv.issue_date,
      purpose: adv.purpose,
      notes: adv.notes || '',
      disbursement_method: adv.disbursement_method || 'cash',
    });
    setIssueOpen(true);
  };

  const openLedger = (adv: any) => {
    setSelectedAdvance(adv);
    setLedgerOpen(true);
  };

  const getTxTypeBadge = (type: string) => {
    switch (type) {
      case 'issue': return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">ISSUE</Badge>;
      case 'expense': return <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">EXPENSE</Badge>;
      case 'return': return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">RETURN</Badge>;
      case 'adjustment': return <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">ADJUSTMENT</Badge>;
      default: return <Badge variant="outline" className="text-xs capitalize">{type}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
              <Banknote className="h-6 w-6 text-accent" />
              Cash Advances
            </h1>
            <p className="text-sm text-muted-foreground">Track cash issued to staff — separate from expenses</p>
          </div>
          <Button onClick={() => setIssueOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Issue Cash Advance
          </Button>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Open Advances</p>
                  <p className="text-2xl font-bold">{openAdvances.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Cash Outside</p>
                  <p className="text-2xl font-bold">${cashOutside.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Settled Advances</p>
                  <p className="text-2xl font-bold">{settledAdvances.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search advances..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="settled">Settled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Advances Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Issued To</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Issued</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={9} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No cash advances found</TableCell></TableRow>
                )}
                {filtered.map((adv: any) => {
                  const summary = advanceSummaries[adv.id] || { spent: 0, returned: 0 };
                  const remaining = Number(adv.remaining_balance);
                  return (
                    <TableRow key={adv.id}>
                      <TableCell className="text-sm">{formatDisplayDate(adv.issue_date)}</TableCell>
                      <TableCell className="text-sm font-medium">{adv.issued_to_profile?.full_name || '—'}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">
                        {adv.purpose}
                        {adv.disbursement_method && adv.disbursement_method !== 'cash' && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] capitalize">{adv.disbursement_method.replace('_', ' ')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">{adv.currency} {Number(adv.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm text-amber-600 font-medium">{summary.spent > 0 ? `${adv.currency} ${summary.spent.toFixed(2)}` : '—'}</TableCell>
                      <TableCell className="text-right text-sm text-emerald-600 font-medium">{summary.returned > 0 ? `${adv.currency} ${summary.returned.toFixed(2)}` : '—'}</TableCell>
                      <TableCell className="text-right font-bold text-sm">
                        <span className={remaining > 0 ? 'text-destructive' : 'text-emerald-600'}>
                          {adv.currency} {remaining.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={adv.status === 'open' ? 'destructive' : 'default'} className="text-xs capitalize">
                          {adv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" title="View Ledger"
                            onClick={() => openLedger(adv)}>
                            <BookOpen className="h-3.5 w-3.5" /> Ledger
                          </Button>
                          {adv.status === 'open' && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" title="Record Expense"
                                onClick={() => { setSelectedAdvance(adv); setExpenseFromAdvanceOpen(true); }}>
                                <Receipt className="h-3.5 w-3.5" /> Expense
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" title="Record Return"
                                onClick={() => { setSelectedAdvance(adv); setReturnOpen(true); }}>
                                <ArrowDownLeft className="h-3.5 w-3.5" /> Return
                              </Button>
                            </>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete"
                            onClick={() => deleteAdvance.mutate(adv.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Issue Cash Advance Dialog */}
        <Dialog open={issueOpen} onOpenChange={v => { if (!v) closeIssueForm(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Advance' : 'Issue Cash Advance'}</DialogTitle>
              <DialogDescription>This is NOT an expense — it tracks cash given to staff</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Issue To (Staff)</Label>
                <Select value={form.issued_to || "none"} onValueChange={v => setForm(p => ({ ...p, issued_to: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select...</SelectItem>
                    {staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Issue Date</Label>
                  <Input type="date" value={form.issue_date} onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))} />
                </div>
                <div>
                  <Label>Disbursement Method</Label>
                  <Select value={form.disbursement_method} onValueChange={v => setForm(p => ({ ...p, disbursement_method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DISBURSEMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Purpose</Label>
                <Input value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} placeholder="Why is this cash being issued?" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeIssueForm}>Cancel</Button>
              <Button onClick={() => saveAdvance.mutate()} disabled={!form.issued_to || !form.amount || !form.purpose || saveAdvance.isPending}>
                {saveAdvance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editingId ? 'Update' : 'Issue'} Advance
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cash Return Dialog */}
        <Dialog open={returnOpen} onOpenChange={v => { if (!v) setReturnOpen(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Record Cash Return</DialogTitle>
              <DialogDescription>
                Remaining balance: {selectedAdvance?.currency} {Number(selectedAdvance?.remaining_balance || 0).toFixed(2)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Return Amount</Label>
                <Input type="number" value={returnForm.amount} onChange={e => setReturnForm(p => ({ ...p, amount: e.target.value }))}
                  max={Number(selectedAdvance?.remaining_balance || 0)} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={returnForm.transaction_date} onChange={e => setReturnForm(p => ({ ...p, transaction_date: e.target.value }))} />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={returnForm.description} onChange={e => setReturnForm(p => ({ ...p, description: e.target.value }))} placeholder="Cash returned" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
              <Button onClick={() => recordReturn.mutate()} disabled={!returnForm.amount || recordReturn.isPending}>
                {recordReturn.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Record Return
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Expense from Advance Dialog */}
        <Dialog open={expenseFromAdvanceOpen} onOpenChange={v => { if (!v) setExpenseFromAdvanceOpen(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Expense from Advance</DialogTitle>
              <DialogDescription>
                Remaining: {selectedAdvance?.currency} {Number(selectedAdvance?.remaining_balance || 0).toFixed(2)} — Creates linked expense record
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select value={expenseForm.category} onValueChange={v => setExpenseForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} placeholder="What was purchased?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                    max={Number(selectedAdvance?.remaining_balance || 0)} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(p => ({ ...p, expense_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice #</Label>
                  <Input value={expenseForm.invoice_number} onChange={e => setExpenseForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="INV-001" />
                </div>
                <div>
                  <Label>Receipt URL</Label>
                  <Input value={expenseForm.receipt_url} onChange={e => setExpenseForm(p => ({ ...p, receipt_url: e.target.value }))} placeholder="https://..." />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExpenseFromAdvanceOpen(false)}>Cancel</Button>
              <Button onClick={() => recordExpenseFromAdvance.mutate()} disabled={!expenseForm.description || !expenseForm.amount || recordExpenseFromAdvance.isPending}>
                {recordExpenseFromAdvance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Record Expense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ledger View Dialog */}
        <Dialog open={ledgerOpen} onOpenChange={v => { if (!v) { setLedgerOpen(false); setSelectedAdvance(null); } }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" /> Advance Ledger
              </DialogTitle>
              <DialogDescription>
                {selectedAdvance?.issued_to_profile?.full_name} — {selectedAdvance?.purpose}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <p className="text-xs text-muted-foreground">Issued</p>
                  <p className="font-bold">{selectedAdvance?.currency} {Number(selectedAdvance?.amount || 0).toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <p className="text-xs text-muted-foreground">Spent</p>
                  <p className="font-bold text-amber-700">{selectedAdvance?.currency} {(advanceSummaries[selectedAdvance?.id]?.spent || 0).toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <p className="text-xs text-muted-foreground">Returned</p>
                  <p className="font-bold text-emerald-700">{selectedAdvance?.currency} {(advanceSummaries[selectedAdvance?.id]?.returned || 0).toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/10">
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="font-bold text-destructive">{selectedAdvance?.currency} {Number(selectedAdvance?.remaining_balance || 0).toFixed(2)}</p>
                </div>
              </div>

              {/* Ledger table */}
              <div className="border rounded-lg max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerWithBalance.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No transactions</TableCell></TableRow>
                    )}
                    {ledgerWithBalance.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{formatDisplayDate(row.transaction_date)}</TableCell>
                        <TableCell>{getTxTypeBadge(row.transaction_type)}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{row.description}</TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {row.transaction_type === 'issue' ? '+' : '−'}{selectedAdvance?.currency} {row.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm">
                          <span className={row.balance_after > 0 ? 'text-destructive' : 'text-emerald-600'}>
                            {selectedAdvance?.currency} {row.balance_after.toFixed(2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
