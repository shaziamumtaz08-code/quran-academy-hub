import { Subject, ExamTemplate, ExamTemplateField, ExamSubmission, ExamSubmissionValue } from '@/types/exam';

export const mockSubjects: Subject[] = [
  { id: '1', name: 'Nazrah', description: 'Basic Quran reading with proper pronunciation' },
  { id: '2', name: 'Hifz', description: 'Quran memorization' },
  { id: '3', name: 'Tajweed', description: 'Rules of Quranic recitation' },
  { id: '4', name: 'Tafseer', description: 'Quranic interpretation and understanding' },
];

export const mockExamTemplates: ExamTemplate[] = [
  {
    id: '1',
    name: 'Nazrah Monthly Assessment',
    subject_id: '1',
    subject: mockSubjects[0],
    tenure: 'monthly',
    description: 'Standard monthly assessment for Nazrah students',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Hifz Weekly Revision',
    subject_id: '2',
    subject: mockSubjects[1],
    tenure: 'weekly',
    description: 'Weekly revision test for Hifz students',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Tajweed Quarterly Exam',
    subject_id: '3',
    subject: mockSubjects[2],
    tenure: 'quarterly',
    description: 'Comprehensive quarterly assessment',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const mockTemplateFields: ExamTemplateField[] = [
  // Nazrah Monthly Assessment fields
  { id: '1', template_id: '1', label: 'Fluency', max_marks: 25, is_public: true, sort_order: 1, created_at: new Date().toISOString() },
  { id: '2', template_id: '1', label: 'Pronunciation (Makharij)', max_marks: 25, is_public: true, sort_order: 2, created_at: new Date().toISOString() },
  { id: '3', template_id: '1', label: 'Tajweed Rules', max_marks: 25, is_public: true, sort_order: 3, created_at: new Date().toISOString() },
  { id: '4', template_id: '1', label: 'Overall Progress', max_marks: 25, is_public: true, sort_order: 4, created_at: new Date().toISOString() },
  { id: '5', template_id: '1', label: 'Examiner Notes', max_marks: 0, description: 'Internal assessment notes', is_public: false, sort_order: 5, created_at: new Date().toISOString() },
  
  // Hifz Weekly Revision fields
  { id: '6', template_id: '2', label: 'New Memorization', max_marks: 30, is_public: true, sort_order: 1, created_at: new Date().toISOString() },
  { id: '7', template_id: '2', label: 'Revision Accuracy', max_marks: 40, is_public: true, sort_order: 2, created_at: new Date().toISOString() },
  { id: '8', template_id: '2', label: 'Tarteel (Slow Recitation)', max_marks: 30, is_public: true, sort_order: 3, created_at: new Date().toISOString() },
  { id: '9', template_id: '2', label: 'Internal Evaluation', max_marks: 0, description: 'Teacher-only assessment', is_public: false, sort_order: 4, created_at: new Date().toISOString() },
  
  // Tajweed Quarterly Exam fields
  { id: '10', template_id: '3', label: 'Theoretical Knowledge', max_marks: 25, is_public: true, sort_order: 1, created_at: new Date().toISOString() },
  { id: '11', template_id: '3', label: 'Practical Application', max_marks: 35, is_public: true, sort_order: 2, created_at: new Date().toISOString() },
  { id: '12', template_id: '3', label: 'Ghunna & Madd Rules', max_marks: 20, is_public: true, sort_order: 3, created_at: new Date().toISOString() },
  { id: '13', template_id: '3', label: 'Waqf & Ibtida', max_marks: 20, is_public: true, sort_order: 4, created_at: new Date().toISOString() },
];

export const mockStudents = [
  { id: '3', name: 'Muhammad Ali', email: 'student@quran.academy' },
  { id: '5', name: 'Fatima Zahra', email: 'fatima@quran.academy' },
  { id: '6', name: 'Omar Hassan', email: 'omar@quran.academy' },
];

export const mockExamSubmissions: ExamSubmission[] = [
  {
    id: '1',
    template_id: '1',
    student_id: '3',
    student_name: 'Muhammad Ali',
    examiner_id: '2',
    examiner_name: 'Sheikh Ahmad',
    total_marks: 85,
    max_total_marks: 100,
    percentage: 85,
    examiner_remarks: 'Excellent progress in fluency. Needs improvement in some tajweed rules.',
    public_remarks: 'Great progress! Keep practicing.',
    exam_date: '2024-12-15',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    template_id: '2',
    student_id: '3',
    student_name: 'Muhammad Ali',
    examiner_id: '2',
    examiner_name: 'Sheikh Ahmad',
    total_marks: 92,
    max_total_marks: 100,
    percentage: 92,
    examiner_remarks: 'Strong memorization skills.',
    public_remarks: 'Excellent work on new surah!',
    exam_date: '2024-12-10',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const mockSubmissionValues: ExamSubmissionValue[] = [
  // Submission 1 values
  { id: '1', submission_id: '1', field_id: '1', marks: 22 },
  { id: '2', submission_id: '1', field_id: '2', marks: 20 },
  { id: '3', submission_id: '1', field_id: '3', marks: 18 },
  { id: '4', submission_id: '1', field_id: '4', marks: 25 },
  
  // Submission 2 values
  { id: '5', submission_id: '2', field_id: '6', marks: 28 },
  { id: '6', submission_id: '2', field_id: '7', marks: 36 },
  { id: '7', submission_id: '2', field_id: '8', marks: 28 },
];

// Helper to get template with fields
export function getTemplateWithFields(templateId: string): ExamTemplate | undefined {
  const template = mockExamTemplates.find(t => t.id === templateId);
  if (!template) return undefined;
  
  return {
    ...template,
    fields: mockTemplateFields.filter(f => f.template_id === templateId).sort((a, b) => a.sort_order - b.sort_order),
  };
}

// Helper to get submission with values
export function getSubmissionWithValues(submissionId: string): ExamSubmission | undefined {
  const submission = mockExamSubmissions.find(s => s.id === submissionId);
  if (!submission) return undefined;
  
  const template = getTemplateWithFields(submission.template_id);
  const values = mockSubmissionValues.filter(v => v.submission_id === submissionId).map(v => ({
    ...v,
    field: template?.fields?.find(f => f.id === v.field_id),
  }));
  
  return {
    ...submission,
    template,
    values,
  };
}
