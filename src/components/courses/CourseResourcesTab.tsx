import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  FolderOpen, Upload, Plus, Trash2, FileText, Video, Music, Link2, Eye,
  EyeOff, Loader2, BookOpen, CheckCircle2, Clock, Edit, History,
  Star, Award, Medal, Trophy, Target, Zap, Heart, Shield, Crown,
  Sparkles, Bot, ExternalLink, Copy, ClipboardCopy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CourseResourcesTabProps {
  courseId: string;
  courseName?: string;
}

// Icon map for badges
const BADGE_ICONS: Record<string, React.ElementType> = {
  star: Star, award: Award, medal: Medal, trophy: Trophy,
  target: Target, zap: Zap, heart: Heart, shield: Shield, crown: Crown,
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
export function CourseResourcesTab({ courseId, courseName }: CourseResourcesTabProps) {
  return (
    <Tabs defaultValue="materials" className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
        <TabsTrigger value="materials" className="gap-1.5 text-xs"><FolderOpen className="h-3.5 w-3.5" /> Materials</TabsTrigger>
        <TabsTrigger value="lesson-planner" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" /> Lesson Planner</TabsTrigger>
        <TabsTrigger value="teacher-guide" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Teacher Guide</TabsTrigger>
        <TabsTrigger value="ai-tools" className="gap-1.5 text-xs"><Bot className="h-3.5 w-3.5" /> AI Tools</TabsTrigger>
        <TabsTrigger value="gamification" className="gap-1.5 text-xs"><Trophy className="h-3.5 w-3.5" /> Gamification</TabsTrigger>
      </TabsList>

      <TabsContent value="materials"><TeachingOSKitsSection courseId={courseId} /><MaterialsSection courseId={courseId} /></TabsContent>
      <TabsContent value="lesson-planner"><LessonPlannerSection courseId={courseId} /></TabsContent>
      <TabsContent value="teacher-guide"><TeacherGuideSection courseId={courseId} /></TabsContent>
      <TabsContent value="ai-tools"><AIToolsDock courseId={courseId} courseName={courseName} /></TabsContent>
      <TabsContent value="gamification"><GamificationSection courseId={courseId} /></TabsContent>
    </Tabs>
  );
}

// ═══════════════════════════════════════════════════
// 0. TEACHING OS KITS — Content generated via Teaching OS
// ═══════════════════════════════════════════════════
function TeachingOSKitsSection({ courseId }: { courseId: string }) {
  const navigate = useNavigate();

  const { data: teachingKits = [] } = useQuery({
    queryKey: ['teaching-kits-for-course', courseId],
    queryFn: async () => {
      const { data: syl } = await supabase.from('syllabi')
        .select('id').eq('course_id', courseId).limit(1);
      if (!syl?.length) return [];

      const { data: sessions } = await supabase.from('session_plans')
        .select('id, week_number, session_number, session_title')
        .eq('syllabus_id', syl[0].id)
        .order('week_number');
      if (!sessions?.length) return [];

      const sessionIds = sessions.map(s => s.id);
      const { data: kits } = await supabase.from('content_kits')
        .select('id, session_plan_id, status')
        .in('session_plan_id', sessionIds);

      return sessions.map(s => ({
        ...s,
        kit: kits?.find(k => k.session_plan_id === s.id) || null,
      }));
    },
    enabled: !!courseId,
  });

  if (teachingKits.length === 0) return null;

  const generatedCount = teachingKits.filter(k => k.kit).length;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold text-sm">Teaching OS Content</h3>
          <Badge variant="secondary" className="text-xs">{generatedCount} kits generated</Badge>
        </div>
        <div className="space-y-1">
          {teachingKits.map(session => (
            <div key={session.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <div>
                <p className="text-sm font-medium">W{session.week_number}S{session.session_number}: {session.session_title}</p>
              </div>
              {session.kit ? (
                <Button variant="ghost" size="sm" className="text-xs"
                  onClick={() => navigate(`/teaching-os/content-kit?session_id=${session.id}`)}>
                  View Kit →
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Not generated</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════
// 1. MATERIALS — File manager with visibility
// ═══════════════════════════════════════════════════
function MaterialsSection({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [assetType, setAssetType] = useState('pdf');
  const [visibility, setVisibility] = useState('all');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['course-materials', courseId],
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

  const uploadAsset = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      let finalUrl = fileUrl;

      if (file) {
        const path = `${courseId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('course-materials').upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('course-materials').getPublicUrl(path);
        finalUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('course_library_assets').insert({
        course_id: courseId,
        title: title.trim(),
        asset_type: assetType,
        content_url: finalUrl || null,
        visibility,
        owner_id: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-materials', courseId] });
      setUploadOpen(false);
      setTitle(''); setFileUrl(''); setAssetType('pdf');
      toast({ title: 'Material uploaded' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_library_assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-materials', courseId] });
      toast({ title: 'Material deleted' });
    },
  });

  const typeIcon = (t: string) => {
    if (t === 'video') return <Video className="h-4 w-4 text-blue-500" />;
    if (t === 'audio') return <Music className="h-4 w-4 text-purple-500" />;
    if (t === 'link') return <Link2 className="h-4 w-4 text-cyan-500" />;
    return <FileText className="h-4 w-4 text-amber-500" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">📁 Course Materials</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" /> Upload
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : assets.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No materials uploaded yet. Upload PDFs, videos, audio, or links.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a: any) => (
            <Card key={a.id} className="shadow-sm">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {typeIcon(a.asset_type)}
                    <p className="text-sm font-medium truncate">{a.title}</p>
                  </div>
                  <button onClick={() => deleteAsset.mutate(a.id)} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">{a.asset_type}</Badge>
                  <Badge variant="outline" className={cn("text-[10px]",
                    a.visibility === 'all' ? 'border-emerald-200 text-emerald-600' : 'border-amber-200 text-amber-600'
                  )}>
                    {a.visibility === 'all' ? <><Eye className="h-2.5 w-2.5 mr-0.5" /> All</> : <><EyeOff className="h-2.5 w-2.5 mr-0.5" /> Teachers</>}
                  </Badge>
                </div>
                {a.content_url && (
                  <a href={a.content_url} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Material</DialogTitle>
            <DialogDescription>Add a file or link to this course</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Material title" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">File</Label>
              <Input ref={fileRef} type="file" className="cursor-pointer" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Or paste URL</Label>
              <Input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Visibility</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  <SelectItem value="teachers">Teachers Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={() => uploadAsset.mutate()} disabled={!title.trim() || uploadAsset.isPending}>
              {uploadAsset.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 2. LESSON PLANNER
// ═══════════════════════════════════════════════════
function LessonPlannerSection({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ week_number: 1, lesson_date: '', topic: '', objectives: '', material_url: '', material_title: '' });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['course-lesson-plans', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_lesson_plans')
        .select('*')
        .eq('course_id', courseId)
        .order('week_number');
      if (error) throw error;
      return data || [];
    },
  });

  const addPlan = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('course_lesson_plans').insert({
        course_id: courseId,
        week_number: form.week_number,
        lesson_date: form.lesson_date || null,
        topic: form.topic.trim(),
        objectives: form.objectives.trim() || null,
        material_url: form.material_url.trim() || null,
        material_title: form.material_title.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-lesson-plans', courseId] });
      setAddOpen(false);
      setForm({ week_number: plans.length + 2, lesson_date: '', topic: '', objectives: '', material_url: '', material_title: '' });
      toast({ title: 'Lesson added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === 'planned' ? 'delivered' : 'planned';
      const { error } = await supabase.from('course_lesson_plans').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-lesson-plans', courseId] }),
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_lesson_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-lesson-plans', courseId] });
      toast({ title: 'Lesson deleted' });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">📋 Lesson Planner</h3>
        <Button size="sm" className="gap-1.5" onClick={() => { setForm(f => ({ ...f, week_number: plans.length + 1 })); setAddOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Lesson
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : plans.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No lessons planned yet. Add your weekly lesson schedule.
        </CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Week</TableHead>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead className="hidden md:table-cell">Objectives</TableHead>
                  <TableHead className="hidden md:table-cell">Materials</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-center">{p.week_number}</TableCell>
                    <TableCell className="text-xs">{p.lesson_date ? format(new Date(p.lesson_date), 'MMM d, yyyy') : '—'}</TableCell>
                    <TableCell className="text-sm">{p.topic || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">{p.objectives || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p.material_url ? (
                        <a href={p.material_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Link2 className="h-3 w-3" /> {p.material_title || 'Link'}
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => toggleStatus.mutate({ id: p.id, status: p.status })}
                        className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                          p.status === 'delivered'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20'
                        )}>
                        {p.status === 'delivered' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {p.status === 'delivered' ? 'Delivered' : 'Planned'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => deletePlan.mutate(p.id)} className="p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add Lesson Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Lesson</DialogTitle>
            <DialogDescription>Plan a new weekly lesson</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Week #</Label>
                <Input type="number" min={1} value={form.week_number} onChange={e => setForm(f => ({ ...f, week_number: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.lesson_date} onChange={e => setForm(f => ({ ...f, lesson_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Topic *</Label>
              <Input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="Lesson topic" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Objectives</Label>
              <Textarea value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))} rows={2} placeholder="Learning objectives…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Material Title</Label>
                <Input value={form.material_title} onChange={e => setForm(f => ({ ...f, material_title: e.target.value }))} placeholder="e.g. Chapter 3 PDF" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Material URL</Label>
                <Input value={form.material_url} onChange={e => setForm(f => ({ ...f, material_url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addPlan.mutate()} disabled={!form.topic.trim() || addPlan.isPending}>
              {addPlan.isPending ? 'Adding…' : 'Add Lesson'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 3. TEACHER GUIDE — Rich text editor with versions
// ═══════════════════════════════════════════════════
function TeacherGuideSection({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: guide, isLoading } = useQuery({
    queryKey: ['course-teacher-guide', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_teacher_guides')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  React.useEffect(() => {
    if (guide && !loaded) {
      setContent(guide.content_html || '');
      setLoaded(true);
    }
    if (!guide && !isLoading && !loaded) {
      setLoaded(true);
    }
  }, [guide, isLoading, loaded]);

  const { data: versions = [] } = useQuery({
    queryKey: ['course-guide-versions', guide?.id],
    queryFn: async () => {
      if (!guide?.id) return [];
      const { data, error } = await supabase
        .from('course_teacher_guide_versions')
        .select('*')
        .eq('guide_id', guide.id)
        .order('version', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!guide?.id,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (guide) {
        // Save version history
        await supabase.from('course_teacher_guide_versions').insert({
          guide_id: guide.id,
          version: guide.version,
          content_html: guide.content_html,
          edited_by: user?.id || null,
        });
        // Update guide
        const { error } = await supabase.from('course_teacher_guides').update({
          content_html: content,
          version: guide.version + 1,
          last_edited_by: user?.id || null,
        }).eq('id', guide.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('course_teacher_guides').insert({
          course_id: courseId,
          content_html: content,
          last_edited_by: user?.id || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-teacher-guide', courseId] });
      qc.invalidateQueries({ queryKey: ['course-guide-versions'] });
      toast({ title: 'Guide saved' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">📖 Teacher Guide</h3>
          <p className="text-[11px] text-muted-foreground">Visible to assigned teachers only. Version {guide?.version || 1}</p>
        </div>
        <div className="flex gap-2">
          {guide && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4" /> History ({versions.length})
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <Textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={16}
        className="font-mono text-sm"
        placeholder="Write the teacher guide here... Supports plain text or HTML content."
      />

      {/* Version History Drawer */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
            <SheetDescription>Previous versions of the teacher guide</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            {versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No previous versions</p>
            ) : versions.map((v: any) => (
              <Card key={v.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">v{v.version}</Badge>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(v.created_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  <pre className="text-xs bg-muted/30 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">{v.content_html?.substring(0, 500)}{v.content_html?.length > 500 ? '…' : ''}</pre>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => {
                    setContent(v.content_html || '');
                    setHistoryOpen(false);
                    toast({ title: `Restored version ${v.version}` });
                  }}>
                    Restore this version
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 4. AI TOOLS DOCK
// ═══════════════════════════════════════════════════
function AIToolsDock({ courseId, courseName }: { courseId: string; courseName?: string }) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard!' });
  };

  const tools = [
    {
      name: 'NotebookLM',
      description: 'Google AI notebook for research and summarization',
      icon: BookOpen,
      color: 'text-blue-600 bg-blue-500/10',
      action: () => {
        copyToClipboard(courseName || 'Course');
        window.open('https://notebooklm.google.com/', '_blank');
      },
      actionLabel: 'Open (title copied)',
    },
    {
      name: 'Magic School AI',
      description: 'AI tools for educators — lesson plans, rubrics, assessments',
      icon: Sparkles,
      color: 'text-purple-600 bg-purple-500/10',
      action: () => window.open('https://www.magicschool.ai/', '_blank'),
      actionLabel: 'Open',
    },
    {
      name: 'Ask AI',
      description: 'In-app AI assistant scoped to your course content',
      icon: Bot,
      color: 'text-emerald-600 bg-emerald-500/10',
      action: null, // handled inline
      actionLabel: 'Chat',
    },
  ];

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', content: chatInput.trim() };
    const msgs = [...chatMessages, userMsg];
    setChatMessages(msgs);
    setChatInput('');
    setChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-course-content', {
        body: {
          prompt: chatInput.trim(),
          context: `Course: ${courseName || 'Unknown'}. You are an AI assistant helping with this course.`,
        },
      });
      if (error) throw error;
      setChatMessages(prev => [...prev, { role: 'assistant', content: data?.content || data?.text || 'No response received.' }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">🤖 AI Tools Dock</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {tools.map(tool => (
          <Card key={tool.name} className="shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-4 space-y-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", tool.color)}>
                <tool.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{tool.name}</p>
                <p className="text-[11px] text-muted-foreground">{tool.description}</p>
              </div>
              {tool.action ? (
                <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={tool.action}>
                  <ExternalLink className="h-3.5 w-3.5" /> {tool.actionLabel}
                </Button>
              ) : (
                <Button size="sm" className="w-full gap-1.5 text-xs" onClick={() => setChatOpen(true)}>
                  <Bot className="h-3.5 w-3.5" /> {tool.actionLabel}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Chat Dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> Ask AI — {courseName}</DialogTitle>
            <DialogDescription>Ask questions about your course content</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-[200px] max-h-[400px]">
            {chatMessages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Ask anything about your course…</p>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("p-2.5 rounded-lg text-sm",
                msg.role === 'user' ? 'bg-primary/10 ml-8' : 'bg-muted mr-8')}>
                {msg.content}
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t">
            <Input value={chatInput} onChange={e => setChatInput(e.target.value)}
              placeholder="Ask a question…"
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()} />
            <Button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}>Send</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 5. GAMIFICATION — Badges
// ═══════════════════════════════════════════════════
function GamificationSection({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [badgeName, setBadgeName] = useState('');
  const [badgeIcon, setBadgeIcon] = useState('star');
  const [badgeCriteria, setBadgeCriteria] = useState('');

  const { data: badges = [], isLoading } = useQuery({
    queryKey: ['course-badges', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_badges')
        .select('*, awards:course_student_badges(id, student_id, awarded_at)')
        .eq('course_id', courseId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: enrolledStudents = [] } = useQuery({
    queryKey: ['course-enrolled-gamification', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_enrollments')
        .select('student_id, profile:student_id(id, full_name)')
        .eq('course_id', courseId)
        .eq('status', 'active');
      return data || [];
    },
  });

  const createBadge = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('course_badges').insert({
        course_id: courseId,
        name: badgeName.trim(),
        icon_key: badgeIcon,
        criteria: badgeCriteria.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-badges', courseId] });
      setCreateOpen(false);
      setBadgeName(''); setBadgeCriteria('');
      toast({ title: 'Badge created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteBadge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_badges').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-badges', courseId] });
      toast({ title: 'Badge deleted' });
    },
  });

  const awardBadge = useMutation({
    mutationFn: async ({ badgeId, studentId }: { badgeId: string; studentId: string }) => {
      const { error } = await supabase.from('course_student_badges').insert({
        badge_id: badgeId,
        student_id: studentId,
        awarded_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-badges', courseId] });
      toast({ title: 'Badge awarded!' });
    },
    onError: (e: any) => {
      if (e.message?.includes('duplicate')) toast({ title: 'Already awarded', variant: 'destructive' });
      else toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const revokeBadge = useMutation({
    mutationFn: async ({ badgeId, studentId }: { badgeId: string; studentId: string }) => {
      const { error } = await supabase.from('course_student_badges')
        .delete()
        .eq('badge_id', badgeId)
        .eq('student_id', studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-badges', courseId] });
      toast({ title: 'Badge revoked' });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">🏆 Gamification — Badges</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Badge
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : badges.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No badges created yet. Create badges to reward student achievements.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge: any) => {
            const IconComp = BADGE_ICONS[badge.icon_key] || Star;
            const awardCount = badge.awards?.length || 0;
            return (
              <Card key={badge.id} className="shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <IconComp className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{badge.name}</p>
                        <p className="text-[10px] text-muted-foreground">{awardCount} awarded</p>
                      </div>
                    </div>
                    <button onClick={() => deleteBadge.mutate(badge.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {badge.criteria && (
                    <p className="text-[11px] text-muted-foreground italic">{badge.criteria}</p>
                  )}
                  <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs"
                    onClick={() => setAssignOpen(badge.id)}>
                    <Award className="h-3.5 w-3.5" /> Assign to Students
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Badge Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Badge</DialogTitle>
            <DialogDescription>Define a new achievement badge</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Badge Name *</Label>
              <Input value={badgeName} onChange={e => setBadgeName(e.target.value)} placeholder="e.g. Perfect Attendance" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Icon</Label>
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(BADGE_ICONS).map(([key, Icon]) => (
                  <button key={key} onClick={() => setBadgeIcon(key)}
                    className={cn("w-9 h-9 rounded-lg flex items-center justify-center border transition-colors",
                      badgeIcon === key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30')}>
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Criteria</Label>
              <Textarea value={badgeCriteria} onChange={e => setBadgeCriteria(e.target.value)} rows={2} placeholder="What earns this badge?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createBadge.mutate()} disabled={!badgeName.trim() || createBadge.isPending}>
              {createBadge.isPending ? 'Creating…' : 'Create Badge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Badge Dialog */}
      {assignOpen && (() => {
        const badge = badges.find((b: any) => b.id === assignOpen);
        const awardedIds = new Set((badge?.awards || []).map((a: any) => a.student_id));

        return (
          <Dialog open={!!assignOpen} onOpenChange={() => setAssignOpen(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Assign "{badge?.name}" Badge</DialogTitle>
                <DialogDescription>Select students to award this badge</DialogDescription>
              </DialogHeader>
              <div className="max-h-60 overflow-y-auto border rounded-md">
                {enrolledStudents.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No enrolled students</p>
                ) : enrolledStudents.map((e: any) => {
                  const hasAward = awardedIds.has(e.student_id);
                  return (
                    <div key={e.student_id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50">
                      <span className="text-sm">{e.profile?.full_name || 'Unknown'}</span>
                      {hasAward ? (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive"
                          onClick={() => revokeBadge.mutate({ badgeId: assignOpen!, studentId: e.student_id })}>
                          Revoke
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                          onClick={() => awardBadge.mutate({ badgeId: assignOpen!, studentId: e.student_id })}>
                          <Award className="h-3 w-3" /> Award
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignOpen(null)}>Done</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
