import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Award, GraduationCap, PenLine } from 'lucide-react';
import { TemplateStructure, StoredCriteriaEntry, calculateSectionMaxScore } from '@/types/reportCard';
import logoLight from '@/assets/logo-light.png';

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
  student: { id: string; full_name: string } | null;
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
}

export function ReportCardCertificate({ report, showInternalNotes = false }: ReportCardCertificateProps) {
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  const getMonth = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  const getGradeInfo = (pct: number) => {
    if (isNaN(pct)) return { label: 'N/A', style: 'bg-muted text-muted-foreground' };
    if (pct >= 90) return { label: 'Mastered', style: 'bg-accent text-accent-foreground' };
    if (pct >= 75) return { label: 'Proficient', style: 'bg-accent/20 text-accent-foreground' };
    if (pct >= 60) return { label: 'Progressing', style: 'bg-info/20 text-info' };
    return { label: 'Beginning', style: 'bg-muted text-muted-foreground' };
  };

  const gradeInfo = getGradeInfo(report.percentage);

  return (
    <div className="bg-slate-100 p-4 sm:p-8 min-h-screen">
      {/* The "Digital A4" Certificate Container */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        
        {/* ===== BRANDED HEADER ===== */}
        <div className="bg-navy-900 px-6 sm:px-10 py-8 relative">
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
            
            {/* Report Title */}
            <div className="text-center sm:text-right">
              <h2 className="text-white text-lg sm:text-xl font-bold tracking-widest uppercase">
                Student Progress Report
              </h2>
              <p className="text-white/60 text-sm mt-1">{report.template?.tenure} Assessment</p>
            </div>
          </div>
          
          {/* Cyan Accent Strip */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500" />
        </div>

        {/* ===== STUDENT DETAILS SECTION ===== */}
        <div className="px-6 sm:px-10 py-8 border-b border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">Student Name</p>
              <p className="text-lg font-bold text-navy-900 mt-1">
                {report.student?.full_name || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">Student ID</p>
              <p className="text-lg font-bold text-navy-900 mt-1">
                {report.student_id?.slice(0, 8).toUpperCase() || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">Subject</p>
              <p className="text-lg font-bold text-navy-900 mt-1">
                {report.template?.subject?.name || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">Period</p>
              <p className="text-lg font-bold text-navy-900 mt-1">
                {getMonth(report.exam_date)}
              </p>
            </div>
          </div>
        </div>

        {/* ===== OVERALL SCORE BANNER ===== */}
        <div className="px-6 sm:px-10 py-6 bg-gradient-to-r from-navy-900/5 to-cyan-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <Award className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">Overall Score</p>
                <p className="text-3xl font-bold text-navy-900">
                  {report.total_marks} <span className="text-lg text-muted-foreground">/ {report.max_total_marks}</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-cyan-600">{report.percentage}%</p>
              <Badge className={`mt-2 px-4 py-1.5 text-sm font-semibold rounded-full ${gradeInfo.style}`}>
                {gradeInfo.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* ===== GRADING GRID (Rubric Style) ===== */}
        {report.template?.structure_json?.sections && (
          <div className="px-6 sm:px-10 py-8">
            <h3 className="text-lg font-bold text-navy-900 mb-6 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-cyan-500" />
              Assessment Breakdown
            </h3>
            
            <div className="space-y-0">
              {(report.template?.structure_json?.sections ?? []).map((section, sIdx) => {
                const sectionMax = calculateSectionMaxScore(section);
                return (
                  <div key={sIdx}>
                    {/* Section Header */}
                    {section.title && (
                      <div className="bg-navy-900/5 px-4 py-3 rounded-t-lg mt-4 first:mt-0 flex items-center justify-between">
                        <h4 className="font-semibold text-navy-900">{section.title}</h4>
                        {section.showSubtotal !== false && sectionMax > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Award className="h-3 w-3 mr-1" /> Max: {sectionMax}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Criteria Rows */}
                    {section.criteria?.map((criterion, cIdx) => {
                      const row = (report.criteria_values_json ?? []).find(
                        (r) => r.criteria_name === criterion.criteria_name && r.max_marks === criterion.max_marks
                      ) ?? (report.criteria_values_json ?? []).find((r) => r.criteria_name === criterion.criteria_name);

                      const obtained = typeof row?.obtained_marks === 'number' ? row.obtained_marks : null;
                      const max = typeof row?.max_marks === 'number' ? row.max_marks : criterion.max_marks;

                      return (
                        <div
                          key={cIdx}
                          className="flex items-center justify-between px-4 py-4 border-b border-dotted border-gray-200 last:border-b-0 hover:bg-gray-50/50 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-navy-900">{criterion.criteria_name}</p>
                            {row?.remarks && (
                              <p className="text-sm text-muted-foreground mt-0.5">{row.remarks}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">Max: {max}</span>
                            <Badge variant="outline" className="px-3 py-1 font-medium">
                              {obtained ?? '--'} / {max}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== COMMENTS & REMARKS ===== */}
        {(report.public_remarks || (showInternalNotes && report.examiner_remarks)) && (
          <div className="px-6 sm:px-10 py-8 border-t border-gray-100">
            <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
              <PenLine className="h-5 w-5 text-cyan-500" />
              Teacher's Comments
            </h3>
            
            {report.public_remarks && (
              <div className="bg-gray-50 rounded-lg p-5 border-l-4 border-cyan-500">
                <p className="text-navy-900 italic leading-relaxed">
                  "{report.public_remarks}"
                </p>
              </div>
            )}
            
            {showInternalNotes && report.examiner_remarks && (
              <div className="mt-4 bg-amber-50 rounded-lg p-5 border-l-4 border-amber-500">
                <p className="text-sm font-medium text-amber-800 mb-2">Internal Notes (Staff Only)</p>
                <p className="text-amber-900">{report.examiner_remarks}</p>
              </div>
            )}
          </div>
        )}

        {/* ===== SIGNATURES FOOTER ===== */}
        <div className="px-6 sm:px-10 py-8 bg-gray-50 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="h-16 border-b-2 border-dotted border-gray-300 mb-2" />
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Teacher's Signature
              </p>
            </div>
            <div className="text-center">
              <div className="h-16 border-b-2 border-dotted border-gray-300 mb-2" />
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Principal's Signature
              </p>
            </div>
          </div>
          
          {/* Date & Official Seal Placeholder */}
          <div className="mt-8 flex items-center justify-between text-sm text-muted-foreground">
            <p>Date of Issue: {formatDate(report.exam_date)}</p>
            <p className="italic">This is an official document of Al-Quran Time Academy</p>
          </div>
        </div>
      </div>
    </div>
  );
}
