import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, BookOpen, ArrowLeft, Copy, Trash2, Pencil, Users,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────
interface Referral {
  ambassadorId: string;
  enrollments: number;
}

interface RunSchedule {
  time: string;
  days: string;
}

interface RunEnrollment {
  registered: number;
  active: number;
  completed: number;
  dropped: number;
}

interface Run {
  runId: string;
  year: string;
  batch: string;
  teacher: string;
  teacherExp: string;
  status: string;
  lmsBatchId: string;
  schedule: RunSchedule;
  enrollment: RunEnrollment;
  referrals: Referral[];
  performanceNotes: string;
  runNotes: string;
}

interface AdCreative {
  title: string;
  body: string;
  hashtags: string;
}

interface SupportMessages {
  welcome: string;
  reminder: string;
  lastSeat: string;
  closing: string;
}

interface CourseAsset {
  id: string;
  name: string;
  subject: string;
  level: string;
  ad_creative: AdCreative;
  support_messages: SupportMessages;
  syllabus: string | null;
  runs: Run[];
  linked_course_id: string | null;
  created_at: string;
  updated_at: string;
}

const SUBJECTS = ['Arabic', 'Quran', 'Islamic Studies', 'Urdu', 'English', 'Other'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];
const STATUSES = ['Active', 'Completed', 'Upcoming', 'Draft'];
const YEARS = ['2024', '2025', '2026', '2027'];

const SAMPLE_ASSET: Omit<CourseAsset, 'id' | 'created_at' | 'updated_at' | 'linked_course_id'> = {
  name: 'Spoken Arabic for Beginners',
  subject: 'Arabic',
  level: 'Beginner',
  ad_creative: {
    title: 'Learn Spoken Arabic in 12 Weeks!',
    body: 'Join our beginner-friendly Spoken Arabic course. Master everyday conversations, greetings, and essential phrases with expert guidance. Live interactive sessions, weekly assignments, and a supportive community.',
    hashtags: '#LearnArabic #SpokenArabic #ArabicForBeginners #LanguageLearning',
  },
  support_messages: {
    welcome: 'Assalamu Alaikum! Welcome to Spoken Arabic for Beginners. We are thrilled to have you. Your classes start this Monday at 8 PM PKT. Please keep your notebook ready!',
    reminder: 'Reminder: Your Spoken Arabic class is tomorrow at 8 PM PKT. Don\'t forget to review last week\'s vocabulary list!',
    lastSeat: '🔥 Only 2 seats left in our Spoken Arabic batch starting next week! Enroll now before it fills up.',
    closing: 'JazakAllah Khair for completing the Spoken Arabic course! We hope you enjoyed the journey. Please share your feedback so we can improve.',
  },
  syllabus: 'Week 1: Greetings & Introductions\nWeek 2: Numbers, Days & Time\nWeek 3: Family & Relationships\nWeek 4: Food & Dining\nWeek 5: Directions & Travel\nWeek 6: Mid-course Review & Practice\nWeek 7: Shopping & Bargaining\nWeek 8: Health & Emergencies\nWeek 9: Work & Daily Routine\nWeek 10: Hobbies & Interests\nWeek 11: Formal Conversations\nWeek 12: Final Review & Graduation',
  runs: [
    {
      runId: 'run-001',
      year: '2025',
      batch: 'Shawwal Batch',
      teacher: 'Ustadh Ahmed',
      teacherExp: 'MA Arabic Linguistics, 8 years teaching experience',
      status: 'Active',
      lmsBatchId: '',
      schedule: { time: '8:00 PM PKT', days: 'Mon, Wed, Fri' },
      enrollment: { registered: 32, active: 28, completed: 0, dropped: 4 },
      referrals: [{ ambassadorId: 'AMB-101', enrollments: 5 }],
      performanceNotes: 'Strong engagement. Average attendance 85%.',
      runNotes: 'First run of the revamped curriculum.',
    },
  ],
};

// ─── Helpers ───────────────────────────────────────────
function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast({ title: `${label} copied to clipboard` });
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Active': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'Completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Upcoming': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'Draft': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

// ─── Main Component ────────────────────────────────────
export default function CourseAssetLibrary() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedAsset, setSelectedAsset] = useState<CourseAsset | null>(null);
  const [editingAsset, setEditingAsset] = useState<CourseAsset | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Detail state
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);
  const [detailTab, setDetailTab] = useState('ad');

  // Form state
  const [formTab, setFormTab] = useState('info');
  const [form, setForm] = useState({
    name: '', subject: 'Arabic', level: 'Beginner',
    ad_creative: { title: '', body: '', hashtags: '' } as AdCreative,
    support_messages: { welcome: '', reminder: '', lastSeat: '', closing: '' } as SupportMessages,
    syllabus: '',
    runs: [{
      runId: '', year: '2025', batch: '', teacher: '', teacherExp: '',
      status: 'Draft', lmsBatchId: '',
      schedule: { time: '', days: '' },
      enrollment: { registered: 0, active: 0, completed: 0, dropped: 0 },
      referrals: [] as Referral[],
      performanceNotes: '', runNotes: '',
    }] as Run[],
  });

  // ─── Query ──────────────────────────────────────────
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['course-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_assets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map((row: any) => ({
        ...row,
        ad_creative: (row.ad_creative || { title: '', body: '', hashtags: '' }) as AdCreative,
        support_messages: (row.support_messages || { welcome: '', reminder: '', lastSeat: '', closing: '' }) as SupportMessages,
        runs: (row.runs || []) as Run[],
      })) as CourseAsset[];
      return mapped;
    },
  });

  // Seed sample if empty
  useQuery({
    queryKey: ['course-assets-seed'],
    enabled: !isLoading && assets.length === 0,
    queryFn: async () => {
      const { error } = await supabase.from('course_assets').insert({
        name: SAMPLE_ASSET.name,
        subject: SAMPLE_ASSET.subject,
        level: SAMPLE_ASSET.level,
        ad_creative: SAMPLE_ASSET.ad_creative as any,
        support_messages: SAMPLE_ASSET.support_messages as any,
        syllabus: SAMPLE_ASSET.syllabus,
        runs: SAMPLE_ASSET.runs as any,
      });
      if (!error) queryClient.invalidateQueries({ queryKey: ['course-assets'] });
      return null;
    },
    retry: false,
  });

  // ─── Mutations ──────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        subject: form.subject,
        level: form.level,
        ad_creative: form.ad_creative as any,
        support_messages: form.support_messages as any,
        syllabus: form.syllabus || null,
        runs: form.runs as any,
      };
      if (editingAsset) {
        const { error } = await supabase.from('course_assets').update(payload).eq('id', editingAsset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('course_assets').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-assets'] });
      toast({ title: editingAsset ? 'Course asset updated' : 'Course asset created' });
      setView('list');
      setEditingAsset(null);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('course_assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-assets'] });
      toast({ title: 'Course asset deleted' });
      setView('list');
      setSelectedAsset(null);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // ─── Filtering ──────────────────────────────────────
  const filtered = useMemo(() => {
    return assets.filter(a => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
      const matchSubject = filterSubject === 'all' || a.subject === filterSubject;
      const matchLevel = filterLevel === 'all' || a.level === filterLevel;
      const latestRun = a.runs?.[a.runs.length - 1];
      const matchStatus = filterStatus === 'all' || latestRun?.status === filterStatus;
      return matchSearch && matchSubject && matchLevel && matchStatus;
    });
  }, [assets, search, filterSubject, filterLevel, filterStatus]);

  // ─── Form helpers ───────────────────────────────────
  const openNewForm = () => {
    setEditingAsset(null);
    setForm({
      name: '', subject: 'Arabic', level: 'Beginner',
      ad_creative: { title: '', body: '', hashtags: '' },
      support_messages: { welcome: '', reminder: '', lastSeat: '', closing: '' },
      syllabus: '',
      runs: [{
        runId: `run-${Date.now()}`, year: '2025', batch: '', teacher: '', teacherExp: '',
        status: 'Draft', lmsBatchId: '',
        schedule: { time: '', days: '' },
        enrollment: { registered: 0, active: 0, completed: 0, dropped: 0 },
        referrals: [],
        performanceNotes: '', runNotes: '',
      }],
    });
    setFormTab('info');
    setView('form');
  };

  const openEditForm = (asset: CourseAsset) => {
    setEditingAsset(asset);
    setForm({
      name: asset.name,
      subject: asset.subject,
      level: asset.level,
      ad_creative: { ...asset.ad_creative },
      support_messages: { ...asset.support_messages },
      syllabus: asset.syllabus || '',
      runs: asset.runs.map(r => ({ ...r, schedule: { ...r.schedule }, enrollment: { ...r.enrollment }, referrals: r.referrals?.map(ref => ({ ...ref })) || [] })),
    });
    setFormTab('info');
    setView('form');
  };

  const openDetail = (asset: CourseAsset) => {
    setSelectedAsset(asset);
    setSelectedRunIndex(0);
    setDetailTab('ad');
    setView('detail');
  };

  const updateRun = (index: number, field: string, value: any) => {
    setForm(prev => {
      const runs = [...prev.runs];
      runs[index] = { ...runs[index], [field]: value };
      return { ...prev, runs };
    });
  };

  const updateRunNested = (index: number, parent: 'schedule' | 'enrollment', field: string, value: any) => {
    setForm(prev => {
      const runs = [...prev.runs];
      runs[index] = { ...runs[index], [parent]: { ...runs[index][parent], [field]: value } };
      return { ...prev, runs };
    });
  };

  const addReferral = (runIndex: number) => {
    setForm(prev => {
      const runs = [...prev.runs];
      runs[runIndex] = { ...runs[runIndex], referrals: [...(runs[runIndex].referrals || []), { ambassadorId: '', enrollments: 0 }] };
      return { ...prev, runs };
    });
  };

  const removeReferral = (runIndex: number, refIndex: number) => {
    setForm(prev => {
      const runs = [...prev.runs];
      const refs = [...(runs[runIndex].referrals || [])];
      refs.splice(refIndex, 1);
      runs[runIndex] = { ...runs[runIndex], referrals: refs };
      return { ...prev, runs };
    });
  };

  const updateReferral = (runIndex: number, refIndex: number, field: keyof Referral, value: any) => {
    setForm(prev => {
      const runs = [...prev.runs];
      const refs = [...(runs[runIndex].referrals || [])];
      refs[refIndex] = { ...refs[refIndex], [field]: value };
      runs[runIndex] = { ...runs[runIndex], referrals: refs };
      return { ...prev, runs };
    });
  };

  // Current run for form (always index 0 for now, can extend)
  const ri = 0;
  const currentRun = form.runs[ri] || {} as Run;

  // ─── RENDER ─────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* ─── LIST VIEW ─────────────────────── */}
        {view === 'list' && (
          <>
            {/* Header */}
            <div className="page-header-premium rounded-xl p-6 mb-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                    <BookOpen className="h-6 w-6" />
                    Course Asset Library
                  </h1>
                  <p className="text-white/80 mt-1">Manage course templates, ad creatives, and run history</p>
                </div>
                <Button onClick={openNewForm} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" /> New Course Asset
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search courses…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">No course assets found.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(asset => {
                  const latestRun = asset.runs?.[asset.runs.length - 1];
                  const enrollment = latestRun?.enrollment;
                  return (
                    <Card
                      key={asset.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow border-border"
                      onClick={() => openDetail(asset)}
                    >
                      <CardContent className="p-5 space-y-3">
                        <h3 className="font-semibold text-foreground text-lg leading-tight">{asset.name}</h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-accent text-accent">{asset.subject}</Badge>
                          <Badge variant="outline">{asset.level}</Badge>
                          {latestRun && (
                            <Badge className={getStatusColor(latestRun.status)}>{latestRun.status}</Badge>
                          )}
                        </div>
                        {latestRun && (
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {latestRun.teacher || '—'}</p>
                            {enrollment && (
                              <p className="text-xs">
                                {enrollment.registered} registered · {enrollment.active} active · {enrollment.completed} completed
                              </p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ─── DETAIL VIEW ───────────────────── */}
        {view === 'detail' && selectedAsset && (() => {
          const runs = selectedAsset.runs || [];
          const run = runs[selectedRunIndex];
          const ad = selectedAsset.ad_creative;
          const sm = selectedAsset.support_messages;

          return (
            <>
              {/* Back + Header */}
              <div className="flex items-center gap-3 mb-4">
                <Button variant="ghost" size="sm" onClick={() => setView('list')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => openEditForm(selectedAsset)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(selectedAsset.id)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>

              <div className="space-y-1 mb-4">
                <h1 className="text-2xl font-serif font-bold text-foreground">{selectedAsset.name}</h1>
                <div className="flex gap-2">
                  <Badge variant="outline" className="border-accent text-accent">{selectedAsset.subject}</Badge>
                  <Badge variant="outline">{selectedAsset.level}</Badge>
                </div>
              </div>

              {/* Run pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {runs.map((r, i) => (
                  <Button
                    key={r.runId}
                    size="sm"
                    variant={selectedRunIndex === i ? 'default' : 'outline'}
                    onClick={() => setSelectedRunIndex(i)}
                    className="rounded-full"
                  >
                    {r.batch} {r.year}
                  </Button>
                ))}
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEditForm(selectedAsset)}>
                  <Plus className="h-3 w-3 mr-1" /> New Run
                </Button>
              </div>

              {/* Tabs */}
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList>
                  <TabsTrigger value="ad">Ad Creative</TabsTrigger>
                  <TabsTrigger value="messages">Support Messages</TabsTrigger>
                  <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
                  <TabsTrigger value="teacher">Teacher</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="ad" className="space-y-4 mt-4">
                  <CopyField label="Title" value={ad?.title} />
                  <CopyField label="Body" value={ad?.body} multiline />
                  <CopyField label="Hashtags" value={ad?.hashtags} />
                </TabsContent>

                <TabsContent value="messages" className="space-y-4 mt-4">
                  <CopyField label="Welcome" value={sm?.welcome} multiline />
                  <CopyField label="Reminder" value={sm?.reminder} multiline />
                  <CopyField label="Last Seat" value={sm?.lastSeat} multiline />
                  <CopyField label="Closing" value={sm?.closing} multiline />
                </TabsContent>

                <TabsContent value="syllabus" className="mt-4">
                  <CopyField label="Syllabus" value={selectedAsset.syllabus || ''} multiline />
                </TabsContent>

                <TabsContent value="teacher" className="mt-4 space-y-3">
                  {run ? (
                    <>
                      <div>
                        <Label className="text-muted-foreground text-xs">Teacher</Label>
                        <p className="text-foreground font-medium">{run.teacher || '—'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Qualifications</Label>
                        <p className="text-foreground">{run.teacherExp || '—'}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No run selected.</p>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="mt-4 space-y-4">
                  {run ? (
                    <>
                      <div>
                        <Label className="text-muted-foreground text-xs">Performance Notes</Label>
                        <p className="text-foreground whitespace-pre-wrap">{run.performanceNotes || '—'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Run Outcome / Lessons Learned</Label>
                        <p className="text-foreground whitespace-pre-wrap">{run.runNotes || '—'}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No run selected.</p>
                  )}
                </TabsContent>
              </Tabs>
            </>
          );
        })()}

        {/* ─── FORM VIEW ─────────────────────── */}
        {view === 'form' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="sm" onClick={() => { setView('list'); setEditingAsset(null); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <h1 className="text-xl font-serif font-bold text-foreground">
                {editingAsset ? 'Edit Course Asset' : 'New Course Asset'}
              </h1>
            </div>

            <Tabs value={formTab} onValueChange={setFormTab}>
              <TabsList className="flex-wrap">
                <TabsTrigger value="info">Template Info</TabsTrigger>
                <TabsTrigger value="run">Run Info</TabsTrigger>
                <TabsTrigger value="ad">Ad Creative</TabsTrigger>
                <TabsTrigger value="messages">Support Messages</TabsTrigger>
                <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
              </TabsList>

              {/* Template Info */}
              <TabsContent value="info" className="mt-4 space-y-4 max-w-xl">
                <div>
                  <Label>Course Name</Label>
                  <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Select value={form.subject} onValueChange={v => setForm(prev => ({ ...prev, subject: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Level</Label>
                  <Select value={form.level} onValueChange={v => setForm(prev => ({ ...prev, level: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* Run Info */}
              <TabsContent value="run" className="mt-4 space-y-4 max-w-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Run ID</Label>
                    <Input value={currentRun.runId} onChange={e => updateRun(ri, 'runId', e.target.value)} />
                  </div>
                  <div>
                    <Label>Year</Label>
                    <Select value={currentRun.year} onValueChange={v => updateRun(ri, 'year', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Batch Name</Label>
                    <Input value={currentRun.batch} onChange={e => updateRun(ri, 'batch', e.target.value)} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={currentRun.status} onValueChange={v => updateRun(ri, 'status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Teacher Name</Label>
                    <Input value={currentRun.teacher} onChange={e => updateRun(ri, 'teacher', e.target.value)} />
                  </div>
                  <div>
                    <Label>Teacher Qualifications</Label>
                    <Input value={currentRun.teacherExp} onChange={e => updateRun(ri, 'teacherExp', e.target.value)} />
                  </div>
                  <div>
                    <Label>Schedule Time</Label>
                    <Input value={currentRun.schedule?.time || ''} onChange={e => updateRunNested(ri, 'schedule', 'time', e.target.value)} placeholder="e.g. 8:00 PM PKT" />
                  </div>
                  <div>
                    <Label>Schedule Days</Label>
                    <Input value={currentRun.schedule?.days || ''} onChange={e => updateRunNested(ri, 'schedule', 'days', e.target.value)} placeholder="e.g. Mon, Wed, Fri" />
                  </div>
                </div>
                <div>
                  <Label>Link to LMS Course ID (optional)</Label>
                  <Input value={currentRun.lmsBatchId} onChange={e => updateRun(ri, 'lmsBatchId', e.target.value)} />
                </div>

                <h3 className="text-sm font-semibold text-foreground pt-2">Enrollment</h3>
                <div className="grid grid-cols-4 gap-3">
                  {(['registered', 'active', 'completed', 'dropped'] as const).map(field => (
                    <div key={field}>
                      <Label className="capitalize text-xs">{field}</Label>
                      <Input
                        type="number" min={0}
                        value={currentRun.enrollment?.[field] ?? 0}
                        onChange={e => updateRunNested(ri, 'enrollment', field, parseInt(e.target.value) || 0)}
                      />
                    </div>
                  ))}
                </div>

                <h3 className="text-sm font-semibold text-foreground pt-2">Referral Tracking</h3>
                {(currentRun.referrals || []).map((ref, refI) => (
                  <div key={refI} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Ambassador ID</Label>
                      <Input value={ref.ambassadorId} onChange={e => updateReferral(ri, refI, 'ambassadorId', e.target.value)} />
                    </div>
                    <div className="w-28">
                      <Label className="text-xs">Enrollments</Label>
                      <Input type="number" min={0} value={ref.enrollments} onChange={e => updateReferral(ri, refI, 'enrollments', parseInt(e.target.value) || 0)} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeReferral(ri, refI)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => addReferral(ri)}>
                  <Plus className="h-3 w-3 mr-1" /> Add Referral
                </Button>
              </TabsContent>

              {/* Ad Creative */}
              <TabsContent value="ad" className="mt-4 space-y-4 max-w-xl">
                <div>
                  <Label>Post Title</Label>
                  <Input value={form.ad_creative.title} onChange={e => setForm(prev => ({ ...prev, ad_creative: { ...prev.ad_creative, title: e.target.value } }))} />
                </div>
                <div>
                  <Label>Post Body</Label>
                  <Textarea rows={10} value={form.ad_creative.body} onChange={e => setForm(prev => ({ ...prev, ad_creative: { ...prev.ad_creative, body: e.target.value } }))} />
                </div>
                <div>
                  <Label>Hashtags</Label>
                  <Input value={form.ad_creative.hashtags} onChange={e => setForm(prev => ({ ...prev, ad_creative: { ...prev.ad_creative, hashtags: e.target.value } }))} />
                </div>
                <div>
                  <Label>Performance Notes</Label>
                  <Textarea rows={3} value={currentRun.performanceNotes} onChange={e => updateRun(ri, 'performanceNotes', e.target.value)} />
                </div>
              </TabsContent>

              {/* Support Messages */}
              <TabsContent value="messages" className="mt-4 space-y-4 max-w-xl">
                {(['welcome', 'reminder', 'lastSeat', 'closing'] as const).map(key => (
                  <div key={key}>
                    <Label className="capitalize">{key === 'lastSeat' ? 'Last Seat' : key}</Label>
                    <Textarea rows={3} value={form.support_messages[key]} onChange={e => setForm(prev => ({ ...prev, support_messages: { ...prev.support_messages, [key]: e.target.value } }))} />
                  </div>
                ))}
              </TabsContent>

              {/* Syllabus */}
              <TabsContent value="syllabus" className="mt-4 space-y-4 max-w-xl">
                <div>
                  <Label>Week-by-Week Syllabus</Label>
                  <Textarea rows={14} value={form.syllabus} onChange={e => setForm(prev => ({ ...prev, syllabus: e.target.value }))} />
                </div>
                <div>
                  <Label>Run Outcome / Lessons Learned</Label>
                  <Textarea rows={4} value={currentRun.runNotes} onChange={e => updateRun(ri, 'runNotes', e.target.value)} />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => { setView('list'); setEditingAsset(null); }}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : editingAsset ? 'Update' : 'Create'}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── CopyField Component ──────────────────────────────
function CopyField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Label className="text-muted-foreground text-xs">{label}</Label>
            <p className={`text-foreground mt-1 ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>
              {value || '—'}
            </p>
          </div>
          {value && (
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copyToClipboard(value, label)}>
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
