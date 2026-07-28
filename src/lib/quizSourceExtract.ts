import { supabase } from '@/integrations/supabase/client';


export const QUIZ_SOURCE_ACCEPT =
  '.pdf,.txt,.md,.csv,.doc,.docx,image/*,audio/*,video/*';

export type ExtractedSource = { name: string; text: string; kind: string };

const AUDIO_FORMATS: Record<string, string> = {
  'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav',
  'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/ogg': 'ogg',
  'audio/aac': 'aac', 'audio/flac': 'flac',
};

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function callExtractor(filename: string, media: any[], instruction: string) {
  const { data, error } = await supabase.functions.invoke('extract-media-content', {
    body: { filename, media, instruction },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return ((data as any)?.text || '').trim();
}

async function extractPdf(file: File): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  return callExtractor(file.name, [{ kind: 'file', filename: file.name, data_url: dataUrl }],
    'Extract all educational content from this PDF. OCR scanned pages if needed and preserve Arabic/Urdu text exactly.');
}

/** Grab evenly spaced frames from a video so vision models can read slides / on-screen text. */
async function extractVideoFrames(file: File, maxFrames = 8): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.crossOrigin = 'anonymous';

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not read video'));
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const count = duration > 0 ? maxFrames : 1;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1024 / (video.videoWidth || 1024));
    canvas.width = Math.round((video.videoWidth || 1024) * scale);
    canvas.height = Math.round((video.videoHeight || 576) * scale);
    const ctx = canvas.getContext('2d')!;

    const frames: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = duration > 0 ? (duration * (i + 0.5)) / count : 0;
      await new Promise<void>((resolve) => {
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = t;
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', 0.7));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Extracts text from any supported source: PDF, plain text, image, audio, or video.
 */
export async function extractSourceFile(file: File): Promise<ExtractedSource> {
  const type = file.type || '';
  const name = file.name;

  if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    const text = await extractPdf(file);
    return { name, text, kind: 'pdf' };
  }

  if (type.startsWith('image/')) {
    const dataUrl = await fileToDataUrl(file);
    const text = await callExtractor(name, [{ kind: 'image', data_url: dataUrl }],
      'Read this image and transcribe all text, tables and diagram labels it contains.');
    return { name, text, kind: 'image' };
  }

  if (type.startsWith('audio/')) {
    const dataUrl = await fileToDataUrl(file);
    const base64 = dataUrl.split(',')[1];
    const format = AUDIO_FORMATS[type] || name.split('.').pop()?.toLowerCase() || 'mp3';
    const text = await callExtractor(name, [{ kind: 'audio', data: base64, format }],
      'Transcribe this audio recording in full, in its original language.');
    return { name, text, kind: 'audio' };
  }

  if (type.startsWith('video/')) {
    const frames = await extractVideoFrames(file);
    const text = await callExtractor(
      name,
      frames.map((f) => ({ kind: 'image', data_url: f })),
      'These are frames sampled in order from a lesson video. Transcribe all on-screen text and describe the teaching content shown.',
    );
    return { name, text, kind: 'video' };
  }

  // Plain text / markdown / csv / doc fallback
  const text = (await file.text()).trim();
  return { name, text, kind: 'text' };
}

export async function extractSourceFiles(files: FileList | File[], limit = 5): Promise<ExtractedSource[]> {
  const list = Array.from(files as any as File[]).slice(0, limit);
  const out: ExtractedSource[] = [];
  for (const file of list) out.push(await extractSourceFile(file));
  return out;
}
