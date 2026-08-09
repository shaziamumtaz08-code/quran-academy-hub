import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Loader2, Pencil, Play, Plus, Search, Trash2, Upload, Video } from 'lucide-react';
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
  video_url: string;
  storage_path: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  visible_roles: string[];
  sort_order: number;
  is_published: boolean;
}

const emptyForm = {
  id: '',
  title: '',
  description: '',
  category: 'Getting started',
  source_type: 'link' as 'link' | 'upload',
  video_url: '',
  storage_path: '' as string | null,
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

export default function Tutorials() {
  const { user, activeRole } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = activeRole === 'admin' || activeRole === 'super_admin';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [playing, setPlaying] = useState<TutorialRow | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

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

  const visible = useMemo(() => {
    const role = activeRole || 'student';
    return tutorials.filter((item) => {
      if (!isAdmin && !item.is_published) return false;
      if (!isAdmin && !(item.visible_roles || []).includes(role)) return false;
      if (category !== 'all' && item.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!`${item.title} ${item.description || ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tutorials, activeRole, isAdmin, category, search]);

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
        video_url: form.video_url.trim(),
        storage_path: form.storage_path || null,
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
      toast({ title: 'Tutorial saved' });
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
      toast({ title: 'Tutorial removed' });
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

  async function openPlayer(row: TutorialRow) {
    setPlaying(row);
    if (row.source_type === 'upload' && row.storage_path) {
      const { data } = await supabase.storage.from('tutorial-videos').createSignedUrl(row.storage_path, 3600);
      setPlayUrl(data?.signedUrl || null);
    } else {
      setPlayUrl(row.video_url);
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
        video_url: row.video_url,
        storage_path: row.storage_path,
        visible_roles: row.visible_roles || [],
        sort_order: row.sort_order,
        is_published: row.is_published,
      });
    } else {
      setForm(emptyForm);
    }
    setDialogOpen(true);
  }

  const embed = playUrl ? toEmbedUrl(playUrl) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 animate-fade-in">
      <header className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-accent p-6 text-primary-foreground md:p-8">
        <p className="text-xs font-bold uppercase tracking-wide opacity-80">Help centre</p>
        <h1 className="mt-1 font-serif text-3xl font-bold">Video tutorials</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-90">
          Short walkthroughs showing how to use the academy portal — filtered to what your role actually needs.
        </p>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tutorials" className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="all">All</TabsTrigger>
              {CATEGORIES.filter((item) => tutorials.some((row) => row.category === item)).map((item) => (
                <TabsTrigger key={item} value={item}>{item}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {isAdmin && (
            <Button onClick={() => openEditor()} className="shrink-0">
              <Plus className="mr-2 h-4 w-4" /> Add tutorial
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-52" />)}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold text-foreground">No tutorials yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin ? 'Add your first walkthrough — paste a YouTube link or upload an MP4.' : 'Tutorials for your role will appear here soon.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        grouped.map(([groupName, rows]) => (
          <section key={groupName} className="space-y-3">
            <h2 className="font-serif text-xl font-bold text-foreground">{groupName}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <Card key={row.id} className="group overflow-hidden transition-shadow hover:shadow-md">
                  <button type="button" className="block w-full text-left" onClick={() => openPlayer(row)}>
                    <div className="relative flex h-36 items-center justify-center bg-muted">
                      {row.thumbnail_url ? (
                        <img src={row.thumbnail_url} alt={`${row.title} thumbnail`} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Video className="h-10 w-10 text-muted-foreground" />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors group-hover:bg-foreground/20">
                        <Play className="h-9 w-9 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                    </div>
                    <div className="space-y-1 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-foreground">{row.title}</p>
                        {!row.is_published && <Badge variant="secondary">Draft</Badge>}
                      </div>
                      {row.description && <p className="line-clamp-2 text-sm text-muted-foreground">{row.description}</p>}
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
              ))}
            </div>
          </section>
        ))
      )}

      {/* Player */}
      <Dialog open={Boolean(playing)} onOpenChange={(open) => { if (!open) { setPlaying(null); setPlayUrl(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{playing?.title}</DialogTitle></DialogHeader>
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
            {!playUrl ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : embed ? (
              <iframe src={embed} title={playing?.title || 'Tutorial'} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen />
            ) : (
              <video src={playUrl} controls className="h-full w-full" />
            )}
          </div>
          {playing?.description && <p className="text-sm text-muted-foreground">{playing.description}</p>}
        </DialogContent>
      </Dialog>

      {/* Editor */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Edit tutorial' : 'Add tutorial'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tut-title">Title</Label>
              <Input id="tut-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="How to mark attendance" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tut-desc">Description</Label>
              <Textarea id="tut-desc" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
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
              <Label>Video source</Label>
              <Tabs value={form.source_type} onValueChange={(value) => setForm({ ...form, source_type: value as 'link' | 'upload' })}>
                <TabsList className="w-full">
                  <TabsTrigger value="link" className="flex-1">YouTube / Vimeo link</TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1">Upload file</TabsTrigger>
                </TabsList>
              </Tabs>
              {form.source_type === 'link' ? (
                <Input value={form.video_url} onChange={(event) => setForm({ ...form, video_url: event.target.value, storage_path: null })} placeholder="https://youtu.be/..." />
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
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.title.trim() || !form.video_url.trim() || uploading || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save tutorial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
