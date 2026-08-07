import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Copy, Loader2, FileText } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo-dark.jpg";
import { normalizeAttendanceStatus, isPresentStatus, isAbsentStatus, isLeaveStatus, attendanceStatusLabel } from '@/lib/attendanceStatus';

type AttRow = {
  id: string;
  status: string;
  class_date: string;
  student_id: string;
  teacher_id: string;
  lesson_covered?: string | null;
  student?: { full_name?: string } | null;
  teacher?: { full_name?: string } | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  attendance: AttRow[];
  dateFrom: string;
  dateTo: string;
  preselectedStudentId?: string;
}

const dayName = (d: string) => format(new Date(d + "T00:00:00"), "EEE");
const fmtDate = (d: string) => format(new Date(d + "T00:00:00"), "dd MMM yyyy");

const statusPill = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "present" || s === "late")
    return { bg: "#dcfce7", color: "#15803d", label: s === "late" ? "Late" : "Present" };
  if (s === "leave" || s === "excused" || s === "student_leave" || s === "teacher_leave")
    return { bg: "#fef3c7", color: "#b45309", label: s === "teacher_leave" ? "Teacher Leave" : "Student Leave" };
  if (s === "holiday")
    return { bg: "#e0e7ff", color: "#4338ca", label: "Holiday" };
  if (s === "rescheduled" || s === "reschedule" || s === "make_up" || s === "makeup")
    return { bg: "#dbeafe", color: "#1d4ed8", label: "Rescheduled" };
  if (s === "cancelled" || s === "canceled")
    return { bg: "#e5e7eb", color: "#374151", label: "Cancelled" };
  if (isLeaveStatus(s))
    return { bg: "#fef3c7", color: "#b45309", label: attendanceStatusLabel(s) };
  if (!s || isAbsentStatus(s))
    return { bg: "#fee2e2", color: "#b91c1c", label: "Absent" };
  // Unknown status — show raw label instead of misclassifying as Absent
  return { bg: "#e5e7eb", color: "#374151", label: status };
};

export default function SendAttendanceReportDialog({
  open, onOpenChange, attendance, dateFrom, dateTo, preselectedStudentId,
}: Props) {
  const students = useMemo(() => {
    const map = new Map<string, { id: string; name: string; teacher: string }>();
    attendance.forEach(r => {
      if (!map.has(r.student_id)) {
        map.set(r.student_id, {
          id: r.student_id,
          name: r.student?.full_name || "Unknown",
          teacher: r.teacher?.full_name || "—",
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [attendance]);

  const [studentId, setStudentId] = useState<string>(preselectedStudentId || students[0]?.id || "");
  const [from, setFrom] = useState(dateFrom);
  const [to, setTo] = useState(dateTo);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const studentRows = useMemo(() => {
    return attendance
      .filter(r => r.student_id === studentId && r.class_date >= from && r.class_date <= to)
      .sort((a, b) => a.class_date.localeCompare(b.class_date));
  }, [attendance, studentId, from, to]);

  const student = students.find(s => s.id === studentId);
  const stats = useMemo(() => {
    const total = studentRows.length;
    const present = studentRows.filter(r => ["present", "late"].includes((r.status || "").toLowerCase())).length;
    const leave = studentRows.filter(r => ["leave", "excused"].includes((r.status || "").toLowerCase())).length;
    const absent = total - present - leave;
    const rate = total ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, leave, rate };
  }, [studentRows]);

  const initials = (student?.name || "S").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  const buildPdf = async (): Promise<Blob> => {
    const node = previewRef.current!;
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    return pdf.output("blob");
  };

  const fileName = () =>
    `attendance_${(student?.name || "student").replace(/[^a-z0-9]+/gi, "_")}_${from}_${to}.pdf`;

  const downloadPdf = async () => {
    if (!student) return;
    setBusy(true);
    try {
      const blob = await buildPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName(); a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (e: any) {
      toast.error("PDF generation failed", { description: e.message });
    } finally { setBusy(false); }
  };

  const copyWhatsAppLink = async () => {
    if (!student) return;
    setBusy(true);
    try {
      const blob = await buildPdf();
      const path = `${studentId}/${Date.now()}_${fileName()}`;
      const { error } = await supabase.storage.from("reports-exports").upload(path, blob, {
        contentType: "application/pdf", upsert: true,
      });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("reports-exports").createSignedUrl(path, 60 * 60 * 24 * 30);
      if (signErr) throw signErr;
      const text = `Assalamu Alaikum,\n\nAttendance report for *${student.name}*\nPeriod: ${fmtDate(from)} – ${fmtDate(to)}\nPresent: ${stats.present}/${stats.total} (${stats.rate}%)\n\nDownload PDF: ${signed.signedUrl}\n\n— Al-Quran Time Academy LMS`;
      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
      await navigator.clipboard.writeText(wa);
      window.open(wa, "_blank");
      toast.success("WhatsApp link copied & opened");
    } catch (e: any) {
      toast.error("Failed to create share link", { description: e.message });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Send Attendance Report</DialogTitle>
        </DialogHeader>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        {/* PDF Preview */}
        <div className="border rounded-lg overflow-hidden bg-muted/30 p-4">
          <div
            ref={previewRef}
            style={{
              width: "794px", margin: "0 auto", background: "#ffffff",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: "#0f172a",
            }}
          >
            {/* Header strip */}
            <div style={{ background: "hsl(216 70% 11%)", color: "#fff", padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.2 }}>Attendance Report</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                  Period: {fmtDate(from)} – {fmtDate(to)}
                </div>
              </div>
              <img src={logo} alt="Al-Quran Time Academy" crossOrigin="anonymous" style={{ height: 56, width: "auto", background: "#fff", borderRadius: 6, padding: 4 }} />
            </div>

            {/* Student block */}
            <div style={{ padding: "20px 28px", display: "flex", gap: 16, alignItems: "center", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 999, background: "hsl(197 100% 45%)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 700,
              }}>{initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{student?.name || "—"}</div>
                <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>Teacher: {student?.teacher || "—"}</div>
              </div>
            </div>

            {/* Stat badges */}
            <div style={{ padding: "16px 28px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[
                { label: "Classes", value: stats.total },
                { label: "Present", value: stats.present },
                { label: "Absent", value: stats.absent },
                { label: "Rate", value: `${stats.rate}%` },
              ].map(b => (
                <div key={b.label} style={{
                  border: "1px solid hsl(197 100% 45% / 0.3)", borderRadius: 10,
                  padding: "12px 8px", textAlign: "center",
                  background: "linear-gradient(180deg, hsl(197 100% 45% / 0.08), #fff)",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "hsl(197 90% 35%)" }}>{b.value}</div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={{ padding: "0 28px 16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "hsl(216 70% 11% / 0.04)", color: "#0f172a" }}>
                    <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid hsl(216 70% 11%)" }}>Date</th>
                    <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid hsl(216 70% 11%)" }}>Day</th>
                    <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid hsl(216 70% 11%)" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid hsl(216 70% 11%)" }}>Lesson Covered</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No attendance records in this period.</td></tr>
                  )}
                  {studentRows.map(r => {
                    const p = statusPill(r.status);
                    const lesson = (r.lesson_covered || "").trim();
                    const isArabic = /[\u0600-\u06FF]/.test(lesson);
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px" }}>{fmtDate(r.class_date)}</td>
                        <td style={{ padding: "8px 10px", color: "#475569" }}>{dayName(r.class_date)}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{
                            background: p.bg, color: p.color, padding: "3px 10px",
                            borderRadius: 999, fontSize: 11, fontWeight: 600,
                          }}>{p.label}</span>
                        </td>
                        <td style={{
                          padding: "8px 10px",
                          fontFamily: isArabic ? "'Amiri', serif" : "inherit",
                          direction: isArabic ? "rtl" : "ltr",
                          fontSize: isArabic ? 14 : 12,
                        }}>{lesson || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{
              padding: "12px 28px 18px", borderTop: "1px solid #e2e8f0",
              fontSize: 10.5, color: "#94a3b8", textAlign: "center",
            }}>
              Generated by Al-Quran Time Academy LMS · {format(new Date(), "dd MMM yyyy, HH:mm")}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Close</Button>
          <Button variant="secondary" onClick={copyWhatsAppLink} disabled={busy || !student}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
            Copy WhatsApp Link
          </Button>
          <Button onClick={downloadPdf} disabled={busy || !student}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
