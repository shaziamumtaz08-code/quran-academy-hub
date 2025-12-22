import React, { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DollarSign, CheckCircle, XCircle, User, Upload, X, GraduationCap, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type PaymentStatus = 'paid' | 'unpaid' | 'partial';
type PaymentMethod = 'bank' | 'easypaisa' | 'jazzcash' | 'cash' | 'other' | '';

interface StudentFeeRow {
  id: string;
  student_id: string;
  monthly_fee: number;
  month: string;
  year: string;
  status: string;
  payment_method: string | null;
  amount_paid: number | null;
  remark: string | null;
  receipt_url: string | null;
  profiles: {
    full_name: string;
  } | null;
}

interface StudentFee {
  id: string;
  studentId: string;
  studentName: string;
  monthlyFee: number;
  month: string;
  year: string;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  remark?: string;
  receiptUrl?: string;
}

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const currentYear = new Date().getFullYear();
const YEARS = [
  (currentYear - 2).toString(),
  (currentYear - 1).toString(),
  currentYear.toString(),
  (currentYear + 1).toString(),
  (currentYear + 2).toString(),
];

const formatFeePeriod = (month: string, year: string) => {
  const monthLabel = MONTHS.find(m => m.value === month)?.label || month;
  return `${monthLabel.substring(0, 3)} ${year}`;
};

const PAYMENT_METHODS = [
  { value: 'bank', label: 'Bank' },
  { value: 'easypaisa', label: 'Easypaisa' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export default function Payments() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [newStatus, setNewStatus] = useState<PaymentStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [amountPaid, setAmountPaid] = useState('');
  const [remark, setRemark] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch fees from Supabase
  const { data: fees = [], isLoading } = useQuery({
    queryKey: ['student-fees', statusFilter, monthFilter, yearFilter],
    queryFn: async () => {
      let query = supabase
        .from('student_fees')
        .select(`
          id,
          student_id,
          monthly_fee,
          month,
          year,
          status,
          payment_method,
          amount_paid,
          remark,
          receipt_url,
          profiles!student_fees_student_id_fkey(full_name)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (monthFilter !== 'all') {
        query = query.eq('month', monthFilter);
      }
      if (yearFilter !== 'all') {
        query = query.eq('year', yearFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data as unknown as StudentFeeRow[]).map((row): StudentFee => ({
        id: row.id,
        studentId: row.student_id,
        studentName: row.profiles?.full_name || 'Unknown Student',
        monthlyFee: Number(row.monthly_fee),
        month: row.month,
        year: row.year,
        status: row.status as PaymentStatus,
        paymentMethod: (row.payment_method as PaymentMethod) || undefined,
        amountPaid: row.amount_paid ? Number(row.amount_paid) : undefined,
        remark: row.remark || undefined,
        receiptUrl: row.receipt_url || undefined,
      }));
    },
  });

  // Update fee mutation
  const updateFeeMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      status: PaymentStatus;
      paymentMethod?: string;
      amountPaid?: number;
      remark?: string;
      receiptUrl?: string;
    }) => {
      const { error } = await supabase
        .from('student_fees')
        .update({
          status: data.status,
          payment_method: data.paymentMethod || null,
          amount_paid: data.amountPaid || null,
          remark: data.remark || null,
          receipt_url: data.receiptUrl || null,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-fees'] });
      toast({
        title: 'Fee Updated',
        description: `${selectedFee?.studentName}'s fee has been updated successfully.`,
      });
      setDialogOpen(false);
      resetDialogState();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update fee',
        variant: 'destructive',
      });
    },
  });

  const totalFees = fees.reduce((sum, f) => sum + f.monthlyFee, 0);
  const collectedAmount = fees.reduce((sum, f) => sum + (f.amountPaid || 0), 0);
  const pendingAmount = totalFees - collectedAmount;

  const openPaymentDialog = (fee: StudentFee) => {
    setSelectedFee(fee);
    const nextStatus: PaymentStatus = fee.status === 'paid' ? 'unpaid' : 'paid';
    setNewStatus(nextStatus);
    setPaymentMethod(fee.paymentMethod || '');
    setAmountPaid(fee.amountPaid?.toString() || fee.monthlyFee.toString());
    setRemark(fee.remark || '');
    setReceiptFile(null);
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an image (JPG, PNG, GIF) or PDF file.',
          variant: 'destructive',
        });
        return;
      }
      setReceiptFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFee) return;

    // Validate payment method is required for paid/partial
    if ((newStatus === 'paid' || newStatus === 'partial') && !paymentMethod) {
      toast({
        title: 'Payment method required',
        description: 'Please select a payment method for paid or partial payments.',
        variant: 'destructive',
      });
      return;
    }

    const paidAmount = parseFloat(amountPaid) || 0;
    
    // Determine actual status based on amount
    let finalStatus = newStatus;
    if (newStatus !== 'unpaid') {
      if (paidAmount >= selectedFee.monthlyFee) {
        finalStatus = 'paid';
      } else if (paidAmount > 0) {
        finalStatus = 'partial';
      } else {
        finalStatus = 'unpaid';
      }
    }

    // Handle receipt upload if present
    let receiptUrl = selectedFee.receiptUrl;
    if (receiptFile) {
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${selectedFee.id}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resources')
        .upload(`receipts/${fileName}`, receiptFile);

      if (uploadError) {
        toast({
          title: 'Upload failed',
          description: uploadError.message,
          variant: 'destructive',
        });
        return;
      }

      // Store the file path (not public URL) since bucket is private
      // Signed URLs will be generated when viewing the receipt
      receiptUrl = `receipts/${fileName}`;
    }

    updateFeeMutation.mutate({
      id: selectedFee.id,
      status: finalStatus,
      paymentMethod: (finalStatus === 'paid' || finalStatus === 'partial') ? paymentMethod : undefined,
      amountPaid: finalStatus === 'unpaid' ? undefined : paidAmount,
      remark: remark || undefined,
      receiptUrl,
    });
  };

  const resetDialogState = () => {
    setSelectedFee(null);
    setPaymentMethod('');
    setAmountPaid('');
    setRemark('');
    setReceiptFile(null);
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-light/10 text-emerald-light">
            <CheckCircle className="h-3 w-3" />
            Paid
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
            <CheckCircle className="h-3 w-3" />
            Partial
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
            <XCircle className="h-3 w-3" />
            Unpaid
          </span>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Student Fees</h1>
          <p className="text-muted-foreground mt-1">Manage student fee collection</p>
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
                <p className="text-2xl font-serif font-bold text-foreground">${totalFees.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-emerald-light/10 rounded-xl border border-emerald-light/20 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-light/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-light" />
              </div>
              <div>
                <p className="text-sm text-emerald-light/80">Collected</p>
                <p className="text-2xl font-serif font-bold text-emerald-light">${collectedAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-destructive/10 rounded-xl border border-destructive/20 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/20 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-destructive/80">Pending</p>
                <p className="text-2xl font-serif font-bold text-destructive">${pendingAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4" />
            <span>{fees.length} records</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : fees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mb-4 opacity-50" />
              <p>No fee records found</p>
              <p className="text-sm">Fee records will appear here once created</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">Monthly Fee</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Fee Period</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell>
                      <span className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <User className="h-5 w-5 text-secondary-foreground" />
                        </div>
                        <span className="font-medium">{fee.studentName}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">${fee.monthlyFee}</TableCell>
                    <TableCell className="text-right">
                      {fee.amountPaid ? (
                        <span className="text-emerald-light font-medium">${fee.amountPaid}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatFeePeriod(fee.month, fee.year)}</TableCell>
                    <TableCell>
                      {fee.paymentMethod ? (
                        <span className="capitalize text-muted-foreground">
                          {PAYMENT_METHODS.find(m => m.value === fee.paymentMethod)?.label || '-'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(fee.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant={fee.status === 'paid' ? 'outline' : 'default'}
                        onClick={() => openPaymentDialog(fee)}
                      >
                        Update
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetDialogState();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Fee Status</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedFee && (
              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Student</p>
                <p className="font-medium text-foreground">{selectedFee.studentName}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Monthly Fee: <span className="text-foreground font-medium">${selectedFee.monthlyFee}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Period: <span className="text-foreground">{formatFeePeriod(selectedFee.month, selectedFee.year)}</span>
                </p>
              </div>
            )}

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={(value) => setNewStatus(value as PaymentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount Paid - for paid/partial */}
            {(newStatus === 'paid' || newStatus === 'partial') && (
              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input
                  type="number"
                  min="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={`Max: $${selectedFee?.monthlyFee || 0}`}
                />
              </div>
            )}

            {/* Payment Method - Required for paid/partial */}
            {(newStatus === 'paid' || newStatus === 'partial') && (
              <div className="space-y-2">
                <Label>
                  Payment Method <span className="text-destructive">*</span>
                </Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Remark - Optional */}
            <div className="space-y-2">
              <Label>Remark (Optional)</Label>
              <Textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Add any notes about this payment..."
                rows={3}
              />
            </div>

            {/* Receipt Upload - Optional */}
            <div className="space-y-2">
              <Label>Receipt (Optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {receiptFile ? receiptFile.name : 'Upload Receipt'}
                </Button>
                {receiptFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setReceiptFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={updateFeeMutation.isPending}>
              {updateFeeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}