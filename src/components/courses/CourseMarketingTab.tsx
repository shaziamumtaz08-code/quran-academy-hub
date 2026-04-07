import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Image, Upload, Copy, Plus, Trash2, Sparkles, Send, Clock, Calendar,
  FileText, Video, ImageIcon, Megaphone, MessageSquare, Timer, Loader2,
  CheckCircle2, PauseCircle, PlayCircle, Link2
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────
interface CourseMarketingTabProps {
  courseId: string;
  courseName: string;
  courseDescription?: string;
}

const ASSET_TYPES = ['Flyer', 'DP', 'Banner', 'Reel', 'Poster', 'Other'] as const;
const CHANNELS = [
  { id: 'lms', label: 'LMS Notification' },
  { id: 'whatsapp', label: 'WhatsApp Broadcast' },
  { id: 'social', label: 'Social Media Post' },
];
const DELAY_RULES = [
  { value: 'before_start', label: 'Before start date' },
  { value: 'after_start', label: 'After start date' },
  { value: 'day_of', label: 'Day of start' },
];

const ASSET_ICON: Record<string, React.ElementType> = {
  Flyer: FileText, DP: ImageIcon, Banner: Image, Reel: Video, Poster: Image, Other: FileText,
};

export function CourseMarketingTab({ courseId, courseName, courseDescription }: CourseMarketingTabProps) {
  return (
    <Tabs defaultValue="assets" className="space-y-4">
      <TabsList className="bg-background border">
        <TabsTrigger value="assets" className="gap-1.5 text-xs sm:text-sm">
          <Image className="h-4 w-4" /><span className="hidden sm:inline">Assets Library</span>
        </TabsTrigger>
        <TabsTrigger value="posts" className="gap-1.5 text-xs sm:text-sm">
          <Megaphone className="h-4 w-4" /><span className="hidden sm:inline">Promo Posts</span>
        </TabsTrigger>
        <TabsTrigger value="sequences" className="gap-1.5 text-xs sm:text-sm">
          <Timer className="h-4 w-4" /><span className="hidden sm:inline">Sequences</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="assets"><AssetsSection courseId={courseId} /></TabsContent>
      <TabsContent value="posts">
        <PostsSection courseId={courseId} courseName={courseName} courseDescription={courseDescription} />
      </TabsContent>
      <TabsContent value="sequences"><SequencesSection courseId={courseId} /></TabsContent>
    </Tabs>
  );
}

// ════════════════════════════════════════════════════════
// 1. ASSETS LIBRARY
// ════════════════════════════════════════════════════════
function AssetsSection({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [assetType, setAssetType] = useState<string>('Flyer');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['course-assets', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_library_assets')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${courseId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('course-materials').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('course-materials').getPublicUrl(path);

      const { error } = await supabase.from('course_library_assets').insert({
        course_id: courseId,
        title: title.trim(),
        asset_type: assetType.toLowerCase(),
        content_url: urlData.publicUrl,
        metadata: { notes, original_name: file.name },
        tags: [assetType],
      });
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['course-assets', courseId] });
      setUploadOpen(false);
      setTitle(''); setNotes(''); setFile(null);
      toast({ title: 'Asset uploaded' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_library_assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-assets', courseId] }); toast({ title: 'Asset removed' }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Marketing Assets</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" /> Upload Asset
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : assets.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          <Image className="h-10 w-10 mx-auto mb-2 opacity-40" />
          No assets uploaded yet. Add flyers, banners, reels and more.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {assets.map((asset: any) => {
            const Icon = ASSET_ICON[asset.tags?.[0]] || FileText;
            const isImage = asset.content_url?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
            return (
              <Card key={asset.id} className="overflow-hidden group">
                <div className="aspect-square bg-muted/30 relative flex items-center justify-center">
                  {isImage ? (
                    <img src={asset.content_url} alt={asset.title} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className="h-10 w-10 text-muted-foreground/40" />
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => { navigator.clipboard.writeText(asset.content_url || ''); toast({ title: 'Link copied!' }); }}
                      className="p-1.5 rounded-md bg-background/90 border shadow-sm hover:bg-background">
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteAsset.mutate(asset.id)}
                      className="p-1.5 rounded-md bg-background/90 border shadow-sm hover:bg-destructive/10 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <CardContent className="p-3 space-y-1">
                  <p className="text-sm font-medium truncate">{asset.title}</p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">{asset.tags?.[0] || asset.asset_type}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(asset.created_at), 'MMM d')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Marketing Asset</DialogTitle>
            <DialogDescription>Add a flyer, banner, reel or other marketing material</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Summer Course Flyer" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">File *</Label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!title.trim() || !file || uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Uploading…</> : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 2. PROMOTIONAL POSTS
// ════════════════════════════════════════════════════════
function PostsSection({ courseId, courseName, courseDescription }: { courseId: string; courseName: string; courseDescription?: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data: posts = [] } = useQuery({
    queryKey: ['promo-posts', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotional_posts')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createPost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('promotional_posts').insert({
        course_id: courseId,
        title: title.trim(),
        content: content.trim(),
        channels,
        scheduled_at: scheduledAt || null,
        status: scheduledAt ? 'scheduled' : 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo-posts', courseId] });
      setTitle(''); setContent(''); setChannels([]); setScheduledAt('');
      toast({ title: 'Post created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promotional_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promo-posts', courseId] }); toast({ title: 'Post removed' }); },
  });

  const handleAiWrite = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-course-content', {
        body: {
          courseName,
          type: 'marketing_post',
          context: courseDescription || '',
        },
      });
      if (error) throw error;
      if (data?.content) {
        setContent(data.content);
        if (!title.trim() && data.title) setTitle(data.title);
      }
    } catch (e: any) {
      toast({ title: 'AI generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  };

  const toggleChannel = (ch: string) => {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-semibold text-sm">Create Promotional Post</h3>
          <div className="space-y-1.5">
            <Label className="text-xs">Post Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enrollment Open for Tajweed Course!" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Content</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary" onClick={handleAiWrite} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI Write
              </Button>
            </div>
            <Textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Write your promotional content…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Channels</Label>
            <div className="flex flex-wrap gap-3">
              {CHANNELS.map(ch => (
                <label key={ch.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={channels.includes(ch.id)} onCheckedChange={() => toggleChannel(ch.id)} />
                  {ch.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Schedule Date/Time (optional)</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>
          <Button onClick={() => createPost.mutate()} disabled={!title.trim() || !content.trim() || createPost.isPending} className="gap-1.5">
            {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {scheduledAt ? 'Schedule Post' : 'Save Draft'}
          </Button>
        </CardContent>
      </Card>

      {posts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Post History</h4>
          {posts.map((post: any) => (
            <Card key={post.id} className="shadow-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  post.status === 'scheduled' ? 'bg-amber-100 text-amber-600' :
                  post.status === 'sent' ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'
                )}>
                  {post.status === 'scheduled' ? <Clock className="h-4 w-4" /> :
                   post.status === 'sent' ? <CheckCircle2 className="h-4 w-4" /> :
                   <FileText className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{post.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{post.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px]">{post.status}</Badge>
                    {(post.channels || []).map((ch: string) => (
                      <Badge key={ch} variant="secondary" className="text-[10px]">{ch}</Badge>
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {format(new Date(post.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                </div>
                <button onClick={() => deletePost.mutate(post.id)} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// 3. MESSAGE SEQUENCES
// ════════════════════════════════════════════════════════
function SequencesSection({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [delayRule, setDelayRule] = useState('before_start');
  const [delayDays, setDelayDays] = useState(1);
  const [channels, setChannels] = useState<string[]>([]);

  const { data: sequences = [] } = useQuery({
    queryKey: ['msg-sequences', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_message_sequences')
        .select('*')
        .eq('course_id', courseId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const addStep = useMutation({
    mutationFn: async () => {
      const maxOrder = sequences.length > 0 ? Math.max(...sequences.map((s: any) => s.sort_order)) + 1 : 0;
      const { error } = await supabase.from('course_message_sequences').insert({
        course_id: courseId,
        title: title.trim(),
        body: body.trim(),
        delay_rule: delayRule,
        delay_days: delayDays,
        channels,
        sort_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['msg-sequences', courseId] });
      setAddOpen(false);
      setTitle(''); setBody(''); setDelayRule('before_start'); setDelayDays(1); setChannels([]);
      toast({ title: 'Sequence step added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from('course_message_sequences').update({ is_enabled: enabled }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['msg-sequences', courseId] }),
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_message_sequences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['msg-sequences', courseId] }); toast({ title: 'Step removed' }); },
  });

  const toggleChannel = (ch: string) => {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  const ruleLabel = (rule: string, days: number) => {
    if (rule === 'day_of') return 'Day of start';
    return `${days} day${days > 1 ? 's' : ''} ${rule === 'before_start' ? 'before' : 'after'} start`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Automated Message Sequence</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Step
        </Button>
      </div>

      {sequences.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">
          <Timer className="h-10 w-10 mx-auto mb-2 opacity-40" />
          No message sequence configured. Add steps to automate reminders.
        </CardContent></Card>
      ) : (
        <div className="relative pl-6 space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-border" />

          {sequences.map((step: any, idx: number) => (
            <div key={step.id} className="relative flex items-start gap-3 py-3">
              {/* Timeline dot */}
              <div className={cn(
                "absolute left-[-13px] top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10",
                step.is_enabled ? "border-primary bg-primary/10" : "border-muted-foreground/30 bg-muted"
              )}>
                <div className={cn("w-2 h-2 rounded-full", step.is_enabled ? "bg-primary" : "bg-muted-foreground/30")} />
              </div>

              <Card className={cn("flex-1 shadow-sm transition-opacity", !step.is_enabled && "opacity-50")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Clock className="h-3 w-3" />
                          {ruleLabel(step.delay_rule, step.delay_days)}
                        </Badge>
                        {(step.channels || []).map((ch: string) => (
                          <Badge key={ch} variant="secondary" className="text-[10px]">{ch}</Badge>
                        ))}
                      </div>
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{step.body}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={step.is_enabled}
                        onCheckedChange={(v) => toggleEnabled.mutate({ id: step.id, enabled: v })}
                      />
                      <button onClick={() => deleteStep.mutate(step.id)} className="p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Sequence Step</DialogTitle>
            <DialogDescription>Create an automated message for this course</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 3-Day Reminder" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message Body *</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Your course starts in 3 days…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Timing</Label>
                <Select value={delayRule} onValueChange={setDelayRule}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELAY_RULES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {delayRule !== 'day_of' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Days</Label>
                  <Input type="number" min={1} max={30} value={delayDays} onChange={e => setDelayDays(parseInt(e.target.value) || 1)} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Channels</Label>
              <div className="flex flex-wrap gap-3">
                {CHANNELS.map(ch => (
                  <label key={ch.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={channels.includes(ch.id)} onCheckedChange={() => toggleChannel(ch.id)} />
                    {ch.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addStep.mutate()} disabled={!title.trim() || !body.trim() || addStep.isPending}>
              {addStep.isPending ? 'Adding…' : 'Add Step'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
