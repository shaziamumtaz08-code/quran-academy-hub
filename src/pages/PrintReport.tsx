import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TemplateStructure, StoredCriteriaEntry } from '@/types/reportCard';
import { ReportCardCertificate, ReportViewMode } from '@/components/reports/ReportCardCertificate';

export default function PrintReport() {
  const { reportId } = useParams<{ reportId: string }>();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') || 'staff') as 'student' | 'staff';
  const viewMode = (searchParams.get('view') || 'admin') as ReportViewMode;

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['print-report', reportId],
    queryFn: async () => {
      if (!reportId) throw new Error('No report ID');
      const { data, error } = await supabase
        .from('exams')
        .select(`
          id,
          template_id,
          student_id,
          examiner_id,
          total_marks,
          max_total_marks,
          percentage,
          criteria_values_json,
          examiner_remarks,
          public_remarks,
          exam_date,
          created_at,
          student:profiles!exams_student_id_fkey(id, full_name, email),
          template:exam_templates!exams_template_id_fkey(
            id,
            name,
            tenure,
            structure_json,
            subject:subjects(id, name)
          )
        `)
        .eq('id', reportId)
        .single();

      if (error) throw error;
      return {
        ...data,
        criteria_values_json: data.criteria_values_json as unknown as StoredCriteriaEntry[] | null,
        template: data.template ? {
          ...data.template,
          structure_json: data.template.structure_json as unknown as TemplateStructure | null,
        } : null,
      };
    },
    enabled: !!reportId,
  });

  // Auto-trigger print once data is loaded
  useEffect(() => {
    if (report && !isLoading) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [report, isLoading]);

  if (isLoading) {
    return (
      <div style={{ width: '794px', margin: '0 auto', padding: '40px', textAlign: 'center' }}>
        <p>Loading report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ width: '794px', margin: '0 auto', padding: '40px', textAlign: 'center' }}>
        <p>Failed to load report.</p>
      </div>
    );
  }

  const showInternalNotes = mode === 'staff';
  const effectiveViewMode: ReportViewMode = mode === 'student' ? 'student' : viewMode;

  return (
    <div id="print-root" style={{ width: '794px', margin: '0 auto' }}>
      <ReportCardCertificate
        report={report}
        showInternalNotes={showInternalNotes}
        viewMode={effectiveViewMode}
        printMode
      />
    </div>
  );
}
