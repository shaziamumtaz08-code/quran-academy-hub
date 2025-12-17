import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Users, CheckCircle, XCircle, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TeacherPayment {
  id: string;
  teacherName: string;
  studentsCount: number;
  monthlyRate: number;
  month: string;
  status: 'paid' | 'unpaid';
}

const mockPayments: TeacherPayment[] = [
  { id: '1', teacherName: 'Sheikh Ahmad Hassan', studentsCount: 8, monthlyRate: 800, month: 'December 2024', status: 'paid' },
  { id: '2', teacherName: 'Ustadh Ibrahim Ali', studentsCount: 6, monthlyRate: 600, month: 'December 2024', status: 'unpaid' },
  { id: '3', teacherName: 'Sheikh Muhammad Omar', studentsCount: 10, monthlyRate: 1000, month: 'December 2024', status: 'paid' },
  { id: '4', teacherName: 'Ustadha Fatima Khan', studentsCount: 5, monthlyRate: 500, month: 'December 2024', status: 'unpaid' },
];

export default function Payments() {
  const [payments, setPayments] = useState(mockPayments);
  const [filter, setFilter] = useState('all');
  const { toast } = useToast();

  const filteredPayments = payments.filter(payment => {
    if (filter === 'all') return true;
    return payment.status === filter;
  });

  const totalAmount = payments.reduce((sum, p) => sum + p.monthlyRate, 0);
  const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.monthlyRate, 0);
  const unpaidAmount = payments.filter(p => p.status === 'unpaid').reduce((sum, p) => sum + p.monthlyRate, 0);

  const togglePaymentStatus = (id: string) => {
    setPayments(payments.map(p => {
      if (p.id === id) {
        const newStatus = p.status === 'paid' ? 'unpaid' : 'paid';
        toast({
          title: newStatus === 'paid' ? 'Payment Marked as Paid' : 'Payment Marked as Unpaid',
          description: `${p.teacherName}'s payment status updated`,
        });
        return { ...p, status: newStatus };
      }
      return p;
    }));
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
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                      payment.status === 'paid' 
                        ? 'bg-emerald-light/10 text-emerald-light' 
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {payment.status === 'paid' ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {payment.status === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant={payment.status === 'paid' ? 'outline' : 'default'}
                      onClick={() => togglePaymentStatus(payment.id)}
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
    </DashboardLayout>
  );
}
