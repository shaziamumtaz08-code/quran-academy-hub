import React, { useState, useMemo, useRef, useCallback } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DollarSign, CheckCircle, XCircle, Clock, User, Loader2, Zap, GraduationCap,
  Plus, Receipt, Upload, ArrowRightLeft, AlertTriangle, ImageIcon, X, Search, ArrowUpDown, Users, Pencil, Trash2, ListChecks,
  MoreHorizontal, Ban, Undo2, History, Tag, FileX
} from 'lucide-react';
import { endOfMonth, startOfMonth, parseISO, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/contexts/AuthContext';
import { trackActivity } from '@/lib/activityLogger';
import BillingPlansTable from '@/components/finance/BillingPlansTable';

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
const RECEIVING_CHANNELS = ['Bank Account', 'JazzCash', 'EasyPaisa', 'Western Union', 'Remitly', 'Cash', 'Other'];

const getDefaultPeriodDates = (billingMonth: string) => {
  try {
    const d = parseISO(billingMonth + '-01');
    return {
      from: format(startOfMonth(d), 'yyyy-MM-dd'),
      to: format(endOfMonth(d), 'yyyy-MM-dd'),
    };
  } catch {
    return { from: '', to: '' };
  }
};

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
interface StudentOption { id: string; full_name: string; country: string | null }
interface StudentSubjects { [studentId: string]: string[] }
interface PackageOption { id: string; name: string; amount: number; currency: string }
type BulkSortColumn = 'name' | 'country' | 'subject';
type BulkSortDir = 'asc' | 'desc';
interface DiscountRule { id: string; name: string; type: string; value: number; is_active: boolean }

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
    case 'waived':
      return <Badge className="bg-muted text-muted-foreground border-border gap-1"><Ban className="h-3 w-3" /> Waived</Badge>;
    case 'adjusted':
      return <Badge className="bg-secondary text-secondary-foreground border-border gap-1"><Tag className="h-3 w-3" /> Adjusted</Badge>;
    case 'voided':
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><FileX className="h-3 w-3" /> Voided</Badge>;
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
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // Invoice action modals state
  const [editInvoiceData, setEditInvoiceData] = useState<{ id: string; amount: string; due_date: string; billing_month: string } | null>(null);
  const [actionModal, setActionModal] = useState<{ type: 'mark_unpaid' | 'apply_discount' | 'waive_fee' | 'reverse_payment' | 'void_invoice' | 'view_history'; invoice: InvoiceRow } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [adjustmentHistory, setAdjustmentHistory] = useState<any[]>([]);

  // Setup fee form - multi-select students
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [feeForm, setFeeForm] = useState({
    base_package_id: '',
    session_duration: '30',
    flat_discount: '0',
    manual_discount_reason: '',
    global_discount_id: '',
  });

  // Bulk selection mode state
  const [selectionMode, setSelectionMode] = useState<'individual' | 'bulk'>('individual');
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkSort, setBulkSort] = useState<{ column: BulkSortColumn; direction: BulkSortDir }>({ column: 'name', direction: 'asc' });

  // Bulk payment form
  const [payForm, setPayForm] = useState({
    amount_foreign: '',
    amount_local: '',
    resolution: 'full' as 'full' | 'partial' | 'writeoff' | 'arrears',
    notes: '',
    payment_date: new Date().toISOString().split('T')[0],
    period_from: '',
    period_to: '',
    payment_method: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('invoices');

  // ─── Data Queries ────────────────────────────────────────────────
  const { data: students = [] } = useQuery({
    queryKey: ['students-for-fees', branchId],
    queryFn: async () => {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      const studentUserIds = (roleRows || []).map(r => r.user_id);
      if (studentUserIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, country')
        .in('id', studentUserIds)
        .is('archived_at', null)
        .order('full_name');
      return (data || []) as StudentOption[];
    },
    enabled: setupOpen,
  });

  const { data: studentSubjects = {} } = useQuery<StudentSubjects>({
    queryKey: ['student-subjects-for-fees', branchId, divisionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('student_teacher_assignments')
        .select('student_id, subjects!student_teacher_assignments_subject_id_fkey(name)')
        .eq('status', 'active');
      const map: StudentSubjects = {};
      (data || []).forEach((row: any) => {
        const sid = row.student_id;
        const subName = row.subjects?.name;
        if (sid && subName) {
          if (!map[sid]) map[sid] = [];
          if (!map[sid].includes(subName)) map[sid].push(subName);
        }
      });
      return map;
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

  const { data: discountRules = [] } = useQuery({
    queryKey: ['discount-rules-active', branchId, divisionId],
    queryFn: async () => {
      let q = supabase.from('discount_rules').select('id, name, type, value, is_active').eq('is_active', true);
      if (branchId) q = q.eq('branch_id', branchId);
      if (divisionId) q = q.eq('division_id', divisionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DiscountRule[];
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

  const { data: parentLinks = [] } = useQuery({
    queryKey: ['parent-links-for-payments'],
    queryFn: async () => {
      const { data } = await supabase.from('student_parent_links').select('student_id, parent_id, profiles!student_parent_links_parent_id_fkey(full_name)');
      return (data || []) as { student_id: string; parent_id: string; profiles: { full_name: string } | null }[];
    },
    enabled: !!branchId,
  });

  const familyGroups = useMemo(() => {
    const map: Record<string, { parentName: string; studentIds: string[] }> = {};
    parentLinks.forEach(link => {
      if (!map[link.parent_id]) {
        map[link.parent_id] = { parentName: link.profiles?.full_name || 'Unknown Parent', studentIds: [] };
      }
      if (!map[link.parent_id].studentIds.includes(link.student_id)) {
        map[link.parent_id].studentIds.push(link.student_id);
      }
    });
    return Object.entries(map).filter(([_, fam]) =>
      invoices.some(inv => fam.studentIds.includes(inv.student_id) && inv.status !== 'paid')
    );
  }, [parentLinks, invoices]);

  // ─── Computed Values ─────────────────────────────────────────────
  const selectedPkg = useMemo(() => packages.find(p => p.id === feeForm.base_package_id), [packages, feeForm.base_package_id]);
  const baseAmount = selectedPkg?.amount || 0;
  const duration = parseInt(feeForm.session_duration) || 30;
  const durationSurcharge = baseAmount * (duration / 30 - 1);
  const subtotal = baseAmount + durationSurcharge;

  const selectedGlobalDiscount = useMemo(() => discountRules.find(d => d.id === feeForm.global_discount_id), [discountRules, feeForm.global_discount_id]);
  const globalDiscountAmount = useMemo(() => {
    if (!selectedGlobalDiscount) return 0;
    if (selectedGlobalDiscount.type === 'percentage') return subtotal * (selectedGlobalDiscount.value / 100);
    return selectedGlobalDiscount.value;
  }, [selectedGlobalDiscount, subtotal]);

  const flatDiscount = parseFloat(feeForm.flat_discount) || 0;
  const totalDiscounts = globalDiscountAmount + flatDiscount;
  const netRecurringFee = Math.max(0, subtotal - totalDiscounts);
  const feeCurrency = selectedPkg?.currency || 'USD';

  const flatDiscountNeedsReason = flatDiscount > 0 && !feeForm.manual_discount_reason.trim();
  const canSavePlan = (editingPlanId || selectedStudentIds.length > 0) && feeForm.base_package_id && !flatDiscountNeedsReason;

  const filteredStudents = useMemo(() => {
    const search = studentSearch.toLowerCase();
    return students.filter(s => !selectedStudentIds.includes(s.id) && s.full_name.toLowerCase().includes(search));
  }, [students, selectedStudentIds, studentSearch]);

  const bulkFilteredStudents = useMemo(() => {
    const search = bulkSearch.toLowerCase();
    let list = students.filter(s => {
      if (!search) return true;
      const nameMatch = s.full_name.toLowerCase().includes(search);
      const countryMatch = s.country?.toLowerCase().includes(search);
      const subjectMatch = (studentSubjects[s.id] || []).some(sub => sub.toLowerCase().includes(search));
      return nameMatch || countryMatch || subjectMatch;
    });
    list.sort((a, b) => {
      const dir = bulkSort.direction === 'asc' ? 1 : -1;
      if (bulkSort.column === 'name') return dir * a.full_name.localeCompare(b.full_name);
      if (bulkSort.column === 'country') return dir * (a.country || '').localeCompare(b.country || '');
      if (bulkSort.column === 'subject') {
        const aSubj = (studentSubjects[a.id] || []).join(', ');
        const bSubj = (studentSubjects[b.id] || []).join(', ');
        return dir * aSubj.localeCompare(bSubj);
      }
      return 0;
    });
    return list;
  }, [students, bulkSearch, bulkSort, studentSubjects]);

  const allBulkFiltered = bulkFilteredStudents.every(s => selectedStudentIds.includes(s.id));

  const toggleBulkSort = useCallback((col: BulkSortColumn) => {
    setBulkSort(prev => prev.column === col ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { column: col, direction: 'asc' });
  }, []);

  const toggleSelectAllBulk = useCallback(() => {
    if (allBulkFiltered && bulkFilteredStudents.length > 0) {
      setSelectedStudentIds(prev => prev.filter(id => !bulkFilteredStudents.some(s => s.id === id)));
    } else {
      setSelectedStudentIds(prev => {
        const newIds = new Set(prev);
        bulkFilteredStudents.forEach(s => newIds.add(s.id));
        return Array.from(newIds);
      });
    }
  }, [allBulkFiltered, bulkFilteredStudents]);

  const toggleBulkStudent = useCallback((id: string) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
  }, []);

  const selectedInvoices = useMemo(() => invoices.filter(i => selectedIds.has(i.id)), [invoices, selectedIds]);
  const unpaidSelected = useMemo(() => selectedInvoices.filter(i => i.status !== 'paid'), [selectedInvoices]);
  const totalExpected = unpaidSelected.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid || 0)), 0);
  const bulkCurrency = unpaidSelected[0]?.currency || 'USD';
  const amountForeign = parseFloat(payForm.amount_foreign) || 0;
  const amountLocal = parseFloat(payForm.amount_local) || 0;
  const effectiveRate = amountForeign > 0 ? amountLocal / amountForeign : 0;
  const shortfall = totalExpected - amountForeign;
  const hasShortfall = amountForeign > 0 && amountForeign < totalExpected;

  const totalFees = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const collected = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const pending = totalFees - collected;

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return { value: `${now.getFullYear()}-${m}`, label: `${MONTHS[i].label} ${now.getFullYear()}` };
  });

  const selectableInvoices = useMemo(() => invoices.filter(i => i.status !== 'voided'), [invoices]);
  const allSelectableChecked = selectableInvoices.length > 0 && selectableInvoices.every(i => selectedIds.has(i.id));

  // ─── Mutations ───────────────────────────────────────────────────
  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (editingPlanId) {
        // Update existing plan
        const { error } = await supabase.from('student_billing_plans').update({
          base_package_id: feeForm.base_package_id,
          session_duration: duration,
          duration_surcharge: durationSurcharge,
          flat_discount: flatDiscount,
          net_recurring_fee: netRecurringFee,
          currency: feeCurrency,
          global_discount_id: feeForm.global_discount_id || null,
          manual_discount_reason: feeForm.manual_discount_reason || null,
        }).eq('id', editingPlanId);
        if (error) throw error;
        return 1;
      }
      if (selectedStudentIds.length === 0 || !feeForm.base_package_id) throw new Error('Select student(s) and package');
      const rows = selectedStudentIds.map(sid => ({
        student_id: sid,
        base_package_id: feeForm.base_package_id,
        session_duration: duration,
        duration_surcharge: durationSurcharge,
        flat_discount: flatDiscount,
        net_recurring_fee: netRecurringFee,
        currency: feeCurrency,
        is_active: true,
        branch_id: branchId,
        division_id: divisionId,
        global_discount_id: feeForm.global_discount_id || null,
        manual_discount_reason: feeForm.manual_discount_reason || null,
      }));
      const { error } = await supabase.from('student_billing_plans').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['billing-plans-list'] });
      const action = editingPlanId ? 'billing_plan_updated' : 'billing_plan_created';
      toast({ title: editingPlanId ? 'Billing plan updated' : `${count} billing plan(s) saved successfully` });
      if (editingPlanId) {
        trackActivity({ action: 'billing_plan_updated', entityType: 'billing_plan', entityId: editingPlanId, details: { net_fee: netRecurringFee, currency: feeCurrency } });
      } else {
        trackActivity({ action: 'billing_plan_created', entityType: 'billing_plan', details: { count, net_fee: netRecurringFee, currency: feeCurrency } });
      }
      setSetupOpen(false);
      resetFeeForm();
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const resetFeeForm = () => {
    setSelectedStudentIds([]);
    setStudentSearch('');
    setSelectionMode('individual');
    setBulkSearch('');
    setBulkSort({ column: 'name', direction: 'asc' });
    setFeeForm({ base_package_id: '', session_duration: '30', flat_discount: '0', manual_discount_reason: '', global_discount_id: '' });
    setEditingPlanId(null);
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.from('fee_invoices').select('plan_id, assignment_id').eq('billing_month', currentBillingMonth);
      const existingPlanIds = new Set((existing || []).filter(e => e.plan_id).map(e => e.plan_id));
      const existingAssignmentIds = new Set((existing || []).filter(e => e.assignment_id).map(e => e.assignment_id));
      const newInvoices: any[] = [];

      let pq = supabase.from('student_billing_plans').select('id, student_id, net_recurring_fee, currency, branch_id, division_id').eq('is_active', true);
      if (branchId) pq = pq.eq('branch_id', branchId);
      if (divisionId) pq = pq.eq('division_id', divisionId);
      const { data: plans } = await pq;
      (plans || []).forEach((p: any) => {
        if (!existingPlanIds.has(p.id) && p.net_recurring_fee > 0) {
          newInvoices.push({ plan_id: p.id, student_id: p.student_id, amount: p.net_recurring_fee, currency: p.currency, billing_month: currentBillingMonth, due_date: `${currentBillingMonth}-10`, branch_id: p.branch_id, division_id: p.division_id });
        }
      });

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

  const bulkPayMutation = useMutation({
    mutationFn: async () => {
      if (unpaidSelected.length === 0) throw new Error('No unpaid invoices selected');
      if (!amountForeign) throw new Error('Enter the amount received');

      let receiptUrl: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop();
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('payment-receipts').upload(path, receiptFile);
        if (upErr) throw new Error('Receipt upload failed: ' + upErr.message);
        const { data: urlData } = supabase.storage.from('payment-receipts').getPublicUrl(path);
        receiptUrl = urlData.publicUrl;
      }

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
            case 'partial': newStatus = 'partially_paid'; break;
            case 'writeoff': newStatus = 'paid'; forgivenAmount = outstanding - allocated; break;
            case 'arrears': newStatus = 'paid'; break;
            default: newStatus = 'partially_paid';
          }
        }

        await supabase.from('fee_invoices').update({
          amount_paid: Number(inv.amount_paid || 0) + allocated,
          status: newStatus as any,
          paid_at: newStatus === 'paid' || newStatus === 'partially_paid' ? new Date().toISOString() : inv.paid_at,
          forgiven_amount: forgivenAmount,
        }).eq('id', inv.id);

        transactions.push({
          invoice_id: inv.id, student_id: inv.student_id,
          amount_foreign: allocated, currency_foreign: inv.currency,
          amount_local: amountLocal > 0 ? (allocated / amountForeign) * amountLocal : 0,
          currency_local: 'PKR', effective_rate: effectiveRate || null,
          resolution_type: isShort ? payForm.resolution : 'full',
          shortfall_amount: isShort ? outstanding - allocated : 0,
          receipt_url: receiptUrl, notes: payForm.notes || null,
          recorded_by: user?.id || null, branch_id: branchId, division_id: divisionId,
          payment_date: payForm.payment_date || new Date().toISOString().split('T')[0],
          period_from: payForm.period_from || null, period_to: payForm.period_to || null,
          payment_method: payForm.payment_method || null,
        });

        if (isShort && payForm.resolution === 'arrears') {
          const arrearsAmount = outstanding - allocated;
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          const nextBillingMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
          await supabase.from('fee_invoices').insert({
            student_id: inv.student_id, assignment_id: inv.assignment_id, plan_id: inv.plan_id,
            amount: arrearsAmount, currency: inv.currency, billing_month: nextBillingMonth,
            due_date: `${nextBillingMonth}-10`, remark: `Previous arrears from ${formatBillingMonth(inv.billing_month)}`,
            branch_id: branchId, division_id: divisionId,
          });
        }
      }

      if (transactions.length > 0) {
        const { error: txErr } = await supabase.from('payment_transactions').insert(transactions);
        if (txErr) throw txErr;
      }

      return transactions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      toast({ title: `${count} payment(s) recorded successfully` });
      trackActivity({ action: 'payment_recorded', entityType: 'invoice', details: { count, amount: amountForeign, currency: bulkCurrency } });
      setBulkPayOpen(false);
      setSelectedIds(new Set());
      setPayForm({ amount_foreign: '', amount_local: '', resolution: 'full', notes: '', payment_date: new Date().toISOString().split('T')[0], period_from: '', period_to: '', payment_method: '' });
      setReceiptFile(null);
    },
    onError: (e: any) => toast({ title: 'Payment failed', description: e.message, variant: 'destructive' }),
  });

  // Helper to get current user profile for audit
  const getAdminInfo = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Not authenticated');
    const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', authUser.id).single();
    return { id: authUser.id, name: profile?.full_name || 'Unknown', email: profile?.email || authUser.email || null };
  };

  // Create adjustment record
  const createAdjustment = async (invoiceId: string, actionType: string, prevValues: any, newValues: any, reason: string) => {
    const admin = await getAdminInfo();
    await supabase.from('invoice_adjustments').insert({
      invoice_id: invoiceId, action_type: actionType,
      previous_values: prevValues, new_values: newValues,
      reason, admin_id: admin.id, admin_name: admin.name, admin_email: admin.email,
    });
  };

  // Invoice edit mutation (with audit trail)
  const editInvoiceMutation = useMutation({
    mutationFn: async (data: { id: string; amount: number; due_date: string; billing_month: string; originalAmount: number; originalDueDate: string; originalBillingMonth: string }) => {
      await createAdjustment(data.id, 'edit_amount',
        { amount: data.originalAmount, due_date: data.originalDueDate, billing_month: data.originalBillingMonth },
        { amount: data.amount, due_date: data.due_date, billing_month: data.billing_month },
        'Amount/details edited by admin'
      );
      const { error } = await supabase.from('fee_invoices').update({
        amount: data.amount, due_date: data.due_date || null, billing_month: data.billing_month,
      }).eq('id', data.id);
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      toast({ title: 'Invoice updated' });
      trackActivity({ action: 'invoice_edited', entityType: 'invoice', entityId: id });
      setEditInvoiceData(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Invoice action mutation (mark_unpaid, waive, void, reverse, discount)
  const invoiceActionMutation = useMutation({
    mutationFn: async ({ type, invoice, reason, discountAmt }: { type: string; invoice: InvoiceRow; reason: string; discountAmt?: number }) => {
      const prev = { status: invoice.status, amount: invoice.amount, amount_paid: invoice.amount_paid, forgiven_amount: invoice.forgiven_amount };

      switch (type) {
        case 'mark_unpaid': {
          await createAdjustment(invoice.id, 'mark_unpaid', prev, { status: 'pending', amount_paid: 0 }, reason);
          await supabase.from('fee_invoices').update({ status: 'pending' as any, amount_paid: 0, paid_at: null }).eq('id', invoice.id);
          break;
        }
        case 'apply_discount': {
          const newAmount = Math.max(0, Number(invoice.amount) - (discountAmt || 0));
          const newStatus = Number(invoice.amount_paid || 0) >= newAmount ? 'paid' : invoice.status;
          await createAdjustment(invoice.id, 'apply_discount', prev, { amount: newAmount, status: newStatus, discount_applied: discountAmt }, reason);
          await supabase.from('fee_invoices').update({ amount: newAmount, status: newStatus as any }).eq('id', invoice.id);
          break;
        }
        case 'waive_fee': {
          const outstanding = Number(invoice.amount) - Number(invoice.amount_paid || 0);
          await createAdjustment(invoice.id, 'waive_fee', prev, { status: 'waived', forgiven_amount: outstanding }, reason);
          await supabase.from('fee_invoices').update({ status: 'waived' as any, forgiven_amount: outstanding }).eq('id', invoice.id);
          break;
        }
        case 'reverse_payment': {
          await createAdjustment(invoice.id, 'reverse_payment', prev, { status: 'pending', amount_paid: 0 }, reason);
          await supabase.from('fee_invoices').update({ status: 'pending' as any, amount_paid: 0, paid_at: null, forgiven_amount: 0 }).eq('id', invoice.id);
          break;
        }
        case 'void_invoice': {
          await createAdjustment(invoice.id, 'void_invoice', prev, { status: 'voided' }, reason);
          await supabase.from('fee_invoices').update({ status: 'voided' as any }).eq('id', invoice.id);
          break;
        }
      }
      return invoice.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      toast({ title: 'Invoice updated successfully' });
      trackActivity({ action: 'invoice_edited', entityType: 'invoice', entityId: id, details: { action: actionModal?.type } });
      setActionModal(null);
      setActionReason('');
      setDiscountAmount('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Fetch history for an invoice
  const fetchHistory = async (invoiceId: string) => {
    const { data } = await supabase.from('invoice_adjustments').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false });
    setAdjustmentHistory(data || []);
  };

  // ─── Selection Handlers ──────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableChecked) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableInvoices.map(i => i.id)));
  };

  const openBulkPay = () => {
    if (unpaidSelected.length === 0) { toast({ title: 'Select pending invoices first', variant: 'destructive' }); return; }
    const months = unpaidSelected.map(i => i.billing_month).sort();
    const earliest = getDefaultPeriodDates(months[0]);
    const latest = getDefaultPeriodDates(months[months.length - 1]);
    setPayForm({
      amount_foreign: totalExpected.toString(), amount_local: '', resolution: 'full', notes: '',
      payment_date: new Date().toISOString().split('T')[0],
      period_from: earliest.from, period_to: latest.to, payment_method: '',
    });
    setReceiptFile(null);
    setBulkPayOpen(true);
  };

  const openSinglePay = (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv || inv.status === 'paid') return;
    setSelectedIds(new Set([invoiceId]));
    const due = Number(inv.amount) - Number(inv.amount_paid || 0);
    const period = getDefaultPeriodDates(inv.billing_month);
    setPayForm({
      amount_foreign: due.toString(), amount_local: '', resolution: 'full', notes: '',
      payment_date: new Date().toISOString().split('T')[0],
      period_from: period.from, period_to: period.to, payment_method: '',
    });
    setReceiptFile(null);
    setBulkPayOpen(true);
  };

  const openFamilyPay = (parentId: string) => {
    const family = familyGroups.find(([pid]) => pid === parentId);
    if (!family) return;
    const familyStudentIds = family[1].studentIds;
    const familyInvoiceIds = invoices.filter(inv => familyStudentIds.includes(inv.student_id) && inv.status !== 'paid').map(inv => inv.id);
    if (familyInvoiceIds.length === 0) { toast({ title: 'No unpaid invoices for this family', variant: 'destructive' }); return; }
    setSelectedIds(new Set(familyInvoiceIds));
    const familyUnpaid = invoices.filter(i => familyInvoiceIds.includes(i.id));
    const total = familyUnpaid.reduce((s, i) => s + (Number(i.amount) - Number(i.amount_paid || 0)), 0);
    const months = familyUnpaid.map(i => i.billing_month).sort();
    const earliest = getDefaultPeriodDates(months[0]);
    const latest = getDefaultPeriodDates(months[months.length - 1]);
    setPayForm({
      amount_foreign: total.toString(), amount_local: '', resolution: 'full', notes: '',
      payment_date: new Date().toISOString().split('T')[0],
      period_from: earliest.from, period_to: latest.to, payment_method: '',
    });
    setReceiptFile(null);
    setBulkPayOpen(true);
  };

  const addStudent = (id: string) => { setSelectedStudentIds(prev => [...prev, id]); setStudentSearch(''); };
  const removeStudent = (id: string) => { setSelectedStudentIds(prev => prev.filter(sid => sid !== id)); };

  // Edit billing plan handler (called from BillingPlansTable)
  const handleEditPlan = (plan: any) => {
    setEditingPlanId(plan.id);
    setSelectedStudentIds([plan.student_id]);
    setFeeForm({
      base_package_id: plan.base_package_id || '',
      session_duration: String(plan.session_duration || 30),
      flat_discount: String(plan.flat_discount || 0),
      manual_discount_reason: '',
      global_discount_id: '',
    });
    setSelectionMode('individual');
    setSetupOpen(true);
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Fee Management</h1>
            <p className="text-muted-foreground mt-1">Billing plans, invoices & payments</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { resetFeeForm(); setSetupOpen(true); }} className="gap-2">
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

        {/* Tabs: Invoices | Billing Plans */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="invoices" className="gap-2"><Receipt className="h-4 w-4" /> Invoices</TabsTrigger>
            <TabsTrigger value="plans" className="gap-2"><ListChecks className="h-4 w-4" /> Billing Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="mt-4 space-y-4">
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
                  <SelectItem value="waived">Waived</SelectItem>
                  <SelectItem value="adjusted">Adjusted</SelectItem>
                  <SelectItem value="voided">Voided</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GraduationCap className="h-4 w-4" />
                <span>{invoices.length} invoice(s)</span>
              </div>
              {familyGroups.length > 0 && (
                <Select onValueChange={openFamilyPay}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Pay Family..." /></SelectTrigger>
                  <SelectContent>
                    {familyGroups.map(([pid, fam]) => (
                      <SelectItem key={pid} value={pid}>
                        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {fam.parentName}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
                      <TableHead className="w-10"><Checkbox checked={allSelectableChecked} onCheckedChange={toggleSelectAll} /></TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Billing Month</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center w-[160px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(inv => {
                      const isVoided = inv.status === 'voided';
                      return (
                        <TableRow key={inv.id} className={selectedIds.has(inv.id) ? 'bg-primary/5' : ''}>
                          <TableCell><Checkbox checked={selectedIds.has(inv.id)} onCheckedChange={() => toggleSelect(inv.id)} disabled={isVoided} /></TableCell>
                          <TableCell>
                            <span className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"><User className="h-4 w-4 text-secondary-foreground" /></div>
                              <span className="font-medium">{inv.profiles?.full_name || 'Unknown'}</span>
                            </span>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{getPackageName(inv)}</Badge></TableCell>
                          <TableCell>{formatBillingMonth(inv.billing_month)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{inv.currency} {Number(inv.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {Number(inv.amount_paid || 0) > 0 ? `${inv.currency} ${Number(inv.amount_paid).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                          </TableCell>
                          <TableCell>{inv.due_date || '—'}</TableCell>
                          <TableCell className="text-center">{getStatusBadge(inv.status)}</TableCell>
                          <TableCell className="text-center">
                            {inv.status === 'voided' ? (
                              <span className="text-xs text-muted-foreground">Voided</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                {inv.status !== 'paid' && inv.status !== 'waived' && (
                                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => openSinglePay(inv.id)}>
                                    <Receipt className="h-3.5 w-3.5" /> Pay
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => setEditInvoiceData({ id: inv.id, amount: String(inv.amount), due_date: inv.due_date || '', billing_month: inv.billing_month })}>
                                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Amount
                                    </DropdownMenuItem>
                                    {(inv.status === 'paid' || inv.status === 'partially_paid') && (
                                      <DropdownMenuItem onClick={() => setActionModal({ type: 'mark_unpaid', invoice: inv })}>
                                        <Undo2 className="h-3.5 w-3.5 mr-2" /> Mark Unpaid
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => setActionModal({ type: 'apply_discount', invoice: inv })}>
                                      <Tag className="h-3.5 w-3.5 mr-2" /> Apply Discount
                                    </DropdownMenuItem>
                                    {inv.status !== 'waived' && (
                                      <DropdownMenuItem onClick={() => setActionModal({ type: 'waive_fee', invoice: inv })}>
                                        <Ban className="h-3.5 w-3.5 mr-2" /> Waive Fee
                                      </DropdownMenuItem>
                                    )}
                                    {(inv.status === 'paid' || inv.status === 'partially_paid') && (
                                      <DropdownMenuItem onClick={() => setActionModal({ type: 'reverse_payment', invoice: inv })}>
                                        <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Reverse Payment
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => { setActionModal({ type: 'view_history', invoice: inv }); fetchHistory(inv.id); }}>
                                      <History className="h-3.5 w-3.5 mr-2" /> View History
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setActionModal({ type: 'void_invoice', invoice: inv })}>
                                      <FileX className="h-3.5 w-3.5 mr-2" /> Void Invoice
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="plans" className="mt-4">
            <BillingPlansTable onEditPlan={handleEditPlan} />
          </TabsContent>
        </Tabs>

        {/* ─── Set Up Student Fee Modal ──────────── */}
        <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
          <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
            <div className="bg-[hsl(var(--sidebar-background))] px-8 py-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-lg text-primary-foreground font-serif">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Receipt className="h-5 w-5 text-primary" />
                  </div>
                  {editingPlanId ? 'Edit Billing Plan' : 'Composite Fee Builder'}
                </DialogTitle>
                <DialogDescription className="text-primary-foreground/60 mt-1">
                  {editingPlanId ? 'Update the billing plan configuration.' : 'Configure billing plans for one or more students with duration surcharges and discounts.'}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
              {/* Left: Configuration (3 cols) */}
              <div className="lg:col-span-3 p-8 space-y-5">
                {/* Student Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Students</Label>
                    {!editingPlanId && (
                      <ToggleGroup type="single" value={selectionMode} onValueChange={(v) => v && setSelectionMode(v as 'individual' | 'bulk')} className="border border-border rounded-lg p-0.5">
                        <ToggleGroupItem value="individual" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Individual</ToggleGroupItem>
                        <ToggleGroupItem value="bulk" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Bulk Select</ToggleGroupItem>
                      </ToggleGroup>
                    )}
                  </div>

                  {/* Selected badges */}
                  {selectedStudentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedStudentIds.slice(0, selectionMode === 'bulk' ? 5 : 999).map(sid => {
                        const s = students.find(st => st.id === sid);
                        return (
                          <Badge key={sid} variant="secondary" className="gap-1 pr-1 text-xs">
                            <GraduationCap className="h-3 w-3" />
                            {s?.full_name || 'Unknown'}
                            {!editingPlanId && (
                              <button type="button" onClick={() => removeStudent(sid)} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors">
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        );
                      })}
                      {selectionMode === 'bulk' && selectedStudentIds.length > 5 && (
                        <Badge variant="outline" className="text-xs">+{selectedStudentIds.length - 5} more</Badge>
                      )}
                    </div>
                  )}

                  {/* Individual Mode */}
                  {!editingPlanId && selectionMode === 'individual' && (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search students by name..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="pl-9" />
                      </div>
                      {studentSearch && filteredStudents.length > 0 && (
                        <div className="border border-border rounded-lg bg-card max-h-36 overflow-y-auto shadow-sm">
                          {filteredStudents.slice(0, 20).map(s => (
                            <button key={s.id} type="button" onClick={() => addStudent(s.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2">
                              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" /> {s.full_name}
                            </button>
                          ))}
                        </div>
                      )}
                      {studentSearch && filteredStudents.length === 0 && <p className="text-xs text-muted-foreground py-2">No matching students found.</p>}
                    </>
                  )}

                  {/* Bulk Mode */}
                  {!editingPlanId && selectionMode === 'bulk' && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Filter by name, country, or subject..." value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} className="pl-9" />
                      </div>
                      <ScrollArea className="h-[250px] border border-border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="w-10 h-9 px-3"><Checkbox checked={bulkFilteredStudents.length > 0 && allBulkFiltered} onCheckedChange={toggleSelectAllBulk} /></TableHead>
                              <TableHead className="h-9 px-3 cursor-pointer select-none text-xs" onClick={() => toggleBulkSort('name')}>Name {bulkSort.column === 'name' && (bulkSort.direction === 'asc' ? '↑' : '↓')}</TableHead>
                              <TableHead className="h-9 px-3 cursor-pointer select-none text-xs" onClick={() => toggleBulkSort('country')}>Country {bulkSort.column === 'country' && (bulkSort.direction === 'asc' ? '↑' : '↓')}</TableHead>
                              <TableHead className="h-9 px-3 cursor-pointer select-none text-xs" onClick={() => toggleBulkSort('subject')}>Subject {bulkSort.column === 'subject' && (bulkSort.direction === 'asc' ? '↑' : '↓')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bulkFilteredStudents.length === 0 ? (
                              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No students match your filter.</TableCell></TableRow>
                            ) : (
                              bulkFilteredStudents.map(s => (
                                <TableRow key={s.id} className={selectedStudentIds.includes(s.id) ? 'bg-primary/5' : 'cursor-pointer'} onClick={() => toggleBulkStudent(s.id)}>
                                  <TableCell className="px-3 py-1.5"><Checkbox checked={selectedStudentIds.includes(s.id)} onCheckedChange={() => toggleBulkStudent(s.id)} onClick={e => e.stopPropagation()} /></TableCell>
                                  <TableCell className="px-3 py-1.5 text-sm font-medium">{s.full_name}</TableCell>
                                  <TableCell className="px-3 py-1.5 text-sm text-muted-foreground">{s.country || '—'}</TableCell>
                                  <TableCell className="px-3 py-1.5">
                                    {(studentSubjects[s.id] || []).length > 0 ? (
                                      <div className="flex flex-wrap gap-1">{(studentSubjects[s.id] || []).map(sub => <Badge key={sub} variant="outline" className="text-[10px] py-0 px-1.5">{sub}</Badge>)}</div>
                                    ) : <span className="text-xs text-muted-foreground">—</span>}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground">{selectedStudentIds.length} of {students.length} students selected{bulkSearch && ` (${bulkFilteredStudents.length} shown)`}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Package & Duration */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Base Package</Label>
                    <Select value={feeForm.base_package_id} onValueChange={v => setFeeForm(f => ({ ...f, base_package_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select package..." /></SelectTrigger>
                      <SelectContent>{packages.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.currency} {p.amount}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Session Duration</Label>
                    <Select value={feeForm.session_duration} onValueChange={v => setFeeForm(f => ({ ...f, session_duration: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DURATION_OPTIONS.map(d => <SelectItem key={d} value={d.toString()}>{d} min</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Discounts Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Discounts</h4>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Global Discount Rule</Label>
                    <Select value={feeForm.global_discount_id} onValueChange={v => setFeeForm(f => ({ ...f, global_discount_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {discountRules.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({d.type === 'percentage' ? `${d.value}%` : `${d.value} flat`})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Flat Discount</Label>
                    <Input type="number" placeholder="0" value={feeForm.flat_discount} onChange={e => setFeeForm(f => ({ ...f, flat_discount: e.target.value }))} />
                  </div>
                  {flatDiscount > 0 && (
                    <div className="space-y-1.5 animate-fade-in">
                      <Label className="text-sm flex items-center gap-1.5">Reason for Manual Discount <span className="text-destructive">*</span></Label>
                      <Input placeholder="e.g. Sibling discount, financial hardship..." value={feeForm.manual_discount_reason} onChange={e => setFeeForm(f => ({ ...f, manual_discount_reason: e.target.value }))} className={flatDiscountNeedsReason ? 'border-destructive' : ''} />
                      {flatDiscountNeedsReason && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> A reason is required when applying a manual discount.</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Invoice Preview (2 cols) */}
              <div className="lg:col-span-2 bg-muted/40 border-l border-border p-8 flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Invoice Preview</h3>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Base Fee (30 min)</span>
                      <span className="font-mono font-semibold">{feeCurrency} {baseAmount.toLocaleString()}</span>
                    </div>
                    {durationSurcharge > 0 && (
                      <div className="flex justify-between items-center text-sm text-primary">
                        <span>Duration Premium ({duration} min)</span>
                        <span className="font-mono font-semibold">+ {feeCurrency} {durationSurcharge.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {durationSurcharge > 0 && (
                      <div className="flex justify-between items-center text-sm border-t border-border/50 pt-2">
                        <span className="text-muted-foreground font-medium">Subtotal</span>
                        <span className="font-mono font-semibold">{feeCurrency} {subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {globalDiscountAmount > 0 && (
                      <div className="flex justify-between items-center text-sm text-destructive">
                        <span>{selectedGlobalDiscount?.name}</span>
                        <span className="font-mono font-semibold">- {feeCurrency} {globalDiscountAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {flatDiscount > 0 && (
                      <div className="flex justify-between items-center text-sm text-destructive">
                        <span>Manual Discount</span>
                        <span className="font-mono font-semibold">- {feeCurrency} {flatDiscount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-foreground">Net Recurring Fee</span>
                    <span className="text-xl font-mono font-black text-foreground">{feeCurrency} {netRecurringFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  {selectedStudentIds.length > 1 && !editingPlanId && (
                    <div className="bg-primary/5 rounded-lg p-3 border border-primary/10 text-sm">
                      <span className="text-muted-foreground">Applying to </span>
                      <span className="font-bold text-primary">{selectedStudentIds.length} students</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Billed monthly when invoices are generated.</p>
                </div>
                <div className="mt-8 space-y-3">
                  <Button onClick={() => savePlanMutation.mutate()} disabled={!canSavePlan || savePlanMutation.isPending} className="w-full gap-2" size="lg">
                    {savePlanMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editingPlanId ? 'Update Billing Plan' : `Save Billing Plan${selectedStudentIds.length > 1 ? `s (${selectedStudentIds.length})` : ''}`}
                  </Button>
                  <Button variant="outline" onClick={() => setSetupOpen(false)} className="w-full">Cancel</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ─── Bulk Payment Modal ───────────────────────────────────── */}
        <Dialog open={bulkPayOpen} onOpenChange={setBulkPayOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-base"><ArrowRightLeft className="h-4 w-4" /> Record Payment</DialogTitle>
              <DialogDescription className="text-xs">{unpaidSelected.length} invoice(s) • Expected: {bulkCurrency} {totalExpected.toLocaleString(undefined, { maximumFractionDigits: 2 })}</DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 px-4 sm:px-6">
              <div className="space-y-3 pb-4">
                <div className="bg-muted/50 rounded-lg border border-border p-2 max-h-24 overflow-y-auto space-y-0.5">
                  {unpaidSelected.map(inv => (
                    <div key={inv.id} className="flex justify-between text-xs">
                      <span className="truncate mr-2">{inv.profiles?.full_name} — {formatBillingMonth(inv.billing_month)}</span>
                      <span className="font-mono font-medium shrink-0">{inv.currency} {(Number(inv.amount) - Number(inv.amount_paid || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payment Period</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">From</Label><Input type="date" value={payForm.period_from} onChange={e => setPayForm(f => ({ ...f, period_from: e.target.value }))} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">To</Label><Input type="date" value={payForm.period_to} onChange={e => setPayForm(f => ({ ...f, period_to: e.target.value }))} className="h-8 text-sm" /></div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payment Details</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Payment Date</Label><Input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} className="h-8 text-sm" /></div>
                    <div>
                      <Label className="text-xs">Receiving Channel</Label>
                      <Select value={payForm.payment_method} onValueChange={v => setPayForm(f => ({ ...f, payment_method: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{RECEIVING_CHANNELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Amount ({bulkCurrency})</Label><Input type="number" placeholder="0.00" value={payForm.amount_foreign} onChange={e => setPayForm(f => ({ ...f, amount_foreign: e.target.value }))} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Realized (PKR)</Label><Input type="number" placeholder="0.00" value={payForm.amount_local} onChange={e => setPayForm(f => ({ ...f, amount_local: e.target.value }))} className="h-8 text-sm" /></div>
                </div>

                {amountLocal > 0 && amountForeign > 0 && (
                  <div className="flex items-center gap-2 text-xs bg-primary/5 rounded-lg p-2 border border-primary/20">
                    <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                    <span className="text-muted-foreground">Rate:</span>
                    <span className="font-mono font-bold text-foreground">1 {bulkCurrency} = {effectiveRate.toFixed(2)} PKR</span>
                  </div>
                )}

                {hasShortfall && (
                  <div className="space-y-2 bg-destructive/5 rounded-lg border border-destructive/20 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> Shortfall: {bulkCurrency} {shortfall.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div>
                      <Label className="text-xs">Resolution</Label>
                      <Select value={payForm.resolution} onValueChange={v => setPayForm(f => ({ ...f, resolution: v as any }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="partial">Leave Open (Partially Paid)</SelectItem>
                          <SelectItem value="writeoff">Write-Off / Forgive</SelectItem>
                          <SelectItem value="arrears">Carry Forward (Arrears)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {payForm.resolution === 'partial' && 'Invoice will remain open with partial payment recorded.'}
                      {payForm.resolution === 'writeoff' && 'Deficit will be forgiven and invoice marked as paid.'}
                      {payForm.resolution === 'arrears' && 'Deficit will be carried forward as an arrears line-item for next month.'}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-xs">Proof of Payment (optional)</Label>
                  <input ref={receiptInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
                  <div onClick={() => receiptInputRef.current?.click()} className="mt-1 border-2 border-dashed border-border rounded-lg p-2.5 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    {receiptFile ? (
                      <div className="flex items-center justify-center gap-2 text-xs text-foreground">
                        <ImageIcon className="h-3.5 w-3.5 text-primary" /> <span className="truncate">{receiptFile.name}</span> <Badge variant="secondary" className="text-[10px]">{(receiptFile.size / 1024).toFixed(0)} KB</Badge>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-muted-foreground"><Upload className="h-4 w-4" /><span className="text-xs">Upload receipt</span></div>
                    )}
                  </div>
                </div>

                <div><Label className="text-xs">Notes (optional)</Label><Textarea placeholder="Any remarks..." value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} className="h-12 text-sm" /></div>
              </div>
            </ScrollArea>

            <DialogFooter className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6 shrink-0 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setBulkPayOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => bulkPayMutation.mutate()} disabled={bulkPayMutation.isPending || !amountForeign}>
                {bulkPayMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Edit Invoice Modal ───────────────────────────────────── */}
        <Dialog open={!!editInvoiceData} onOpenChange={() => setEditInvoiceData(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Invoice</DialogTitle>
              <DialogDescription>Adjust amount, due date, or billing month. Original values are preserved in audit trail.</DialogDescription>
            </DialogHeader>
            {editInvoiceData && (
              <div className="space-y-4 py-2">
                <div><Label>Amount</Label><Input type="number" value={editInvoiceData.amount} onChange={e => setEditInvoiceData(d => d ? { ...d, amount: e.target.value } : null)} /></div>
                <div><Label>Due Date</Label><Input type="date" value={editInvoiceData.due_date} onChange={e => setEditInvoiceData(d => d ? { ...d, due_date: e.target.value } : null)} /></div>
                <div>
                  <Label>Billing Month</Label>
                  <Select value={editInvoiceData.billing_month} onValueChange={v => setEditInvoiceData(d => d ? { ...d, billing_month: v } : null)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditInvoiceData(null)}>Cancel</Button>
              <Button onClick={() => {
                if (!editInvoiceData) return;
                const inv = invoices.find(i => i.id === editInvoiceData.id);
                editInvoiceMutation.mutate({
                  id: editInvoiceData.id,
                  amount: parseFloat(editInvoiceData.amount) || 0,
                  due_date: editInvoiceData.due_date,
                  billing_month: editInvoiceData.billing_month,
                  originalAmount: inv?.amount || 0,
                  originalDueDate: inv?.due_date || '',
                  originalBillingMonth: inv?.billing_month || '',
                });
              }} disabled={editInvoiceMutation.isPending}>
                {editInvoiceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Invoice Action Modal ──────────────────────────────────── */}
        <Dialog open={!!actionModal && actionModal.type !== 'view_history'} onOpenChange={() => { setActionModal(null); setActionReason(''); setDiscountAmount(''); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {actionModal?.type === 'mark_unpaid' && <><Undo2 className="h-5 w-5" /> Mark Unpaid</>}
                {actionModal?.type === 'apply_discount' && <><Tag className="h-5 w-5" /> Apply Discount</>}
                {actionModal?.type === 'waive_fee' && <><Ban className="h-5 w-5" /> Waive Fee</>}
                {actionModal?.type === 'reverse_payment' && <><ArrowRightLeft className="h-5 w-5" /> Reverse Payment</>}
                {actionModal?.type === 'void_invoice' && <><FileX className="h-5 w-5 text-destructive" /> Void Invoice</>}
              </DialogTitle>
              <DialogDescription>
                {actionModal?.type === 'mark_unpaid' && 'Reset this invoice to unpaid status. Payment records are preserved.'}
                {actionModal?.type === 'apply_discount' && 'Apply an additional discount to reduce the invoice amount.'}
                {actionModal?.type === 'waive_fee' && 'Waive the remaining balance. This will mark the fee as forgiven.'}
                {actionModal?.type === 'reverse_payment' && 'Reverse all payments on this invoice. Transaction records are preserved.'}
                {actionModal?.type === 'void_invoice' && 'Void this invoice. It will remain in records but be inactive.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {actionModal?.type === 'apply_discount' && (
                <div>
                  <Label>Discount Amount ({actionModal.invoice.currency})</Label>
                  <Input type="number" placeholder="0.00" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} />
                  {actionModal.invoice && (
                    <p className="text-xs text-muted-foreground mt-1">Current amount: {actionModal.invoice.currency} {Number(actionModal.invoice.amount).toLocaleString()}</p>
                  )}
                </div>
              )}
              <div>
                <Label>Reason <span className="text-destructive">*</span></Label>
                <Textarea placeholder="Provide a reason for this action..." value={actionReason} onChange={e => setActionReason(e.target.value)} className="h-20" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setActionModal(null); setActionReason(''); setDiscountAmount(''); }}>Cancel</Button>
              <Button
                variant={actionModal?.type === 'void_invoice' ? 'destructive' : 'default'}
                disabled={!actionReason.trim() || invoiceActionMutation.isPending || (actionModal?.type === 'apply_discount' && !parseFloat(discountAmount))}
                onClick={() => actionModal && invoiceActionMutation.mutate({
                  type: actionModal.type,
                  invoice: actionModal.invoice,
                  reason: actionReason,
                  discountAmt: parseFloat(discountAmount) || undefined,
                })}
              >
                {invoiceActionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── View History Modal ────────────────────────────────────── */}
        <Dialog open={actionModal?.type === 'view_history'} onOpenChange={() => { setActionModal(null); setAdjustmentHistory([]); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Invoice History</DialogTitle>
              <DialogDescription>
                {actionModal?.invoice.profiles?.full_name} — {actionModal?.invoice && formatBillingMonth(actionModal.invoice.billing_month)}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              {adjustmentHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No adjustments recorded for this invoice.</p>
              ) : (
                <div className="space-y-3">
                  {adjustmentHistory.map((adj: any) => (
                    <div key={adj.id} className="border border-border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs capitalize">{adj.action_type.replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(adj.created_at).toLocaleString('en-US', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                      <p className="text-sm"><span className="text-muted-foreground">By:</span> {adj.admin_name} {adj.admin_email && `(${adj.admin_email})`}</p>
                      {adj.reason && <p className="text-sm"><span className="text-muted-foreground">Reason:</span> {adj.reason}</p>}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-destructive/5 rounded p-2">
                          <span className="font-semibold text-destructive">Previous:</span>
                          <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">{JSON.stringify(adj.previous_values, null, 2)}</pre>
                        </div>
                        <div className="bg-primary/5 rounded p-2">
                          <span className="font-semibold text-primary">New:</span>
                          <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">{JSON.stringify(adj.new_values, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setActionModal(null); setAdjustmentHistory([]); }}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
