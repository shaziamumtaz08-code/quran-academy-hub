import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Loader2, Copy, Share2, Trash2, Eye, FileText, Pencil,
  ClipboardCheck, Trophy, Link as LinkIcon, Globe, Lock, Play, Square, Upload, X
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
import { format } from 'date-fns';

export default function QuizEngine() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('banks');
  const [createOpen, setCreateOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '', name: '', description: '', language: 'en', mode: 'public' as string,
    course_id: '', difficulty_level: 'mixed' as string,
    questions_per_attempt: 10, time_limit_minutes: 0,
    max_attempts: 1, passing_percentage: 50,
  });

  const [extractingPdf, setExtractingPdf] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; text: string }[]>([]);

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', language: 'en',
    course_id: '', mode: 'public' as 'authenticated' | 'public',
    mcq: 5, tf: 3, fib: 2,
    difficulty_level: 'mixed' as 'easy' | 'medium' | 'hard' | 'mixed',
    questions_per_attempt: 10, time_limit_minutes: 0,
    max_attempts: 1, passing_percentage: 50,
    source_content: '',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setExtractingPdf(true);
    try {
      const newFiles: { name: string; text: string }[] = [];
      for (let i = 0; i < Math.min(files.length, 5); i++) {
        const file = files[i];
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = '';
          for (let p = 1; p <= Math.min(pdf.numPages, 50); p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            text += content.items.map((item: any) => item.str).join(' ') + '\n';
          }
          newFiles.push({ name: file.name, text: text.trim() });
        } else {
          const text = await file.text();
          newFiles.push({ name: file.name, text: text.trim() });
        }
      }
      setUploadedFiles(prev => [...prev, ...newFiles].slice(0, 5));
      const allText = [...uploadedFiles, ...newFiles].map(f => `[SOURCE: ${f.name}]\n${f.text}`).join('\n\n');
      setForm(prev => ({ ...prev, source_content: allText }));
      toast({ title: `${newFiles.length} file(s) processed` });
    } catch (err: any) {
      toast({ title: 'File processing failed', description: err.message, variant: 'destructive' });
    } finally {
      setExtractingPdf(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
    const allText = updated.map(f => `[SOURCE: ${f.name}]\n${f.text}`).join('\n\n');
    setForm(prev => ({ ...prev, source_content: allText }));
  };

  // Load courses for dropdown
  const { data: courses = [] } = useQuery({
    queryKey: ['quiz-engine-courses'],
    queryFn: async () => {
      const { data } = await supabase.from('courses').select('id, name').eq('status', 'active').order('name');
      return data || [];
    },
  });

  // Load quiz banks
  const { data: banks = [], isLoading: banksLoading } = useQuery({
    queryKey: ['quiz-banks'],
    queryFn: async () => {
      const { data } = await (supabase.from('quiz_banks') as any)
        .select('*, course:courses(name)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Load sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ['quiz-sessions'],
    queryFn: async () => {
      const { data } = await (supabase.from('quiz_sessions') as any)
        .select('*, quiz_bank:quiz_banks(name, mode)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Load attempts
  const { data: attempts = [] } = useQuery({
    queryKey: ['quiz-attempts'],
    queryFn: async () => {
      const { data } = await (supabase.from('quiz_attempts') as any)
        .select('*, session:quiz_sessions(title, access_token)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const createBank = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      // 1. Create the bank record
      const { data: bank, error } = await (supabase.from('quiz_banks') as any).insert({
        name: form.name,
        description: form.description || null,
        language: form.language,
        course_id: form.course_id || null,
        mode: form.mode,
        question_mix: { mcq: form.mcq, tf: form.tf, fib: form.fib },
        difficulty_level: form.difficulty_level,
        questions_per_attempt: form.questions_per_attempt,
        time_limit_minutes: form.time_limit_minutes || null,
        max_attempts: form.max_attempts || 1,
        passing_percentage: form.passing_percentage,
        source_content: form.source_content,
        question_bank: [],
        created_by: user?.id,
        status: 'draft',
      }).select('id').single();

      if (error) throw error;

      // 2. Call AI to generate question bank
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/generate-quiz-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          quiz_bank_id: bank.id,
          source_content: form.source_content,
          language: form.language,
          difficulty_level: form.difficulty_level,
          question_mix: { mcq: form.mcq, tf: form.tf, fib: form.fib },
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Generation failed');
      return result;
    },
    onSuccess: (data) => {
      setGenerating(false);
      queryClient.invalidateQueries({ queryKey: ['quiz-banks'] });
      setCreateOpen(false);
      resetForm();
      toast({ title: 'Quiz Bank Created', description: `${data.count} questions generated by AI` });
    },
    onError: (e: any) => {
      setGenerating(false);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const createSession = useMutation({
    mutationFn: async (bankId: string) => {
      const bank = banks.find((b: any) => b.id === bankId);
      const { error } = await (supabase.from('quiz_sessions') as any).insert({
        quiz_bank_id: bankId,
        title: bank?.name || 'Quiz Session',
        status: 'live',
        created_by: user?.id,
      });
      if (error) throw error;
      // Also mark bank as published
      await (supabase.from('quiz_banks') as any).update({ status: 'published' }).eq('id', bankId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['quiz-banks'] });
      toast({ title: 'Session created & live!' });
    },
  });

  const toggleSession = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase.from('quiz_sessions') as any)
        .update({ status: status === 'live' ? 'closed' : 'live' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sessions'] });
      toast({ title: 'Session updated' });
    },
  });

  const deleteBank = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from('quiz_banks') as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-banks'] });
      toast({ title: 'Deleted' });
    },
  });

  const updateBank = useMutation({
    mutationFn: async () => {
      const { id, ...updates } = editForm;
      const { error } = await (supabase.from('quiz_banks') as any).update({
        name: updates.name,
        description: updates.description || null,
        language: updates.language,
        mode: updates.mode,
        course_id: updates.course_id || null,
        difficulty_level: updates.difficulty_level,
        questions_per_attempt: updates.questions_per_attempt,
        time_limit_minutes: updates.time_limit_minutes || null,
        max_attempts: updates.max_attempts || 1,
        passing_percentage: updates.passing_percentage,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-banks'] });
      setEditOpen(false);
      toast({ title: 'Quiz bank updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openEdit = (bank: any) => {
    setEditForm({
      id: bank.id,
      name: bank.name || '',
      description: bank.description || '',
      language: bank.language || 'en',
      mode: bank.mode || 'public',
      course_id: bank.course_id || '',
      difficulty_level: bank.difficulty_level || 'mixed',
      questions_per_attempt: bank.questions_per_attempt || 10,
      time_limit_minutes: bank.time_limit_minutes || 0,
      max_attempts: bank.max_attempts || 1,
      passing_percentage: bank.passing_percentage || 50,
    });
    setEditOpen(true);
  };

  const resetForm = () => {
    setForm({
      name: '', description: '', language: 'en', course_id: '', mode: 'public',
      mcq: 5, tf: 3, fib: 2, difficulty_level: 'mixed', questions_per_attempt: 10,
      time_limit_minutes: 0, max_attempts: 1, passing_percentage: 50, source_content: '',
    });
    setUploadedFiles([]);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/quiz/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!' });
  };

  const getQuestionCount = (bank: any) => {
    try { return Array.isArray(bank.question_bank) ? bank.question_bank.length : 0; } catch { return 0; }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Quiz Engine</h1>
            <p className="text-sm text-muted-foreground">AI-powered quiz banks for pre-screening & assessments</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Quiz Bank
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="banks" className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" /> Banks
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-1 text-xs">
              <LinkIcon className="h-3.5 w-3.5" /> Sessions
            </TabsTrigger>
            <TabsTrigger value="results" className="gap-1 text-xs">
              <Trophy className="h-3.5 w-3.5" /> Results
            </TabsTrigger>
          </TabsList>

          {/* Banks Tab */}
          <TabsContent value="banks" className="mt-4 space-y-3">
            {banksLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : banks.length === 0 ? (
              <Card><CardContent className="p-8 text-center">
                <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No quiz banks yet. Create one to get started.</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {banks.map((bank: any) => (
                  <Card key={bank.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-medium">{bank.name}</h4>
                            <Badge variant={bank.status === 'published' ? 'default' : 'secondary'} className="text-xs">{bank.status}</Badge>
                            <Badge variant="outline" className="text-xs gap-1">
                              {bank.mode === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                              {bank.mode}
                            </Badge>
                            {bank.course?.name && <Badge variant="outline" className="text-xs">{bank.course.name}</Badge>}
                          </div>
                          {bank.description && <p className="text-xs text-muted-foreground">{bank.description}</p>}
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>{getQuestionCount(bank)} questions</span>
                            <span>Lang: {bank.language}</span>
                            <span>{bank.questions_per_attempt}/attempt</span>
                            {bank.time_limit_minutes && <span>{bank.time_limit_minutes}min</span>}
                            <span>Pass: {bank.passing_percentage}%</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => createSession.mutate(bank.id)}
                            disabled={getQuestionCount(bank) === 0}>
                            <Play className="h-3 w-3 mr-1" /> Go Live
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                            onClick={() => openEdit(bank)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                            onClick={() => deleteBank.mutate(bank.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="mt-4 space-y-3">
            {sessions.length === 0 ? (
              <Card><CardContent className="p-8 text-center">
                <LinkIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No active sessions. Go Live on a quiz bank to create one.</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {sessions.map((s: any) => {
                  const sessionAttempts = attempts.filter((a: any) => a.session_id === s.id);
                  return (
                    <Card key={s.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium">{s.title || s.quiz_bank?.name}</h4>
                              <Badge variant={s.status === 'live' ? 'default' : 'secondary'} className="text-xs">
                                {s.status}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {s.quiz_bank?.mode === 'public' ? '🌐 Public' : '🔒 Auth'}
                              </Badge>
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span>{sessionAttempts.length} submissions</span>
                              <span>Created {format(new Date(s.created_at), 'MMM d, yyyy')}</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {s.quiz_bank?.mode === 'public' && (
                              <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
                                onClick={() => copyLink(s.access_token)}>
                                <Copy className="h-3 w-3" /> Copy Link
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-xs h-7"
                              onClick={() => toggleSession.mutate({ id: s.id, status: s.status })}>
                              {s.status === 'live' ? <><Square className="h-3 w-3 mr-1" /> Close</> : <><Play className="h-3 w-3 mr-1" /> Reopen</>}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="mt-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">All Results ({attempts.length})</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {attempts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No submissions yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Email</TableHead>
                          <TableHead className="text-xs">Quiz</TableHead>
                          <TableHead className="text-xs">Score</TableHead>
                          <TableHead className="text-xs">%</TableHead>
                          <TableHead className="text-xs">Time</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attempts.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-sm">{a.guest_name || a.student?.full_name || '-'}</TableCell>
                            <TableCell className="text-sm">{a.guest_email || a.student?.email || '-'}</TableCell>
                            <TableCell className="text-sm">{a.session?.title || '-'}</TableCell>
                            <TableCell className="text-sm">{a.score}/{a.max_score}</TableCell>
                            <TableCell>
                              <Badge variant={a.percentage >= 70 ? 'default' : a.percentage >= 50 ? 'secondary' : 'destructive'} className="text-xs">
                                {a.percentage}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {a.time_taken_seconds ? `${Math.floor(a.time_taken_seconds / 60)}m ${a.time_taken_seconds % 60}s` : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(a.created_at), 'MMM d, HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Quiz Bank Dialog */}
        <Dialog open={createOpen} onOpenChange={c => { if (!generating) { setCreateOpen(c); if (!c) resetForm(); } }}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Quiz Bank</DialogTitle>
              <DialogDescription>Upload source content and AI will generate a question bank.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Quiz Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Arabic Level 1 Pre-Screening" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Language</Label>
                  <Select value={form.language} onValueChange={v => setForm({ ...form, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ur">Urdu (اردو)</SelectItem>
                      <SelectItem value="ar">Arabic (العربية)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mode</Label>
                  <Select value={form.mode} onValueChange={(v: any) => setForm({ ...form, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">🌐 Public Link</SelectItem>
                      <SelectItem value="authenticated">🔒 Authenticated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Link to Course (optional)</Label>
                <Select value={form.course_id} onValueChange={v => setForm({ ...form, course_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                  <SelectContent>
                    {courses.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Number of Questions by Type</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-[10px] text-muted-foreground">MCQ</Label><Input type="number" min={0} value={form.mcq} onChange={e => setForm({ ...form, mcq: +e.target.value })} /></div>
                  <div><Label className="text-[10px] text-muted-foreground">True / False</Label><Input type="number" min={0} value={form.tf} onChange={e => setForm({ ...form, tf: +e.target.value })} /></div>
                  <div><Label className="text-[10px] text-muted-foreground">Fill in Blank</Label><Input type="number" min={0} value={form.fib} onChange={e => setForm({ ...form, fib: +e.target.value })} /></div>
                </div>
                <p className="text-[10px] text-muted-foreground">Total questions per quiz: <strong>{form.mcq + form.tf + form.fib}</strong></p>
              </div>
              <div>
                <Label className="text-xs">Difficulty Level</Label>
                <Select value={form.difficulty_level} onValueChange={(v: any) => setForm({ ...form, difficulty_level: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Time Limit (minutes)</Label>
                  <Input type="number" min={0} value={form.time_limit_minutes} onChange={e => setForm({ ...form, time_limit_minutes: +e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">0 = no timer</p>
                </div>
                <div>
                  <Label className="text-xs">Max Attempts</Label>
                  <Input type="number" min={1} value={form.max_attempts} onChange={e => setForm({ ...form, max_attempts: +e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Per email/student</p>
                </div>
                <div>
                  <Label className="text-xs">Passing %</Label>
                  <Input type="number" min={0} max={100} value={form.passing_percentage} onChange={e => setForm({ ...form, passing_percentage: +e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Source Content *</Label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-xs text-muted-foreground">
                    {extractingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload PDF / Text
                    <input type="file" multiple accept=".pdf,.txt,.md,.doc,.docx" className="hidden" onChange={handleFileUpload} disabled={extractingPdf} />
                  </label>
                  <span className="text-[10px] text-muted-foreground">Max 5 files, 50 pages each</span>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {uploadedFiles.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                        <FileText className="h-3 w-3" /> {f.name}
                        <button onClick={() => removeFile(i)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Textarea value={form.source_content} onChange={e => setForm({ ...form, source_content: e.target.value })}
                  placeholder="Upload PDFs above or paste text directly..."
                  className="min-h-[100px] text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }} disabled={generating}>Cancel</Button>
              <Button onClick={() => createBank.mutate()}
                disabled={!form.name.trim() || !form.source_content.trim() || generating}
                className="gap-1.5">
                {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : 'Create & Generate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Quiz Bank Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Quiz Bank</DialogTitle>
              <DialogDescription>Update quiz bank settings. Questions are not changed.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Quiz Name *</Label>
                <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Language</Label>
                  <Select value={editForm.language} onValueChange={v => setEditForm({ ...editForm, language: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ur">Urdu (اردو)</SelectItem>
                      <SelectItem value="ar">Arabic (العربية)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mode</Label>
                  <Select value={editForm.mode} onValueChange={v => setEditForm({ ...editForm, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">🌐 Public Link</SelectItem>
                      <SelectItem value="authenticated">🔒 Authenticated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Link to Course (optional)</Label>
                <Select value={editForm.course_id} onValueChange={v => setEditForm({ ...editForm, course_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                  <SelectContent>
                    {courses.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Difficulty Level</Label>
                <Select value={editForm.difficulty_level} onValueChange={v => setEditForm({ ...editForm, difficulty_level: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Questions per Attempt</Label>
                  <Input type="number" min={1} value={editForm.questions_per_attempt} onChange={e => setEditForm({ ...editForm, questions_per_attempt: +e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Time Limit (minutes)</Label>
                  <Input type="number" min={0} value={editForm.time_limit_minutes} onChange={e => setEditForm({ ...editForm, time_limit_minutes: +e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">0 = no timer</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Max Attempts Allowed</Label>
                  <Input type="number" min={1} value={editForm.max_attempts} onChange={e => setEditForm({ ...editForm, max_attempts: +e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Passing Percentage (%)</Label>
                  <Input type="number" min={0} max={100} value={editForm.passing_percentage} onChange={e => setEditForm({ ...editForm, passing_percentage: +e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={() => updateBank.mutate()} disabled={!editForm.name.trim()}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
