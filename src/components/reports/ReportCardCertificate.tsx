import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
}

// Helper to detect if text contains Arabic/Urdu characters
const hasArabicUrdu = (text: string): boolean => {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
};

const canSeeInternalNotes = (mode: ReportViewMode) =>
  mode === 'admin' || mode === 'examiner' || mode === 'teacher';

export function ReportCardCertificate({ report, showInternalNotes = false, viewMode = 'admin' }: ReportCardCertificateProps) {
  // Derive effective internal notes visibility from both props
  const showNotes = showInternalNotes && canSeeInternalNotes(viewMode);

  // Fetch attendance summary for the same student and month
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

  // Fetch previous reports for trend display
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
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  const getMonth = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    } catch {
      return '-';
    }
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

  // ─── PDF Generation ─────────────────────────────────────────────
  const handlePrint = (mode: 'student' | 'staff' = 'staff') => {
    // Set a data attribute so print CSS can conditionally hide internal notes
    const printRoot = document.getElementById('report-print-root');
    if (printRoot) {
      printRoot.setAttribute('data-print-mode', mode);
    }
    window.print();
    // Clean up
    if (printRoot) {
      printRoot.removeAttribute('data-print-mode');
    }
  };

  const isStaffView = canSeeInternalNotes(viewMode);

  return (
    <div className="bg-slate-100 p-4 sm:p-8 min-h-screen print-certificate" id="report-print-root">
      {/* Action Buttons - Hide on print */}
      <div className="max-w-4xl mx-auto mb-4 flex justify-end gap-2 no-print">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => handlePrint('student')}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
        {isStaffView ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-white">
                <Download className="h-4 w-4" />
                Download PDF
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handlePrint('student')}>
                <Users className="h-4 w-4 mr-2" />
                Student Version
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrint('staff')}>
                <PenLine className="h-4 w-4 mr-2" />
                Staff Version (with Internal Notes)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-white" onClick={() => handlePrint('student')}>
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        )}
      </div>

      {/* The "Digital A4" Certificate Container */}
      <div className="report-a4-container max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden print:rounded-none print:shadow-none">
        
        {/* ===== BRANDED HEADER ===== */}
        <div className="bg-navy-900 px-6 sm:px-10 py-8 relative print:py-6 report-section">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Logo & School Name */}
            <div className="flex items-center gap-4">
              <img 
                src={logoLight} 
                alt="Al-Quran Time Academy" 
                className="h-14 w-14 rounded-lg object-contain bg-white/10 p-1"
              />
              <div>
                <h1 className="text-white font-serif text-xl sm:text-2xl font-bold">
                  Al-Quran Time Academy
                </h1>
                <p className="text-cyan-400 text-sm">Excellence in Quranic Education</p>
              </div>
            </div>
            
            {/* Report Title + Tenure Badge */}
            <div className="text-center sm:text-right flex flex-col items-end gap-2">
              <Badge className="bg-cyan-500 text-white px-4 py-1.5 text-sm font-semibold capitalize">
                {report.template?.tenure || 'Assessment'}
              </Badge>
              <p className="text-white/60 text-sm">{getMonth(report.exam_date)}</p>
            </div>
          </div>
          
          {/* Cyan Accent Strip */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500" />
        </div>

        {/* ===== STUDENT DETAILS SECTION ===== */}
        <div className="px-6 sm:px-10 py-6 border-b border-gray-100 bg-gray-50/50 report-section print:py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Student Name</p>
              <p className="text-lg font-bold text-navy-900">
                {report.student?.full_name || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Student ID</p>
              <p className="text-sm font-semibold text-navy-900 font-mono">
                ID{report.student_id?.slice(0, 8).toUpperCase() || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
              <p className="text-sm font-semibold text-navy-900">
                {report.template?.subject?.name || 'General'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Period</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cyan-500" />
                <p className="text-sm font-semibold text-navy-900">
                  {getMonth(report.exam_date)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ===== SCORE + ATTENDANCE + GRADE CARDS ===== */}
        <div className="px-6 sm:px-10 py-6 report-section print:py-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Overall Score Card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Award className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-sm text-muted-foreground">Overall Score</p>
              </div>
              <p className="text-3xl font-bold text-navy-900">
                {report.total_marks} <span className="text-lg text-muted-foreground font-normal">/ {report.max_total_marks}</span>
              </p>
              <div className="mt-2">
                <Progress value={report.percentage} className="h-2" />
                <p className="text-right text-sm text-muted-foreground mt-1">{report.percentage}%</p>
              </div>
            </div>

            {/* Attendance Card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-cyan-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-cyan-600" />
                </div>
                <p className="text-sm text-muted-foreground">Attendance this Month</p>
              </div>
              <p className="text-3xl font-bold text-navy-900">
                {attendance.present} <span className="text-lg text-muted-foreground font-normal">/ {attendance.total}</span>
                <span className="text-lg text-muted-foreground font-normal"> = {attendance.percentage}%</span>
              </p>
            </div>

            {/* Grade Badge Card */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">Grade</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`px-4 py-2 text-lg font-bold rounded-lg ${gradeInfo.style}`}>
                  {gradeInfo.code}
                </Badge>
                {gradeInfo.arabic && (
                  <span className="urdu-text text-lg font-bold text-navy-900">{gradeInfo.arabic}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== ASSESSMENT BREAKDOWN ===== */}
        {report.template?.structure_json?.sections && (
          <div className="px-6 sm:px-10 py-6 report-section print:py-4">
            <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-cyan-500" />
              Assessment Breakdown
            </h3>
            
            {/* Desktop Table Header - hidden on mobile */}
            <div className="hidden sm:grid bg-gray-50 rounded-t-lg px-4 py-3 grid-cols-12 gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-gray-200">
              <div className="col-span-5">Criteria</div>
              <div className="col-span-2 text-center">Obtained</div>
              <div className="col-span-2 text-center">Max</div>
              <div className="col-span-3 text-center">Grade</div>
            </div>

            {/* Sections & Criteria */}
            <div className="border border-gray-200 sm:border-t-0 rounded-lg sm:rounded-t-none overflow-hidden">
              {(report.template?.structure_json?.sections ?? []).map((section, sIdx) => {
                const sectionMax = calculateSectionMaxScore(section);
                const sectionObtained = section.criteria?.reduce((sum, c) => {
                  const row = (report.criteria_values_json ?? []).find(r => r.criteria_name === c.criteria_name);
                  return sum + (row?.obtained_marks ?? 0);
                }, 0) ?? 0;

                return (
                  <div key={sIdx} className="report-section">
                    {/* Section Header */}
                    {section.title && (
                      <div className="bg-navy-900/5 px-4 py-2.5 flex items-center justify-between">
                        <h4 className={`font-semibold text-navy-900 ${hasArabicUrdu(section.title) ? 'urdu-text' : ''}`}>
                          {section.title}
                        </h4>
                        {section.showSubtotal !== false && sectionMax > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {sectionObtained} / {sectionMax}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Criteria Rows */}
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
                          <div className="hidden sm:grid grid-cols-12 gap-4 items-center px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                            <div className="col-span-5 flex items-center gap-3">
                              <div className="w-24 h-2 rounded-full bg-gray-200 overflow-hidden print:w-16">
                                <div className={`h-full ${progressColor}`} style={{ width: `${pct}%` }} />
                              </div>
                              <p className={`text-sm font-medium text-navy-900 ${hasArabicUrdu(criterion.criteria_name) ? 'urdu-text' : ''}`}>
                                {criterion.criteria_name}
                              </p>
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="font-semibold text-navy-900">{obtained}</span>
                              <span className="text-muted-foreground text-sm"> / {max}</span>
                            </div>
                            <div className="col-span-2 text-center text-muted-foreground">
                              {max}
                            </div>
                            <div className="col-span-3 text-center">
                              <Badge variant="outline" className="font-medium gap-1">
                                {rowGrade.code} {pct}%
                              </Badge>
                            </div>
                          </div>

                          {/* Mobile stacked card */}
                          <div className="sm:hidden border-b border-gray-100 last:border-b-0 px-4 py-3 space-y-2">
                            <p className={`font-medium text-navy-900 ${hasArabicUrdu(criterion.criteria_name) ? 'urdu-text text-lg' : 'text-sm'}`}>
                              {criterion.criteria_name}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">
                                <span className="font-semibold text-navy-900">{obtained}</span>
                                <span className="text-muted-foreground"> / {max}</span>
                              </span>
                              <Badge variant="outline" className="font-medium text-xs gap-1">
                                {rowGrade.code} {rowGrade.arabic && <span className="urdu-text">{rowGrade.arabic}</span>} {pct}%
                              </Badge>
                            </div>
                            <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div className={`h-full ${progressColor}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Grand Total Row - Desktop */}
              <div className="hidden sm:grid bg-navy-900/5 grid-cols-12 gap-4 items-center px-4 py-4 border-t border-gray-200">
                <div className="col-span-5 font-bold text-navy-900">Total</div>
                <div className="col-span-2 text-center">
                  <span className="font-bold text-navy-900">{report.total_marks}</span>
                  <span className="text-muted-foreground"> / {report.max_total_marks}</span>
                </div>
                <div className="col-span-2 text-center font-semibold text-muted-foreground">
                  {report.max_total_marks}
                </div>
                <div className="col-span-3 text-center flex items-center justify-center gap-2">
                  <Badge className={`font-bold px-3 ${gradeInfo.style}`}>
                    {gradeInfo.code} — {report.percentage}%
                  </Badge>
                  {gradeInfo.arabic && <span className="urdu-text font-bold text-sm">{gradeInfo.arabic}</span>}
                </div>
              </div>

              {/* Grand Total Row - Mobile */}
              <div className="sm:hidden bg-navy-900/5 px-4 py-4 border-t border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy-900">Total</span>
                  <span>
                    <span className="font-bold text-navy-900">{report.total_marks}</span>
                    <span className="text-muted-foreground"> / {report.max_total_marks}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge className={`font-bold px-3 ${gradeInfo.style}`}>
                    {gradeInfo.code} — {report.percentage}%
                  </Badge>
                  {gradeInfo.arabic && <span className="urdu-text font-bold text-lg">{gradeInfo.arabic}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== COMMENTS & REMARKS ===== */}
        <div className="px-6 sm:px-10 py-6 border-t border-gray-100 report-section print:py-4">
          <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
            <PenLine className="h-5 w-5 text-cyan-500" />
            Examiner's Comments
          </h3>
          
          {report.public_remarks ? (
            <div className="bg-amber-50 rounded-lg p-5 border-l-4 border-amber-400">
              <p className={`text-navy-900 leading-relaxed ${hasArabicUrdu(report.public_remarks) ? 'urdu-text' : ''}`}>
                {report.public_remarks}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground italic">No comments provided.</p>
          )}
          
          {/* Internal Notes - NOT rendered in DOM for student/parent views */}
          {showNotes && report.examiner_remarks && (
            <div className="mt-4 bg-red-50 rounded-lg p-5 border-l-4 border-red-400 internal-notes-section">
              <p className="text-sm font-medium text-red-700 mb-2">Internal Notes (Staff Only)</p>
              <p className={`text-red-900 ${hasArabicUrdu(report.examiner_remarks) ? 'urdu-text' : ''}`}>
                {report.examiner_remarks}
              </p>
            </div>
          )}
        </div>

        {/* ===== PLANNING SNAPSHOT (Placeholder) ===== */}
        <div className="px-6 sm:px-10 py-6 border-t border-gray-100 report-section print:py-4">
          <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-cyan-500" />
            Planning Snapshot
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monthly Target</p>
              <p className="text-lg font-bold text-navy-900">—</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Completed</p>
              <p className="text-lg font-bold text-navy-900">—</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
              <p className="text-lg font-bold text-navy-900">—</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">Planning data will be populated from monthly plans.</p>
        </div>

        {/* ===== OVERALL PROGRESS SUMMARY (AI Placeholder) ===== */}
        <div className="px-6 sm:px-10 py-6 border-t border-gray-100 report-section print:py-4">
          <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
            <Brain className="h-5 w-5 text-cyan-500" />
            Overall Progress Summary
          </h3>
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-6 border border-cyan-200/50 text-center">
            <BookOpen className="h-8 w-8 mx-auto mb-3 text-cyan-400" />
            <p className="text-sm font-medium text-navy-900">Automated academic analysis will appear here</p>
            <p className="text-xs text-muted-foreground mt-1">AI-powered progress summary coming soon</p>
          </div>
        </div>

        {/* ===== PREVIOUS RESULTS ===== */}
        {previousReports.length > 0 && (
          <div className="px-6 sm:px-10 py-6 border-t border-gray-100 report-section print:py-4">
            <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-500" />
              Previous Results
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {previousReports.map((prev, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-navy-900">{getMonth(prev.exam_date)}</p>
                  <div className="mt-2">
                    <Progress value={prev.percentage} className="h-1.5" />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{prev.percentage}%</span>
                      <span className="text-xs text-muted-foreground">{prev.total_marks}/{prev.max_total_marks}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== SIGNATURES FOOTER ===== */}
        <div className="px-6 sm:px-10 py-8 bg-gray-50 border-t border-gray-200 report-section print:py-6">
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="h-16 border-b-2 border-dotted border-gray-300 mb-2" />
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Examiner's Signature
              </p>
            </div>
            <div className="text-center">
              <div className="h-16 border-b-2 border-dotted border-gray-300 mb-2" />
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Principal's Signature
              </p>
            </div>
          </div>
          
          {/* Date & Footer */}
          <div className="mt-8 flex items-center justify-between text-sm text-muted-foreground border-t border-gray-200 pt-4">
            <p>Date of Issue: {formatDate(report.exam_date)}</p>
            <p className="italic">Generated by Al-Quran Time Academy LMS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
