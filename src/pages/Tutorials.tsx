import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, Clock, GraduationCap, Languages, LifeBuoy, ListOrdered, Loader2,
  MessageCircle, MousePointerClick, Pencil, Plus, Search, Sparkles, Trash2, Upload,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { WalkthroughViewer, type WalkthroughFrame } from '@/components/tutorials/WalkthroughViewer';
import { WalkthroughVideoCard } from '@/components/tutorials/WalkthroughVideoCard';
import { TutorialCard } from '@/components/tutorials/TutorialCard';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
];

const CATEGORIES = ['Getting started', 'Attendance', 'Classes & Zoom', 'Fees & Payments', 'Reports', 'Communication', 'General'];

const LANGS = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'اردو' },
];

/** Bilingual labels for the learner-facing Help Centre chrome. */
const UI = {
  eyebrow: { en: 'Help centre', ur: 'مرکزِ رہنمائی' },
  heading: { en: 'Learn the academy portal, step by step', ur: 'اکیڈمی پورٹل قدم بہ قدم سیکھیں' },
  sub: {
    en: 'Short written guides and screen walkthroughs — filtered to exactly what your role uses.',
    ur: 'مختصر تحریری رہنمائیاں اور اسکرین واک تھرو — صرف وہی جو آپ کے کردار سے متعلق ہیں۔',
  },
  searchPlaceholder: { en: 'Search guides…', ur: 'رہنمائی تلاش کریں…' },
  all: { en: 'All topics', ur: 'تمام موضوعات' },
  back: { en: 'Back to Help Centre', ur: 'مرکزِ رہنمائی پر واپس' },
  minRead: { en: 'min read', ur: 'منٹ' },
  stepsWord: { en: 'steps', ur: 'مراحل' },
  stepWord: { en: 'Step', ur: 'مرحلہ' },
  draft: { en: 'Draft', ur: 'مسودہ' },
  stepByStep: { en: 'Step by step', ur: 'قدم بہ قدم' },
  noSteps: { en: 'No steps added yet.', ur: 'ابھی کوئی مراحل شامل نہیں کیے گئے۔' },
  goodToKnow: { en: 'Good to know', ur: 'یاد رکھنے کی بات' },
  commonProblems: { en: 'Common problems', ur: 'عام مسائل' },
  optionalVideo: { en: 'Optional: watch the walkthrough', ur: 'اختیاری: واک تھرو دیکھیں' },
  empty: { en: 'No guides yet', ur: 'ابھی کوئی رہنمائی موجود نہیں' },
  emptySub: { en: 'Guides for your role will appear here soon.', ur: 'آپ کے کردار کی رہنمائیاں جلد یہاں دستیاب ہوں گی۔' },
  needHelp: { en: 'Need more help?', ur: 'مزید مدد چاہیے؟' },
  needHelpSub: {
    en: 'Message the academy team or raise a request — we usually reply the same day.',
    ur: 'اکیڈمی ٹیم کو پیغام بھیجیں — عموماً اسی دن جواب دیا جاتا ہے۔',
  },
  ask: { en: 'Ask the academy', ur: 'اکیڈمی سے پوچھیں' },
  announcements: { en: 'Announcements', ur: 'اعلانات' },
} as const;

const CATEGORY_UR: Record<string, string> = {
  'Getting started': 'ابتدائی رہنمائی',
  Attendance: 'حاضری',
  'Classes & Zoom': 'کلاسز اور زوم',
  'Fees & Payments': 'فیس اور ادائیگی',
  Reports: 'رپورٹس',
  Communication: 'رابطہ',
  General: 'عمومی',
};



interface TutorialRow {
  id: string;
  language: string;
  tutorial_key: string | null;
  title: string;
  description: string | null;
  category: string;
  source_type: 'link' | 'upload';
  video_url: string | null;
  storage_path: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  visible_roles: string[];
  sort_order: number;
  is_published: boolean;
  walkthrough_status?: string | null;
  walkthrough_frames?: WalkthroughFrame[] | null;
  walkthrough_generated_at?: string | null;
  walkthrough_error?: string | null;
  walkthrough_video_path?: string | null;
  walkthrough_poster_path?: string | null;
  share_token?: string | null;
  share_enabled?: boolean | null;
}

const emptyForm = {
  id: '',
  language: 'en',
  tutorial_key: '',
  title: '',
  description: '',
  category: 'Getting started',
  source_type: 'link' as 'link' | 'upload',
  video_url: '',
  storage_path: '' as string | null,
  thumbnail_url: '',
  visible_roles: ['admin', 'super_admin', 'teacher', 'student', 'parent'],
  sort_order: 0,
  is_published: true,
};

function toEmbedUrl(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

/** Splits a guide body into a short intro, numbered steps (with optional per-step image), notes and FAQs. */
function parseGuide(description?: string | null) {
  const lines = (description || '').split('\n').map((line) => line.trim());
  const intro: string[] = [];
  const steps: { text: string; image?: string }[] = [];
  const notes: string[] = [];
  const faqs: { q: string; a: string }[] = [];
  let inFaq = false;
  lines.forEach((line) => {
    if (!line) return;
    if (/^step-by-step script:?$/i.test(line)) return;
    if (/^(faq|common problems|common questions):?$/i.test(line)) { inFaq = true; return; }
    if (inFaq) {
      const q = line.match(/^q[:.]\s*(.+)$/i);
      if (q) { faqs.push({ q: q[1], a: '' }); return; }
      const a = line.match(/^a[:.]\s*(.+)$/i);
      if (a && faqs.length) { faqs[faqs.length - 1].a = a[1]; return; }
      if (faqs.length) { faqs[faqs.length - 1].a = `${faqs[faqs.length - 1].a} ${line}`.trim(); return; }
      return;
    }
    // optional per-step visual: "1. Do the thing [img: https://...]"
    let image: string | undefined;
    const withImage = line.replace(/\[img:\s*([^\]]+)\]/i, (_m, url) => { image = String(url).trim(); return ''; }).trim();
    const match = withImage.match(/^\d+[.)]\s*(.+)$/);
    if (match) steps.push({ text: match[1], image });
    else if (steps.length === 0) intro.push(withImage);
    else if (withImage) notes.push(withImage);
    else if (image && steps.length) steps[steps.length - 1].image = image;
  });
  return { intro: intro.join(' '), steps, notes, faqs };
}


function readingMinutes(steps: number, intro: string) {
  return Math.max(1, Math.round((steps * 12 + intro.length / 5) / 60) || 1);
}

export default function Tutorials() {
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();
  const { tutorialId } = useParams();
  const queryClient = useQueryClient();
  const isAdmin = activeRole === 'admin' || activeRole === 'super_admin';

  const [search, setSearch] = useState('');
  const [lang, setLang] = useState<'en' | 'ur'>('en');
  const [category, setCategory] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ['tutorial-videos', activeRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tutorial_videos')
        .select('*')
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as TutorialRow[];
    },
  });

  const readable = useMemo(() => {
    const role = activeRole || 'student';
    return tutorials.filter((item) => {
      if (!isAdmin && !item.is_published) return false;
      if (!isAdmin && !(item.visible_roles || []).includes(role)) return false;
      return true;
    });
  }, [tutorials, activeRole, isAdmin]);

  const visible = useMemo(() => {
    return readable.filter((item) => {
      if ((item.language || 'en') !== lang) return false;
      if (category !== 'all' && item.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!`${item.title} ${item.description || ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [readable, category, search, lang]);

  const grouped = useMemo(() => {
    const map = new Map<string, TutorialRow[]>();
    visible.forEach((item) => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });
    return Array.from(map.entries());
  }, [visible]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        language: form.language,
        tutorial_key: form.tutorial_key.trim() || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        source_type: form.source_type,
        video_url: form.video_url.trim() || null,
        storage_path: form.storage_path || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        visible_roles: form.visible_roles,
        sort_order: Number(form.sort_order) || 0,
        is_published: form.is_published,
      };
      if (form.id) {
        const { error } = await supabase.from('tutorial_videos').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tutorial_videos').insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Guide saved' });
      setDialogOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
    },
    onError: (error: any) => toast({ title: 'Could not save', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: TutorialRow) => {
      if (row.storage_path) await supabase.storage.from('tutorial-videos').remove([row.storage_path]);
      const { error } = await supabase.from('tutorial_videos').delete().eq('id', row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Guide removed' });
      queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
    },
    onError: (error: any) => toast({ title: 'Could not delete', description: error.message, variant: 'destructive' }),
  });

  const queueWalkthrough = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tutorial_videos')
        .update({ walkthrough_status: 'pending', walkthrough_error: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Capture queued', description: 'Screens will be captured from the live app.' });
      queryClient.invalidateQueries({ queryKey: ['tutorial-videos'] });
    },
    onError: (error: any) => toast({ title: 'Could not queue', description: error.message, variant: 'destructive' }),
  });


  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error } = await supabase.storage.from('tutorial-videos').upload(path, file, { upsert: false });
      if (error) throw error;
      setForm((prev) => ({ ...prev, source_type: 'upload', storage_path: path, video_url: path }));
      toast({ title: 'Video uploaded' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  function openEditor(row?: TutorialRow) {
    if (row) {
      setForm({
        id: row.id,
        language: row.language || 'en',
        tutorial_key: row.tutorial_key || '',
        title: row.title,
        description: row.description || '',
        category: row.category,
        source_type: row.source_type,
        video_url: row.video_url || '',
        storage_path: row.storage_path,
        thumbnail_url: row.thumbnail_url || '',
        visible_roles: row.visible_roles || [],
        sort_order: row.sort_order,
        is_published: row.is_published,
      });
    } else {
      setForm(emptyForm);
    }
    setDialogOpen(true);
  }

  const active = tutorialId ? readable.find((row) => row.id === tutorialId) || null : null;

  // Resolve an optional video for the open article (never required).
  useEffect(() => {
    let cancelled = false;
    setVideoUrl(null);
    if (!active) return;
    if (active.source_type === 'upload' && active.storage_path) {
      supabase.storage.from('tutorial-videos').createSignedUrl(active.storage_path, 3600).then(({ data }) => {
        if (!cancelled) setVideoUrl(data?.signedUrl || null);
      });
    } else if (active.video_url) {
      setVideoUrl(active.video_url);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.source_type, active?.storage_path, active?.video_url]);

  const NeedMoreHelp = (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Need more help?</p>
            <p className="text-sm text-muted-foreground">
              Message the academy team or raise a request — we usually reply the same day.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate('/hub?new=1')}>
            <MessageCircle className="mr-2 h-4 w-4" /> Ask the academy
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/announcements')}>
            Announcements
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ---------------- Article view ----------------
  if (tutorialId) {
    if (isLoading) {
      return <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
    }
    if (!active) {
      return (
        <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
          <Button variant="ghost" onClick={() => navigate('/tutorials')}><ArrowLeft className="mr-2 h-4 w-4" /> Help Centre</Button>
          <Card><CardContent className="py-14 text-center text-sm text-muted-foreground">This guide is not available for your account.</CardContent></Card>
        </div>
      );
    }
    const guide = parseGuide(active.description);
    const embed = videoUrl ? toEmbedUrl(videoUrl) : null;
    const isUrdu = (active.language || 'en') === 'ur';
    const other = active.tutorial_key
      ? readable.find((row) => row.tutorial_key === active.tutorial_key && row.id !== active.id)
      : undefined;
    const t = (key: keyof typeof UI) => UI[key][isUrdu ? 'ur' : 'en'];
    return (
      <div
        className={`mx-auto max-w-3xl p-4 md:p-8 animate-fade-in ${isUrdu ? 'urdu-text' : ''}`}
        dir={isUrdu ? 'rtl' : 'ltr'}
      >
        <Button variant="ghost" size="sm" className="-ms-2 mb-4 text-muted-foreground" onClick={() => navigate('/tutorials')}>
          {isUrdu ? <ArrowRight className="ms-2 h-4 w-4" /> : <ArrowLeft className="me-2 h-4 w-4" />} {t('back')}
        </Button>

        <article className="space-y-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">{active.category}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingMinutes(guide.steps.length, guide.intro)} {t('minRead')}</span>
              {guide.steps.length > 0 && (
                <span className="inline-flex items-center gap-1"><ListOrdered className="h-3.5 w-3.5" /> {guide.steps.length} {t('stepsWord')}</span>
              )}
              {!active.is_published && <Badge variant="secondary">{t('draft')}</Badge>}
            </div>
            <h1 className={`font-serif font-bold tracking-tight text-foreground ${isUrdu ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl'}`}>
              {active.title}
            </h1>
            {guide.intro && <p className="text-base leading-relaxed text-muted-foreground">{guide.intro}</p>}
            {other && (
              <Button
                variant="outline"
                size="sm"
                className={other.language === 'ur' ? 'urdu-ui' : undefined}
                onClick={() => { setLang((other.language as 'en' | 'ur') || 'en'); navigate(`/tutorials/${other.id}`); }}
              >
                <Languages className="me-2 h-4 w-4" />
                {other.language === 'ur' ? 'اردو میں پڑھیں' : 'Read in English'}
              </Button>
            )}
          </header>

          {active.walkthrough_video_path && (
            <WalkthroughVideoCard
              videoPath={active.walkthrough_video_path}
              fileName={`${active.title}.mp4`}
              posterPath={active.walkthrough_poster_path}
              shareToken={active.share_token}
              shareEnabled={active.share_enabled}
              durationSeconds={active.duration_seconds}
            />
          )}

          {active.thumbnail_url && !active.walkthrough_video_path && (
            <img src={active.thumbnail_url} alt={`${active.title}`} loading="lazy" className="w-full rounded-2xl border border-border object-cover shadow-sm" />
          )}

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-7">
            <h2 className="mb-5 font-serif text-lg font-bold text-foreground md:text-xl">{t('stepByStep')}</h2>
            {guide.steps.length === 0 ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">{active.description || t('noSteps')}</p>
            ) : (
              <ol className="space-y-6">
                {guide.steps.map((step, index) => (
                  <li key={index} className="relative flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-3 border-b border-border/60 pb-5 last:border-0 last:pb-0">
                      <p className={`leading-relaxed text-foreground ${isUrdu ? 'text-base' : 'text-[15px]'}`}>{step.text}</p>
                      {step.image && (
                        <img src={step.image} alt={`${t('stepWord')} ${index + 1}`} loading="lazy" className="w-full rounded-xl border border-border shadow-sm" />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {guide.notes.length > 0 && (
              <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="mb-1 text-sm font-semibold text-foreground">{t('goodToKnow')}</p>
                {guide.notes.map((note, index) => (
                  <p key={index} className="text-sm leading-relaxed text-muted-foreground">{note}</p>
                ))}
              </div>
            )}
          </section>

          {guide.faqs.length > 0 && (
            <section className="rounded-2xl border border-border bg-muted/30 p-5 md:p-7">
              <h2 className="mb-4 font-serif text-lg font-bold text-foreground md:text-xl">{t('commonProblems')}</h2>
              <div className="space-y-3">
                {guide.faqs.map((faq, index) => (
                  <div key={index} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-foreground">{faq.q}</p>
                    {faq.a && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {Array.isArray(active.walkthrough_frames) && active.walkthrough_frames.length > 0 && (
            <WalkthroughViewer frames={active.walkthrough_frames} generatedAt={active.walkthrough_generated_at} />
          )}

          {isAdmin && (!Array.isArray(active.walkthrough_frames) || active.walkthrough_frames.length === 0) && (
            <Card className="border-dashed">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Visual walkthrough</p>
                  <p className="text-xs text-muted-foreground">
                    {active.walkthrough_status === 'pending'
                      ? 'Queued — screens will be captured from the live app on the next capture run.'
                      : active.walkthrough_error
                        ? `Last attempt failed: ${active.walkthrough_error}`
                        : 'No screens captured yet for this guide.'}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={queueWalkthrough.isPending} onClick={() => queueWalkthrough.mutate(active.id)}>
                  <MousePointerClick className="me-2 h-4 w-4" /> Queue capture
                </Button>
              </CardContent>
            </Card>
          )}

          {videoUrl && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-sm font-semibold text-foreground">{t('optionalVideo')}</p>
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-muted">
                  {embed ? (
                    <iframe src={embed} title={active.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen />
                  ) : (
                    <video src={videoUrl} controls className="h-full w-full" />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {NeedMoreHelp}

          {isAdmin && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => openEditor(active)}>
                <Pencil className="me-2 h-4 w-4" /> Edit this guide
              </Button>
            </div>
          )}
        </article>

        <EditorDialog />
      </div>
    );

  }

  // ---------------- Editor dialog (shared) ----------------
  function EditorDialog() {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Edit guide' : 'Add guide'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Language branch</Label>
                <Select value={form.language} onValueChange={(value) => setForm({ ...form, language: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tut-key">Guide key</Label>
                <Input id="tut-key" value={form.tutorial_key} onChange={(event) => setForm({ ...form, tutorial_key: event.target.value })} placeholder="logging-in" />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">Use the same guide key for the English and Urdu version of one guide.</p>
            <div className="space-y-2">
              <Label htmlFor="tut-title">Title</Label>
              <Input id="tut-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="How to upload a payment slip" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tut-desc">Guide text</Label>
              <Textarea
                id="tut-desc"
                rows={8}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder={'One-line intro.\n\n1. First step\n2. Second step'}
              />
              <p className="text-xs text-muted-foreground">First lines = intro. Lines starting with 1. 2. 3. become numbered steps. Add an optional picture to a step with [img: https://link-to-screenshot]. Add a "FAQ:" line, then "Q: ..." / "A: ..." lines for common problems. Video is always optional.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tut-order">Order</Label>
                <Input id="tut-order" type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tut-shot">Screenshot URL (optional)</Label>
              <Input id="tut-shot" value={form.thumbnail_url} onChange={(event) => setForm({ ...form, thumbnail_url: event.target.value })} placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <Label>Video (optional)</Label>
              <Tabs value={form.source_type} onValueChange={(value) => setForm({ ...form, source_type: value as 'link' | 'upload' })}>
                <TabsList className="w-full">
                  <TabsTrigger value="link" className="flex-1">YouTube / Vimeo link</TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1">Upload file</TabsTrigger>
                </TabsList>
              </Tabs>
              {form.source_type === 'link' ? (
                <Input value={form.video_url} onChange={(event) => setForm({ ...form, video_url: event.target.value, storage_path: null })} placeholder="Leave empty for a text-only guide" />
              ) : (
                <div className="space-y-2">
                  <Input type="file" accept="video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleUpload(file); }} />
                  {uploading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</p>}
                  {form.storage_path && !uploading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Upload className="h-4 w-4" /> {form.storage_path}</p>}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Visible to</Label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((role) => (
                  <label key={role.value} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={form.visible_roles.includes(role.value)}
                      onCheckedChange={(checked) => setForm({
                        ...form,
                        visible_roles: checked
                          ? [...form.visible_roles, role.value]
                          : form.visible_roles.filter((item) => item !== role.value),
                      })}
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Published</p>
                <p className="text-xs text-muted-foreground">Drafts are only visible to admins.</p>
              </div>
              <Switch checked={form.is_published} onCheckedChange={(checked) => setForm({ ...form, is_published: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.title.trim() || uploading || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save guide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ---------------- List view ----------------
  const isUr = lang === 'ur';
  const t = (key: keyof typeof UI) => UI[key][isUr ? 'ur' : 'en'];
  const catLabel = (name: string) => (isUr ? CATEGORY_UR[name] || name : name);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 pb-16 md:p-8 animate-fade-in" dir={isUr ? 'rtl' : 'ltr'}>
      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary via-primary to-accent px-6 py-8 text-primary-foreground md:px-10 md:py-10">
        <span className="pointer-events-none absolute -end-16 -top-16 h-52 w-52 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className={`relative max-w-2xl ${isUr ? 'urdu-text' : ''}`}>
          <p className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" /> {t('eyebrow')}
          </p>
          <h1 className={`mt-3 font-serif font-bold tracking-tight ${isUr ? 'text-2xl md:text-4xl' : 'text-3xl md:text-4xl'}`}>
            {t('heading')}
          </h1>
          <p className="mt-2 text-sm opacity-90 md:text-base">{t('sub')}</p>
        </div>
      </header>

      {/* Language branches + search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-full max-w-xs rounded-full border border-border bg-muted/60 p-1 shadow-sm sm:w-auto" role="tablist">
          {LANGS.map((item) => {
            const activeLang = lang === item.value;
            return (
              <button
                key={item.value}
                role="tab"
                aria-selected={activeLang}
                onClick={() => setLang(item.value as 'en' | 'ur')}
                className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeLang ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                } ${item.value === 'ur' ? 'urdu-ui' : ''}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex w-full items-center gap-2 lg:max-w-md">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className={`h-11 rounded-full border-border bg-card ps-9 shadow-sm ${isUr ? 'urdu-ui text-right' : ''}`}
            />
          </div>
          {isAdmin && (
            <Button onClick={() => openEditor()} variant="outline" className="h-11 shrink-0 rounded-full">
              <Plus className="me-2 h-4 w-4" /> Add guide
            </Button>
          )}
        </div>
      </div>

      {/* Category chips */}
      <div className="-mx-1 flex flex-wrap gap-2 px-1">
        {['all', ...CATEGORIES.filter((item) => readable.some((row) => row.category === item))].map((item) => {
          const selected = category === item;
          return (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
              } ${isUr ? 'urdu-ui' : ''}`}
            >
              {item === 'all' ? t('all') : catLabel(item)}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-52 rounded-xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className={`py-16 text-center ${isUr ? 'urdu-text' : ''}`}>
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">{t('empty')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin && !isUr ? 'Add your first written guide — video is optional.' : t('emptySub')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {grouped.map(([groupName, rows]) => (
            <section key={groupName} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className={`font-serif font-bold text-foreground ${isUr ? 'urdu-text text-lg' : 'text-xl'}`}>
                  {catLabel(groupName)}
                </h2>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">{rows.length}</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => {
                  const guide = parseGuide(row.description);
                  return (
                    <TutorialCard
                      key={row.id}
                      row={{
                        ...row,
                        hasFrames: Array.isArray(row.walkthrough_frames) && row.walkthrough_frames.length > 0,
                        hasVideo: Boolean(row.video_url || row.storage_path),
                      }}
                      intro={guide.intro}
                      steps={guide.steps.length}
                      minutes={readingMinutes(guide.steps.length, guide.intro)}
                      isUrdu={isUr}
                      onOpen={() => navigate(`/tutorials/${row.id}`)}
                      adminBar={isAdmin ? (
                        <div className="flex items-center justify-end gap-1 border-t border-border/70 bg-muted/30 px-2 py-1.5">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => openEditor(row)}>
                            <Pencil className="me-1 h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(row)}>
                            <Trash2 className="me-1 h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      ) : undefined}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {NeedMoreHelp}

      <EditorDialog />
    </div>
  );
}

