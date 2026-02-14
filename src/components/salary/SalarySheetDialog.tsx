import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download, Phone, MapPin, Building2, CreditCard, CalendarDays,
  CheckCircle, XCircle, Clock, AlertCircle, Printer, Plus, Minus,
  User, Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface AttendanceDay {
  date: string;
  status: string;
}

interface StudentPayoutRow {
  studentId: string;
  studentName: string;
  assignmentId: string;
  dateFrom: string;
  dateTo: string;
  payoutRate: number;
  payoutType: string;
  eligibleDays: number;
  totalDays: number;
  calculatedAmount: number;
  editedAmount: number | null;
  attendanceDays: AttendanceDay[];
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  rescheduledCount: number;
  missingCount: number;
  feeStatus: string;
  lastPaymentDate: string | null;
}

interface TeacherProfile {
  id: string;
  full_name: string;
  email?: string | null;
  whatsapp_number?: string | null;
  country?: string | null;
  city?: string | null;
  bank_name?: string | null;
  bank_account_title?: string | null;
  bank_account_number?: string | null;
  bank_iban?: string | null;
}

interface TeacherAttendanceSnapshot {
  present: number;
  absent: number;
  leave: number;
  notMarked: number;
}

interface SalarySheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: {
    teacherId: string;
    teacherName: string;
    students: StudentPayoutRow[];
    baseSalary: number;
    extraClassAmount: number;
    adjustmentAmount: number;
    deductions: number;
    netSalary: number;
    payoutStatus: string;
  } | null;
  teacherProfile: TeacherProfile | null;
  teacherAttendance: TeacherAttendanceSnapshot;
  adjustments: { id: string; adjustment_type: string; amount: number; reason: string | null }[];
  salaryMonth: string;
  year: number;
  month: number;
  editAmounts: Record<string, number>;
  onEditAmount: (assignmentId: string, amount: number) => void;
  onMarkPaid: (type: 'full' | 'partial', reason?: string) => void;
  isPayingPending?: boolean;
  isLocked: boolean;
}

export function SalarySheetDialog({
  open, onOpenChange, teacher, teacherProfile, teacherAttendance,
  adjustments, salaryMonth, year, month, editAmounts, onEditAmount,
  onMarkPaid, isPayingPending, isLocked
}: SalarySheetDialogProps) {
  const [partialReason, setPartialReason] = useState('');
  const [showPartialInput, setShowPartialInput] = useState(false);

  if (!teacher) return null;

  const monthLabel = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const handlePrint = () => {
    window.print();
  };

  const dotColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-500';
      case 'absent': return 'bg-red-500';
      case 'leave': return 'bg-amber-400';
      case 'rescheduled': return 'bg-sky-400';
      default: return 'bg-gray-300';
    }
  };

  const dotLabel = (status: string) => {
    switch (status) {
      case 'present': return 'Present';
      case 'absent': return 'Absent';
      case 'leave': return 'Leave';
      case 'rescheduled': return 'Rescheduled';
      default: return 'Not Marked';
    }
  };

  const totalBase = teacher.students.reduce((s, r) => s + (editAmounts[r.assignmentId] ?? r.calculatedAmount), 0);
  const grandNet = totalBase + teacher.extraClassAmount + teacher.adjustmentAmount - teacher.deductions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0 gap-0 overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:border-none">
        <ScrollArea className="max-h-[95vh]">
          <div className="salary-sheet-print">
            {/* ═══ HEADER ═══ */}
            <div className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] text-primary-foreground p-6 print:p-4">
              <div className="flex justify-between items-start gap-6">
                {/* Left: Teacher Info */}
                <div className="space-y-3 flex-1">
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-70 font-medium">Salary Statement</p>
                    <h2 className="text-2xl font-serif font-bold mt-1">{teacher.teacherName}</h2>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm opacity-90">
                    {teacherProfile?.whatsapp_number && (
                      <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{teacherProfile.whatsapp_number}</span>
                    )}
                    {(teacherProfile?.city || teacherProfile?.country) && (
                      <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{[teacherProfile.city, teacherProfile.country].filter(Boolean).join(', ')}</span>
                    )}
                    {teacherProfile?.email && (
                      <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{teacherProfile.email}</span>
                    )}
                  </div>
                  {/* Bank Details */}
                  {(teacherProfile?.bank_name || teacherProfile?.bank_account_number) && (
                    <div className="bg-white/10 rounded-lg p-3 mt-2 space-y-1">
                      <p className="text-xs uppercase tracking-wider opacity-60 flex items-center gap-1.5"><CreditCard className="h-3 w-3" />Bank Details</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                        {teacherProfile?.bank_account_title && <div><span className="opacity-60">Title:</span> {teacherProfile.bank_account_title}</div>}
                        {teacherProfile?.bank_name && <div><span className="opacity-60">Bank:</span> {teacherProfile.bank_name}</div>}
                        {teacherProfile?.bank_account_number && <div><span className="opacity-60">A/C #:</span> {teacherProfile.bank_account_number}</div>}
                        {teacherProfile?.bank_iban && <div><span className="opacity-60">IBAN:</span> {teacherProfile.bank_iban}</div>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Attendance Snapshot + Period */}
                <div className="text-right space-y-3 shrink-0">
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-70">Period</p>
                    <p className="text-lg font-semibold">{monthLabel}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs uppercase tracking-wider opacity-60">Teacher Attendance</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="flex items-center gap-1.5 justify-end"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> {teacherAttendance.present} Present</span>
                      <span className="flex items-center gap-1.5 justify-end"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {teacherAttendance.absent} Absent</span>
                      <span className="flex items-center gap-1.5 justify-end"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {teacherAttendance.leave} Leave</span>
                      <span className="flex items-center gap-1.5 justify-end"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> {teacherAttendance.notMarked} Not Marked</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="print:hidden bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={handlePrint}
                  >
                    <Printer className="h-4 w-4 mr-1" /> Download
                  </Button>
                </div>
              </div>
            </div>

            {/* ═══ LEGEND BAR ═══ */}
            <div className="px-6 py-2.5 bg-muted/50 border-b border-border flex items-center gap-5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground mr-1">Legend:</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Present</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Absent</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Leave</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" /> Not Marked</span>
            </div>

            {/* ═══ STUDENT ROWS ═══ */}
            <div className="p-6 space-y-4">
              {/* Column Headers */}
              <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">
                <div className="col-span-3">Student</div>
                <div className="col-span-2">Period</div>
                <div className="col-span-2 text-right">Monthly Fee</div>
                <div className="col-span-2 text-right">Due Amount</div>
                <div className="col-span-2 text-right">Final Amount</div>
                <div className="col-span-1 text-right">Fee</div>
              </div>

              {teacher.students.map(s => {
                const finalAmt = editAmounts[s.assignmentId] ?? s.calculatedAmount;
                return (
                  <div key={s.assignmentId} className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
                    {/* Main Row */}
                    <div className="grid grid-cols-12 gap-3 items-center px-4 py-3">
                      <div className="col-span-3">
                        <p className="font-medium text-sm text-foreground">{s.studentName}</p>
                        <Badge variant="outline" className="text-[10px] mt-0.5 capitalize">{s.payoutType}</Badge>
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground">
                        {format(parseISO(s.dateFrom), 'dd MMM')} – {format(parseISO(s.dateTo), 'dd MMM')}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm font-medium tabular-nums">${s.payoutRate.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm tabular-nums text-muted-foreground">${s.calculatedAmount.toFixed(2)}</span>
                        <p className="text-[10px] text-muted-foreground">{s.eligibleDays}/{s.totalDays} days</p>
                      </div>
                      <div className="col-span-2 text-right">
                        <Input
                          type="number"
                          className="h-8 w-28 text-right text-sm font-semibold ml-auto tabular-nums"
                          value={finalAmt}
                          onChange={e => onEditAmount(s.assignmentId, parseFloat(e.target.value) || 0)}
                          disabled={isLocked}
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        {s.feeStatus === 'paid' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            <CheckCircle className="h-3 w-3 mr-0.5" />PAID
                          </Badge>
                        ) : s.feeStatus === 'overdue' ? (
                          <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                            <XCircle className="h-3 w-3 mr-0.5" />OVERDUE
                          </Badge>
                        ) : s.feeStatus === 'pending' ? (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                            <Clock className="h-3 w-3 mr-0.5" />UNPAID
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">—</Badge>
                        )}
                      </div>
                    </div>

                    {/* Attendance Timeline */}
                    <div className="px-4 pb-3 space-y-2">
                      <TooltipProvider>
                        <div className="flex items-center gap-[3px] flex-wrap">
                          {s.attendanceDays.map((d, i) => (
                            <Tooltip key={d.date}>
                              <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[8px] text-muted-foreground leading-none">
                                    {format(parseISO(d.date), 'd')}
                                  </span>
                                  <span className={`w-3 h-3 rounded-full ${dotColor(d.status)} inline-block transition-transform hover:scale-125 cursor-default`} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {format(parseISO(d.date), 'dd MMM yyyy')} — {dotLabel(d.status)}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </TooltipProvider>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="text-emerald-600 font-medium">{s.presentCount} present</span>
                        <span className="text-red-600">{s.absentCount} absent</span>
                        <span className="text-amber-600">{s.leaveCount} leave</span>
                        <span className="text-gray-500">{s.missingCount} not marked</span>
                        {s.lastPaymentDate && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <span className="text-muted-foreground">Last paid: {format(parseISO(s.lastPaymentDate), 'dd MMM')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {teacher.students.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No student assignments for this period</div>
              )}
            </div>

            {/* ═══ ADJUSTMENTS ═══ */}
            {(adjustments.length > 0 || teacher.extraClassAmount > 0) && (
              <div className="px-6 pb-4">
                <Separator className="mb-4" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Adjustments & Extras</p>
                <div className="space-y-1.5">
                  {teacher.extraClassAmount > 0 && (
                    <div className="flex justify-between items-center py-1.5 px-3 bg-emerald-50 rounded-lg text-sm">
                      <span className="text-muted-foreground">Extra Classes</span>
                      <span className="font-medium text-emerald-700">+${teacher.extraClassAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {adjustments.map(adj => (
                    <div key={adj.id} className={`flex justify-between items-center py-1.5 px-3 rounded-lg text-sm ${adj.adjustment_type === 'deduction' ? 'bg-red-50' : 'bg-emerald-50'}`}>
                      <span className="text-muted-foreground">{adj.reason || adj.adjustment_type}</span>
                      <span className={`font-medium ${adj.adjustment_type === 'deduction' ? 'text-red-700' : 'text-emerald-700'}`}>
                        {adj.adjustment_type === 'deduction' ? '-' : '+'}${Number(adj.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ NET SALARY FOOTER ═══ */}
            <div className="border-t-2 border-border bg-muted/30 px-6 py-5">
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Base Salary</p>
                  <p className="text-lg font-bold tabular-nums">${totalBase.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Additions</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-600">+${(teacher.extraClassAmount + teacher.adjustmentAmount).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deductions</p>
                  <p className="text-lg font-bold tabular-nums text-red-600">-${teacher.deductions.toFixed(2)}</p>
                </div>
                <div className="text-center bg-[hsl(var(--primary))] text-primary-foreground rounded-xl py-2">
                  <p className="text-[10px] uppercase tracking-wider opacity-70">Net Salary</p>
                  <p className="text-2xl font-bold tabular-nums">${grandNet.toFixed(2)}</p>
                </div>
              </div>

              {/* Payment Actions */}
              <div className="flex items-center gap-3 print:hidden">
                {!isLocked && teacher.payoutStatus !== 'paid' && (
                  <>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => onMarkPaid('full')}
                      disabled={isPayingPending}
                    >
                      {isPayingPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      <CheckCircle className="h-4 w-4 mr-1.5" /> Mark Fully Paid
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowPartialInput(!showPartialInput)}
                    >
                      <AlertCircle className="h-4 w-4 mr-1.5" /> Partially Paid
                    </Button>
                  </>
                )}
                {teacher.payoutStatus === 'paid' && (
                  <div className="flex items-center gap-2 text-emerald-600 font-medium">
                    <CheckCircle className="h-5 w-5" /> Payment Completed
                  </div>
                )}
                {isLocked && (
                  <div className="flex items-center gap-2 text-muted-foreground font-medium">
                    <AlertCircle className="h-5 w-5" /> Salary Locked
                  </div>
                )}
              </div>

              {/* Partial Payment Reason */}
              {showPartialInput && !isLocked && (
                <div className="mt-3 space-y-2 print:hidden">
                  <Textarea
                    placeholder="Reason for partial payment (mandatory)..."
                    value={partialReason}
                    onChange={e => setPartialReason(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={!partialReason.trim() || isPayingPending}
                    onClick={() => { onMarkPaid('partial', partialReason); setPartialReason(''); setShowPartialInput(false); }}
                  >
                    {isPayingPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Confirm Partial Payment
                  </Button>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
