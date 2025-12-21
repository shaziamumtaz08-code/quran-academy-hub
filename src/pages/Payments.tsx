import React, { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DollarSign, CheckCircle, XCircle, User, Upload, X, GraduationCap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PaymentStatus = 'paid' | 'unpaid' | 'partial';
type PaymentMethod = 'bank' | 'easypaisa' | 'jazzcash' | 'cash' | 'other' | '';

interface StudentFee {
  id: string;
  studentName: string;
  monthlyFee: number;
  month: string;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  remark?: string;
  receiptUrl?: string;
  receiptName?: string;
}

// Mock data - replace with Supabase query
const mockStudentFees: StudentFee[] = [
  { id: '1', studentName: 'Ahmed Hassan', monthlyFee: 100, month: 'December 2024', status: 'paid', paymentMethod: 'bank', amountPaid: 100 },
  { id: '2', studentName: 'Fatima Ali', monthlyFee: 100, month: 'December 2024', status: 'unpaid' },
  { id: '3', studentName: 'Omar Khan', monthlyFee: 150, month: 'December 2024', status: 'paid', paymentMethod: 'easypaisa', amountPaid: 150 },
  { id: '4', studentName: 'Aisha Mahmood', monthlyFee: 100, month: 'December 2024', status: 'partial', paymentMethod: 'cash', amountPaid: 50 },
  { id: '5', studentName: 'Yusuf Ibrahim', monthlyFee: 120, month: 'December 2024', status: 'unpaid' },
];

const PAYMENT_METHODS = [
  { value: 'bank', label: 'Bank' },
  { value: 'easypaisa', label: 'Easypaisa' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export default function Payments() {
  const [fees, setFees] = useState(mockStudentFees);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [newStatus, setNewStatus] = useState<PaymentStatus>('paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [amountPaid, setAmountPaid] = useState('');
  const [remark, setRemark] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFees = fees.filter(fee => {
    if (filter === 'all') return true;
    return fee.status === filter;
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

  const handleSubmit = () => {
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

    setFees(fees.map(f => {
      if (f.id === selectedFee.id) {
        return {
          ...f,
          status: finalStatus,
          paymentMethod: (finalStatus === 'paid' || finalStatus === 'partial') ? paymentMethod : undefined,
          amountPaid: finalStatus === 'unpaid' ? undefined : paidAmount,
          remark: remark || undefined,
          receiptUrl: receiptFile ? URL.createObjectURL(receiptFile) : f.receiptUrl,
          receiptName: receiptFile ? receiptFile.name : f.receiptName,
        };
      }
      return f;
    }));

    toast({
      title: 'Fee Updated',
      description: `${selectedFee.studentName}'s fee marked as ${finalStatus}`,
    });

    setDialogOpen(false);
    resetDialogState();
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

        {/* Filter */}
        <div className="flex items-center gap-4">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4" />
            <span>{filteredFees.length} students</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="text-right">Monthly Fee</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFees.map((fee) => (
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
                  <TableCell>{fee.month}</TableCell>
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
            <Button onClick={handleSubmit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
