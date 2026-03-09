import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  MapPin,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Printer,
  User,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { FileUploadField, AttachmentPreview } from "@/components/shared/FileUploadField";

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
  holidayCount: number;
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
  onMarkPaid: (type: "full" | "partial", reason?: string, invoiceNumber?: string, receiptUrls?: string[], amountPaid?: number) => void;
  onTopUp?: (amount: number, notes: string, receiptUrls: string[]) => void;
  onUpdateProofs?: (receiptUrls: string[], invoiceNumber?: string) => void;
  onRevert?: () => void;
  isPayingPending?: boolean;
  isTopUpPending?: boolean;
  isUpdatingProofs?: boolean;
  isLocked: boolean;
  isPaid?: boolean;
  isPartiallyPaid?: boolean;
  existingAmountPaid?: number;
  viewerRole?: "admin" | "teacher";
  existingReceiptUrls?: string[];
  existingInvoiceNumber?: string | null;
}

const MAX_RECEIPTS = 3;

export function SalarySheetDialog({
  open,
  onOpenChange,
  teacher,
  teacherProfile,
  teacherAttendance,
  adjustments,
  salaryMonth,
  year,
  month,
  editAmounts,
  onEditAmount,
  onMarkPaid,
  onTopUp,
  onUpdateProofs,
  onRevert,
  isPayingPending,
  isTopUpPending,
  isUpdatingProofs,
  isLocked,
  isPaid,
  isPartiallyPaid,
  existingAmountPaid = 0,
  viewerRole = "admin",
  existingReceiptUrls = [],
  existingInvoiceNumber,
}: SalarySheetDialogProps) {
  const [partialReason, setPartialReason] = useState("");
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [showPartialInput, setShowPartialInput] = useState(false);
  const [receiptUrls, setReceiptUrls] = useState<string[]>([]);
  // Top-up state
  const [showTopUpInput, setShowTopUpInput] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>("");
  const [topUpNotes, setTopUpNotes] = useState("");
  const [topUpReceipts, setTopUpReceipts] = useState<string[]>([]);

  // Reset local state every time the dialog opens for a (possibly different) teacher
  useEffect(() => {
    if (open) {
      setReceiptUrls(existingReceiptUrls || []);
      setPartialReason("");
      setPartialAmount("");
      setShowPartialInput(false);
      setShowTopUpInput(false);
      setTopUpAmount("");
      setTopUpNotes("");
      setTopUpReceipts([]);
    }
  }, [open, teacher?.teacherId, existingReceiptUrls]);

  // Auto-generate invoice number
  const autoInvoiceNumber = `SAL-${salaryMonth.replace("-", "")}-${teacher?.teacherName?.substring(0, 3).toUpperCase() || "XXX"}`;
  const displayInvoice = existingInvoiceNumber || autoInvoiceNumber;

  const isTeacherView = viewerRole === "teacher";

  if (!teacher) return null;

  const monthLabel = new Date(year, month - 1).toLocaleString("default", { month: "long", year: "numeric" });

  const handlePrint = () => {
    const payoutId = (teacher as any)?.payoutId;
    if (payoutId) {
      window.open(`/finance/print/salary/${payoutId}`, "_blank");
    } else {
      window.print();
    }
  };

  const dotColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-emerald-500";
      case "absent":
        return "bg-red-500";
      case "leave":
        return "bg-amber-400";
      case "holiday":
        return "bg-sky-400";
      case "rescheduled":
        return "bg-sky-400";
      default:
        return "bg-gray-300";
    }
  };

  const dotLabel = (status: string) => {
    switch (status) {
      case "present":
        return "Present";
      case "absent":
        return "Absent";
      case "leave":
        return "Leave";
      case "holiday":
        return "Holiday / Off Day";
      case "rescheduled":
        return "Rescheduled";
      default:
        return "Not Marked";
    }
  };

  const totalBase = teacher.students.reduce((s, r) => s + (editAmounts[r.assignmentId] ?? r.calculatedAmount), 0);
  const grandNet = totalBase + teacher.extraClassAmount + teacher.adjustmentAmount - teacher.deductions;

  const adjustmentTypeLabel = (type: string) => {
    switch (type) {
      case "bonus":
        return "Bonus";
      case "allowance":
        return "Allowance";
      case "deduction":
        return "Deduction";
      case "expense":
        return "Expense";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const handleReceiptUpload = (url: string, index: number) => {
    setReceiptUrls(prev => {
      const updated = [...prev];
      updated[index] = url;
      return updated.filter(Boolean);
    });
  };

  const removeReceipt = (index: number) => {
    setReceiptUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateProofs = () => {
    if (onUpdateProofs) {
      onUpdateProofs(receiptUrls, displayInvoice);
    }
  };

  // Determine if proofs can be edited (paid but not locked)
  const canEditProofs = isPaid && !isLocked && !isTeacherView;
  // Determine if calculation fields can be edited (draft or confirmed only)
  const canEditCalculations = !isPaid && !isLocked && !isTeacherView;
  // Show revert button for paid or locked status
  const canRevert = (isPaid || isLocked) && !isTeacherView && onRevert;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0 gap-0 overflow-hidden w-[95vw] sm:w-auto print:max-w-none print:max-h-none print:shadow-none print:border-none">
        <ScrollArea className="max-h-[95vh]">
          <div className="salary-sheet-print">
            {/* ═══ HEADER ═══ */}
            <div className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] text-primary-foreground p-4 sm:p-6 print:p-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                {/* Left: Teacher Info */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-70 font-medium">Salary Statement</p>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold mt-1 truncate">{teacher.teacherName}</h2>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm opacity-90">
                    {teacherProfile?.whatsapp_number && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        {teacherProfile.whatsapp_number}
                      </span>
                    )}
                    {(teacherProfile?.city || teacherProfile?.country) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {[teacherProfile.city, teacherProfile.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {teacherProfile?.email && (
                      <span className="flex items-center gap-1 break-all">
                        <User className="h-3 w-3 shrink-0" />
                        {teacherProfile.email}
                      </span>
                    )}
                  </div>
                  {(teacherProfile?.bank_name || teacherProfile?.bank_account_number) && (
                    <div className="bg-white/10 rounded-lg p-2.5 mt-1 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider opacity-60 flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        Bank Details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-xs sm:text-sm">
                        {teacherProfile?.bank_account_title && (
                          <div>
                            <span className="opacity-60">Title:</span> {teacherProfile.bank_account_title}
                          </div>
                        )}
                        {teacherProfile?.bank_name && (
                          <div>
                            <span className="opacity-60">Bank:</span> {teacherProfile.bank_name}
                          </div>
                        )}
                        {teacherProfile?.bank_account_number && (
                          <div>
                            <span className="opacity-60">A/C #:</span> {teacherProfile.bank_account_number}
                          </div>
                        )}
                        {teacherProfile?.bank_iban && (
                          <div>
                            <span className="opacity-60">IBAN:</span> {teacherProfile.bank_iban}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Attendance Snapshot + Period (admin only) */}
                <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-3 shrink-0">
                  <div className="sm:text-right">
                    <p className="text-[10px] uppercase tracking-widest opacity-70">Period</p>
                    <p className="text-base sm:text-lg font-semibold">{monthLabel}</p>
                    <p className="text-[10px] opacity-60 mt-0.5">Invoice: {displayInvoice}</p>
                  </div>
                  {!isTeacherView && (
                    <div className="bg-white/10 rounded-lg p-2.5 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider opacity-60">Teacher Attendance</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs sm:text-sm">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0" />{" "}
                          {teacherAttendance.present} Present
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-400 inline-block shrink-0" />{" "}
                          {teacherAttendance.absent} Absent
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shrink-0" />{" "}
                          {teacherAttendance.leave} Leave
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block shrink-0" />{" "}
                          {teacherAttendance.notMarked} N/M
                        </span>
                      </div>
                    </div>
                  )}
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
            {!isTeacherView && (
              <div className="px-4 sm:px-6 py-2 bg-muted/50 border-b border-border flex flex-wrap items-center gap-3 sm:gap-5 text-[10px] sm:text-xs text-muted-foreground">
                <span className="font-medium text-foreground mr-1">Legend:</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Present
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Absent
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Leave
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Holiday
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Not Marked
                </span>
              </div>
            )}

            {/* ═══ STUDENT ROWS ═══ */}
            <div className="p-3 sm:p-6 space-y-3">
              {/* Column Headers - hidden on mobile */}
              <div
                className={`hidden sm:grid gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 ${isTeacherView ? "grid-cols-10" : "grid-cols-12"}`}
              >
                <div className="col-span-3">Student</div>
                <div className="col-span-2">Period</div>
                <div className="col-span-2 text-right">Monthly Fee</div>
                <div className="col-span-2 text-right">{isTeacherView ? "Final Amount" : "Due Amount"}</div>
                {!isTeacherView && <div className="col-span-2 text-right">Final Amount</div>}
                {!isTeacherView && <div className="col-span-1 text-right">Fee</div>}
              </div>

              {teacher.students.map((s) => {
                const finalAmt = editAmounts[s.assignmentId] ?? s.calculatedAmount;
                return (
                  <div
                    key={s.assignmentId}
                    className="border border-border rounded-xl bg-card shadow-sm overflow-hidden"
                  >
                    {/* Desktop Row */}
                    <div
                      className={`hidden sm:grid gap-3 items-center px-4 py-3 ${isTeacherView ? "grid-cols-10" : "grid-cols-12"}`}
                    >
                      <div className="col-span-3">
                        <p className="font-medium text-sm text-foreground">{s.studentName}</p>
                        <Badge variant="outline" className="text-[10px] mt-0.5 capitalize">
                          {s.payoutType}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-sm text-muted-foreground">
                        {format(parseISO(s.dateFrom), "dd MMM")} – {format(parseISO(s.dateTo), "dd MMM")}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm font-medium tabular-nums">PKR {s.payoutRate.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm tabular-nums text-muted-foreground">
                          PKR {s.calculatedAmount.toFixed(2)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {s.eligibleDays}/{s.totalDays} days
                        </p>
                      </div>
                      {!isTeacherView && (
                        <div className="col-span-2 text-right">
                          <Input
                            type="number"
                            className="h-8 w-28 text-right text-sm font-semibold ml-auto tabular-nums"
                            value={finalAmt}
                            onChange={(e) => onEditAmount(s.assignmentId, parseFloat(e.target.value) || 0)}
                            disabled={!canEditCalculations}
                          />
                        </div>
                      )}
                      {!isTeacherView && (
                        <div className="col-span-1 text-right">
                          <FeeBadge status={s.feeStatus} />
                        </div>
                      )}
                    </div>

                    {/* Mobile Row */}
                    <div className="sm:hidden px-3 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm text-foreground">{s.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(s.dateFrom), "dd MMM")} – {format(parseISO(s.dateTo), "dd MMM")}
                            <Badge variant="outline" className="text-[9px] ml-1.5 capitalize">
                              {s.payoutType}
                            </Badge>
                          </p>
                        </div>
                        {!isTeacherView && <FeeBadge status={s.feeStatus} />}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Fee</p>
                          <p className="font-medium tabular-nums">PKR {s.payoutRate.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Due</p>
                          <p className="tabular-nums">PKR {s.calculatedAmount.toFixed(0)}</p>
                          <p className="text-[9px] text-muted-foreground">
                            {s.eligibleDays}/{s.totalDays}d
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Final</p>
                          {isTeacherView ? (
                            <p className="font-semibold tabular-nums">PKR {finalAmt.toFixed(0)}</p>
                          ) : (
                            <Input
                              type="number"
                              className="h-7 w-full text-right text-xs font-semibold tabular-nums"
                              value={finalAmt}
                              onChange={(e) => onEditAmount(s.assignmentId, parseFloat(e.target.value) || 0)}
                              disabled={!canEditCalculations}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Attendance Timeline - Admin only */}
                    {!isTeacherView && (
                      <div className="px-3 sm:px-4 pb-3 space-y-1.5">
                        <TooltipProvider>
                          <div className="flex items-center gap-[3px] flex-wrap">
                            {s.attendanceDays.map((d) => (
                              <Tooltip key={d.date}>
                                <TooltipTrigger asChild>
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[7px] sm:text-[8px] text-muted-foreground leading-none">
                                      {format(parseISO(d.date), "d")}
                                    </span>
                                    <span
                                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${dotColor(d.status)} inline-block transition-transform hover:scale-125 cursor-default`}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {format(parseISO(d.date), "dd MMM yyyy")} — {dotLabel(d.status)}
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </TooltipProvider>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-muted-foreground">
                          <span className="text-emerald-600 font-medium">{s.presentCount} present</span>
                          <span className="text-red-600">{s.absentCount} absent</span>
                          <span className="text-amber-600">{s.leaveCount} leave</span>
                          {s.holidayCount > 0 && <span className="text-sky-600">{s.holidayCount} off</span>}
                          {s.missingCount > 0 && <span className="text-gray-500">{s.missingCount} not marked</span>}
                          {s.lastPaymentDate && (
                            <>
                              <Separator orientation="vertical" className="h-3 hidden sm:block" />
                              <span className="text-muted-foreground">
                                Last paid: {format(parseISO(s.lastPaymentDate), "dd MMM")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {teacher.students.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No student assignments for this period</div>
              )}
            </div>

            {/* ═══ ADJUSTMENTS ═══ */}
            {(adjustments.length > 0 || teacher.extraClassAmount > 0) && (
              <div className="px-4 sm:px-6 pb-4">
                <Separator className="mb-4" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Adjustments & Extras
                </p>
                <div className="space-y-2">
                  {teacher.extraClassAmount > 0 && (
                    <div className="flex justify-between items-center py-2 px-3 bg-emerald-50 rounded-lg">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Extra Classes</p>
                      </div>
                      <span className="font-semibold text-sm text-emerald-700">
                        +PKR {teacher.extraClassAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {adjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className={`flex justify-between items-start py-2 px-3 rounded-lg ${adj.adjustment_type === "deduction" ? "bg-red-50" : "bg-emerald-50"}`}
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="text-sm font-semibold text-foreground capitalize">
                          {adjustmentTypeLabel(adj.adjustment_type)}
                        </p>
                        {adj.reason && <p className="text-xs text-muted-foreground mt-0.5 italic">{adj.reason}</p>}
                      </div>
                      <span
                        className={`font-semibold text-sm shrink-0 ${adj.adjustment_type === "deduction" ? "text-red-700" : "text-emerald-700"}`}
                      >
                        {adj.adjustment_type === "deduction" ? "-" : "+"}PKR {Number(adj.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ NET SALARY FOOTER ═══ */}
            <div className="border-t-2 border-border bg-muted/30 px-4 sm:px-6 py-4 sm:py-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
                <div className="text-center">
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">
                    Base Salary
                  </p>
                  <p className="text-base sm:text-lg font-bold tabular-nums">PKR {totalBase.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Additions</p>
                  <p className="text-base sm:text-lg font-bold tabular-nums text-emerald-600">
                    +PKR {(teacher.extraClassAmount + teacher.adjustmentAmount).toFixed(2)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground">Deductions</p>
                  <p className="text-base sm:text-lg font-bold tabular-nums text-red-600">
                    -PKR {teacher.deductions.toFixed(2)}
                  </p>
                </div>
                <div className="text-center bg-[hsl(var(--primary))] text-primary-foreground rounded-xl py-2">
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider opacity-70">Net Salary</p>
                  <p className="text-xl sm:text-2xl font-bold tabular-nums">PKR {grandNet.toFixed(2)}</p>
                </div>
              </div>

              {/* Payment Actions - Draft/Confirmed status */}
              {!isLocked && !isPaid && !isTeacherView && (
                <div className="space-y-3 print:hidden">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Invoice #</Label>
                      <Input value={displayInvoice} disabled className="h-8 text-sm bg-muted" />
                    </div>
                    
                    {/* Multi-attachment upload */}
                    <div className="space-y-2">
                      <Label className="text-xs">Payment Proofs (up to {MAX_RECEIPTS})</Label>
                      <div className="space-y-2">
                        {Array.from({ length: Math.min(receiptUrls.length + 1, MAX_RECEIPTS) }).map((_, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="flex-1">
                              {receiptUrls[idx] ? (
                                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                                  <AttachmentPreview url={receiptUrls[idx]} />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    onClick={() => removeReceipt(idx)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <FileUploadField
                                  label=""
                                  bucket="salary-receipts"
                                  value=""
                                  onChange={(url) => handleReceiptUpload(url, idx)}
                                  hint={`Proof ${idx + 1}`}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => onMarkPaid("full", undefined, displayInvoice, receiptUrls)}
                      disabled={isPayingPending}
                    >
                      {isPayingPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      <CheckCircle className="h-4 w-4 mr-1.5" /> Mark Fully Paid
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setShowPartialInput(!showPartialInput)}>
                      <AlertCircle className="h-4 w-4 mr-1.5" /> Partially Paid
                    </Button>
                  </div>
                </div>
              )}

              {/* Paid status - can still edit proofs */}
              {isPaid && !isLocked && (
                <div className="space-y-3 print:hidden">
                  <div className="flex items-center gap-2 text-emerald-600 font-medium">
                    <CheckCircle className="h-5 w-5" /> Payment Completed
                  </div>
                  {existingInvoiceNumber && (
                    <p className="text-xs text-muted-foreground">Invoice: {existingInvoiceNumber}</p>
                  )}
                  
                  {/* Editable proofs section for paid status */}
                  {!isTeacherView && (
                    <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                      <Label className="text-xs font-medium">Payment Proofs (editable)</Label>
                      <div className="space-y-2">
                        {Array.from({ length: Math.min(receiptUrls.length + 1, MAX_RECEIPTS) }).map((_, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="flex-1">
                              {receiptUrls[idx] ? (
                                <div className="flex items-center gap-2 p-2 bg-background rounded-lg">
                                  <AttachmentPreview url={receiptUrls[idx]} />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    onClick={() => removeReceipt(idx)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <FileUploadField
                                  label=""
                                  bucket="salary-receipts"
                                  value=""
                                  onChange={(url) => handleReceiptUpload(url, idx)}
                                  hint={`Add proof ${idx + 1}`}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        onClick={handleUpdateProofs}
                        disabled={isUpdatingProofs}
                        className="mt-2"
                      >
                        {isUpdatingProofs && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                        <Upload className="h-4 w-4 mr-1" /> Update Proofs
                      </Button>
                    </div>
                  )}
                  
                  {/* Show existing proofs for teacher view */}
                  {isTeacherView && receiptUrls.length > 0 && (
                    <div className="space-y-1">
                      {receiptUrls.map((url, idx) => (
                        <AttachmentPreview key={idx} url={url} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Locked status */}
              {isLocked && (
                <div className="space-y-2 print:hidden">
                  <div className="flex items-center gap-2 text-muted-foreground font-medium">
                    <AlertCircle className="h-5 w-5" /> Salary Locked
                  </div>
                  {receiptUrls.length > 0 && (
                    <div className="space-y-1">
                      {receiptUrls.map((url, idx) => (
                        <AttachmentPreview key={idx} url={url} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Revert button - visible for paid or locked */}
              {canRevert && (
                <div className="mt-4 pt-3 border-t border-border print:hidden">
                  <Button
                    variant="outline"
                    className="text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                    onClick={onRevert}
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" /> Revert to Draft
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    This will reset the salary back to draft status for editing.
                  </p>
                </div>
              )}

              {showPartialInput && !isLocked && !isPaid && !isTeacherView && (
                <div className="mt-3 space-y-2 print:hidden">
                  <Textarea
                    placeholder="Reason for partial payment (mandatory)..."
                    value={partialReason}
                    onChange={(e) => setPartialReason(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    disabled={!partialReason.trim() || isPayingPending}
                    onClick={() => {
                      onMarkPaid("partial", partialReason, displayInvoice, receiptUrls);
                      setPartialReason("");
                      setShowPartialInput(false);
                    }}
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

function FeeBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
        <CheckCircle className="h-3 w-3 mr-0.5" />
        PAID
      </Badge>
    );
  }
  if (status === "overdue") {
    return (
      <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
        <XCircle className="h-3 w-3 mr-0.5" />
        OVERDUE
      </Badge>
    );
  }
  // pending, no_invoice, or any other status → show UNPAID
  return (
    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
      <Clock className="h-3 w-3 mr-0.5" />
      UNPAID
    </Badge>
  );
}
