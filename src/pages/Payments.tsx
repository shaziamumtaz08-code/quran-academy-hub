import React, { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DollarSign, Users, CheckCircle, XCircle, User, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PaymentStatus = 'paid' | 'unpaid' | 'partial';
type PaymentMethod = 'bank' | 'easypaisa' | 'jazzcash' | 'cash' | 'other' | '';

interface TeacherPayment {
  id: string;
  teacherName: string;
  studentsCount: number;
  monthlyRate: number;
  month: string;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  remark?: string;
  receiptUrl?: string;
  receiptName?: string;
}

const mockPayments: TeacherPayment[] = [
  { id: '1', teacherName: 'Sheikh Ahmad Hassan', studentsCount: 8, monthlyRate: 800, month: 'December 2024', status: 'paid', paymentMethod: 'bank' },
  { id: '2', teacherName: 'Ustadh Ibrahim Ali', studentsCount: 6, monthlyRate: 600, month: 'December 2024', status: 'unpaid' },
  { id: '3', teacherName: 'Sheikh Muhammad Omar', studentsCount: 10, monthlyRate: 1000, month: 'December 2024', status: 'paid', paymentMethod: 'easypaisa' },
  { id: '4', teacherName: 'Ustadha Fatima Khan', studentsCount: 5, monthlyRate: 500, month: 'December 2024', status: 'unpaid' },
];

const PAYMENT_METHODS = [
  { value: 'bank', label: 'Bank' },
  { value: 'easypaisa', label: 'Easypaisa' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export default function Payments() {
  const [payments, setPayments] = useState(mockPayments);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<TeacherPayment | null>(null);
  const [newStatus, setNewStatus] = useState<PaymentStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [remark, setRemark] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPayments = payments.filter(payment => {
    if (filter === 'all') return true;
    return payment.status === filter;
  });

  const totalAmount = payments.reduce((sum, p) => sum + p.monthlyRate, 0);
  const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.monthlyRate, 0);
  const unpaidAmount = payments.filter(p => p.status === 'unpaid' || p.status === 'partial').reduce((sum, p) => sum + p.monthlyRate, 0);

  const openPaymentDialog = (payment: TeacherPayment) => {
    setSelectedPayment(payment);
    const nextStatus: PaymentStatus = payment.status === 'paid' ? 'unpaid' : 'paid';
    setNewStatus(nextStatus);
    setPaymentMethod(payment.paymentMethod || '');
    setRemark(payment.remark || '');
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

  const handleSubmit = () => {
    if (!selectedPayment) return;

    // Validate payment method is required for paid/partial
    if ((newStatus === 'paid' || newStatus === 'partial') && !paymentMethod) {
      toast({
        title: 'Payment method required',
        description: 'Please select a payment method for paid or partial payments.',
        variant: 'destructive',
      });
      return;
    }

    setPayments(payments.map(p => {
      if (p.id === selectedPayment.id) {
        return {
          ...p,
          status: newStatus,
          paymentMethod: (newStatus === 'paid' || newStatus === 'partial') ? paymentMethod : undefined,
          remark: remark || undefined,
          receiptUrl: receiptFile ? URL.createObjectURL(receiptFile) : p.receiptUrl,
          receiptName: receiptFile ? receiptFile.name : p.receiptName,
        };
      }
      return p;
    }));

    toast({
      title: 'Payment Updated',
      description: `${selectedPayment.teacherName}'s payment marked as ${newStatus}`,
    });

    setDialogOpen(false);
    resetDialogState();
  };

  const resetDialogState = () => {
    setSelectedPayment(null);
    setPaymentMethod('');
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
          <h1 className="font-serif text-3xl font-bold text-foreground">Teacher Payments</h1>
          <p className="text-muted-foreground mt-1">Manage teacher payment status</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Payable</p>
                <p className="text-2xl font-serif font-bold text-foreground">${totalAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-emerald-light/10 rounded-xl border border-emerald-light/20 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-light/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-light" />
              </div>
              <div>
                <p className="text-sm text-emerald-light/80">Paid</p>
                <p className="text-2xl font-serif font-bold text-emerald-light">${paidAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-destructive/10 rounded-xl border border-destructive/20 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-destructive/20 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-destructive/80">Unpaid</p>
                <p className="text-2xl font-serif font-bold text-destructive">${unpaidAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead className="text-center">Students</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-5 w-5 text-secondary-foreground" />
                      </div>
                      <span className="font-medium">{payment.teacherName}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
                      <Users className="h-3 w-3" />
                      {payment.studentsCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-lg">${payment.monthlyRate}</TableCell>
                  <TableCell>{payment.month}</TableCell>
                  <TableCell>
                    {payment.paymentMethod ? (
                      <span className="capitalize text-muted-foreground">
                        {PAYMENT_METHODS.find(m => m.value === payment.paymentMethod)?.label || '-'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(payment.status)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant={payment.status === 'paid' ? 'outline' : 'default'}
                      onClick={() => openPaymentDialog(payment)}
                    >
                      {payment.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetDialogState();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedPayment && (
              <div className="text-sm text-muted-foreground">
                Updating payment for <span className="font-medium text-foreground">{selectedPayment.teacherName}</span>
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
                  {receiptFile ? receiptFile.name : 'Upload Receipt (Image/PDF)'}
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
            <Button onClick={handleSubmit}>
              Update Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
