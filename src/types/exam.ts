export type ExamTenure = 'weekly' | 'monthly' | 'quarterly';

export interface Subject {
  id: string;
  name: string;
  description?: string;
}

export interface ExamTemplate {
  id: string;
  name: string;
  subject_id: string | null;
  subject?: Subject;
  tenure: ExamTenure;
  description?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  fields?: ExamTemplateField[];
}

export interface ExamTemplateField {
  id: string;
  template_id: string;
  label: string;
  max_marks: number;
  description?: string;
  is_public: boolean;
  sort_order: number;
  created_at: string;
}

export interface ExamSubmission {
  id: string;
  template_id: string;
  template?: ExamTemplate;
  student_id: string;
  student_name?: string;
  examiner_id?: string;
  examiner_name?: string;
  total_marks: number;
  max_total_marks: number;
  percentage: number;
  examiner_remarks?: string;
  public_remarks?: string;
  exam_date: string;
  created_at: string;
  updated_at: string;
  values?: ExamSubmissionValue[];
}

export interface ExamSubmissionValue {
  id: string;
  submission_id: string;
  field_id: string;
  field?: ExamTemplateField;
  marks: number;
}

export interface ExamResultFilters {
  student_id?: string;
  subject_id?: string;
  tenure?: ExamTenure;
  month?: number;
  year?: number;
}
