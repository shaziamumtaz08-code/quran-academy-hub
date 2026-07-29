import { supabase } from '@/integrations/supabase/client';

export type QuizJob = {
  id: string;
  quiz_bank_id: string | null;
  status: 'queued' | 'extracting' | 'generating' | 'completed' | 'failed' | 'cancelled';
  stage: string;
  stage_message: string | null;
  total_units: number;
  processed_units: number;
  questions_generated: number;
  error: string | null;
  files: { name: string; path: string; type: string; size: number }[];
  created_at: string;
};

export type QuizJobParams = {
  language: string;
  difficulty_level: string;
  question_mix: { mcq: number; tf: number; fib: number };
  custom_instructions?: string;
};

const BUCKET = 'quiz-sources';

/**
 * Uploads source files to private storage, creates a background job and kicks off
 * the worker. Extraction + generation continue server-side even if the tab closes.
 */
export async function startQuizExtractionJob(opts: {
  quizBankId: string;
  files: File[];
  params: QuizJobParams;
}): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) throw new Error('You must be signed in to start a background job');

  const jobKey = crypto.randomUUID();
  const uploaded: QuizJob['files'] = [];

  for (const file of opts.files) {
    const safeName = file.name.replace(/[^\w.\-\s]/g, '_');
    const path = `${userId}/${jobKey}/${uploaded.length}-${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
    if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`);
    uploaded.push({ name: file.name, path, type: file.type || '', size: file.size });
  }

  const { data: job, error: jobErr } = await (supabase.from('quiz_generation_jobs') as any)
    .insert({
      quiz_bank_id: opts.quizBankId,
      created_by: userId,
      status: 'queued',
      stage: 'extract',
      stage_message: 'Queued — preparing to extract',
      files: uploaded,
      params: opts.params,
      cursor: { file_index: 0, page: 0 },
      total_units: uploaded.length,
    })
    .select('id')
    .single();

  if (jobErr) throw jobErr;

  await supabase.functions.invoke('quiz-job-worker', { body: { job_id: job.id } });
  return job.id as string;
}

export async function fetchQuizJob(jobId: string): Promise<QuizJob | null> {
  const { data } = await (supabase.from('quiz_generation_jobs') as any)
    .select('*').eq('id', jobId).maybeSingle();
  return (data as QuizJob) || null;
}

export async function fetchActiveQuizJobs(): Promise<QuizJob[]> {
  const { data } = await (supabase.from('quiz_generation_jobs') as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  return (data || []) as QuizJob[];
}

export async function resumeQuizJob(jobId: string) {
  await (supabase.from('quiz_generation_jobs') as any)
    .update({ status: 'queued', error: null, locked_until: null }).eq('id', jobId);
  await supabase.functions.invoke('quiz-job-worker', { body: { job_id: jobId } });
}

export async function cancelQuizJob(jobId: string) {
  await (supabase.from('quiz_generation_jobs') as any)
    .update({ status: 'cancelled', stage_message: 'Cancelled' }).eq('id', jobId);
}
