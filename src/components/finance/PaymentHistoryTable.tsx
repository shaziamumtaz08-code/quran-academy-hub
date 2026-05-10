import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Search, Eye, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDisplayDate } from '@/lib/dateFormat';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const formatBillingMonth = (bm: string) => {
  if (!bm) return '—';
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
  profileMap?: Record<string, string>;
  onViewReceipt?: (transaction: Transaction) => void;
  studentFilter?: string;
  showStudentColumn?: boolean;
}

export function PaymentHistoryTable({
  transactions, invoiceMap, profileMap = {},
  onViewReceipt, studentFilter, showStudentColumn = true,
}: PaymentHistoryTableProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = transactions;
    if (studentFilter) list = list.filter(tx => tx.student_id === studentFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(tx => {
        const inv = invoiceMap[tx.invoice_id];
        return inv?.student_name?.toLowerCase().includes(q)
          || tx.payment_method?.toLowerCase().includes(q)
          || inv?.billing_month?.includes(q);
      });
    }
    return list.sort((a, b) => {
      const ad = a.payment_date || a.created_at;
      const bd = b.payment_date || b.created_at;
      return new Date(bd).getTime() - new Date(ad).getTime();
    });
  }, [transactions, search, studentFilter, invoiceMap]);

  return (
    <div className="space-y-4">
      {/* Search only — month filter is provided by parent */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search student, channel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} payment{filtered.length === 1 ? '' : 's'}</p>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">No payment records found</p>
            <p className="text-xs">Adjust the month filter or search to see more results</p>
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
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tx) => {
                const inv = invoiceMap[tx.invoice_id];
                const recordedName = (tx.recorded_by && profileMap[tx.recorded_by]) || 'Admin';
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {tx.payment_date ? formatDisplayDate(tx.payment_date) : '—'}
                    </TableCell>
                    {showStudentColumn && (
                      <TableCell className="font-medium text-sm">{inv?.student_name || '—'}</TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{inv ? formatBillingMonth(inv.billing_month) : '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono font-semibold text-sm tabular-nums">
                        {tx.currency_foreign} {Number(tx.amount_foreign).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {tx.amount_local > 0 && tx.currency_foreign !== 'PKR' && (
                        <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                          PKR {Number(tx.amount_local).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{tx.payment_method || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{recordedName}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onViewReceipt?.(tx)}
                          title="View payment record"
                        >
                          <Eye className="h-3 w-3" /> View
                        </Button>
                        {tx.invoice_id && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-primary"
                            title="Open invoice"
                          >
                            <Link to={`/finance/print/invoice/${tx.invoice_id}`} target="_blank" rel="noreferrer">
                              Invoice <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        )}
                      </div>
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
