import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Receipt, Plus, Search, Loader2, CheckCircle, Clock, Pencil, Trash2,
  DollarSign, Users, Briefcase, Gift, Baby, Settings, FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayDate } from '@/lib/dateFormat';

const CATEGORIES = [
  { value: 'allowance', label: 'Allowance', icon: DollarSign, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'zoom', label: 'Zoom', icon: Settings, color: 'bg-blue-100 text-blue-700' },
  { value: 'admin_cost', label: 'Admin Cost', icon: Briefcase, color: 'bg-purple-100 text-purple-700' },
  { value: 'gifts', label: 'Gifts', icon: Gift, color: 'bg-pink-100 text-pink-700' },
  { value: 'maternity', label: 'Maternity', icon: Baby, color: 'bg-amber-100 text-amber-700' },
  { value: 'operational', label: 'Operational', icon: Settings, color: 'bg-gray-100 text-gray-700' },
  { value: 'manual', label: 'Manual', icon: FileText, color: 'bg-slate-100 text-slate-700' },
];

export default function Expenses() {
  const { activeBranch, activeDivision } = useDivision();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const branchId = activeBranch?.id || null;
  const divisionId = activeDivision?.id || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    category: 'operational',
    description: '',
    amount: '',
    currency: 'USD',
    expense_date: new Date().toISOString().split('T')[0],
    teacher_id: '',
    student_id: '',
    notes: '',
    invoice_number: '',
    receipt_url: '',
  });

  // Fetch expenses
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', branchId, divisionId, categoryFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('*, profiles_teacher:profiles!expenses_teacher_id_fkey(full_name), profiles_student:profiles!expenses_student_id_fkey(full_name), profiles_creator:profiles!expenses_created_by_fkey(full_name), cash_advance:cash_advances!expenses_advance_id_fkey(id, purpose, issued_to)')
        .order('expense_date', { ascending: false });
      if (branchId) q = q.eq('branch_id', branchId);
      if (divisionId) q = q.eq('division_id', divisionId);
      if (categoryFilter !== 'all') q = q.eq('category', categoryFilter);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!branchId,
  });

  // Teachers and students for dropdowns
  const { data: teachers = [] } = useQuery({
    queryKey: ['expense-teachers'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher');
      if (!roleRows?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', roleRows.map(r => r.user_id)).is('archived_at', null).order('full_name');
      return data || [];
    },
    enabled: formOpen,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['expense-students'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'student');
      if (!roleRows?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', roleRows.map(r => r.user_id)).is('archived_at', null).order('full_name');
      return data || [];
    },
    enabled: formOpen,
  });

  const filtered = useMemo(() => {
    if (!searchQuery) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter((e: any) =>
      e.description?.toLowerCase().includes(q) ||
      e.profiles_teacher?.full_name?.toLowerCase().includes(q) ||
      e.profiles_student?.full_name?.toLowerCase().includes(q)
    );
  }, [expenses, searchQuery]);

  // Summary
  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const categorySummary = CATEGORIES.map(c => ({
    ...c,
    total: expenses.filter((e: any) => e.category === c.value).reduce((s: number, e: any) => s + Number(e.amount), 0),
    count: expenses.filter((e: any) => e.category === c.value).length,
  }));

  const saveExpense = useMutation({
    mutationFn: async () => {
      const payload: any = {
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount) || 0,
        currency: form.currency,
        expense_date: form.expense_date,
        teacher_id: form.teacher_id || null,
        student_id: form.student_id || null,
        notes: form.notes || null,
        invoice_number: form.invoice_number || null,
        receipt_url: form.receipt_url || null,
        branch_id: branchId,
        division_id: divisionId,
        created_by: user?.id,
        status: 'approved',
      };

      if (editingId) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from('expenses').insert(payload).select('id').single();
        if (error) throw error;

        // Auto-create salary adjustment for teacher-linked expenses
        if (form.teacher_id && inserted) {
          const salaryMonth = form.expense_date.substring(0, 7);
          await supabase.from('salary_adjustments').insert({
            teacher_id: form.teacher_id,
            salary_month: salaryMonth,
            adjustment_type: 'expense',
            amount: parseFloat(form.amount) || 0,
            reason: `Expense: ${form.description}`,
            expense_id: inserted.id,
            created_by: user?.id,
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Expense updated' : 'Expense added' });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['salary-adjustments'] });
      closeForm();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      // Also delete linked salary adjustment
      await supabase.from('salary_adjustments').delete().eq('expense_id', id);
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Expense deleted' });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['salary-adjustments'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm({ category: 'operational', description: '', amount: '', currency: 'USD', expense_date: new Date().toISOString().split('T')[0], teacher_id: '', student_id: '', notes: '', invoice_number: '', receipt_url: '' });
  };

  const openEdit = (expense: any) => {
    setEditingId(expense.id);
    setForm({
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      currency: expense.currency,
      expense_date: expense.expense_date,
      teacher_id: expense.teacher_id || '',
      student_id: expense.student_id || '',
      notes: expense.notes || '',
      invoice_number: expense.invoice_number || '',
      receipt_url: expense.receipt_url || '',
    });
    setFormOpen(true);
  };

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[5];

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-6 w-6 text-accent" />
              Expenses Hub
            </h1>
            <p className="text-sm text-muted-foreground">Track organizational expenses and auto-link to salary</p>
          </div>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Expense
          </Button>
        </div>

        {/* Category Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {categorySummary.map(c => (
            <Card key={c.value} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCategoryFilter(categoryFilter === c.value ? 'all' : c.value)}>
              <CardContent className="p-3 text-center">
                <c.icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                <p className="text-lg font-bold">${c.total.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{c.count} items</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Total */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium">Total Expenses</span>
            <span className="text-xl font-bold">${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search expenses..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Expenses Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={9} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No expenses found</TableCell></TableRow>
                )}
                {filtered.map((expense: any) => {
                  const catInfo = getCategoryInfo(expense.category);
                  return (
                    <TableRow key={expense.id}>
                      <TableCell className="text-sm">{formatDisplayDate(expense.expense_date)}</TableCell>
                      <TableCell>
                        <Badge className={`${catInfo.color} border-0 gap-1`}>
                          <catInfo.icon className="h-3 w-3" />
                          {catInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {expense.description}
                        {expense.advance_id && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-amber-300 text-amber-600">From Advance</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {expense.invoice_number ? (
                          <span className="font-mono text-xs">{expense.invoice_number}</span>
                        ) : '—'}
                        {expense.receipt_url && (
                          <a href={expense.receipt_url} target="_blank" rel="noreferrer" className="ml-1 text-primary hover:underline text-xs">📎</a>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{expense.profiles_teacher?.full_name || '—'}</TableCell>
                      <TableCell className="text-sm">{expense.profiles_student?.full_name || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{expense.currency} {Number(expense.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={expense.status === 'approved' ? 'default' : 'outline'} className="text-xs capitalize">
                          {expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(expense)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteExpense.mutate(expense.id)}>
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

        {/* Add/Edit Dialog */}
        <Dialog open={formOpen} onOpenChange={v => { if (!v) closeForm(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
              <DialogDescription>Teacher-linked expenses auto-appear in salary additions</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What is this expense for?" />
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
                      {['USD', 'PKR', 'GBP', 'EUR', 'CAD', 'AUD', 'AED'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} />
              </div>
              <div>
                <Label>Link to Teacher (optional)</Label>
                <Select value={form.teacher_id || "none"} onValueChange={v => setForm(p => ({ ...p, teacher_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.teacher_id && (
                  <p className="text-xs text-accent mt-1">⚡ This expense will auto-appear in teacher's salary additions</p>
                )}
              </div>
              <div>
                <Label>Link to Student (optional)</Label>
                <Select value={form.student_id || "none"} onValueChange={v => setForm(p => ({ ...p, student_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Number</Label>
                  <Input value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="INV-001" />
                </div>
                <div>
                  <Label>Receipt / Attachment URL</Label>
                  <Input value={form.receipt_url} onChange={e => setForm(p => ({ ...p, receipt_url: e.target.value }))} placeholder="https://..." />
                  <p className="text-[10px] text-muted-foreground mt-0.5">PDF, JPEG, PNG link for proof</p>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeForm}>Cancel</Button>
              <Button onClick={() => saveExpense.mutate()} disabled={!form.description || !form.amount || saveExpense.isPending}>
                {saveExpense.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editingId ? 'Update' : 'Add'} Expense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
