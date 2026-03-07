import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DollarSign, CheckCircle, Clock, Calendar, Search, FileText, Download, Printer, Eye } from 'lucide-react';
import { format, parseISO, subMonths, isAfter } from 'date-fns';
import { AttachmentPreview } from '@/components/shared/FileUploadField';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const formatBillingMonth = (bm: string) => {
  const [y, m] = bm.split('-');
  return `${MONTHS[parseInt(m, 10) - 1] || m} ${y}`;
};

interface Transaction {
  id: string;
  invoice_id: string;
  student_id: string;
  amount_foreign: number;
  amount_local: number;
  currency_foreign: string;
  currency_local: string;
  effective_rate: number | null;
  payment_date: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  notes: string | null;
  recorded_by: string | null;
  resolution_type: string;
  period_from: string | null;
  period_to: string | null;
  created_at: string;
}

interface InvoiceInfo {
  id: string;
  billing_month: string;
  amount: number;
  currency: string;
  status: string;
  student_name: string;
}

interface PaymentHistoryTableProps {
  transactions: Transaction[];
  invoiceMap: Record<string, InvoiceInfo>;
  profileMap?: Record<string, string>; // recorded_by id -> name
  onViewReceipt?: (transaction: Transaction) => void;
  studentFilter?: string;
  showStudentColumn?: boolean;
}

export function PaymentHistoryTable({
  transactions, invoiceMap, profileMap = {},
  onViewReceipt, studentFilter, showStudentColumn = true
}: PaymentHistoryTableProps) {
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('last12');
  const [statusFilter, setStatusFilter] = useState('all');

  const cutoffDate = subMonths(new Date(), 12);

  const filtered = useMemo(() => {
    let list = transactions;

    // Time filter
    if (monthFilter === 'last12') {
      list = list.filter(tx => tx.payment_date && isAfter(parseISO(tx.payment_date), cutoffDate));
    } else if (monthFilter !== 'all') {
      list = list.filter(tx => {
        const inv = invoiceMap[tx.invoice_id];
        return inv?.billing_month === monthFilter;
      });
    }

    // Student filter
    if (studentFilter) {
      list = list.filter(tx => tx.student_id === studentFilter);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(tx => {
        const inv = invoiceMap[tx.invoice_id];
        return inv?.student_name?.toLowerCase().includes(q) ||
          tx.payment_method?.toLowerCase().includes(q) ||
          inv?.billing_month?.includes(q);
      });
    }

    // Status
    if (statusFilter !== 'all') {
      list = list.filter(tx => {
        const inv = invoiceMap[tx.invoice_id];
        return inv?.status === statusFilter;
      });
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [transactions, monthFilter, statusFilter, search, studentFilter, invoiceMap, cutoffDate]);

  // Summary cards
  const totalInvoiced = useMemo(() => {
    const uniqueInvoices = new Set(filtered.map(t => t.invoice_id));
    return Array.from(uniqueInvoices).reduce((s, id) => s + (invoiceMap[id]?.amount || 0), 0);
  }, [filtered, invoiceMap]);

  const totalPaid = useMemo(() => filtered.reduce((s, t) => s + t.amount_foreign, 0), [filtered]);
  const totalPending = Math.max(0, totalInvoiced - totalPaid);
  const lastPayment = filtered.length > 0 ? filtered[0].payment_date : null;

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(tx => {
      const inv = invoiceMap[tx.invoice_id];
      if (inv?.billing_month) months.add(inv.billing_month);
    });
    return Array.from(months).sort().reverse();
  }, [transactions, invoiceMap]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Invoiced</p>
          <p className="text-lg font-bold tabular-nums">{totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Paid</p>
          <p className="text-lg font-bold tabular-nums text-emerald-600">{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Pending</p>
          <p className="text-lg font-bold tabular-nums text-amber-600">{totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last Payment</p>
          <p className="text-sm font-bold">{lastPayment ? format(parseISO(lastPayment), 'dd MMM yyyy') : '—'}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search student, channel..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="last12">Last 12 Months</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
            {monthOptions.map(m => <SelectItem key={m} value={m}>{formatBillingMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partially_paid">Partial</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">No payment records found</p>
            <p className="text-xs">Adjust filters to see more results</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {showStudentColumn && <TableHead>Student</TableHead>}
                <TableHead>Billing Month</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead className="text-center">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(tx => {
                const inv = invoiceMap[tx.invoice_id];
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">
                      {tx.payment_date ? format(parseISO(tx.payment_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    {showStudentColumn && (
                      <TableCell className="font-medium text-sm">{inv?.student_name || '—'}</TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{inv ? formatBillingMonth(inv.billing_month) : '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono font-semibold text-sm">{tx.currency_foreign} {tx.amount_foreign.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      {tx.amount_local > 0 && (
                        <p className="text-[10px] text-muted-foreground font-mono">PKR {tx.amount_local.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{tx.payment_method || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{profileMap[tx.recorded_by || ''] || '—'}</TableCell>
                    <TableCell className="text-center">
                      {tx.receipt_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onViewReceipt?.(tx)}
                        >
                          <Eye className="h-3 w-3" /> View
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
