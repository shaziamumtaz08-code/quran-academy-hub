import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
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
  MoreHorizontal, Ban, Undo2, History, Tag, FileX, Eye, FileText, Printer
} from 'lucide-react';
import { endOfMonth, startOfMonth, parseISO, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDivision } from '@/contexts/DivisionContext';
import { useAuth } from '@/contexts/AuthContext';
import { trackActivity } from '@/lib/activityLogger';
import BillingPlansTable from '@/components/finance/BillingPlansTable';
import { AttachmentPreview } from '@/components/shared/FileUploadField';

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
  remark: string | null;
  payment_method: string | null;
  period_from: string | null;
  period_to: string | null;
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
      return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pay</Badge>;
  }
};

const getPackageName = (inv: InvoiceRow) =>
  inv.student_billing_plans?.fee_packages?.name
  || inv.student_teacher_assignments?.fee_packages?.name
  || '—';

// ─── Main Component ──────────────────────────────────────────────────
export default function Payments() {
  const { activeBranch, activeDivision } = useDivision();
  const { user, activeRole, hasRole } = useAuth();
  const isParentView = activeRole === 'parent';
  const isStudentView = activeRole === 'student';
  const isReadOnlyView = isParentView || isStudentView;
  const branchId = activeBranch?.id || null;
  const divisionId = activeDivision?.id || null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter state
  const [monthFilter, setMonthFilter] = useState(currentBillingMonth);
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedInvoiceCacheRef = useRef<Map<string, InvoiceRow>>(new Map());

  // Modal state
  const [setupOpen, setSetupOpen] = useState(false);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // Invoice action modals state
  const [editInvoiceData, setEditInvoiceData] = useState<{ id: string; amount: string; due_date: string; billing_month: string; currency: string; remark: string; status: string; amount_paid: string; forgiven_amount: string; payment_method: string; paid_at: string; period_from: string; period_to: string; amount_local: string; receipt_url: string } | null>(null);
  const editReceiptInputRef = useRef<HTMLInputElement>(null);
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
  const [actionModal, setActionModal] = useState<{ type: 'mark_unpaid' | 'apply_discount' | 'waive_fee' | 'reverse_payment' | 'void_invoice' | 'view_history' | 'restore_to_pending'; invoice: InvoiceRow } | null>(null);
  const [receiptViewInvoice, setReceiptViewInvoice] = useState<InvoiceRow | null>(null);
  const [receiptTransactions, setReceiptTransactions] = useState<any[]>([]);
  const [actionReason, setActionReason] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [adjustmentHistory, setAdjustmentHistory] = useState<any[]>([]);
  const [editPaymentData, setEditPaymentData] = useState<{ invoiceId: string; transaction: any; invoice: InvoiceRow } | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({ amount_foreign: '', amount_local: '', payment_date: '', payment_method: '', notes: '', reason: '' });
  const [editPaymentLoading, setEditPaymentLoading] = useState(false);
  const [splitInvoices, setSplitInvoices] = useState<InvoiceRow[]>([]);
  const [splitMode, setSplitMode] = useState(false);

  // Setup fee form - multi-select students
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [feeForm, setFeeForm] = useState({
    base_package_id: '',
    session_duration: '30',
    flat_discount: '0',
    manual_discount_reason: '',
    global_discount_id: '',
    manual_fee: false,
    manual_amount: '',
    manual_currency: 'USD',
  });

  // Bulk selection mode state
  const [effectiveFrom, setEffectiveFrom] = useState(currentBillingMonth);
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
    queryKey: ['fee-invoices', branchId, divisionId, monthFilter, statusFilter, isReadOnlyView],
    queryFn: async () => {
      let q = supabase
        .from('fee_invoices')
        .select(`
          id, assignment_id, plan_id, student_id, amount, currency, billing_month,
          due_date, status, paid_at, amount_paid, forgiven_amount, remark, payment_method, period_from, period_to,
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

      // For admin views, scope to branch/division
      if (!isReadOnlyView) {
        if (branchId) q = q.eq('branch_id', branchId);
        if (divisionId) q = q.eq('division_id', divisionId);
      }
      if (monthFilter !== 'all') q = q.eq('billing_month', monthFilter);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter as any);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as InvoiceRow[];
    },
    // Parents/students don't need branch context; RLS handles scoping
    enabled: isReadOnlyView || !!branchId,
  });

  // Realised amounts + paid sums query (sum of amount_local and amount_foreign per invoice from ledger)
  const { data: txnSumsMap = {} } = useQuery({
    queryKey: ['txn-sums', branchId, divisionId, monthFilter, statusFilter],
    queryFn: async () => {
      const invoiceIds = invoices.map(i => i.id);
      if (invoiceIds.length === 0) return {};
      const { data } = await supabase
        .from('payment_transactions')
        .select('invoice_id, amount_local, amount_foreign')
        .in('invoice_id', invoiceIds);
      const map: Record<string, { realised: number; paid: number }> = {};
      (data || []).forEach((tx: any) => {
        if (!map[tx.invoice_id]) map[tx.invoice_id] = { realised: 0, paid: 0 };
        map[tx.invoice_id].realised += Number(tx.amount_local || 0);
        map[tx.invoice_id].paid += Number(tx.amount_foreign || 0);
      });
      return map;
    },
    enabled: invoices.length > 0,
  });

  // Derived maps for backward-compat
  const realisedMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(txnSumsMap).forEach(([id, v]) => { m[id] = (v as any).realised; });
    return m;
  }, [txnSumsMap]);

  const ledgerPaidMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(txnSumsMap).forEach(([id, v]) => { m[id] = (v as any).paid; });
    return m;
  }, [txnSumsMap]);

  // Self-healing: fix amount_paid drift by comparing invoice.amount_paid vs ledger sum
  useEffect(() => {
    if (!invoices.length || !Object.keys(ledgerPaidMap).length) return;
    const drifted = invoices.filter(inv => {
      const ledgerPaid = ledgerPaidMap[inv.id];
      if (ledgerPaid === undefined) return false;
      return Math.abs(Number(inv.amount_paid || 0) - ledgerPaid) > 0.01;
    });
    if (drifted.length === 0) return;
    // Silently fix drifted invoices
    (async () => {
      for (const inv of drifted) {
        const totalPaid = ledgerPaidMap[inv.id];
        const invoiceAmount = Number(inv.amount || 0);
        const forgivenAmt = Number(inv.forgiven_amount || 0);
        let status: string;
        if (totalPaid + forgivenAmt >= invoiceAmount) status = 'paid';
        else if (totalPaid > 0) status = 'partially_paid';
        else status = 'pending';
        await supabase.from('fee_invoices').update({
          amount_paid: totalPaid,
          status: status as any,
        }).eq('id', inv.id);
      }
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
    })();
  }, [invoices, ledgerPaidMap]);

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
  const computedNetFee = Math.max(0, subtotal - totalDiscounts);
  const netRecurringFee = feeForm.manual_fee ? (parseFloat(feeForm.manual_amount) || 0) : computedNetFee;
  const feeCurrency = feeForm.manual_fee ? feeForm.manual_currency : (selectedPkg?.currency || 'USD');

  const flatDiscountNeedsReason = !feeForm.manual_fee && flatDiscount > 0 && !feeForm.manual_discount_reason.trim();
  const canSavePlan = (editingPlanId || selectedStudentIds.length > 0) && (feeForm.base_package_id || (feeForm.manual_fee && parseFloat(feeForm.manual_amount) > 0)) && !flatDiscountNeedsReason;

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

  const selectedInvoices = useMemo(() => {
    const cached = Array.from(selectedIds).map(id => selectedInvoiceCacheRef.current.get(id)).filter(Boolean) as InvoiceRow[];
    // Also include any from current invoices list that might have updated data
    const currentMap = new Map(invoices.map(i => [i.id, i]));
    return cached.map(c => currentMap.get(c.id) || c);
  }, [invoices, selectedIds]);
  const unpaidSelected = useMemo(() => selectedInvoices.filter(i => i.status !== 'paid' && i.status !== 'voided'), [selectedInvoices]);
  // Guardrail #8: balance = invoice.amount - paid_total - forgiven_amount (paid_total from ledger)
  const totalExpected = unpaidSelected.reduce((s, i) => s + Math.max(0, Number(i.amount) - (ledgerPaidMap[i.id] || 0) - Number(i.forgiven_amount || 0)), 0);
  const bulkCurrency = unpaidSelected[0]?.currency || 'USD';
  const amountForeign = parseFloat(payForm.amount_foreign) || 0;
  const amountLocal = parseFloat(payForm.amount_local) || 0;
  const effectiveRate = amountForeign > 0 ? amountLocal / amountForeign : 0;
  const shortfall = totalExpected - amountForeign;
  const hasShortfall = amountForeign > 0 && amountForeign < totalExpected;

  const totalFees = invoices.reduce((s, i) => s + Number(i.amount), 0);
  // Guardrail #2/#10: Always derive collected from ledger, never from invoice.amount_paid
  const collected = useMemo(() => invoices.reduce((s, i) => s + (ledgerPaidMap[i.id] || 0), 0), [invoices, ledgerPaidMap]);
  const pending = totalFees - collected;

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return { value: `${now.getFullYear()}-${m}`, label: `${MONTHS[i].label} ${now.getFullYear()}` };
  });

  const selectableInvoices = useMemo(() => invoices.filter(i => i.status !== 'voided'), [invoices]);
  const allSelectableChecked = selectableInvoices.length > 0 && selectableInvoices.every(i => selectedIds.has(i.id));

  // ─── Multi-month split detection for Edit Invoice ─────────────────
  useEffect(() => {
    if (!editInvoiceData?.period_from || !editInvoiceData?.period_to) {
      setSplitInvoices([]);
      setSplitMode(false);
      return;
    }
    const from = editInvoiceData.period_from;
    const to = editInvoiceData.period_to;
    const fromMonth = from.substring(0, 7); // YYYY-MM
    const toMonth = to.substring(0, 7);
    if (fromMonth === toMonth) {
      setSplitInvoices([]);
      setSplitMode(false);
      return;
    }
    // Generate all months in range
    const months: string[] = [];
    let cursor = parseISO(fromMonth + '-01');
    const endDate = parseISO(toMonth + '-01');
    while (cursor <= endDate) {
      months.push(format(cursor, 'yyyy-MM'));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    if (months.length <= 1) { setSplitInvoices([]); setSplitMode(false); return; }

    // Fetch invoices for this student across those months
    const inv = invoices.find(i => i.id === editInvoiceData.id);
    if (!inv) return;
    const fetchSplitInvoices = async () => {
      const { data } = await supabase
        .from('fee_invoices')
        .select(`id, student_id, amount, currency, billing_month, status, amount_paid, forgiven_amount, profiles!fee_invoices_student_id_fkey(full_name)`)
        .eq('student_id', inv.student_id)
        .in('billing_month', months)
        .neq('status', 'voided' as any)
        .order('billing_month');
      setSplitInvoices((data || []) as unknown as InvoiceRow[]);
      setSplitMode(months.length > 1);
    };
    fetchSplitInvoices();
  }, [editInvoiceData?.period_from, editInvoiceData?.period_to, editInvoiceData?.id]);

  // ─── Mutations ───────────────────────────────────────────────────
  const savePlanMutation = useMutation({
    mutationFn: async () => {
      const isManual = feeForm.manual_fee;
      const planFields = isManual ? {
        base_package_id: null,
        session_duration: 30,
        duration_surcharge: 0,
        flat_discount: 0,
        net_recurring_fee: netRecurringFee,
        currency: feeCurrency,
        global_discount_id: null,
        manual_discount_reason: null,
      } : {
        base_package_id: feeForm.base_package_id,
        session_duration: duration,
        duration_surcharge: durationSurcharge,
        flat_discount: flatDiscount,
        net_recurring_fee: netRecurringFee,
        currency: feeCurrency,
        global_discount_id: feeForm.global_discount_id || null,
        manual_discount_reason: feeForm.manual_discount_reason || null,
      };

      if (editingPlanId) {
        const { error } = await supabase.from('student_billing_plans').update(planFields).eq('id', editingPlanId);
        if (error) throw error;
        // Cascade update pending invoices from the effective month onward
        const { error: invoiceErr } = await supabase
          .from('fee_invoices')
          .update({ amount: netRecurringFee, currency: feeCurrency } as any)
          .eq('plan_id', editingPlanId)
          .eq('status', 'pending' as any)
          .gte('billing_month', effectiveFrom);
        if (invoiceErr) console.error('Invoice cascade error:', invoiceErr);
        return 1;
      }
      if (selectedStudentIds.length === 0 || (!feeForm.base_package_id && !isManual)) throw new Error('Select student(s) and package');
      const rows = selectedStudentIds.map(sid => ({
        student_id: sid,
        ...planFields,
        is_active: true,
        branch_id: branchId,
        division_id: divisionId,
      }));
      const { error } = await supabase.from('student_billing_plans').insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['billing-plans'] });
      queryClient.invalidateQueries({ queryKey: ['billing-plans-list'] });
      if (editingPlanId) queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      toast({ title: editingPlanId ? `Billing plan updated — pending invoices from ${formatBillingMonth(effectiveFrom)} updated` : `${count} billing plan(s) saved successfully` });
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
    setFeeForm({ base_package_id: '', session_duration: '30', flat_discount: '0', manual_discount_reason: '', global_discount_id: '', manual_fee: false, manual_amount: '', manual_currency: 'USD' });
    setEditingPlanId(null);
    setEffectiveFrom(currentBillingMonth);
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const targetMonth = monthFilter;
      const targetLabel = MONTHS.find(m => m.value === targetMonth)?.label || targetMonth;
      const { data: existing } = await supabase.from('fee_invoices').select('id, plan_id, assignment_id, amount, status, period_from, period_to').eq('billing_month', targetMonth);
      const existingPlanMap = new Map((existing || []).filter(e => e.plan_id).map(e => [e.plan_id, e]));
      const existingAssignmentMap = new Map((existing || []).filter(e => e.assignment_id).map(e => [e.assignment_id, e]));
      const newInvoices: any[] = [];
      const updatedInvoices: { id: string; amount: number; period_from: string; period_to: string }[] = [];

      // Proration helper
      const computeProration = (monthlyFee: number, assignmentStartDate: string | null, assignmentEndDate: string | null, billingMonth: string) => {
        const monthFirstDay = parseISO(billingMonth + '-01');
        const monthLastDay = endOfMonth(monthFirstDay);
        const daysInMonth = monthLastDay.getDate();
        
        const activeFrom = assignmentStartDate && parseISO(assignmentStartDate) > monthFirstDay
          ? parseISO(assignmentStartDate) : monthFirstDay;
        const activeTo = assignmentEndDate && parseISO(assignmentEndDate) < monthLastDay
          ? parseISO(assignmentEndDate) : monthLastDay;
        
        // Assignment doesn't overlap this month
        if (activeFrom > monthLastDay || activeTo < monthFirstDay) return null;
        
        const activeDays = Math.floor((activeTo.getTime() - activeFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const proratedAmount = Math.round(((monthlyFee / daysInMonth) * activeDays) * 100) / 100;
        
        return {
          amount: proratedAmount,
          period_from: format(activeFrom, 'yyyy-MM-dd'),
          period_to: format(activeTo, 'yyyy-MM-dd'),
        };
      };

      // Helper to check if existing invoice needs updating
      const checkAndQueueUpdate = (existingInv: any, prorated: { amount: number; period_from: string; period_to: string }) => {
        if (!existingInv) return false;
        const amountChanged = Math.abs(existingInv.amount - prorated.amount) > 0.01;
        const periodChanged = existingInv.period_from !== prorated.period_from || existingInv.period_to !== prorated.period_to;
        
        if (existingInv.status === 'pending' && (amountChanged || periodChanged)) {
          updatedInvoices.push({ id: existingInv.id, amount: prorated.amount, period_from: prorated.period_from, period_to: prorated.period_to });
          return true;
        }
        // For paid/partially_paid invoices, only update amount if fee changed (preserve payment state)
        if ((existingInv.status === 'paid' || existingInv.status === 'partially_paid') && amountChanged) {
          updatedInvoices.push({ id: existingInv.id, amount: prorated.amount, period_from: prorated.period_from, period_to: prorated.period_to });
          return true;
        }
        return false;
      };

      // 1) Billing plans
      let pq = supabase.from('student_billing_plans').select('id, student_id, assignment_id, net_recurring_fee, currency, branch_id, division_id').eq('is_active', true);
      if (branchId) pq = pq.eq('branch_id', branchId);
      if (divisionId) pq = pq.eq('division_id', divisionId);
      const { data: plans } = await pq;

      // Get assignment dates for plans that have assignment_id
      const planAssignmentIds = (plans || []).filter(p => (p as any).assignment_id).map(p => (p as any).assignment_id);
      let planAssignmentMap: Record<string, any> = {};
      if (planAssignmentIds.length > 0) {
        const { data: planAssigns } = await supabase.from('student_teacher_assignments')
          .select('id, student_id, effective_from_date, effective_to_date, status')
          .in('id', planAssignmentIds);
        (planAssigns || []).forEach((a: any) => { planAssignmentMap[a.id] = a; });
      }

      // Fallback: for plans without assignment_id, look up by student_id
      const plansWithoutAssignment = (plans || []).filter(p => !(p as any).assignment_id);
      const fallbackStudentIds = plansWithoutAssignment.map(p => (p as any).student_id);
      let studentAssignmentMap: Record<string, any> = {};
      if (fallbackStudentIds.length > 0) {
        const { data: studentAssigns } = await supabase.from('student_teacher_assignments')
          .select('id, student_id, effective_from_date, effective_to_date, status')
          .in('student_id', fallbackStudentIds)
          .in('status', ['active', 'paused']);
        (studentAssigns || []).forEach((a: any) => {
          if (!studentAssignmentMap[a.student_id]) studentAssignmentMap[a.student_id] = a;
        });
      }

      (plans || []).forEach((p: any) => {
        if (p.net_recurring_fee > 0) {
          // Resolve assignment: direct link first, then fallback by student_id
          const assign = p.assignment_id ? planAssignmentMap[p.assignment_id] : studentAssignmentMap[p.student_id] || null;
          
          // Skip paused assignments entirely - frozen students don't get invoices
          if (assign?.status === 'paused') return;
          
          const startDate = assign?.effective_from_date || null;
          const endDate = (assign?.status === 'active') ? null : (assign?.effective_to_date || null);
          
          const prorated = computeProration(p.net_recurring_fee, startDate, endDate, targetMonth);
          if (!prorated) return;

          const existingInv = existingPlanMap.get(p.id);
          if (existingInv) {
            checkAndQueueUpdate(existingInv, prorated);
            return; // skip insert
          }

          newInvoices.push({
            plan_id: p.id, student_id: p.student_id,
            amount: prorated.amount, currency: p.currency, billing_month: targetMonth,
            due_date: `${targetMonth}-10`, branch_id: p.branch_id, division_id: p.division_id,
            period_from: prorated.period_from, period_to: prorated.period_to,
          });
        }
      });

      // 2) Legacy assignments (no billing plan)
      let aq = supabase.from('student_teacher_assignments')
        .select('id, student_id, calculated_monthly_fee, effective_from_date, effective_to_date, status, fee_packages!student_teacher_assignments_fee_package_id_fkey(currency), branch_id, division_id')
        .in('status', ['active', 'completed']);
      if (branchId) aq = aq.eq('branch_id', branchId);
      if (divisionId) aq = aq.eq('division_id', divisionId);
      const { data: assignments } = await aq;
      const planStudentIds = new Set([...(plans || []).map((p: any) => p.student_id)]);
      (assignments || []).forEach((a: any) => {
        if (a.calculated_monthly_fee && !planStudentIds.has(a.student_id)) {
          const startDate = a.effective_from_date || null;
          const endDate = (a.status === 'active') ? null : (a.effective_to_date || null);
          
          const prorated = computeProration(Number(a.calculated_monthly_fee), startDate, endDate, targetMonth);
          if (!prorated) return;

          const existingInv = existingAssignmentMap.get(a.id);
          if (existingInv) {
            checkAndQueueUpdate(existingInv, prorated);
            return;
          }

          newInvoices.push({
            assignment_id: a.id, student_id: a.student_id,
            amount: prorated.amount, currency: a.fee_packages?.currency || 'USD',
            billing_month: targetMonth, due_date: `${targetMonth}-10`,
            branch_id: a.branch_id, division_id: a.division_id,
            period_from: prorated.period_from, period_to: prorated.period_to,
          });
        }
      });

      // Update existing pending invoices with corrected proration
      for (const upd of updatedInvoices) {
        await supabase.from('fee_invoices').update({
          amount: upd.amount, period_from: upd.period_from, period_to: upd.period_to, updated_at: new Date().toISOString(),
        }).eq('id', upd.id);
      }

      if (newInvoices.length === 0 && updatedInvoices.length === 0) throw new Error('All invoices for this month already exist and are up to date');
      if (newInvoices.length > 0) {
        const { error } = await supabase.from('fee_invoices').insert(newInvoices);
        if (error) throw error;
      }
      return { count: newInvoices.length, updated: updatedInvoices.length, label: targetLabel };
    },
    onSuccess: ({ count, updated, label }) => {
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      const parts = [];
      if (count > 0) parts.push(`${count} new`);
      if (updated > 0) parts.push(`${updated} updated`);
      toast({ title: `${parts.join(' + ')} invoice(s) for ${label}.` });
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

      // Guardrail #4: ONLY insert into payment_transactions. Never increment invoice.amount_paid directly.
      const forgivenAmounts: Record<string, number> = {};

      for (const inv of unpaidSelected) {
        // Guardrail #8: balance = invoice.amount - paid_total - forgiven_amount
        const paidSoFar = ledgerPaidMap[inv.id] || 0;
        const outstanding = Math.max(0, Number(inv.amount) - paidSoFar - Number(inv.forgiven_amount || 0));
        const allocated = Math.min(remainingAmount, outstanding);
        remainingAmount -= allocated;

        const isShort = allocated < outstanding;
        let forgivenAmount = 0;

        if (isShort) {
          switch (payForm.resolution) {
            case 'writeoff': forgivenAmount = outstanding - allocated; break;
            case 'arrears': break;
            default: break; // partial - leave open
          }
        }

        forgivenAmounts[inv.id] = forgivenAmount;

        // Guardrail #4: ONLY insert into payment_transactions
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

      // Guardrail #7: After transaction insert, refresh invoice totals from ledger
      const affectedInvoiceIds = [...new Set(transactions.map(t => t.invoice_id))];
      for (const invId of affectedInvoiceIds) {
        const { data: allTxns } = await supabase.from('payment_transactions').select('amount_foreign').eq('invoice_id', invId);
        const totalPaid = (allTxns || []).reduce((s: number, t: any) => s + Number(t.amount_foreign || 0), 0);
        const inv = unpaidSelected.find(i => i.id === invId);
        const invoiceAmount = Number(inv?.amount || 0);
        const forgivenAmt = Number(inv?.forgiven_amount || 0) + (forgivenAmounts[invId] || 0);
        // Guardrail #9: status logic
        let recalcStatus: string;
        if (totalPaid + forgivenAmt >= invoiceAmount) recalcStatus = 'paid';
        else if (totalPaid > 0) recalcStatus = 'partially_paid';
        else recalcStatus = 'pending';
        await supabase.from('fee_invoices').update({
          amount_paid: totalPaid,
          status: recalcStatus as any,
          forgiven_amount: forgivenAmt,
          paid_at: recalcStatus === 'paid' || recalcStatus === 'partially_paid' ? new Date().toISOString() : null,
        }).eq('id', invId);
      }

      return transactions.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      toast({ title: `${count} payment(s) recorded successfully` });
      trackActivity({ action: 'payment_recorded', entityType: 'invoice', details: { count, amount: amountForeign, currency: bulkCurrency } });
      setBulkPayOpen(false);
      selectedInvoiceCacheRef.current.clear();
      setSelectedIds(new Set());
      setPayForm({ amount_foreign: '', amount_local: '', resolution: 'full', notes: '', payment_date: new Date().toISOString().split('T')[0], period_from: '', period_to: '', payment_method: '' });
      setReceiptFile(null);
    },
    onError: (e: any) => toast({ title: 'Payment failed', description: e.message, variant: 'destructive' }),
  });

  // Self-healing: recalculate amount_paid from transaction ledger when opening Edit Invoice
  const openEditInvoiceWithRecalc = async (inv: any) => {
    setEditReceiptFile(null);
    // Query actual transaction sum
    const { data: txns } = await supabase.from('payment_transactions').select('amount_foreign, amount_local').eq('invoice_id', inv.id);
    const recalcPaid = (txns || []).reduce((s: number, t: any) => s + Number(t.amount_foreign || 0), 0);
    const recalcLocal = (txns || []).reduce((s: number, t: any) => s + Number(t.amount_local || 0), 0);
    // If amount_paid drifted, fix it in DB silently
    if (Math.abs(recalcPaid - Number(inv.amount_paid || 0)) > 0.01) {
      const invoiceAmount = Number(inv.amount);
      const forgivenAmt = Number(inv.forgiven_amount || 0);
      let fixStatus: string;
      if (recalcPaid + forgivenAmt >= invoiceAmount) fixStatus = 'paid';
      else if (recalcPaid > 0) fixStatus = 'partially_paid';
      else fixStatus = 'pending';
      await supabase.from('fee_invoices').update({ amount_paid: recalcPaid, status: fixStatus as any }).eq('id', inv.id);
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
    }
    setEditInvoiceData({
      id: inv.id, amount: String(inv.amount), due_date: inv.due_date || '', billing_month: inv.billing_month,
      currency: inv.currency, remark: inv.remark || '', status: inv.status,
      amount_paid: String(recalcPaid), forgiven_amount: String(inv.forgiven_amount || 0),
      payment_method: inv.payment_method || '', paid_at: inv.paid_at || '',
      period_from: (inv as any).period_from || '', period_to: (inv as any).period_to || '',
      amount_local: String(recalcLocal || ''), receipt_url: '',
    });
  };

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

  // Invoice edit mutation (with audit trail) - full edit
  const editInvoiceMutation = useMutation({
    mutationFn: async (data: { id: string; amount: number; due_date: string; billing_month: string; currency: string; remark: string; status: string; amount_paid: number; forgiven_amount: number; payment_method: string; paid_at: string; period_from: string; period_to: string; originalInvoice: InvoiceRow }) => {
      const orig = data.originalInvoice;
      await createAdjustment(data.id, 'edit_invoice',
        { amount: orig.amount, due_date: orig.due_date, billing_month: orig.billing_month, currency: orig.currency, status: orig.status, amount_paid: orig.amount_paid, forgiven_amount: orig.forgiven_amount, payment_method: orig.payment_method, paid_at: orig.paid_at },
        { amount: data.amount, due_date: data.due_date, billing_month: data.billing_month, currency: data.currency, remark: data.remark, status: data.status, amount_paid: data.amount_paid, forgiven_amount: data.forgiven_amount, payment_method: data.payment_method, paid_at: data.paid_at, period_from: data.period_from, period_to: data.period_to },
        'Invoice edited by admin'
      );
      // CRITICAL: billing_month is NEVER overwritten — it is immutable once generated.
      // The update is strictly bound to data.id (the opened invoice's primary key).
      const { error } = await supabase.from('fee_invoices').update({
        amount: data.amount, due_date: data.due_date || null,
        currency: data.currency, remark: data.remark || null, status: data.status as any, amount_paid: data.amount_paid,
        forgiven_amount: data.forgiven_amount, payment_method: data.payment_method || null, paid_at: data.paid_at || null,
        period_from: data.period_from || null, period_to: data.period_to || null,
      } as any).eq('id', data.id);
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['txn-sums'] });
      toast({ title: 'Invoice updated' });
      trackActivity({ action: 'invoice_edited', entityType: 'invoice', entityId: id });
      setEditInvoiceData(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Invoice action mutation (mark_unpaid, waive, void, reverse, discount)
  const invoiceActionMutation = useMutation({
    mutationFn: async ({ type, invoice, reason, discountAmt }: { type: string; invoice: InvoiceRow; reason: string; discountAmt?: number }) => {
      // Guardrail #10: read paid_total from ledger
      const paidTotal = ledgerPaidMap[invoice.id] || 0;
      const prev = { status: invoice.status, amount: invoice.amount, amount_paid: paidTotal, forgiven_amount: invoice.forgiven_amount };

      switch (type) {
        case 'mark_unpaid': {
          await createAdjustment(invoice.id, 'mark_unpaid', prev, { status: 'pending', amount_paid: 0 }, reason);
          await supabase.from('fee_invoices').update({ status: 'pending' as any, amount_paid: 0, paid_at: null }).eq('id', invoice.id);
          break;
        }
        case 'restore_to_pending': {
          await createAdjustment(invoice.id, 'restore_to_pending', prev, { status: 'pending', amount_paid: 0 }, reason);
          await supabase.from('fee_invoices').update({ status: 'pending' as any, amount_paid: 0, paid_at: null, forgiven_amount: 0 }).eq('id', invoice.id);
          break;
        }
        case 'apply_discount': {
          const newAmount = Math.max(0, Number(invoice.amount) - (discountAmt || 0));
          // Guardrail #9: derive status from ledger
          const newStatus = paidTotal >= newAmount ? 'paid' : (paidTotal > 0 ? 'partially_paid' : 'pending');
          await createAdjustment(invoice.id, 'apply_discount', prev, { amount: newAmount, status: newStatus, discount_applied: discountAmt }, reason);
          await supabase.from('fee_invoices').update({ amount: newAmount, status: newStatus as any }).eq('id', invoice.id);
          break;
        }
        case 'waive_fee': {
          // Guardrail #8: balance = amount - paid_total - forgiven
          const outstanding = Math.max(0, Number(invoice.amount) - paidTotal);
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
    const inv = invoices.find(i => i.id === id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        selectedInvoiceCacheRef.current.delete(id);
      } else {
        next.add(id);
        if (inv) selectedInvoiceCacheRef.current.set(id, inv);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      // Remove only the currently visible ones from selection
      const visibleIds = new Set(selectableInvoices.map(i => i.id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => { next.delete(id); selectedInvoiceCacheRef.current.delete(id); });
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableInvoices.forEach(i => { next.add(i.id); selectedInvoiceCacheRef.current.set(i.id, i); });
        return next;
      });
    }
  };

  const openBulkPay = () => {
    if (unpaidSelected.length === 0) { toast({ title: 'Select pending invoices first', variant: 'destructive' }); return; }
    // Use actual invoice period dates (prorated from assignment), fallback to billing month
    const allFroms = unpaidSelected.map(i => i.period_from || getDefaultPeriodDates(i.billing_month).from).sort();
    const allTos = unpaidSelected.map(i => i.period_to || getDefaultPeriodDates(i.billing_month).to).sort();
    setPayForm({
      amount_foreign: totalExpected.toString(), amount_local: '', resolution: 'full', notes: '',
      payment_date: new Date().toISOString().split('T')[0],
      period_from: allFroms[0], period_to: allTos[allTos.length - 1], payment_method: '',
    });
    setReceiptFile(null);
    setBulkPayOpen(true);
  };

  const openSinglePay = (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv || inv.status === 'paid') return;
    selectedInvoiceCacheRef.current.clear();
    selectedInvoiceCacheRef.current.set(invoiceId, inv);
    setSelectedIds(new Set([invoiceId]));
    const due = Math.max(0, Number(inv.amount) - (ledgerPaidMap[inv.id] || 0) - Number(inv.forgiven_amount || 0));
    const fallback = getDefaultPeriodDates(inv.billing_month);
    setPayForm({
      amount_foreign: due.toString(), amount_local: '', resolution: 'full', notes: '',
      payment_date: new Date().toISOString().split('T')[0],
      period_from: inv.period_from || fallback.from, period_to: inv.period_to || fallback.to, payment_method: '',
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
    selectedInvoiceCacheRef.current.clear();
    invoices.filter(inv => familyInvoiceIds.includes(inv.id)).forEach(inv => selectedInvoiceCacheRef.current.set(inv.id, inv));
    setSelectedIds(new Set(familyInvoiceIds));
    const familyUnpaid = invoices.filter(i => familyInvoiceIds.includes(i.id));
    const total = familyUnpaid.reduce((s, i) => s + Math.max(0, Number(i.amount) - (ledgerPaidMap[i.id] || 0) - Number(i.forgiven_amount || 0)), 0);
    const allFroms = familyUnpaid.map(i => i.period_from || getDefaultPeriodDates(i.billing_month).from).sort();
    const allTos = familyUnpaid.map(i => i.period_to || getDefaultPeriodDates(i.billing_month).to).sort();
    setPayForm({
      amount_foreign: total.toString(), amount_local: '', resolution: 'full', notes: '',
      payment_date: new Date().toISOString().split('T')[0],
      period_from: allFroms[0], period_to: allTos[allTos.length - 1], payment_method: '',
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
    const isManual = !plan.base_package_id && plan.net_recurring_fee > 0;
    setFeeForm({
      base_package_id: plan.base_package_id || '',
      session_duration: String(plan.session_duration || 30),
      flat_discount: String(plan.flat_discount || 0),
      manual_discount_reason: '',
      global_discount_id: plan.global_discount_id || '',
      manual_fee: isManual,
      manual_amount: isManual ? String(plan.net_recurring_fee) : '',
      manual_currency: plan.currency || 'USD',
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
            <h1 className="font-serif text-3xl font-bold text-foreground">
              {isParentView ? 'Family Fees' : isStudentView ? 'My Fees' : 'Fee Management'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isParentView ? 'View and pay fees for your children' : isStudentView ? 'View your fee invoices' : 'Billing plans, invoices & payments'}
            </p>
          </div>
          {!isReadOnlyView && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => { resetFeeForm(); setSetupOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Set Up Student Fee
              </Button>
              <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="gap-2">
                {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Generate Monthly Invoices
              </Button>
            </div>
          )}
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
          {!isReadOnlyView ? (
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="invoices" className="gap-2"><Receipt className="h-4 w-4" /> Invoices</TabsTrigger>
              <TabsTrigger value="plans" className="gap-2"><ListChecks className="h-4 w-4" /> Billing Plans</TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="grid w-full max-w-xs grid-cols-1">
              <TabsTrigger value="invoices" className="gap-2"><Receipt className="h-4 w-4" /> Invoices</TabsTrigger>
            </TabsList>
          )}

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
              {!isReadOnlyView && familyGroups.length > 0 && (
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
              {isParentView && (() => {
                const unpaidInvoices = invoices.filter(i => i.status !== 'paid' && i.status !== 'voided' && i.status !== 'waived');
                const unpaidTotal = unpaidInvoices.reduce((s, i) => s + Math.max(0, Number(i.amount) - (ledgerPaidMap[i.id] || 0) - Number(i.forgiven_amount || 0)), 0);
                if (unpaidInvoices.length === 0) return null;
                return (
                  <Button
                    className="gap-2"
                    onClick={() => {
                      selectedInvoiceCacheRef.current.clear();
                      unpaidInvoices.forEach(inv => selectedInvoiceCacheRef.current.set(inv.id, inv));
                      setSelectedIds(new Set(unpaidInvoices.map(i => i.id)));
                      const months = [...new Set(unpaidInvoices.map(i => i.billing_month))].sort();
                      const earliest = getDefaultPeriodDates(months[0]);
                      const latest = getDefaultPeriodDates(months[months.length - 1]);
                      setPayForm({
                        amount_foreign: unpaidTotal.toString(), amount_local: '', resolution: 'full', notes: '',
                        payment_date: new Date().toISOString().split('T')[0],
                        period_from: earliest.from, period_to: latest.to, payment_method: '',
                      });
                      setReceiptFile(null);
                      setBulkPayOpen(true);
                    }}
                  >
                    <Users className="h-4 w-4" /> Pay All ({unpaidInvoices.length}) — {unpaidInvoices[0]?.currency} {unpaidTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Button>
                );
              })()}
              <div className="flex-1" />
            </div>

            {/* Cross-month selection bar */}
            {selectedIds.size > 0 && (() => {
              const currentVisibleIds = new Set(invoices.map(i => i.id));
              const crossMonthCount = Array.from(selectedIds).filter(id => !currentVisibleIds.has(id)).length;
              const months = [...new Set(selectedInvoices.map(i => i.billing_month))].sort();
              return (
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5 animate-fade-in">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {selectedIds.size} invoice{selectedIds.size > 1 ? 's' : ''} selected
                    {months.length > 1 && <span className="text-muted-foreground"> across {months.length} months ({months.map(formatBillingMonth).join(', ')})</span>}
                    {crossMonthCount > 0 && <span className="text-muted-foreground"> • {crossMonthCount} from other month{crossMonthCount > 1 ? 's' : ''}</span>}
                  </span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { selectedInvoiceCacheRef.current.clear(); setSelectedIds(new Set()); }}>
                    <X className="h-3 w-3 mr-1" /> Clear All
                  </Button>
                  <Button size="sm" className="h-7 text-xs gap-1.5" onClick={openBulkPay} disabled={unpaidSelected.length === 0}>
                    <Receipt className="h-3 w-3" /> Record Payment ({unpaidSelected.length})
                  </Button>
                </div>
              );
            })()}

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
                      {!isReadOnlyView && <TableHead className="w-10"><Checkbox checked={allSelectableChecked} onCheckedChange={toggleSelectAll} /></TableHead>}
                      <TableHead>Student</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Billing Month</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      {!isReadOnlyView && <TableHead className="text-right">Realised (PKR)</TableHead>}
                      <TableHead>Due Date</TableHead>
                       <TableHead className="text-center">Status</TableHead>
                       <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(inv => {
                      const isVoided = inv.status === 'voided';
                      return (
                        <TableRow key={inv.id} className={selectedIds.has(inv.id) ? 'bg-primary/5' : ''}>
                          {!isReadOnlyView && <TableCell><Checkbox checked={selectedIds.has(inv.id)} onCheckedChange={() => toggleSelect(inv.id)} disabled={isVoided} /></TableCell>}
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
                            {(ledgerPaidMap[inv.id] || 0) > 0 ? `${inv.currency} ${(ledgerPaidMap[inv.id] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                          </TableCell>
                          {!isReadOnlyView && (
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {realisedMap[inv.id] ? `PKR ${realisedMap[inv.id].toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                            </TableCell>
                          )}
                          <TableCell>{inv.due_date || '—'}</TableCell>
                          <TableCell className="text-center">
                            {(inv.status === 'pending' || inv.status === 'partially_paid' || inv.status === 'overdue') ? (
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => openSinglePay(inv.id)}>
                                <Receipt className="h-3.5 w-3.5" /> {inv.status === 'partially_paid' ? 'Pay Rest' : 'Pay'}
                              </Button>
                            ) : getStatusBadge(inv.status)}
                          </TableCell>
                          {isReadOnlyView && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`/finance/print/invoice/${inv.id}`, '_blank')} title="View Invoice">
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                                {(inv.status === 'paid' || inv.status === 'partially_paid') && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`/finance/print/invoice/${inv.id}?mode=receipt`, '_blank')} title="View Receipt">
                                    <Printer className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {!isReadOnlyView && (
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {isVoided ? (
                                    <>
                                      <DropdownMenuItem onClick={() => setActionModal({ type: 'restore_to_pending', invoice: inv })}>
                                        <Undo2 className="h-3.5 w-3.5 mr-2" /> Restore to Pending
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openEditInvoiceWithRecalc(inv)}>
                                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Invoice
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => { setActionModal({ type: 'view_history', invoice: inv }); fetchHistory(inv.id); }}>
                                        <History className="h-3.5 w-3.5 mr-2" /> View History
                                      </DropdownMenuItem>
                                    </>
                                  ) : (
                                    <>
                                      <DropdownMenuItem onClick={() => window.open(`/finance/print/invoice/${inv.id}`, '_blank')}>
                                        <FileText className="h-3.5 w-3.5 mr-2" /> View Invoice
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openEditInvoiceWithRecalc(inv)}>
                                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Invoice
                                      </DropdownMenuItem>
                                      {(inv.status === 'paid' || inv.status === 'partially_paid') && (
                                        <DropdownMenuItem onClick={async () => {
                                          const { data: txns } = await supabase.from('payment_transactions').select('*').eq('invoice_id', inv.id).order('created_at', { ascending: false });
                                          if (!txns?.length) { toast({ title: 'No payment transactions found', variant: 'destructive' }); return; }
                                          setReceiptTransactions(txns);
                                          setReceiptViewInvoice(inv);
                                        }}>
                                          <Eye className="h-3.5 w-3.5 mr-2" /> View Receipt
                                        </DropdownMenuItem>
                                      )}
                                      {(inv.status === 'paid' || inv.status === 'partially_paid') && (
                                        <DropdownMenuItem onClick={() => window.open(`/finance/print/invoice/${inv.id}?mode=receipt`, '_blank')}>
                                          <Printer className="h-3.5 w-3.5 mr-2" /> Print Receipt
                                        </DropdownMenuItem>
                                      )}
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
                                      {(inv.status === 'paid' || inv.status === 'partially_paid') && (
                                        <DropdownMenuItem onClick={async () => {
                                          const { data: txns } = await supabase.from('payment_transactions').select('*').eq('invoice_id', inv.id).order('created_at', { ascending: false }).limit(1);
                                          const tx = txns?.[0];
                                          if (!tx) { toast({ title: 'No payment transaction found for this invoice', variant: 'destructive' }); return; }
                                          setEditPaymentForm({
                                            amount_foreign: String(tx.amount_foreign || ''),
                                            amount_local: String(tx.amount_local || ''),
                                            payment_date: tx.payment_date || '',
                                            payment_method: tx.payment_method || '',
                                            notes: tx.notes || '',
                                            reason: '',
                                          });
                                          setEditPaymentData({ invoiceId: inv.id, transaction: tx, invoice: inv });
                                        }}>
                                          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Payment
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
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {!isReadOnlyView && (
            <TabsContent value="plans" className="mt-4">
              <BillingPlansTable onEditPlan={handleEditPlan} />
            </TabsContent>
          )}
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

                {/* Manual Fee Toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Manual Fee</Label>
                    <p className="text-xs text-muted-foreground">Bypass package & discounts, enter fee directly</p>
                  </div>
                  <Switch checked={feeForm.manual_fee} onCheckedChange={v => setFeeForm(f => ({ ...f, manual_fee: v }))} />
                </div>

                {feeForm.manual_fee ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</Label>
                      <Input type="number" placeholder="0" min="0" value={feeForm.manual_amount} onChange={e => setFeeForm(f => ({ ...f, manual_amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Currency</Label>
                      <Select value={feeForm.manual_currency} onValueChange={v => setFeeForm(f => ({ ...f, manual_currency: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['USD', 'PKR', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SAR'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              {/* Right: Invoice Preview (2 cols) */}
              <div className="lg:col-span-2 bg-muted/40 border-l border-border p-8 flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Invoice Preview</h3>
                  <Separator />
                  {feeForm.manual_fee ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Manual Fee</span>
                        <span className="font-mono font-semibold">{feeCurrency} {netRecurringFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  ) : (
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
                  )}
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
                  {editingPlanId && (
                    <div className="mt-3 space-y-1.5 bg-muted/50 rounded-lg p-3 border border-border">
                      <Label className="text-xs font-medium">Effective From</Label>
                      <p className="text-xs text-muted-foreground">Pending invoices from this month onward will be updated to the new fee.</p>
                      <Select value={effectiveFrom} onValueChange={setEffectiveFrom}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => {
                            const year = now.getFullYear();
                            const month = String(i + 1).padStart(2, '0');
                            const val = `${year}-${month}`;
                            return <SelectItem key={val} value={val}>{MONTHS[i].label} {year}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
                <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg p-2 border border-border">
                  <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Amounts are allocated across selected invoices in order (oldest first).</span>
                </div>
                <div className="bg-muted/50 rounded-lg border border-border p-2 max-h-24 overflow-y-auto space-y-0.5">
                  {unpaidSelected.map(inv => (
                    <div key={inv.id} className="flex justify-between text-xs">
                      <span className="truncate mr-2">{inv.profiles?.full_name} — {formatBillingMonth(inv.billing_month)}</span>
                      <span className="font-mono font-medium shrink-0">{inv.currency} {Math.max(0, Number(inv.amount) - (ledgerPaidMap[inv.id] || 0) - Number(inv.forgiven_amount || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Billing Period <span className="text-muted-foreground font-normal normal-case">(auto-calculated from invoice)</span></Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">From</Label><Input type="date" value={payForm.period_from} disabled className="h-8 text-sm bg-muted" /></div>
                    <div><Label className="text-xs">To</Label><Input type="date" value={payForm.period_to} disabled className="h-8 text-sm bg-muted" /></div>
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

        {/* ─── Edit Invoice Modal (Full) ──────────────────────────── */}
        <Dialog open={!!editInvoiceData} onOpenChange={() => setEditInvoiceData(null)}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-base"><Pencil className="h-4 w-4" /> Edit Invoice</DialogTitle>
              {editInvoiceData && (() => {
                const inv = invoices.find(i => i.id === editInvoiceData.id);
                return <DialogDescription className="text-xs">{inv?.profiles?.full_name || 'Student'} • Expected: {editInvoiceData.currency} {Number(editInvoiceData.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} • {formatBillingMonth(editInvoiceData.billing_month)}</DialogDescription>;
              })()}
            </DialogHeader>

            {editInvoiceData && (() => {
              const editAmountForeign = parseFloat(editInvoiceData.amount) || 0;
              const editAmountLocal = parseFloat(editInvoiceData.amount_local) || 0;
              const editEffectiveRate = editAmountForeign > 0 ? editAmountLocal / editAmountForeign : 0;
              const editExpected = parseFloat(editInvoiceData.amount) || 0;
              const editShortfall = editExpected - editAmountForeign;
              const editHasShortfall = editAmountForeign > 0 && editAmountForeign < editExpected;

              return (
              <ScrollArea className="flex-1 px-4 sm:px-6">
                <div className="space-y-3 pb-4">
                  {/* Payment Period */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payment Period</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">From</Label><Input type="date" value={editInvoiceData.period_from} onChange={e => setEditInvoiceData(d => d ? { ...d, period_from: e.target.value } : null)} className="h-8 text-sm" /></div>
                      <div><Label className="text-xs">To</Label><Input type="date" value={editInvoiceData.period_to} onChange={e => setEditInvoiceData(d => d ? { ...d, period_to: e.target.value } : null)} className="h-8 text-sm" /></div>
                    </div>
                  </div>

                  {/* Multi-month split preview */}
                  {splitMode && splitInvoices.length > 0 && (
                    <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 space-y-2 animate-fade-in">
                      <div className="flex items-center gap-2 text-xs font-semibold text-accent-foreground">
                        <ListChecks className="h-3.5 w-3.5" />
                        <span>Multi-Month Split — {splitInvoices.length} invoice{splitInvoices.length > 1 ? 's' : ''} found</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">The period spans multiple months. You can record payment for all matching invoices at once using the cart system:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {splitInvoices.map(si => {
                          const outstanding = Math.max(0, Number(si.amount) - (ledgerPaidMap[si.id] || 0) - Number(si.forgiven_amount || 0));
                          return (
                            <div key={si.id} className="flex justify-between items-center text-xs py-1 border-b border-border/50 last:border-0">
                              <span className="font-medium">{formatBillingMonth(si.billing_month)}</span>
                              <span className="flex items-center gap-2">
                                <span className="font-mono">{si.currency} {outstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                {getStatusBadge(si.status)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-accent/20">
                        <span className="text-xs font-medium text-foreground">Total Outstanding</span>
                        <span className="text-xs font-mono font-bold">{splitInvoices[0]?.currency || 'USD'} {splitInvoices.reduce((s, i) => s + Math.max(0, Number(i.amount) - (ledgerPaidMap[i.id] || 0) - Number(i.forgiven_amount || 0)), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs gap-1.5"
                        onClick={() => {
                          // Select all split invoices in the cart and open bulk pay
                          const unpaidSplit = splitInvoices.filter(si => si.status !== 'paid' && si.status !== 'voided');
                          if (unpaidSplit.length === 0) { toast({ title: 'No unpaid invoices in this range', variant: 'destructive' }); return; }
                          selectedInvoiceCacheRef.current.clear();
                          unpaidSplit.forEach(si => selectedInvoiceCacheRef.current.set(si.id, si));
                          setSelectedIds(new Set(unpaidSplit.map(si => si.id)));
                          const total = unpaidSplit.reduce((s, i) => s + Math.max(0, Number(i.amount) - (ledgerPaidMap[i.id] || 0) - Number(i.forgiven_amount || 0)), 0);
                          const months = unpaidSplit.map(i => i.billing_month).sort();
                          const earliest = getDefaultPeriodDates(months[0]);
                          const latest = getDefaultPeriodDates(months[months.length - 1]);
                          setPayForm({
                            amount_foreign: total.toString(), amount_local: '', resolution: 'full', notes: '',
                            payment_date: new Date().toISOString().split('T')[0],
                            period_from: earliest.from, period_to: latest.to, payment_method: '',
                          });
                          setReceiptFile(null);
                          setEditInvoiceData(null);
                          setBulkPayOpen(true);
                        }}
                      >
                        <Receipt className="h-3 w-3" /> Record Payment for All {splitInvoices.filter(si => si.status !== 'paid' && si.status !== 'voided').length} Unpaid Invoices
                      </Button>
                    </div>
                  )}

                  <Separator />

                  {/* Payment Details */}
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payment Details</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Paid At</Label><Input type="date" value={editInvoiceData.paid_at ? editInvoiceData.paid_at.substring(0, 10) : ''} onChange={e => setEditInvoiceData(d => d ? { ...d, paid_at: e.target.value ? `${e.target.value}T00:00:00Z` : '' } : null)} className="h-8 text-sm" /></div>
                      <div>
                        <Label className="text-xs">Receiving Channel</Label>
                        <Select value={editInvoiceData.payment_method || '_none'} onValueChange={v => setEditInvoiceData(d => d ? { ...d, payment_method: v === '_none' ? '' : v } : null)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">None</SelectItem>
                            {RECEIVING_CHANNELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Amount + Realized */}
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Amount ({editInvoiceData.currency})</Label><Input type="number" value={editInvoiceData.amount} onChange={e => setEditInvoiceData(d => d ? { ...d, amount: e.target.value } : null)} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">Realized (PKR)</Label><Input type="number" placeholder="0.00" value={editInvoiceData.amount_local} onChange={e => setEditInvoiceData(d => d ? { ...d, amount_local: e.target.value } : null)} className="h-8 text-sm" /></div>
                  </div>

                  {/* Exchange Rate */}
                  {editAmountLocal > 0 && editAmountForeign > 0 && (
                    <div className="flex items-center gap-2 text-xs bg-primary/5 rounded-lg p-2 border border-primary/20">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                      <span className="text-muted-foreground">Rate:</span>
                      <span className="font-mono font-bold text-foreground">1 {editInvoiceData.currency} = {editEffectiveRate.toFixed(2)} PKR</span>
                    </div>
                  )}

                  {/* Shortfall / Resolution (informational) */}
                  {editHasShortfall && (
                    <div className="flex items-center gap-2 text-xs bg-destructive/5 rounded-lg border border-destructive/20 p-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-destructive font-medium">Shortfall: {editInvoiceData.currency} {editShortfall.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {/* Proof of Payment */}
                  <div>
                    <Label className="text-xs">Proof of Payment</Label>
                    <input ref={editReceiptInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setEditReceiptFile(e.target.files?.[0] || null)} />
                    <div onClick={() => editReceiptInputRef.current?.click()} className="mt-1 border-2 border-dashed border-border rounded-lg p-2.5 text-center cursor-pointer hover:border-primary/50 transition-colors">
                      {editReceiptFile ? (
                        <div className="flex items-center justify-center gap-2 text-xs text-foreground">
                          <ImageIcon className="h-3.5 w-3.5 text-primary" /> <span className="truncate">{editReceiptFile.name}</span> <Badge variant="secondary" className="text-[10px]">{(editReceiptFile.size / 1024).toFixed(0)} KB</Badge>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground"><Upload className="h-4 w-4" /><span className="text-xs">Upload receipt</span></div>
                      )}
                    </div>
                    {/* Show existing receipt if any */}
                    {(() => {
                      const existingReceipt = editInvoiceData.receipt_url;
                      if (existingReceipt) return <AttachmentPreview url={existingReceipt} className="mt-1" />;
                      return null;
                    })()}
                  </div>

                  {/* Notes */}
                  <div><Label className="text-xs">Remark / Notes</Label><Textarea placeholder="Any remarks..." value={editInvoiceData.remark} onChange={e => setEditInvoiceData(d => d ? { ...d, remark: e.target.value } : null)} className="h-12 text-sm" /></div>

                  {/* Admin Overrides Section */}
                  <Separator />
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Admin Overrides</Label>

                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Amount Paid</Label><Input type="number" value={editInvoiceData.amount_paid} onChange={e => setEditInvoiceData(d => d ? { ...d, amount_paid: e.target.value } : null)} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">Forgiven Amount</Label><Input type="number" value={editInvoiceData.forgiven_amount} onChange={e => setEditInvoiceData(d => d ? { ...d, forgiven_amount: e.target.value } : null)} className="h-8 text-sm" /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Currency</Label>
                      <Select value={editInvoiceData.currency} onValueChange={v => setEditInvoiceData(d => d ? { ...d, currency: v } : null)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{['USD', 'PKR', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SAR'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Due Date</Label><Input type="date" value={editInvoiceData.due_date} onChange={e => setEditInvoiceData(d => d ? { ...d, due_date: e.target.value } : null)} className="h-8 text-sm" /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Billing Month <span className="text-muted-foreground">(locked)</span></Label>
                      <Input value={formatBillingMonth(editInvoiceData.billing_month)} disabled className="h-8 text-sm bg-muted" />
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={editInvoiceData.status} onValueChange={v => setEditInvoiceData(d => d ? { ...d, status: v } : null)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="partially_paid">Partially Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="waived">Waived</SelectItem>
                          <SelectItem value="adjusted">Adjusted</SelectItem>
                          <SelectItem value="voided">Voided</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              );
            })()}
            <DialogFooter className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6 shrink-0 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setEditInvoiceData(null)}>Cancel</Button>
              <Button size="sm" onClick={async () => {
                if (!editInvoiceData) return;
                const inv = invoices.find(i => i.id === editInvoiceData.id);
                if (!inv) return;

                // Upload receipt if new file provided
                let receiptUrl = editInvoiceData.receipt_url || null;
                if (editReceiptFile) {
                  const ext = editReceiptFile.name.split('.').pop();
                  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                  const { error: upErr } = await supabase.storage.from('payment-receipts').upload(path, editReceiptFile);
                  if (upErr) { toast({ title: 'Receipt upload failed', description: upErr.message, variant: 'destructive' }); return; }
                  const { data: urlData } = supabase.storage.from('payment-receipts').getPublicUrl(path);
                  receiptUrl = urlData.publicUrl;
                }

                // Update linked payment_transaction receipt_url and amount_local if changed
                if (receiptUrl || editInvoiceData.amount_local) {
                  const { data: txns } = await supabase.from('payment_transactions').select('id').eq('invoice_id', editInvoiceData.id).order('created_at', { ascending: false }).limit(1);
                  if (txns?.length) {
                    const updates: any = {};
                    if (receiptUrl) updates.receipt_url = receiptUrl;
                    if (editInvoiceData.amount_local) updates.amount_local = parseFloat(editInvoiceData.amount_local) || 0;
                    await supabase.from('payment_transactions').update(updates).eq('id', txns[0].id);
                  }
                }

                editInvoiceMutation.mutate({
                  id: editInvoiceData.id,
                  amount: parseFloat(editInvoiceData.amount) || 0,
                  due_date: editInvoiceData.due_date,
                  billing_month: editInvoiceData.billing_month,
                  currency: editInvoiceData.currency,
                  remark: editInvoiceData.remark,
                  status: editInvoiceData.status,
                  amount_paid: parseFloat(editInvoiceData.amount_paid) || 0,
                  forgiven_amount: parseFloat(editInvoiceData.forgiven_amount) || 0,
                  payment_method: editInvoiceData.payment_method,
                  paid_at: editInvoiceData.paid_at,
                  period_from: editInvoiceData.period_from,
                  period_to: editInvoiceData.period_to,
                  originalInvoice: inv,
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
                {actionModal?.type === 'restore_to_pending' && <><Undo2 className="h-5 w-5" /> Restore to Pending</>}
                {actionModal?.type === 'apply_discount' && <><Tag className="h-5 w-5" /> Apply Discount</>}
                {actionModal?.type === 'waive_fee' && <><Ban className="h-5 w-5" /> Waive Fee</>}
                {actionModal?.type === 'reverse_payment' && <><ArrowRightLeft className="h-5 w-5" /> Reverse Payment</>}
                {actionModal?.type === 'void_invoice' && <><FileX className="h-5 w-5 text-destructive" /> Void Invoice</>}
              </DialogTitle>
              <DialogDescription>
                {actionModal?.type === 'mark_unpaid' && 'Reset this invoice to unpaid status. Payment records are preserved.'}
                {actionModal?.type === 'restore_to_pending' && 'Restore this voided invoice back to pending. Amount paid will be reset to 0.'}
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
                    <div key={adj.id} className="border border-border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs capitalize">{adj.action_type.replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(adj.created_at).toLocaleString('en-US', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                      <p className="text-sm"><span className="text-muted-foreground">By:</span> {adj.admin_name} {adj.admin_email && `(${adj.admin_email})`}</p>
                      {adj.reason && <p className="text-sm"><span className="text-muted-foreground">Reason:</span> {adj.reason}</p>}
                      {/* Clean key-value display instead of raw JSON */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-destructive/5 rounded p-2 space-y-0.5">
                          <span className="font-semibold text-destructive block mb-1">Previous</span>
                          {Object.entries(adj.previous_values || {}).map(([key, val]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                              <span className="font-medium">{String(val ?? '—')}</span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-primary/5 rounded p-2 space-y-0.5">
                          <span className="font-semibold text-primary block mb-1">Updated</span>
                          {Object.entries(adj.new_values || {}).map(([key, val]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                              <span className="font-medium">{String(val ?? '—')}</span>
                            </div>
                          ))}
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

        {/* ─── View Receipt Dialog ────────────────────────────────────── */}
        <Dialog open={!!receiptViewInvoice} onOpenChange={() => { setReceiptViewInvoice(null); setReceiptTransactions([]); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Payment Receipt</DialogTitle>
              <DialogDescription>
                {receiptViewInvoice?.profiles?.full_name} — {receiptViewInvoice && formatBillingMonth(receiptViewInvoice.billing_month)} • Invoice: {receiptViewInvoice?.currency} {Number(receiptViewInvoice?.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              {receiptTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No transactions found.</p>
              ) : (
                <div className="space-y-3">
                  {receiptTransactions.map((tx: any, idx: number) => (
                    <div key={tx.id} className="border border-border rounded-lg p-4 space-y-2">
                      {receiptTransactions.length > 1 && <p className="text-xs font-semibold text-muted-foreground">Transaction #{idx + 1}</p>}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        <div><span className="text-muted-foreground">Payment Date:</span></div>
                        <div className="font-medium">{tx.payment_date || '—'}</div>
                        <div><span className="text-muted-foreground">Receiving Channel:</span></div>
                        <div className="font-medium">{tx.payment_method || '—'}</div>
                        <div><span className="text-muted-foreground">Amount ({tx.currency_foreign}):</span></div>
                        <div className="font-mono font-semibold">{Number(tx.amount_foreign).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div><span className="text-muted-foreground">Realised (PKR):</span></div>
                        <div className="font-mono font-semibold">{Number(tx.amount_local).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        {tx.effective_rate && (
                          <>
                            <div><span className="text-muted-foreground">Exchange Rate:</span></div>
                            <div className="font-mono">1 {tx.currency_foreign} = {Number(tx.effective_rate).toFixed(2)} PKR</div>
                          </>
                        )}
                        {tx.notes && (
                          <>
                            <div><span className="text-muted-foreground">Notes:</span></div>
                            <div>{tx.notes}</div>
                          </>
                        )}
                      </div>
                      {tx.receipt_url && (
                        <div className="pt-1 border-t border-border">
                          <span className="text-xs text-muted-foreground mr-2">Proof:</span>
                          <AttachmentPreview url={tx.receipt_url} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setReceiptViewInvoice(null); setReceiptTransactions([]); }}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Edit Payment Modal ────────────────────────────────────── */}
        <Dialog open={!!editPaymentData} onOpenChange={() => setEditPaymentData(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Edit Payment</DialogTitle>
              <DialogDescription>
                Correct payment details for {editPaymentData?.invoice.profiles?.full_name} — {editPaymentData?.invoice && formatBillingMonth(editPaymentData.invoice.billing_month)}. All changes are audit-trailed.
              </DialogDescription>
            </DialogHeader>
            {editPaymentData && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Amount ({editPaymentData.invoice.currency})</Label>
                    <Input type="number" placeholder="0.00" value={editPaymentForm.amount_foreign} onChange={e => setEditPaymentForm(f => ({ ...f, amount_foreign: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Realized (PKR)</Label>
                    <Input type="number" placeholder="0.00" value={editPaymentForm.amount_local} onChange={e => setEditPaymentForm(f => ({ ...f, amount_local: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Payment Date</Label>
                    <Input type="date" value={editPaymentForm.payment_date} onChange={e => setEditPaymentForm(f => ({ ...f, payment_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Receiving Channel</Label>
                    <Select value={editPaymentForm.payment_method} onValueChange={v => setEditPaymentForm(f => ({ ...f, payment_method: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{RECEIVING_CHANNELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea placeholder="Optional notes..." value={editPaymentForm.notes} onChange={e => setEditPaymentForm(f => ({ ...f, notes: e.target.value }))} className="h-16" />
                </div>
                <Separator />
                <div>
                  <Label className="text-xs">Reason for Correction <span className="text-destructive">*</span></Label>
                  <Textarea placeholder="Why is this payment being corrected?" value={editPaymentForm.reason} onChange={e => setEditPaymentForm(f => ({ ...f, reason: e.target.value }))} className="h-20" />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPaymentData(null)}>Cancel</Button>
              <Button
                disabled={editPaymentLoading || !editPaymentForm.reason.trim() || !parseFloat(editPaymentForm.amount_foreign)}
                onClick={async () => {
                  if (!editPaymentData) return;
                  setEditPaymentLoading(true);
                  try {
                    const tx = editPaymentData.transaction;
                    const newAmountForeign = parseFloat(editPaymentForm.amount_foreign) || 0;
                    const newAmountLocal = parseFloat(editPaymentForm.amount_local) || 0;
                    const newEffectiveRate = newAmountForeign > 0 ? newAmountLocal / newAmountForeign : 0;

                    // 1. Log adjustment
                    await createAdjustment(editPaymentData.invoiceId, 'edit_payment',
                      { amount_foreign: tx.amount_foreign, amount_local: tx.amount_local, payment_date: tx.payment_date, payment_method: tx.payment_method, notes: tx.notes },
                      { amount_foreign: newAmountForeign, amount_local: newAmountLocal, payment_date: editPaymentForm.payment_date, payment_method: editPaymentForm.payment_method, notes: editPaymentForm.notes },
                      editPaymentForm.reason
                    );

                    // 2. Update payment_transactions row
                    await supabase.from('payment_transactions').update({
                      amount_foreign: newAmountForeign,
                      amount_local: newAmountLocal,
                      effective_rate: newEffectiveRate || null,
                      payment_date: editPaymentForm.payment_date || null,
                      payment_method: editPaymentForm.payment_method || null,
                      notes: editPaymentForm.notes || null,
                    }).eq('id', tx.id);

                    // 3. Recalculate invoice amount_paid & status
                    const { data: allTxns } = await supabase.from('payment_transactions').select('amount_foreign').eq('invoice_id', editPaymentData.invoiceId);
                    const totalPaid = (allTxns || []).reduce((s: number, t: any) => s + Number(t.amount_foreign || 0), 0);
                    const invoiceAmount = Number(editPaymentData.invoice.amount);
                    let newStatus: string;
                    if (totalPaid >= invoiceAmount) newStatus = 'paid';
                    else if (totalPaid > 0) newStatus = 'partially_paid';
                    else newStatus = 'pending';

                    await supabase.from('fee_invoices').update({
                      amount_paid: totalPaid,
                      status: newStatus as any,
                    }).eq('id', editPaymentData.invoiceId);

                    queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
                    queryClient.invalidateQueries({ queryKey: ['txn-sums'] });
                    queryClient.invalidateQueries({ queryKey: ['payment_transactions'] });
                    toast({ title: 'Payment corrected successfully' });
                    trackActivity({ action: 'payment_edited', entityType: 'payment_transaction', entityId: tx.id, details: { invoice_id: editPaymentData.invoiceId, reason: editPaymentForm.reason } });
                    setEditPaymentData(null);
                  } catch (err: any) {
                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                  } finally {
                    setEditPaymentLoading(false);
                  }
                }}
              >
                {editPaymentLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Correction
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
