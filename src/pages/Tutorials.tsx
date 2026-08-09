import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, BookOpen, ChevronRight, Clock, GraduationCap, LifeBuoy, Loader2,
  MessageCircle, Pencil, Plus, Search, Trash2, Upload, Video,
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

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
];

const CATEGORIES = ['Getting started', 'Attendance', 'Classes & Zoom', 'Fees & Payments', 'Reports', 'Communication', 'General'];

interface TutorialRow {
  id: string;
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
}

const emptyForm = {
  id: '',
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
      if (category !== 'all' && item.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!`${item.title} ${item.description || ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [readable, category, search]);

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
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6 animate-fade-in">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate('/tutorials')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Help Centre
        </Button>

        <header className="rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-foreground">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-85">
            <span>{active.category}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readingMinutes(guide.steps.length, guide.intro)} min read</span>
            {!active.is_published && <Badge variant="secondary" className="ml-1">Draft</Badge>}
          </div>
          <h1 className="mt-2 font-serif text-2xl font-bold md:text-3xl">{active.title}</h1>
          {guide.intro && <p className="mt-2 text-sm opacity-90">{guide.intro}</p>}
        </header>

        {active.thumbnail_url && (
          <img src={active.thumbnail_url} alt={`${active.title} screenshot`} loading="lazy" className="w-full rounded-xl border border-border object-cover" />
        )}

        <Card>
          <CardContent className="p-5 md:p-6">
            <h2 className="mb-4 font-serif text-lg font-bold text-foreground">Step by step</h2>
            {guide.steps.length === 0 ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{active.description || 'No steps added yet.'}</p>
            ) : (
              <ol className="space-y-4">
                {guide.steps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</span>
                    <div className="space-y-2 pt-0.5">
                      <p className="text-sm leading-relaxed text-foreground">{step.text}</p>
                      {step.image && (
                        <img src={step.image} alt={`Step ${index + 1}`} loading="lazy" className="w-full rounded-lg border border-border" />
                      )}
                    </div>
                  </li>
                ))}

              </ol>
            )}
            {guide.notes.length > 0 && (
              <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
                <p className="mb-1 text-sm font-semibold text-foreground">Good to know</p>
                {guide.notes.map((note, index) => (
                  <p key={index} className="text-sm leading-relaxed text-muted-foreground">{note}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {guide.faqs.length > 0 && (
          <Card>
            <CardContent className="p-5 md:p-6">
              <h2 className="mb-3 font-serif text-lg font-bold text-foreground">Common problems</h2>
              <div className="space-y-3">
                {guide.faqs.map((faq, index) => (
                  <div key={index} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold text-foreground">{faq.q}</p>
                    {faq.a && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}


        {videoUrl && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold text-foreground">Optional: watch the walkthrough</p>
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
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
            <Button variant="outline" size="sm" onClick={() => openEditor(active)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit this guide
            </Button>
          </div>
        )}

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
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 animate-fade-in">
      <header className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-foreground md:p-8">
        <p className="text-xs font-bold uppercase tracking-wide opacity-80">Help centre</p>
        <h1 className="mt-1 font-serif text-3xl font-bold">How to use the academy portal</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-90">
          Short written guides — read them in a minute, no video needed. Filtered to what your role actually uses.
        </p>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guides" className="pl-9" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="all">All</TabsTrigger>
              {CATEGORIES.filter((item) => readable.some((row) => row.category === item)).map((item) => (
                <TabsTrigger key={item} value={item}>{item}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {isAdmin && (
            <Button onClick={() => openEditor()} className="shrink-0">
              <Plus className="mr-2 h-4 w-4" /> Add guide
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-44" />)}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">No guides yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin ? 'Add your first written guide — video is optional.' : 'Guides for your role will appear here soon.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        grouped.map(([groupName, rows]) => (
          <section key={groupName} className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-foreground">{groupName}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => {
                const guide = parseGuide(row.description);
                const hasVideo = Boolean(row.video_url || row.storage_path);
                return (
                  <Card key={row.id} className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
                    <button type="button" className="flex-1 text-left" onClick={() => navigate(`/tutorials/${row.id}`)}>
                      <div className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <BookOpen className="h-4.5 w-4.5 text-primary" />
                          </span>
                          {!row.is_published && <Badge variant="secondary">Draft</Badge>}
                        </div>
                        <p className="font-semibold leading-snug text-foreground">{row.title}</p>
                        {guide.intro && <p className="line-clamp-2 text-sm text-muted-foreground">{guide.intro}</p>}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {readingMinutes(guide.steps.length, guide.intro)} min read</Badge>
                          {guide.steps.length > 0 && <Badge variant="outline">{guide.steps.length} steps</Badge>}
                          {hasVideo && <Badge variant="outline" className="gap-1"><Video className="h-3 w-3" /> Video</Badge>}
                        </div>
                        <span className="inline-flex items-center pt-1 text-sm font-medium text-primary">
                          Read guide <ChevronRight className="ml-1 h-4 w-4" />
                        </span>
                      </div>
                    </button>
                    {isAdmin && (
                      <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
                        <Button size="sm" variant="ghost" onClick={() => openEditor(row)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(row)}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}

      {NeedMoreHelp}

      <EditorDialog />
    </div>
  );
}
