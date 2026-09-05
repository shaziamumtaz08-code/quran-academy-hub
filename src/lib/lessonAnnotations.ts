import { supabase } from '@/integrations/supabase/client';

/**
 * Saved markings for the built-in interactive lessons (Noorani Qaida and the
 * Mushaf). Library files keep their marks on the personal resource copy; these
 * lessons have no file, so the marks are kept per student, content type and
 * page/unit — and we record who last saved them.
 */

const table = () => supabase.from('vcr_lesson_annotations' as any);

export async function getLessonAnnotations(
  studentId: string,
  contentType: string,
  unit: number,
): Promise<any[]> {
  const { data, error } = await table()
    .select('data')
    .eq('student_id', studentId)
    .eq('content_type', contentType)
    .eq('unit', unit)
    .maybeSingle();
  if (error) return [];
  const strokes = (data as any)?.data?.strokes;
  return Array.isArray(strokes) ? strokes : [];
}

export async function saveLessonAnnotations(opts: {
  studentId: string;
  contentType: string;
  unit: number;
  strokes: any[];
  userId: string;
  reference?: Record<string, unknown> | null;
}) {
  const { error } = await table().upsert(
    {
      student_id: opts.studentId,
      content_type: opts.contentType,
      unit: opts.unit,
      data: { strokes: opts.strokes },
      reference: opts.reference ?? null,
      updated_by: opts.userId,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: 'student_id,content_type,unit' },
  );
  if (error) throw error;
}
