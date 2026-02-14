import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, GraduationCap, PenLine, Printer, Download, Calendar, Users, TrendingUp, BookOpen, Target, Brain, ChevronDown } from 'lucide-react';
import { TemplateStructure, StoredCriteriaEntry, calculateSectionMaxScore } from '@/types/reportCard';
import { supabase } from '@/integrations/supabase/client';
import logoLight from '@/assets/logo-light.png';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Types ───────────────────────────────────────────────────────────
export type ReportViewMode = 'admin' | 'teacher' | 'examiner' | 'student' | 'parent' | 'pdf';

interface StudentReport {
  id: string;
  template_id: string;
  student_id: string;
  examiner_id: string | null;
  total_marks: number;
  max_total_marks: number;
  percentage: number;
  criteria_values_json: StoredCriteriaEntry[] | null;
  examiner_remarks: string | null;
  public_remarks: string | null;
  exam_date: string;
  created_at: string;
  student: { id: string; full_name: string; email?: string } | null;
  template: {
    id: string;
    name: string;
    tenure: string;
    structure_json: TemplateStructure | null;
    subject: { id: string; name: string } | null;
  } | null;
}

interface ReportCardCertificateProps {
  report: StudentReport;
  showInternalNotes?: boolean;
  viewMode?: ReportViewMode;
  printMode?: boolean;
}

const hasArabicUrdu = (text: string): boolean =>
  /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

const canSeeInternalNotes = (mode: ReportViewMode) =>
  mode === 'admin' || mode === 'examiner' || mode === 'teacher';

export function ReportCardCertificate({ report, showInternalNotes = false, viewMode = 'admin', printMode = false }: ReportCardCertificateProps) {
  const showNotes = showInternalNotes && canSeeInternalNotes(viewMode);

  const examMonth = report.exam_date ? new Date(report.exam_date) : new Date();
  const monthStart = new Date(examMonth.getFullYear(), examMonth.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(examMonth.getFullYear(), examMonth.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: attendanceData } = useQuery({
    queryKey: ['report-attendance', report.student_id, monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', report.student_id)
        .gte('class_date', monthStart)
        .lte('class_date', monthEnd);
      if (error) return { present: 0, absent: 0, total: 0, percentage: 0 };
      const present = (data || []).filter(a => a.status === 'present' || a.status === 'completed').length;
      const absent = (data || []).filter(a => a.status === 'absent' || a.status === 'absent_teacher' || a.status === 'absent_student').length;
      const total = (data || []).length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      return { present, absent, total, percentage };
    },
    enabled: !!report.student_id,
  });

  const { data: previousReports = [] } = useQuery({
    queryKey: ['previous-reports', report.student_id, report.template_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exams')
        .select('id, exam_date, percentage, total_marks, max_total_marks')
        .eq('student_id', report.student_id)
        .eq('template_id', report.template_id)
        .neq('id', report.id)
        .order('exam_date', { ascending: false })
        .limit(3);
      if (error) return [];
      return data || [];
    },
    enabled: !!report.student_id && !!report.template_id,
  });

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try { return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return '-'; }
  };

  const getMonth = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try { return new Date(dateString).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); } catch { return '-'; }
  };

  const getGradeInfo = (pct: number) => {
    if (isNaN(pct)) return { code: 'N/A', label: 'N/A', arabic: '', style: 'bg-muted text-muted-foreground' };
    if (pct >= 90) return { code: 'A+', label: 'A+', arabic: 'ممتاز مرتفع', style: 'bg-cyan-500 text-white' };
    if (pct >= 80) return { code: 'A', label: 'A', arabic: 'ممتاز', style: 'bg-cyan-400 text-white' };
    if (pct >= 70) return { code: 'B', label: 'B', arabic: 'جيد جداً', style: 'bg-blue-500 text-white' };
    if (pct >= 60) return { code: 'C', label: 'C', arabic: 'جيد', style: 'bg-amber-500 text-white' };
    if (pct >= 50) return { code: 'D', label: 'D', arabic: 'مقبول', style: 'bg-orange-500 text-white' };
    return { code: 'F', label: 'F', arabic: 'راسب', style: 'bg-red-500 text-white' };
  };

  const gradeInfo = getGradeInfo(report.percentage);
  const attendance = attendanceData || { present: 0, absent: 0, total: 0, percentage: 0 };

  const handlePrint = (mode: 'student' | 'staff' = 'staff') => {
    const roleParam = viewMode || 'admin';
    const url = `/reports/print/${report.id}?mode=${mode}&view=${roleParam}`;
    window.open(url, '_blank');
  };

  const isStaffView = canSeeInternalNotes(viewMode);

  return (
    <div className={`${printMode ? '' : 'bg-slate-100 p-4 sm:p-6'} print:bg-white print:p-0 print:m-0`} id="report-print-root">
      {/* Action Buttons - Hide on print and in printMode */}
      {!printMode && (
      <div className="max-w-4xl mx-auto mb-3 flex justify-end gap-2 no-print">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => handlePrint('student')}>
          <Printer className="h-4 w-4" /> Print
        </Button>
        {isStaffView ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-white">
                <Download className="h-4 w-4" /> Download PDF <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlePrint('student')}>
                <Users className="h-4 w-4 mr-2" /> Student Copy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint('staff')}>
                <PenLine className="h-4 w-4 mr-2" /> Full Report (with Internal Notes)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-white" onClick={() => handlePrint('student')}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        )}
      </div>
      )}

      {/* A4 Certificate Container */}
      <div className="report-a4-container max-w-4xl mx-auto bg-white rounded-xl shadow-xl overflow-hidden print:rounded-none print:shadow-none print:overflow-hidden">

        {/* ===== HEADER ===== */}
        <div className="bg-navy-900 px-6 py-4 relative report-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoLight} alt="Academy" className="h-10 w-10 rounded-lg object-contain bg-white/10 p-0.5" />
              <div>
                <h1 className="text-white font-serif text-lg font-bold leading-tight">Al-Quran Time Academy</h1>
                <p className="text-cyan-400 text-xs">Excellence in Quranic Education</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <Badge className="bg-cyan-500 text-white px-3 py-0.5 text-xs font-semibold capitalize">
                {report.template?.tenure || 'Assessment'}
              </Badge>
              <p className="text-white/60 text-xs">{getMonth(report.exam_date)}</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500" />
        </div>

        {/* ===== STUDENT DETAILS ===== */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 report-section">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Student</p>
              <p className="text-sm font-bold text-navy-900">{report.student?.full_name || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Student ID</p>
              <p className="text-xs font-semibold text-navy-900 font-mono">ID{report.student_id?.slice(0, 8).toUpperCase()}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subject</p>
              <p className="text-xs font-semibold text-navy-900">{report.template?.subject?.name || 'General'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Period</p>
              <p className="text-xs font-semibold text-navy-900">{getMonth(report.exam_date)}</p>
            </div>
          </div>
        </div>

        {/* ===== KPI STRIP (Compact Horizontal) ===== */}
        <div className="px-6 py-3 report-section">
          <div className="grid grid-cols-3 gap-3">
            {/* Score */}
            <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Overall Score</p>
              <p className="text-xl font-bold text-navy-900">
                {report.total_marks}<span className="text-sm text-muted-foreground font-normal">/{report.max_total_marks}</span>
              </p>
              <p className="text-xs text-muted-foreground">{report.percentage}%</p>
            </div>
            {/* Attendance */}
            <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Attendance</p>
              <p className="text-xl font-bold text-navy-900">
                {attendance.present}<span className="text-sm text-muted-foreground font-normal">/{attendance.total}</span>
              </p>
              <p className="text-xs text-muted-foreground">{attendance.percentage}%</p>
            </div>
            {/* Grade */}
            <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Grade</p>
              <div className="flex items-center justify-center gap-1.5">
                <Badge className={`px-2 py-0.5 text-sm font-bold rounded ${gradeInfo.style}`}>
                  {gradeInfo.code}
                </Badge>
                {gradeInfo.arabic && (
                  <span className="urdu-text text-sm font-bold text-navy-900">{gradeInfo.arabic}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== ASSESSMENT BREAKDOWN (Compact Table) ===== */}
        {report.template?.structure_json?.sections && (
          <div className="px-6 py-3 report-section">
            <h3 className="text-sm font-bold text-navy-900 mb-2 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-cyan-500" /> Assessment Breakdown
            </h3>
            
            {/* Desktop Table Header */}
            <div className="hidden sm:grid bg-gray-50 rounded-t-lg px-3 py-2 grid-cols-12 gap-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-gray-200">
              <div className="col-span-5">Criteria</div>
              <div className="col-span-2 text-center">Score</div>
              <div className="col-span-2 text-center">Max</div>
              <div className="col-span-3 text-center">Grade</div>
            </div>

            <div className="border border-gray-200 sm:border-t-0 rounded-lg sm:rounded-t-none overflow-hidden">
              {(report.template?.structure_json?.sections ?? []).map((section, sIdx) => {
                const sectionMax = calculateSectionMaxScore(section);
                const sectionObtained = section.criteria?.reduce((sum, c) => {
                  const row = (report.criteria_values_json ?? []).find(r => r.criteria_name === c.criteria_name);
                  return sum + (row?.obtained_marks ?? 0);
                }, 0) ?? 0;

                return (
                  <div key={sIdx} className="report-section">
                    {section.title && (
                      <div className="bg-navy-900/5 px-3 py-1.5 flex items-center justify-between">
                        <h4 className={`text-xs font-semibold text-navy-900 ${hasArabicUrdu(section.title) ? 'urdu-text text-sm' : ''}`}>
                          {section.title}
                        </h4>
                        {section.showSubtotal !== false && sectionMax > 0 && (
                          <span className="text-xs text-muted-foreground">{sectionObtained}/{sectionMax}</span>
                        )}
                      </div>
                    )}

                    {section.criteria?.map((criterion, cIdx) => {
                      const row = (report.criteria_values_json ?? []).find(
                        (r) => r.criteria_name === criterion.criteria_name && r.max_marks === criterion.max_marks
                      ) ?? (report.criteria_values_json ?? []).find((r) => r.criteria_name === criterion.criteria_name);

                      const obtained = typeof row?.obtained_marks === 'number' ? row.obtained_marks : 0;
                      const max = typeof row?.max_marks === 'number' ? row.max_marks : criterion.max_marks;
                      const pct = max > 0 ? Math.round((obtained / max) * 100) : 0;
                      const progressColor = pct >= 80 ? 'bg-cyan-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400';
                      const rowGrade = getGradeInfo(pct);

                      return (
                        <div key={cIdx}>
                          {/* Desktop row */}
                          <div className="hidden sm:grid grid-cols-12 gap-3 items-center px-3 py-1.5 border-b border-gray-100 last:border-b-0 text-xs">
                            <div className="col-span-5 flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden shrink-0">
                                <div className={`h-full ${progressColor}`} style={{ width: `${pct}%` }} />
                              </div>
                              <p className={`font-medium text-navy-900 leading-tight ${hasArabicUrdu(criterion.criteria_name) ? 'urdu-text text-sm' : ''}`}>
                                {criterion.criteria_name}
                              </p>
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="font-semibold text-navy-900">{obtained}</span>
                            </div>
                            <div className="col-span-2 text-center text-muted-foreground">{max}</div>
                            <div className="col-span-3 text-center">
                              <span className="font-medium">{rowGrade.code} {rowGrade.arabic && <span className="urdu-text">{rowGrade.arabic}</span>}</span>
                            </div>
                          </div>

                          {/* Mobile stacked card */}
                          <div className="sm:hidden border-b border-gray-100 last:border-b-0 px-3 py-2 space-y-1">
                            <p className={`font-medium text-navy-900 ${hasArabicUrdu(criterion.criteria_name) ? 'urdu-text text-base' : 'text-xs'}`}>
                              {criterion.criteria_name}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs"><span className="font-semibold">{obtained}</span>/{max}</span>
                              <span className="text-xs font-medium">{rowGrade.code} {rowGrade.arabic && <span className="urdu-text">{rowGrade.arabic}</span>}</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div className={`h-full ${progressColor}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Grand Total Row */}
              <div className="hidden sm:grid bg-navy-900/5 grid-cols-12 gap-3 items-center px-3 py-2 border-t border-gray-200 text-xs">
                <div className="col-span-5 font-bold text-navy-900">Total</div>
                <div className="col-span-2 text-center font-bold text-navy-900">{report.total_marks}</div>
                <div className="col-span-2 text-center font-semibold text-muted-foreground">{report.max_total_marks}</div>
                <div className="col-span-3 text-center flex items-center justify-center gap-1">
                  <Badge className={`font-bold px-2 py-0 text-xs ${gradeInfo.style}`}>{gradeInfo.code} — {report.percentage}%</Badge>
                  {gradeInfo.arabic && <span className="urdu-text font-bold text-xs">{gradeInfo.arabic}</span>}
                </div>
              </div>
              {/* Mobile total */}
              <div className="sm:hidden bg-navy-900/5 px-3 py-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy-900 text-xs">Total: {report.total_marks}/{report.max_total_marks}</span>
                  <div className="flex items-center gap-1">
                    <Badge className={`font-bold px-2 py-0 text-xs ${gradeInfo.style}`}>{gradeInfo.code} {report.percentage}%</Badge>
                    {gradeInfo.arabic && <span className="urdu-text font-bold text-sm">{gradeInfo.arabic}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== EXAMINER'S COMMENTS ===== */}
        <div className="px-6 py-3 border-t border-gray-100 report-section">
          <h3 className="text-sm font-bold text-navy-900 mb-2 flex items-center gap-1.5">
            <PenLine className="h-4 w-4 text-cyan-500" /> Examiner's Comments
          </h3>
          {report.public_remarks ? (
            <div className="bg-amber-50 rounded-lg p-3 border-l-4 border-amber-400">
              <p className={`text-xs text-navy-900 leading-relaxed ${hasArabicUrdu(report.public_remarks) ? 'urdu-text text-sm' : ''}`}>
                {report.public_remarks}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No comments provided.</p>
          )}

          {/* Internal Notes - NOT rendered for student/parent */}
          {showNotes && report.examiner_remarks && (
            <div className="mt-2 bg-red-50 rounded-lg p-3 border-l-4 border-red-400 internal-notes-section">
              <p className="text-[10px] font-medium text-red-700 mb-1">Internal Notes (Staff Only)</p>
              <p className={`text-xs text-red-900 ${hasArabicUrdu(report.examiner_remarks) ? 'urdu-text text-sm' : ''}`}>
                {report.examiner_remarks}
              </p>
            </div>
          )}
        </div>

        {/* ===== COMPACT 3-COLUMN: Attendance + Planning + Progress ===== */}
        <div className="px-6 py-3 border-t border-gray-100 report-section">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Attendance Summary */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Users className="h-3 w-3" /> Attendance Snapshot
              </p>
              <div className="text-xs space-y-0.5">
                <div className="flex justify-between"><span>Present</span><span className="font-semibold">{attendance.present}</span></div>
                <div className="flex justify-between"><span>Absent</span><span className="font-semibold">{attendance.absent}</span></div>
                <div className="flex justify-between"><span>Rate</span><span className="font-semibold">{attendance.percentage}%</span></div>
              </div>
            </div>

            {/* Planning Placeholder */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Target className="h-3 w-3" /> Planning Snapshot
              </p>
              <div className="text-xs space-y-0.5 text-muted-foreground">
                <div className="flex justify-between"><span>Target</span><span>—</span></div>
                <div className="flex justify-between"><span>Completed</span><span>—</span></div>
                <div className="flex justify-between"><span>Status</span><span>—</span></div>
              </div>
            </div>

            {/* Previous Results */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Previous Results
              </p>
              {previousReports.length > 0 ? (
                <div className="text-xs space-y-0.5">
                  {previousReports.slice(0, 3).map((prev, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate mr-2">{getMonth(prev.exam_date)}</span>
                      <span className="font-semibold">{prev.percentage}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No previous data</p>
              )}
            </div>
          </div>
        </div>

        {/* ===== AI PROGRESS SUMMARY PLACEHOLDER ===== */}
        <div className="px-6 py-3 border-t border-gray-100 report-section">
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-3 border border-cyan-200/50 text-center">
            <div className="flex items-center justify-center gap-2">
              <Brain className="h-4 w-4 text-cyan-400" />
              <p className="text-xs font-medium text-navy-900">Overall Progress Summary</p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">(Automated academic analysis will appear here)</p>
          </div>
        </div>

        {/* ===== SIGNATURE FOOTER ===== */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 report-section">
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="h-10 border-b-2 border-dotted border-gray-300 mb-1" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Examiner's Signature</p>
            </div>
            <div className="text-center">
              <div className="h-10 border-b-2 border-dotted border-gray-300 mb-1" />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Principal's Signature</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground border-t border-gray-200 pt-2">
            <p>Date of Issue: {formatDate(report.exam_date)}</p>
            <p className="italic">Generated by Al-Quran Time Academy LMS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
